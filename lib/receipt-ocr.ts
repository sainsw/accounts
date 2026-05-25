export type OcrResult = {
  totalAmount: number | null;
  date: string | null;
  vendor: string | null;
  vatAmount: number | null;
  confidence: {
    totalAmount: number;
    date: number;
    vendor: number;
    vatAmount: number;
  };
  rawText: string;
};

export type OcrProgress = {
  status: 'loading' | 'downloading' | 'initialising' | 'processing' | 'extracting';
  label: string;
};

// ── Tesseract (default) ─────────────────────────────────────────────

let tesseractWorker: unknown = null;

async function getWorker() {
  if (tesseractWorker) return tesseractWorker;

  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  tesseractWorker = worker;
  return worker;
}

async function recognizeWithTesseract(
  imageData: string | File,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  onProgress?.({ status: 'loading', label: 'Starting OCR engine...' });
  const worker = await getWorker() as { recognize: (img: string | File) => Promise<{ data: { text: string } }> };
  onProgress?.({ status: 'processing', label: 'Reading receipt...' });
  const { data: { text } } = await worker.recognize(imageData);
  onProgress?.({ status: 'extracting', label: 'Extracting details...' });
  return parseReceiptText(text);
}

// ── Florence-2 (experimental) ───────────────────────────────────────

const MODEL_ID = 'onnx-community/Florence-2-base-ft';

type ModelBundle = { model: any; processor: any; tokenizer: any };

let cached: ModelBundle | null = null;
let loading: Promise<ModelBundle> | null = null;

async function getModel(onProgress?: (p: OcrProgress) => void) {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const {
      Florence2ForConditionalGeneration,
      AutoProcessor,
      AutoTokenizer,
    } = await import('@huggingface/transformers');

    onProgress?.({ status: 'downloading', label: 'Downloading vision model...' });

    const [model, processor, tokenizer] = await Promise.all([
      Florence2ForConditionalGeneration.from_pretrained(MODEL_ID, {
        dtype: {
          embed_tokens: 'fp32',
          vision_encoder: 'fp32',
          encoder_model: 'fp32',
          decoder_model_merged: 'q4',
        },
        progress_callback: (p: any) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            const pct = Math.round(p.progress);
            onProgress?.({ status: 'downloading', label: `Downloading vision model... ${pct}%` });
          }
        },
      }),
      AutoProcessor.from_pretrained(MODEL_ID),
      AutoTokenizer.from_pretrained(MODEL_ID),
    ]);

    cached = { model, processor, tokenizer };
    return cached;
  })();

  loading.catch(() => { loading = null; });
  return loading!;
}

async function recognizeWithFlorence(
  imageData: string | File,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const { RawImage } = await import('@huggingface/transformers');
  const bundle = await getModel(onProgress);
  const { model, processor, tokenizer } = bundle;

  onProgress?.({ status: 'initialising', label: 'Warming up model...' });

  const image = imageData instanceof File
    ? await RawImage.fromBlob(imageData)
    : await RawImage.read(imageData);

  onProgress?.({ status: 'processing', label: 'Analysing receipt...' });

  const task = '<OCR>';
  const inputs = await processor(image, task);

  const generatedIds = await model.generate({
    ...inputs,
    max_new_tokens: 1024,
  });

  onProgress?.({ status: 'extracting', label: 'Extracting text...' });

  const generatedText = tokenizer.batch_decode(generatedIds, {
    skip_special_tokens: false,
  })[0];

  const result = processor.post_process_generation(
    generatedText,
    task,
    image.size,
  );

  const text: string = result[task] ?? generatedText;
  return parseReceiptText(text);
}

// ── Public API ──────────────────────────────────────────────────────

export async function recognizeReceipt(
  imageData: string | File,
  options?: {
    experimental?: boolean;
    onProgress?: (p: OcrProgress) => void;
  },
): Promise<OcrResult> {
  const { experimental = false, onProgress } = options ?? {};
  if (experimental) {
    return recognizeWithFlorence(imageData, onProgress);
  }
  return recognizeWithTesseract(imageData, onProgress);
}

