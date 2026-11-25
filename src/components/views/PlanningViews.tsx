import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WorkspaceActions } from '../../lib/actions';
import {
  computeBudgetUtilization,
  computeCashFlowSummary,
  computeEmergencyFundSummary,
  formatDateDDMMYYYY,
  formatINR,
  toNum,
} from '../../lib/finance';
import type { FamilyWorkspaceSnapshot, Role } from '../../lib/types';
import { EXPENSE_CATEGORIES } from './LedgerViews';

export function FamilyView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [role, setRole] = useState<Role>('MEMBER');
  const [ageGroup, setAgeGroup] = useState<'ADULT' | 'MINOR'>('ADULT');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [responsibilities, setResponsibilities] = useState('');

  const canManage = snapshot.currentMember.role === 'OWNER' || snapshot.currentMember.role === 'ADMIN';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await actions.onAddMember({
      name: name.trim(),
      relationship,
      role: ageGroup === 'MINOR' ? 'READ_ONLY' : role,
      ageGroup,
      invitedEmail: invitedEmail.trim() || null,
      responsibilities: responsibilities.trim() || null,
      canAddTransactions: ageGroup !== 'MINOR' && role !== 'READ_ONLY',
      canManageBudgets: ageGroup !== 'MINOR' && (role === 'OWNER' || role === 'ADMIN'),
      canViewInvestments: ageGroup !== 'MINOR',
    });
    setName('');
    setInvitedEmail('');
    setResponsibilities('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshot.members.map((m) => {
          const memberFlow = computeCashFlowSummary(snapshot.transactions, undefined, m.id);
          return (
            <div
              key={m.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</h4>
                  <p className="text-xs text-slate-500">
                    {m.relationship} · {m.role.replace(/_/g, ' ')} · {m.ageGroup === 'MINOR' ? 'Child Account' : 'Adult'}
                  </p>
                </div>
                {snapshot.currentMember.role === 'OWNER' && m.id !== snapshot.currentMember.id && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => actions.onDeleteMember(m.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Income</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatINR(memberFlow.income)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Expenses</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                    {formatINR(memberFlow.expenses)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Saved</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatINR(memberFlow.savings)}
                  </span>
                </div>
              </div>

              {m.responsibilities && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Responsibilities: {m.responsibilities}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                <span>Add Tx: {m.canAddTransactions ? 'Yes' : 'No'}</span>
                <span>·</span>
                <span>Budgets: {m.canManageBudgets ? 'Yes' : 'No'}</span>
                <span>·</span>
                <span>Investments: {m.canViewInvestments ? 'Yes' : 'Restricted'}</span>
              </div>

              {canManage && m.role !== 'OWNER' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      actions.onUpdateMember(m.id, { canAddTransactions: !m.canAddTransactions })
                    }
                    className="text-xs text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                  >
                    Toggle Tx Entry
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      actions.onUpdateMember(m.id, { canViewInvestments: !m.canViewInvestments })
                    }
                    className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                  >
                    Toggle Investments
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canManage && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Family Member & Assign Permissions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Spouse">Spouse</option>
              <option value="Child">Child</option>
              <option value="Family Administrator">Family Administrator</option>
              <option value="Other">Other Family Member</option>
            </select>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as 'ADULT' | 'MINOR')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="ADULT">Adult</option>
              <option value="MINOR">Child / Minor (Age-Appropriate Controls)</option>
            </select>
            <select
              value={role}
              disabled={ageGroup === 'MINOR'}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="ADMIN">Family Administrator</option>
              <option value="MEMBER">Family Member</option>
              <option value="READ_ONLY">Read Only</option>
              {snapshot.currentMember.role === 'OWNER' && <option value="OWNER">Family Owner</option>}
            </select>
            <input
              type="email"
              value={invitedEmail}
              onChange={(e) => setInvitedEmail(e.target.value)}
              placeholder="Google email (optional for login)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="Financial responsibilities"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={actions.isBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90"
          >
            Add Member
          </button>
        </form>
      )}
    </div>
  );
}

