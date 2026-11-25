import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WorkspaceActions } from '../../lib/actions';
import { formatDateDDMMYYYY, formatINR, toNum } from '../../lib/finance';
import type { FamilyWorkspaceSnapshot } from '../../lib/types';

export const INCOME_CATEGORIES = [
  'Monthly salary',
  'Business income',
  'Freelance income',
  'Rental income',
  'Agricultural income',
  'Interest income',
  'Dividend income',
  'Pension',
  'Other income',
];

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Food',
  'Electricity',
  'Water',
  'Gas',
  'House rent',
  'Education',
  'Medical',
  'Transportation',
  'Fuel',
  'Mobile recharge',
  'Internet',
  'Insurance',
  'Shopping',
  'Entertainment',
  'Family functions',
  'Travel',
  'EMI',
  'Household maintenance',
  'Other expenses',
];

const PAYMENT_METHODS = ['UPI', 'BANK_TRANSFER', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER'];

export function IncomeView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [memberId, setMemberId] = useState<string>(String(snapshot.currentMember.id));
  const [accountId, setAccountId] = useState<string>(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');
  const [merchantOrSource, setMerchantOrSource] = useState('');
  const [transactionDate, setTransactionDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [status, setStatus] = useState<'COMPLETED' | 'PENDING'>('COMPLETED');
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const incomeRows = useMemo(
    () => snapshot.transactions.filter((t) => t.type === 'INCOME'),
    [snapshot.transactions],
  );
  const totalReceived = incomeRows
    .filter((t) => t.status === 'COMPLETED')
    .reduce((s, t) => s + toNum(t.amount), 0);
  const totalExpected = incomeRows
    .filter((t) => t.status === 'PENDING')
    .reduce((s, t) => s + toNum(t.amount), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    await actions.onAddTransaction({
      type: 'INCOME',
      category,
      amount: Number(amount),
      memberId: Number(memberId),
      accountId: accountId ? Number(accountId) : null,
      merchantOrSource,
      transactionDate,
      paymentMethod,
      status,
      isExpected: status === 'PENDING',
      isRecurring,
      recurringFrequency: isRecurring ? 'MONTHLY' : null,
      description,
    });
    setAmount('');
    setMerchantOrSource('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Received Income</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatINR(totalReceived)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Expected / Pending Income</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatINR(totalExpected)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Income Entries</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {incomeRows.length}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Record Family Income</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Amount (₹)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 45000"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Family Member</span>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {snapshot.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Receiving Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">No linked account</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Income Source</span>
            <input
              type="text"
              value={merchantOrSource}
              onChange={(e) => setMerchantOrSource(e.target.value)}
              placeholder="Employer / Client / Tenant"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Date</span>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Receipt Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'COMPLETED' | 'PENDING')}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="COMPLETED">Received</option>
              <option value="PENDING">Expected (Upcoming)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm w-64"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring monthly income
            </label>
          </div>
          <button
            type="submit"
            disabled={actions.isBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Save Income
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Category & Source</th>
              <th className="py-3 px-4 font-medium">Member</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Amount</th>
              <th className="py-3 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {incomeRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                  No income entries recorded yet.
                </td>
              </tr>
            ) : (
              incomeRows.map((row) => {
                const mem = snapshot.members.find((m) => m.id === row.memberId);
                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs">
                      {formatDateDDMMYYYY(row.transactionDate)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.category}</div>
                      <div className="text-xs text-slate-500">
                        {row.merchantOrSource || '—'} · {row.paymentMethod.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {mem?.name || 'Family'}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      <span className={row.status === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-amber-600 font-medium'}>
                        {row.status === 'COMPLETED' ? 'Received' : 'Expected'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      +{formatINR(row.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {confirmDeleteId === row.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await actions.onDeleteTransaction(row.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete income ${row.category}`}
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExpensesView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [memberId, setMemberId] = useState<string>(String(snapshot.currentMember.id));
  const [accountId, setAccountId] = useState<string>(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [merchantOrSource, setMerchantOrSource] = useState('');
  const [transactionDate, setTransactionDate] = useState(today);
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [gstTag, setGstTag] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const expenseRows = useMemo(
    () => snapshot.transactions.filter((t) => t.type === 'EXPENSE'),
    [snapshot.transactions],
  );

  const currentMonth = today.slice(0, 7);
  const monthTotal = expenseRows
    .filter((e) => e.transactionDate.startsWith(currentMonth))
    .reduce((s, e) => s + toNum(e.amount), 0);

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const weekTotal = expenseRows
    .filter((e) => e.transactionDate >= weekAgo)
    .reduce((s, e) => s + toNum(e.amount), 0);

  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenseRows) {
      map[e.category] = (map[e.category] || 0) + toNum(e.amount);
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${sorted[0][0]} (${formatINR(sorted[0][1])})` : '—';
  }, [expenseRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    await actions.onAddTransaction({
      type: 'EXPENSE',
      category,
      amount: Number(amount),
      memberId: Number(memberId),
      accountId: accountId ? Number(accountId) : null,
      paymentMethod,
      merchantOrSource,
      transactionDate,
      description,
      isRecurring,
      gstTag,
      status: 'COMPLETED',
    });
    setAmount('');
    setMerchantOrSource('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">7-Day Spending</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
            {formatINR(weekTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">This Month Expenses</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatINR(monthTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Highest Category</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {topCategory}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Household Expense (Manual Entry)
          </h3>
          <span className="text-xs text-slate-500">
            UPI & bank payments are recorded manually for accuracy and privacy
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Amount (₹)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1250"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Paid From Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">No linked account</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Family Member</span>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {snapshot.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Merchant / Payee</span>
            <input
              type="text"
              value={merchantOrSource}
              onChange={(e) => setMerchantOrSource(e.target.value)}
              placeholder="DMart / Kirana / Hospital"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Expense Date</span>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring monthly expense
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={gstTag}
                onChange={(e) => setGstTag(e.target.checked)}
              />
              GST-tagged expense
            </label>
          </div>
          <button
            type="submit"
            disabled={actions.isBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Save Expense
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Category & Merchant</th>
              <th className="py-3 px-4 font-medium">Method / Member</th>
              <th className="py-3 px-4 font-medium text-right">Amount</th>
              <th className="py-3 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenseRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                  No expenses logged yet.
                </td>
              </tr>
            ) : (
              expenseRows.map((row) => {
                const mem = snapshot.members.find((m) => m.id === row.memberId);
                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs">
                      {formatDateDDMMYYYY(row.transactionDate)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {row.category} {row.gstTag ? '· GST' : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.merchantOrSource || '—'} {row.description ? `· ${row.description}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {row.paymentMethod.replace(/_/g, ' ')} · {mem?.name || 'Family'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      −{formatINR(row.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {confirmDeleteId === row.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await actions.onDeleteTransaction(row.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete expense ${row.category}`}
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TransactionsView({ snapshot }: { snapshot: FamilyWorkspaceSnapshot }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (!q) return true;
      return (
        tx.category.toLowerCase().includes(q) ||
        (tx.merchantOrSource || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q)
      );
    });
  }, [snapshot.transactions, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search category, merchant, or notes..."
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm w-full sm:w-72"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="ALL">All Transaction Types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="TRANSFER">Internal Transfer</option>
          <option value="INVESTMENT_CONTRIBUTION">Investment Contribution</option>
          <option value="INVESTMENT_WITHDRAWAL">Investment Redemption</option>
          <option value="LOAN_REPAYMENT">Loan Repayment</option>
          <option value="GOAL_CONTRIBUTION">Goal Allocation</option>
          <option value="BALANCE_ADJUSTMENT">Reconciliation</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Type</th>
              <th className="py-3 px-4 font-medium">Category & Details</th>
              <th className="py-3 px-4 font-medium">Account</th>
              <th className="py-3 px-4 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                  No matching transactions found.
                </td>
              </tr>
            ) : (
              paged.map((tx) => {
                const src = snapshot.accounts.find((a) => a.id === tx.accountId);
                const dst = snapshot.accounts.find((a) => a.id === tx.toAccountId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs">
                      {formatDateDDMMYYYY(tx.transactionDate)}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {tx.type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{tx.category}</div>
                      <div className="text-xs text-slate-500">
                        {tx.merchantOrSource || tx.description || '—'}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {src?.name || '—'}
                      {dst ? ` → ${dst.name}` : ''}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        tx.type === 'INCOME' || tx.type === 'INVESTMENT_WITHDRAWAL'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : tx.type === 'TRANSFER'
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {formatINR(tx.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages} ({filtered.length} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState('SAVINGS');
  const [ownerMemberId, setOwnerMemberId] = useState(String(snapshot.currentMember.id));
  const [openingBalance, setOpeningBalance] = useState('');

  // Internal transfer state
  const [fromAcc, setFromAcc] = useState(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');
  const [toAcc, setToAcc] = useState(snapshot.accounts[1] ? String(snapshot.accounts[1].id) : '');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));

  // Reconciliation state
  const [reconcileId, setReconcileId] = useState<number | null>(null);
  const [actualBal, setActualBal] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await actions.onAddAccount({
      name: name.trim(),
      bankName: bankName.trim(),
      accountType,
      ownerMemberId: Number(ownerMemberId),
      openingBalance: Number(openingBalance || 0),
    });
    setName('');
    setBankName('');
    setOpeningBalance('');
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAcc || !toAcc || fromAcc === toAcc || Number(transferAmt) <= 0) return;
    await actions.onAddTransaction({
      type: 'TRANSFER',
      category: 'Internal Transfer',
      amount: Number(transferAmt),
      accountId: Number(fromAcc),
      toAccountId: Number(toAcc),
      paymentMethod: 'BANK_TRANSFER',
      transactionDate: transferDate,
      description: 'Internal family account transfer (neutral to income/expense)',
      status: 'COMPLETED',
    });
    setTransferAmt('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshot.accounts.map((acc) => {
          const owner = snapshot.members.find((m) => m.id === acc.ownerMemberId);
          return (
            <div
              key={acc.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{acc.name}</h4>
                    <p className="text-xs text-slate-500">
                      {acc.bankName || 'Cash / Wallet'} · {acc.accountType.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{owner?.name || 'Shared'}</span>
                </div>
                <p className="mt-3 text-2xl font-bold font-mono tabular-nums text-[#0F274A] dark:text-[#D4AF37]">
                  {formatINR(acc.currentBalance)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Opening: {formatINR(acc.openingBalance)} · Status: {acc.status}
                </p>
              </div>

              {reconcileId === acc.id ? (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <input
                    type="number"
                    step="0.01"
                    value={actualBal}
                    onChange={(e) => setActualBal(e.target.value)}
                    placeholder="Verified bank balance"
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={reconcileNote}
                    onChange={(e) => setReconcileNote(e.target.value)}
                    placeholder="Audit reason"
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await actions.onReconcileAccount(acc.id, Number(actualBal), reconcileNote);
                        setReconcileId(null);
                        setActualBal('');
                        setReconcileNote('');
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
                    >
                      Save Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => setReconcileId(null)}
                      className="px-3 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReconcileId(acc.id);
                    setActualBal(String(toNum(acc.currentBalance)));
                  }}
                  className="mt-3 text-left text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                >
                  Reconcile Balance
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddAccount}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Bank Account or Cash Wallet
          </h3>
          <p className="text-xs text-slate-500">
            Never store banking passwords, UPI PINs, ATM PINs, or OTPs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Account label (e.g. SBI Savings)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name (e.g. State Bank of India)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="SAVINGS">Savings Account</option>
              <option value="SALARY">Salary Account</option>
              <option value="JOINT">Joint Account</option>
              <option value="CURRENT">Current Account</option>
              <option value="CASH">Cash Wallet</option>
              <option value="FIXED_DEPOSIT">Fixed Deposit</option>
              <option value="RECURRING_DEPOSIT">Recurring Deposit</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="OTHER">Other Account</option>
            </select>
            <select
              value={ownerMemberId}
              onChange={(e) => setOwnerMemberId(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {snapshot.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="Opening balance (₹)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
            <button
              type="submit"
              disabled={actions.isBusy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90"
            >
              Add Account
            </button>
          </div>
        </form>

        <form
          onSubmit={handleTransfer}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Internal Account Transfer
          </h3>
          <p className="text-xs text-slate-500">
            Transfers move funds between family accounts without inflating income or expenses.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-slate-600 dark:text-slate-300">From Account</span>
              <select
                value={fromAcc}
                onChange={(e) => setFromAcc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {snapshot.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-slate-600 dark:text-slate-300">To Account</span>
              <select
                value={toAcc}
                onChange={(e) => setToAcc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {snapshot.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              aria-label="Transfer amount in rupees"
              value={transferAmt}
              onChange={(e) => setTransferAmt(e.target.value)}
              placeholder="Amount (₹)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
            <input
              type="date"
              required
              aria-label="Transfer date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={actions.isBusy || snapshot.accounts.length < 2}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90 disabled:opacity-40"
          >
            Record Internal Transfer
          </button>
        </form>
      </div>
    </div>
  );
}
