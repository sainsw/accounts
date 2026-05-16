'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { formatCurrency, getYearRange, getFinancialYear, generateId, todayString } from '@/lib/utils';
import { calculateMileageAllowance, calculateWorkingFromHomeAllowance } from '@/lib/simplified-expenses';
import { exportMileageCSV, downloadCsv } from '@/lib/export';
import type { MileageEntry, VehicleType, WfhEntry } from '@/lib/types';

type MileageForm = {
  date: string;
  description: string;
  from: string;
  to: string;
  miles: string;
  vehicleType: VehicleType;
};

type WfhForm = {
  month: string;
  hoursPerMonth: string;
};

const emptyMileageForm: MileageForm = { date: todayString(), description: '', from: '', to: '', miles: '', vehicleType: 'car' };
const emptyWfhForm: WfhForm = { month: new Date().toISOString().slice(0, 7), hoursPerMonth: '' };

export default function ExpensesPage() {
  const { settings, mileageEntries, addMileageEntry, updateMileageEntry, deleteMileageEntry, wfhEntries, addWfhEntry, updateWfhEntry, deleteWfhEntry, addTransaction } = useApp();
  const [tab, setTab] = useState<'mileage' | 'wfh'>('mileage');
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [showWfhModal, setShowWfhModal] = useState(false);
  const [editingMileage, setEditingMileage] = useState<MileageEntry | null>(null);
  const [editingWfh, setEditingWfh] = useState<WfhEntry | null>(null);
  const [mileageForm, setMileageForm] = useState<MileageForm>(emptyMileageForm);
  const [wfhForm, setWfhForm] = useState<WfhForm>(emptyWfhForm);
  const [selectedYear, setSelectedYear] = useState(() => getFinancialYear(todayString(), settings.taxYear));

  const sym = settings.currencySymbol || '£';
  const yearRange = getYearRange(selectedYear, settings.taxYear);

  const yearMileage = useMemo(() =>
    mileageEntries.filter((e) => e.date >= yearRange.start && e.date <= yearRange.end)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [mileageEntries, yearRange]
  );

  const yearWfh = useMemo(() =>
    wfhEntries.filter((e) => e.month + '-01' >= yearRange.start && e.month + '-01' <= yearRange.end)
      .sort((a, b) => b.month.localeCompare(a.month)),
    [wfhEntries, yearRange]
  );

  const totalMiles = yearMileage.reduce((s, e) => s + e.miles, 0);
  const totalMileageAllowance = yearMileage.reduce((s, e) => s + e.allowance, 0);
  const totalWfhAllowance = yearWfh.reduce((s, e) => s + e.allowance, 0);

  function handleSaveMileage() {
    const miles = parseFloat(mileageForm.miles) || 0;
    if (miles <= 0) return;

    const previousMiles = yearMileage
      .filter((e) => editingMileage ? e.id !== editingMileage.id : true)
      .filter((e) => e.date <= mileageForm.date)
      .reduce((s, e) => e.vehicleType === mileageForm.vehicleType ? s + e.miles : s, 0);

    const allowance = calculateMileageAllowance(miles, mileageForm.vehicleType, previousMiles);

    if (editingMileage) {
      updateMileageEntry({ ...editingMileage, ...mileageForm, miles, allowance });
    } else {
      addMileageEntry({ ...mileageForm, miles, allowance, transactionId: null });
    }
    setShowMileageModal(false);
    setEditingMileage(null);
    setMileageForm(emptyMileageForm);
  }

  function handleSaveWfh() {
    const hours = parseFloat(wfhForm.hoursPerMonth) || 0;
    if (hours <= 0) return;

    const allowance = calculateWorkingFromHomeAllowance(hours);

    if (editingWfh) {
      updateWfhEntry({ ...editingWfh, month: wfhForm.month, hoursPerMonth: hours, allowance });
    } else {
      addWfhEntry({ month: wfhForm.month, hoursPerMonth: hours, allowance, transactionId: null });
    }
    setShowWfhModal(false);
    setEditingWfh(null);
    setWfhForm(emptyWfhForm);
  }

  function createMileageTransaction(entry: MileageEntry) {
    addTransaction({
      date: entry.date,
      type: 'cost',
      amount: entry.allowance,
      description: `Mileage: ${entry.description || entry.from + ' to ' + entry.to} (${entry.miles} miles)`,
      category: 'Vehicle / Mileage',
      clientId: null,
      invoiceId: null,
      projectId: null,
      notes: `${entry.vehicleType}, ${entry.miles} miles`,
      vatRate: null,
      vatAmount: 0,
      taxDeductible: true,
      attachments: [],
      currency: null,
      exchangeRate: null,
      originalAmount: null,
      recurrence: null,
      reconciliationStatus: 'unreconciled',
      importedFrom: null,
    });
    updateMileageEntry({ ...entry, transactionId: 'created' });
  }

  function createWfhTransaction(entry: WfhEntry) {
    addTransaction({
      date: entry.month + '-28',
      type: 'cost',
      amount: entry.allowance,
      description: `Working from home allowance: ${entry.month}`,
      category: 'Use of Home',
      clientId: null,
      invoiceId: null,
      projectId: null,
      notes: `${entry.hoursPerMonth} hours/month`,
      vatRate: null,
      vatAmount: 0,
      taxDeductible: true,
      attachments: [],
      currency: null,
      exchangeRate: null,
      originalAmount: null,
      recurrence: null,
      reconciliationStatus: 'unreconciled',
      importedFrom: null,
    });
    updateWfhEntry({ ...entry, transactionId: 'created' });
  }

  return (
    <>
      <PageHeader title="Simplified Expenses" description="Mileage allowance and working from home claims" />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatCard label="Total Miles" value={totalMiles.toLocaleString()} color="blue" />
        <StatCard label="Mileage Allowance" value={formatCurrency(totalMileageAllowance, sym)} color="green" />
        <StatCard label="WFH Allowance" value={formatCurrency(totalWfhAllowance, sym)} color="green" />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
          <button onClick={() => setTab('mileage')} className={`px-4 py-2 text-sm font-medium rounded-l-lg ${tab === 'mileage' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
            Mileage
          </button>
          <button onClick={() => setTab('wfh')} className={`px-4 py-2 text-sm font-medium rounded-r-lg ${tab === 'wfh' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>
            Working From Home
          </button>
        </div>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          {Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i).map((y) => (
            <option key={y} value={y}>{y}{settings.taxYear !== 'calendar' ? `/${(y + 1).toString().slice(2)}` : ''}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          {tab === 'mileage' && yearMileage.length > 0 && (
            <button
              onClick={() => {
                const csv = exportMileageCSV(yearMileage);
                downloadCsv(csv, `mileage-${selectedYear}.csv`);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              if (tab === 'mileage') { setMileageForm(emptyMileageForm); setEditingMileage(null); setShowMileageModal(true); }
              else { setWfhForm(emptyWfhForm); setEditingWfh(null); setShowWfhModal(true); }
            }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Add {tab === 'mileage' ? 'Journey' : 'Month'}
          </button>
        </div>
      </div>

      {tab === 'mileage' && (
        <Card>
          {yearMileage.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No mileage entries this year. Add a journey to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">From / To</th>
                    <th className="pb-2 font-medium text-right">Miles</th>
                    <th className="pb-2 font-medium">Vehicle</th>
                    <th className="pb-2 font-medium text-right">Allowance</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {yearMileage.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 text-slate-700 dark:text-slate-300">{entry.date}</td>
                      <td className="py-2 text-slate-900 dark:text-slate-100">{entry.description}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{entry.from} → {entry.to}</td>
                      <td className="py-2 text-right text-slate-900 dark:text-slate-100">{entry.miles}</td>
                      <td className="py-2 capitalize text-slate-600 dark:text-slate-400">{entry.vehicleType}</td>
                      <td className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.allowance, sym)}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!entry.transactionId && (
                            <button onClick={() => createMileageTransaction(entry)} className="rounded px-2 py-1 text-xs text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10">
                              Claim
                            </button>
                          )}
                          <button onClick={() => { setEditingMileage(entry); setMileageForm({ date: entry.date, description: entry.description, from: entry.from, to: entry.to, miles: String(entry.miles), vehicleType: entry.vehicleType }); setShowMileageModal(true); }} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                            Edit
                          </button>
                          <button onClick={() => deleteMileageEntry(entry.id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                    <td colSpan={3} className="pt-2 text-slate-700 dark:text-slate-300">Total</td>
                    <td className="pt-2 text-right text-slate-900 dark:text-slate-100">{totalMiles}</td>
                    <td></td>
                    <td className="pt-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totalMileageAllowance, sym)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'wfh' && (
        <Card>
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            HMRC simplified expenses: 25-50 hrs/month = £10, 51-100 hrs = £18, 101+ hrs = £26 per month.
          </div>
          {yearWfh.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No WFH claims this year. Add a month to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">Month</th>
                    <th className="pb-2 font-medium text-right">Hours/Month</th>
                    <th className="pb-2 font-medium text-right">Monthly Allowance</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {yearWfh.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 text-slate-900 dark:text-slate-100">{entry.month}</td>
                      <td className="py-2 text-right text-slate-700 dark:text-slate-300">{entry.hoursPerMonth}</td>
                      <td className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.allowance, sym)}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!entry.transactionId && (
                            <button onClick={() => createWfhTransaction(entry)} className="rounded px-2 py-1 text-xs text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10">
                              Claim
                            </button>
                          )}
                          <button onClick={() => { setEditingWfh(entry); setWfhForm({ month: entry.month, hoursPerMonth: String(entry.hoursPerMonth) }); setShowWfhModal(true); }} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                            Edit
                          </button>
                          <button onClick={() => deleteWfhEntry(entry.id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                    <td className="pt-2 text-slate-700 dark:text-slate-300">Total</td>
                    <td></td>
                    <td className="pt-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totalWfhAllowance, sym)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Mileage Modal */}
      {showMileageModal && (
        <Modal open={showMileageModal} title={editingMileage ? 'Edit Journey' : 'Add Journey'} onClose={() => setShowMileageModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Date</label>
              <input type="date" value={mileageForm.date} onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Purpose / Description</label>
              <input type="text" value={mileageForm.description} onChange={(e) => setMileageForm({ ...mileageForm, description: e.target.value })} placeholder="e.g. Client meeting" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">From</label>
                <input type="text" value={mileageForm.from} onChange={(e) => setMileageForm({ ...mileageForm, from: e.target.value })} placeholder="Start location" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">To</label>
                <input type="text" value={mileageForm.to} onChange={(e) => setMileageForm({ ...mileageForm, to: e.target.value })} placeholder="End location" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Miles</label>
                <input type="number" step="0.1" value={mileageForm.miles} onChange={(e) => setMileageForm({ ...mileageForm, miles: e.target.value })} placeholder="0" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Vehicle</label>
                <select value={mileageForm.vehicleType} onChange={(e) => setMileageForm({ ...mileageForm, vehicleType: e.target.value as VehicleType })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="car">Car (45p/25p)</option>
                  <option value="motorcycle">Motorcycle (24p)</option>
                  <option value="bicycle">Bicycle (20p)</option>
                </select>
              </div>
            </div>
            {mileageForm.miles && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Allowance: {formatCurrency(calculateMileageAllowance(parseFloat(mileageForm.miles) || 0, mileageForm.vehicleType, yearMileage.filter((e) => editingMileage ? e.id !== editingMileage.id : true).filter((e) => e.vehicleType === mileageForm.vehicleType).reduce((s, e) => s + e.miles, 0)), sym)}
              </div>
            )}
            <button onClick={handleSaveMileage} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              {editingMileage ? 'Update' : 'Add'} Journey
            </button>
          </div>
        </Modal>
      )}

      {/* WFH Modal */}
      {showWfhModal && (
        <Modal open={showWfhModal} title={editingWfh ? 'Edit WFH Month' : 'Add WFH Month'} onClose={() => setShowWfhModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Month</label>
              <input type="month" value={wfhForm.month} onChange={(e) => setWfhForm({ ...wfhForm, month: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Hours per month working from home</label>
              <select value={wfhForm.hoursPerMonth} onChange={(e) => setWfhForm({ ...wfhForm, hoursPerMonth: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Select bracket...</option>
                <option value="30">25-50 hours (£10/month)</option>
                <option value="75">51-100 hours (£18/month)</option>
                <option value="120">101+ hours (£26/month)</option>
              </select>
            </div>
            {wfhForm.hoursPerMonth && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Monthly allowance: {formatCurrency(calculateWorkingFromHomeAllowance(parseFloat(wfhForm.hoursPerMonth) || 0), '£')}
              </div>
            )}
            <button onClick={handleSaveWfh} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              {editingWfh ? 'Update' : 'Add'} Month
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
