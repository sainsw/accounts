export type ParsedBankEntry = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
};

export function parseOFX(content: string): ParsedBankEntry[] {
  const entries: ParsedBankEntry[] = [];
  const txnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

  let match: RegExpExecArray | null;
  while ((match = txnRegex.exec(content)) !== null) {
    try {
      const block = match[1];
      const dateRaw = extractTag(block, "DTPOSTED");
      const amount = extractTag(block, "TRNAMT");
      const name = extractTag(block, "NAME");
      const memo = extractTag(block, "MEMO");
      const fitid = extractTag(block, "FITID");

      if (!dateRaw || !amount) continue;

      const date = parseOFXDate(dateRaw);
      if (!date) continue;

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) continue;

      const description = [name, memo].filter(Boolean).join(" - ") || "Unknown";

      entries.push({
        date,
        description: description.trim(),
        amount: parsedAmount,
        ...(fitid ? { reference: fitid } : {}),
      });
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

function extractTag(block: string, tag: string): string | null {
  // OFX tags can be self-closing (no end tag) or have an end tag
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const match = regex.exec(block);
  return match ? match[1].trim() : null;
}

function parseOFXDate(raw: string): string | null {
  // Format: YYYYMMDD or YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.XXX[timezone]
  const cleaned = raw.replace(/\[.*\]/, "").trim();
  if (cleaned.length < 8) return null;

  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}

export function parseQIF(content: string): ParsedBankEntry[] {
  const entries: ParsedBankEntry[] = [];
  // Split on ^ which separates transactions
  const blocks = content.split("^");

  for (const block of blocks) {
    try {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      let date: string | null = null;
      let amount: number | null = null;
      let payee = "";
      let memo = "";
      let checkNum = "";

      for (const line of lines) {
        const code = line[0];
        const value = line.slice(1).trim();

        switch (code) {
          case "D":
            date = parseQIFDate(value);
            break;
          case "T":
          case "U":
            amount = parseFloat(value.replace(/,/g, ""));
            break;
          case "P":
            payee = value;
            break;
          case "M":
            memo = value;
            break;
          case "N":
            checkNum = value;
            break;
        }
      }

      if (!date || amount === null || isNaN(amount)) continue;

      const description = [payee, memo].filter(Boolean).join(" - ") || "Unknown";

      entries.push({
        date,
        description: description.trim(),
        amount,
        ...(checkNum ? { reference: checkNum } : {}),
      });
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

function parseQIFDate(raw: string): string | null {
  // Common formats: MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY, DD-MM-YYYY
  // Also handles MM/DD'YY and M/D/YY variants
  const cleaned = raw.replace(/'/g, "/").replace(/-/g, "/");
  const parts = cleaned.split("/");

  if (parts.length !== 3) return null;

  let a = parseInt(parts[0], 10);
  let b = parseInt(parts[1], 10);
  let c = parseInt(parts[2], 10);

  if (isNaN(a) || isNaN(b) || isNaN(c)) return null;

  // Handle 2-digit year
  if (c < 100) {
    c += c < 50 ? 2000 : 1900;
  }

  // Determine if MM/DD/YYYY or DD/MM/YYYY
  // If first value > 12, it must be day (DD/MM/YYYY)
  // If second value > 12, it must be day (MM/DD/YYYY)
  // Default to MM/DD/YYYY (US format, most common in QIF)
  let month: number;
  let day: number;

  if (a > 12 && b <= 12) {
    // DD/MM/YYYY
    day = a;
    month = b;
  } else {
    // MM/DD/YYYY (default)
    month = a;
    day = b;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const yyyy = String(c);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export function detectFormat(content: string): "ofx" | "qif" | "csv" | "unknown" {
  const sample = content.slice(0, 500).toUpperCase();

  // OFX detection: look for OFX/SGML markers
  if (
    sample.includes("<OFX") ||
    sample.includes("OFXHEADER") ||
    sample.includes("<STMTTRN>") ||
    sample.includes("<BANKTRANLIST")
  ) {
    return "ofx";
  }

  // QIF detection: starts with !Type: or has typical QIF line patterns
  const trimmed = content.trim();
  if (
    trimmed.toUpperCase().startsWith("!TYPE:") ||
    /^[DTPMNL^]/m.test(trimmed.slice(0, 200))
  ) {
    // Further verify QIF by checking for ^ separator and D/T lines
    if (trimmed.includes("^") && /^D[\d/'-]/m.test(trimmed.slice(0, 500))) {
      return "qif";
    }
    if (trimmed.toUpperCase().startsWith("!TYPE:")) {
      return "qif";
    }
  }

  // CSV detection: check for comma-separated lines with consistent column count
  const lines = trimmed.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (lines.length >= 2) {
    const commaCountFirst = (lines[0].match(/,/g) || []).length;
    if (commaCountFirst >= 2) {
      const commaCountSecond = (lines[1].match(/,/g) || []).length;
      if (commaCountFirst === commaCountSecond) {
        return "csv";
      }
    }
  }

  return "unknown";
}