export function BudgetsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [period, setPeriod] = useState('MONTHLY');
  const [monthKey, setMonthKey] = useState(currentMonth);
  const [memberId, setMemberId] = useState<string>('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [alertThresholdPct, setAlertThresholdPct] = useState('80');

  const utilization = useMemo(
    () => computeBudgetUtilization(snapshot.budgets, snapshot.transactions, monthKey),
    [snapshot.budgets, snapshot.transactions, monthKey],
  );

  const applyMiddleClassTemplate = async (monthlyIncome: number) => {
    const starter = [
      { name: 'Groceries & Food', category: 'Groceries', allocatedAmount: Math.round(monthlyIncome * 0.2) },
      { name: 'Rent & Utilities', category: 'House rent', allocatedAmount: Math.round(monthlyIncome * 0.25) },
      { name: 'Education & Health', category: 'Education', allocatedAmount: Math.round(monthlyIncome * 0.1) },
    ];
    for (const item of starter) {
      await actions.onAddBudget({
        ...item,
        period: 'MONTHLY',
        monthKey,
        alertThresholdPct: 80,
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatedAmount || Number(allocatedAmount) <= 0) return;
    await actions.onAddBudget({
      name: name.trim() || `${category} Budget`,
      category,
      period,
      monthKey,
      memberId: memberId ? Number(memberId) : null,
      allocatedAmount: Number(allocatedAmount),
      alertThresholdPct: Number(alertThresholdPct || 80),
    });
    setName('');
    setAllocatedAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Realistic Household Budgets
          </h3>
          <p className="text-xs text-slate-500">
            Optional starting templates adapt proportionally to your family income—never imposed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyMiddleClassTemplate(25000)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Optional Template: ₹25k/mo
          </button>
          <button
            type="button"
            onClick={() => applyMiddleClassTemplate(50000)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Optional Template: ₹50k/mo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {utilization.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-8 text-center text-xs text-slate-500">
            No budgets created yet. Create a category or member budget below.
          </div>
        ) : (
          utilization.map((u) => {
            const mem = snapshot.members.find((m) => m.id === u.budget.memberId);
            const barColor =
              u.status === 'EXCEEDED'
                ? 'bg-red-600'
                : u.status === 'WARNING'
                  ? 'bg-amber-500'
                  : 'bg-[#0F274A] dark:bg-[#D4AF37]';
            return (
              <div
                key={u.budget.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      {u.budget.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {u.budget.category} · {u.budget.period} · {mem ? mem.name : 'Whole Family'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        u.status === 'EXCEEDED'
                          ? 'text-red-600 dark:text-red-400'
                          : u.status === 'WARNING'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {u.status === 'EXCEEDED'
                        ? 'Exceeded'
                        : u.status === 'WARNING'
                          ? 'Approaching Limit'
                          : 'On Track'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete budget ${u.budget.name}`}
                      onClick={() => actions.onDeleteBudget(u.budget.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(100, u.utilizationPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-600 dark:text-slate-300">
                    Spent: {formatINR(u.spent)} / {formatINR(u.budget.allocatedAmount)} ({u.utilizationPct}%)
                  </span>
                  <span className={u.remaining < 0 ? 'text-red-600 font-semibold' : 'text-slate-700 dark:text-slate-200'}>
                    {u.remaining >= 0 ? `Left: ${formatINR(u.remaining)}` : `Over by ${formatINR(Math.abs(u.remaining))}`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create Budget</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Budget title (e.g. Monthly Groceries)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="ALL">All Categories (Overall)</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            required
            value={allocatedAmount}
            onChange={(e) => setAllocatedAmount(e.target.value)}
            placeholder="Budget limit (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="ANNUAL">Annual</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Whole Family</option>
            {snapshot.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Alert Threshold %</span>
            <input
              type="number"
              min="10"
              max="100"
              value={alertThresholdPct}
              onChange={(e) => setAlertThresholdPct(e.target.value)}
              className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={actions.isBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90"
          >
            Save Budget
          </button>
        </div>
      </form>
    </div>
  );
}

export function SavingsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [targetInput, setTargetInput] = useState(String(toNum(snapshot.family.monthlySavingsTarget)));

  const flow = useMemo(
    () => computeCashFlowSummary(snapshot.transactions, currentMonth),
    [snapshot.transactions, currentMonth],
  );

  const target = toNum(snapshot.family.monthlySavingsTarget);
  const pct = target > 0 ? Math.min(100, Math.round((Math.max(0, flow.savings) / target) * 100)) : 0;
  const remaining = Math.max(0, target - Math.max(0, flow.savings));

  const savingsAccounts = snapshot.accounts.filter((a) =>
    ['SAVINGS', 'JOINT', 'FIXED_DEPOSIT', 'RECURRING_DEPOSIT'].includes(a.accountType),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Monthly Savings Target</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatINR(target)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Actual Monthly Savings</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatINR(flow.savings)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Savings Rate: {flow.savingsRatePct}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Remaining to Target</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatINR(remaining)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Goal Completion</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#0F274A] dark:text-[#D4AF37]">
            {pct}%
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Monthly Savings Target Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Account balances are tracked separately from earmarked savings goals to prevent double counting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono tabular-nums"
            />
            <button
              type="button"
              onClick={() =>
                actions.onUpdateFamilySettings({ monthlySavingsTarget: Number(targetInput || 0) })
              }
              className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
            >
              Update Target
            </button>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Member & Savings Account Breakdown
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {savingsAccounts.map((acc) => (
            <div key={acc.id} className="py-2.5 flex justify-between">
              <span className="text-slate-700 dark:text-slate-200">
                {acc.name} ({acc.accountType.replace(/_/g, ' ')})
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatINR(acc.currentBalance)}
              </span>
            </div>
          ))}
          {savingsAccounts.length === 0 && (
            <p className="py-4 text-xs text-slate-500">No savings or deposit accounts linked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmergencyFundView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [essential, setEssential] = useState(String(toNum(snapshot.family.monthlyEssentialExpenses)));
  const [months, setMonths] = useState(snapshot.family.emergencyTargetMonths || 6);
  const [monthlyContrib, setMonthlyContrib] = useState('5000');

  const emergencyGoal = snapshot.goals.find((g) => g.goalType === 'EMERGENCY_FUND');
  const currentBalance = emergencyGoal ? toNum(emergencyGoal.currentAllocated) : 0;

  const summary = computeEmergencyFundSummary(
    Number(essential || 0),
    months,
    currentBalance,
    Number(monthlyContrib || 0),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Target Emergency Fund</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#0F274A] dark:text-[#D4AF37]">
            {formatINR(summary.targetAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{months} months × {formatINR(essential)}/mo</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Current Emergency Savings</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatINR(summary.currentBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Completion</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {summary.completionPct}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Estimated Time to Target</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {summary.estimatedMonthsToTarget === null
              ? 'Set monthly deposit'
              : summary.estimatedMonthsToTarget === 0
                ? 'Fully Funded'
                : `${summary.estimatedMonthsToTarget} months`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Configure Emergency Protection Target
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Monthly Essential Expenses (₹)
            </span>
            <input
              type="number"
              min="0"
              value={essential}
              onChange={(e) => setEssential(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Protection Duration
            </span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value={3}>3 Months (Starter)</option>
              <option value={6}>6 Months (Recommended)</option>
              <option value={9}>9 Months (Extended)</option>
              <option value={12}>12 Months (Fortress)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Planned Monthly Contribution (₹)
            </span>
            <input
              type="number"
              min="0"
              value={monthlyContrib}
              onChange={(e) => setMonthlyContrib(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              actions.onUpdateFamilySettings({
                monthlyEssentialExpenses: Number(essential || 0),
                emergencyTargetMonths: months,
              })
            }
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
          >
            Save Emergency Config
          </button>

          {!emergencyGoal && summary.targetAmount > 0 && (
            <button
              type="button"
              onClick={() =>
                actions.onAddGoal({
                  title: `${months}-Month Family Emergency Fund`,
                  goalType: 'EMERGENCY_FUND',
                  targetAmount: summary.targetAmount,
                  currentAllocated: 0,
                  monthlyContribution: Number(monthlyContrib || 0),
                  priority: 'HIGH',
                })
              }
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Create Linked Emergency Goal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GoalsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState('CHILDREN_EDUCATION');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  const [txGoalId, setTxGoalId] = useState<number | null>(null);
  const [txType, setTxType] = useState<'CONTRIBUTION' | 'WITHDRAWAL'>('CONTRIBUTION');
  const [txAmt, setTxAmt] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || Number(targetAmount) <= 0) return;
    await actions.onAddGoal({
      title: title.trim(),
      goalType,
      targetAmount: Number(targetAmount),
      monthlyContribution: Number(monthlyContribution || 0),
      targetDate: targetDate || null,
      priority,
    });
    setTitle('');
    setTargetAmount('');
    setMonthlyContribution('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.goals.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-8 text-center text-xs text-slate-500">
            No financial goals created yet. Add your first family milestone below.
          </div>
        ) : (
          snapshot.goals.map((g) => {
            const target = toNum(g.targetAmount);
            const current = toNum(g.currentAllocated);
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const remaining = Math.max(0, target - current);
            return (
              <div
                key={g.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{g.title}</h4>
                    <p className="text-xs text-slate-500">
                      {g.goalType.replace(/_/g, ' ')} · Priority: {g.priority} · Target:{' '}
                      {formatDateDDMMYYYY(g.targetDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete goal ${g.title}`}
                    onClick={() => actions.onDeleteGoal(g.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0F274A] dark:bg-[#D4AF37]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex flex-wrap justify-between gap-2 text-xs font-mono tabular-nums">
                  <span>
                    Saved: {formatINR(current)} / {formatINR(target)} ({pct}%)
                  </span>
                  <span className="text-slate-500">Remaining: {formatINR(remaining)}</span>
                </div>

                {txGoalId === g.id ? (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value as 'CONTRIBUTION' | 'WITHDRAWAL')}
                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                    >
                      <option value="CONTRIBUTION">Contribute</option>
                      <option value="WITHDRAWAL">Withdraw</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={txAmt}
                      onChange={(e) => setTxAmt(e.target.value)}
                      placeholder="Amount ₹"
                      className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (Number(txAmt) <= 0) return;
                        await actions.onAddGoalTx(g.id, { txType, amount: Number(txAmt) });
                        setTxGoalId(null);
                        setTxAmt('');
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxGoalId(null)}
                      className="px-2 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTxGoalId(g.id)}
                    className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                  >
                    + Log Contribution / Withdrawal
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Create Financial Goal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title (e.g. Daughter College Corpus)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="EMERGENCY_FUND">Emergency Fund</option>
            <option value="CHILDREN_EDUCATION">Children's Education</option>
            <option value="HOUSE_PURCHASE">House Purchase</option>
            <option value="VEHICLE_PURCHASE">Vehicle Purchase</option>
            <option value="MARRIAGE">Marriage</option>
            <option value="RETIREMENT">Retirement</option>
            <option value="VACATION">Family Vacation</option>
            <option value="DEBT_FREEDOM">Debt Freedom</option>
            <option value="FINANCIAL_INDEPENDENCE">Financial Independence</option>
            <option value="WEALTH_CREATION">Long-Term Wealth Creation</option>
          </select>
          <input
            type="number"
            min="1"
            required
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="Target amount (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            placeholder="Monthly contribution (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={actions.isBusy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
        >
          Create Goal
        </button>
      </form>
    </div>
  );
}
