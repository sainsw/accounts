'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader } from '@/components/Card';
import { formatCurrency, formatDate, getFinancialYear, getYearRange, isInRange, todayString } from '@/lib/utils';
import { calculateUKTax, calculateFlatTax } from '@/lib/tax';

type TaxEvent = {
  date: string;
  label: string;
  description: string;
  estimatedAmount: number | null;
  urgency: 'normal' | 'soon' | 'overdue';
};

export default function TaxCalendarPage() {
  const { settings, transactions } = useApp();
  const sym = settings.currencySymbol || '£';
  const today = todayString();
  const currentYear = getFinancialYear(today, settings.taxYear);
  const yearRange = getYearRange(currentYear, settings.taxYear);

  const taxEstimate = useMemo(() => {
    const yearTx = transactions.filter((t) => isInRange(t.date, yearRange.start, yearRange.end));
    const income = yearTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const costs = yearTx.filter((t) => t.type === 'cost' && t.taxDeductible !== false).reduce((s, t) => s + t.amount, 0);
    const net = income - costs;

    if (settings.taxMode === 'uk-sole-trader') {
      return calculateUKTax(net, {
        year: currentYear,
        grossIncome: income,
        allowableCosts: costs,
        voluntaryClass2NI: settings.voluntaryClass2NI,
        studentLoanPlan: settings.studentLoanPlan,
      });
    }
    return calculateFlatTax(net, settings.taxRate);
  }, [transactions, yearRange, settings, currentYear]);

  const events = useMemo(() => {
    const items: TaxEvent[] = [];
    const yr = currentYear;

    // Self Assessment filing deadline
    items.push({
      date: `${yr + 1}-01-31`,
      label: 'Self Assessment Filing Deadline',
      description: `File your ${yr}/${(yr + 1).toString().slice(2)} tax return online`,
      estimatedAmount: null,
      urgency: getUrgency(`${yr + 1}-01-31`, today),
    });

    // Payment on account 1 (31 Jan)
    if (taxEstimate.paymentsOnAccount?.applies) {
      items.push({
        date: `${yr + 1}-01-31`,
        label: '1st Payment on Account',
        description: `First payment on account for ${yr}/${(yr + 1).toString().slice(2)}`,
        estimatedAmount: taxEstimate.paymentsOnAccount.firstPayment,
        urgency: getUrgency(`${yr + 1}-01-31`, today),
      });

      // Payment on account 2 (31 Jul)
      items.push({
        date: `${yr + 1}-07-31`,
        label: '2nd Payment on Account',
        description: `Second payment on account for ${yr}/${(yr + 1).toString().slice(2)}`,
        estimatedAmount: taxEstimate.paymentsOnAccount.secondPayment,
        urgency: getUrgency(`${yr + 1}-07-31`, today),
      });
    }

    // Balancing payment
    items.push({
      date: `${yr + 1}-01-31`,
      label: 'Balancing Payment',
      description: 'Pay remaining tax owed (or receive refund)',
      estimatedAmount: taxEstimate.totalTax - (taxEstimate.paymentsOnAccount?.applies ? taxEstimate.paymentsOnAccount.firstPayment + taxEstimate.paymentsOnAccount.secondPayment : 0),
      urgency: getUrgency(`${yr + 1}-01-31`, today),
    });

    // VAT deadlines
    if (settings.vatRegistered) {
      const vatQuarters = [
        { end: `${yr}-03-31`, due: `${yr}-05-07` },
        { end: `${yr}-06-30`, due: `${yr}-08-07` },
        { end: `${yr}-09-30`, due: `${yr}-11-07` },
        { end: `${yr}-12-31`, due: `${yr + 1}-02-07` },
      ];
      for (const q of vatQuarters) {
        items.push({
          date: q.due,
          label: `VAT Return Due`,
          description: `Quarter ending ${formatDate(q.end, settings.locale)}`,
          estimatedAmount: null,
          urgency: getUrgency(q.due, today),
        });
      }
    }

    // Class 2 NI
    if (settings.taxMode === 'uk-sole-trader') {
      items.push({
        date: `${yr + 1}-01-31`,
        label: 'Class 2 NI Due',
        description: `Annual Class 2 National Insurance for ${yr}/${(yr + 1).toString().slice(2)}`,
        estimatedAmount: taxEstimate.class2NI,
        urgency: getUrgency(`${yr + 1}-01-31`, today),
      });
    }

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [currentYear, taxEstimate, settings, today]);

  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);

  return (
    <>
      <PageHeader title="Tax Calendar" description="Upcoming deadlines and estimated payments" />

      {upcoming.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming Deadlines</h2>
          <div className="space-y-3">
            {upcoming.map((event, i) => {
              const daysUntil = Math.ceil((new Date(event.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={i} className={`flex items-center justify-between rounded-lg border p-3 ${
                  event.urgency === 'overdue' ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/5' :
                  event.urgency === 'soon' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5' :
                  'border-slate-200 dark:border-slate-700'
                }`}>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.label}</p>
                    <p className="text-xs text-slate-500">{event.description}</p>
                    <p className={`text-xs font-medium mt-1 ${
                      event.urgency === 'overdue' ? 'text-red-600' :
                      event.urgency === 'soon' ? 'text-amber-600' :
                      'text-slate-400'
                    }`}>
                      {formatDate(event.date, settings.locale)} — {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                    </p>
                  </div>
                  {event.estimatedAmount !== null && event.estimatedAmount > 0 && (
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      ~{formatCurrency(event.estimatedAmount, sym)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Past Deadlines</h2>
          <div className="space-y-2 opacity-60">
            {past.map((event, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{event.label}</p>
                  <p className="text-xs text-slate-400">{formatDate(event.date, settings.locale)}</p>
                </div>
                {event.estimatedAmount !== null && event.estimatedAmount > 0 && (
                  <span className="text-xs text-slate-500">{formatCurrency(event.estimatedAmount, sym)}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function getUrgency(deadline: string, today: string): 'normal' | 'soon' | 'overdue' {
  if (deadline < today) return 'overdue';
  const daysUntil = Math.ceil((new Date(deadline).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) return 'soon';
  return 'normal';
}