// ── Text parsing ────────────────────────────────────────────────────

/**
 * Florence-2 OCR often returns text as a single continuous string rather than
 * line-by-line. We normalise by splitting on multiple spaces, common receipt
 * delimiters, and newlines to produce "lines" the extraction logic can work with.
 */
function normaliseOcrText(raw: string): string[] {
  let lines = raw.split('\n');

  // If we got very few lines, the text is probably one long string —
  // split on runs of 2+ spaces which often separate receipt fields
  if (lines.length <= 3) {
    lines = raw.split(/\s{2,}|\n/);
  }

  return lines.map((l) => l.trim()).filter((l) => l.length > 0);
}

export function parseReceiptText(text: string): OcrResult {
  const result: OcrResult = {
    totalAmount: null,
    date: null,
    vendor: null,
    vatAmount: null,
    confidence: { totalAmount: 0, date: 0, vendor: 0, vatAmount: 0 },
    rawText: text,
  };

  const lines = normaliseOcrText(text);
  if (lines.length === 0) return result;

  // --- Vendor ---
  const skipWords = /total|subtotal|vat|tax|change|card|cash|visa|mastercard|payment|balance|due|tendered|receipt|order|thank/i;
  const looksLikePrice = /^[£$€]?\s*\d+\.\d{2}$/;
  const looksLikeDate = /^\d{1,2}[\/\-.]?\d{1,2}[\/\-.]?\d{2,4}$/;

  for (const line of lines) {
    if (
      line.length > 2 &&
      !/^\d/.test(line) &&
      !skipWords.test(line) &&
      !looksLikePrice.test(line) &&
      !looksLikeDate.test(line)
    ) {
      result.vendor = line.slice(0, 50);
      result.confidence.vendor = 0.6;
      break;
    }
  }

  // --- Total amount ---
  const totalPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total)\s*[:\s£$€]?\s*([\d,]+\.?\d*)/i,
    /(?:total|amount)\s*[:]\s*[£$€]?\s*([\d,]+\.?\d*)/i,
    /[£$€]\s*([\d,]+\.\d{2})\s*$/im,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val > 0 && val < 100000) {
        result.totalAmount = val;
        result.confidence.totalAmount = 0.7;
        break;
      }
    }
  }

  if (!result.totalAmount) {
    const amounts = text.match(/[£$€]?\s*(\d+\.\d{2})/g);
    if (amounts) {
      const values = amounts.map((a) => parseFloat(a.replace(/[^0-9.]/g, '')));
      const max = Math.max(...values);
      if (max > 0) {
        result.totalAmount = max;
        result.confidence.totalAmount = 0.3;
      }
    }
  }

  // --- VAT ---
  const vatPattern = /(?:vat|tax)\s*[:\s£$€]?\s*([\d,]+\.?\d*)/i;
  const vatMatch = text.match(vatPattern);
  if (vatMatch) {
    const val = parseFloat(vatMatch[1].replace(/,/g, ''));
    if (val > 0) {
      result.vatAmount = val;
      result.confidence.vatAmount = 0.7;
    }
  }

  // --- Date ---
  const datePatterns = [
    { regex: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/, format: 'dmy' },
    { regex: /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/, format: 'ymd' },
    { regex: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i, format: 'dMy' },
  ];

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  for (const { regex, format } of datePatterns) {
    const match = text.match(regex);
    if (match) {
      let dateStr = '';
      if (format === 'dmy') {
        dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      } else if (format === 'ymd') {
        dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else if (format === 'dMy') {
        const m = months[match[2].toLowerCase().slice(0, 3)];
        dateStr = `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
      }

      const d = new Date(dateStr);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
        result.date = dateStr;
        result.confidence.date = 0.7;
        break;
      }
    }
  }

  return result;
}
