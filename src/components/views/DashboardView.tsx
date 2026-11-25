import React, { useMemo, useState } from 'react';
import {
  computeCashFlowSummary,
  computeNetWorthSummary,
  formatCompactINR,
  formatINR,
  getIndianFinancialYear,
  toNum,
} from '../../lib/finance';
import type { FamilyWorkspaceSnapshot, NavSectionId } from '../../lib/types';
import {
  DonutBreakdownChart,
  GroupedBarChart,
  HorizontalProgressChart,
  TrendLineChart,
} from '../Charts';

export function DashboardView({
  snapshot,
  onNavigate,
  onSeedSample,
  isBusy,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  onNavigate: (tab: NavSectionId) => void;
  onSeedSample: () => Promise<void>;
  isBusy: boolean;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultFy = getIndianFinancialYear(`${defaultMonth}-01`);

  const [periodView, setPeriodView] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL'>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [memberFilter, setMemberFilter] = useState<string>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');

  const memberId = memberFilter === 'ALL' ? null : Number(memberFilter);
  const accountId = accountFilter === 'ALL' ? null : Number(accountFilter);

  const isEmpty =
    snapshot.accounts.length === 0 &&
    snapshot.transactions.length === 0 &&
    snapshot.assets.length === 0 &&
    snapshot.investments.length === 0 &&
    snapshot.loans.length === 0;

  const netWorth = useMemo(
    () =>
      computeNetWorthSummary(
        snapshot.accounts,
        snapshot.assets,
        snapshot.investments,
        snapshot.loans,
      ),
    [snapshot.accounts, snapshot.assets, snapshot.investments, snapshot.loans],
  );

  const filteredTx = useMemo(() => {
    return snapshot.transactions.filter((tx) => {
      if (memberId && tx.memberId !== memberId) return false;
      if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
      if (periodView === 'MONTHLY') {
        return tx.transactionDate.startsWith(selectedMonth);
      }
      if (periodView === 'ANNUAL') {
        return getIndianFinancialYear(tx.transactionDate) === selectedFy;
      }
      // QUARTERLY: current 3-month window ending selectedMonth
      const [y, m] = selectedMonth.split('-').map(Number);
      const txDate = new Date(tx.transactionDate);
      const end = new Date(y, m, 0);
      const start = new Date(y, m - 3, 1);
      return txDate >= start && txDate <= end;
    });
  }, [snapshot.transactions, memberId, accountId, periodView, selectedMonth, selectedFy]);

  const cashFlow = useMemo(() => computeCashFlowSummary(filteredTx), [filteredTx]);

  const emergencyBalance = useMemo(() => {
    const emergencyGoals = snapshot.goals.filter((g) => g.goalType === 'EMERGENCY_FUND');
    if (emergencyGoals.length > 0) {
      return emergencyGoals.reduce((sum, g) => sum + toNum(g.currentAllocated), 0);
    }
    return 0;
  }, [snapshot.goals]);

  // Last 6 months series
  const sixMonthsSeries = useMemo(() => {
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const months: Array<{
      label: string;
      income: number;
      expenses: number;
      savings: number;
    }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(yr, mo - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const flow = computeCashFlowSummary(snapshot.transactions, key, memberId, accountId);
      months.push({
        label,
        income: flow.income,
        expenses: flow.expenses,
        savings: flow.savings,
      });
    }
    return months;
  }, [snapshot.transactions, selectedMonth, memberId, accountId]);

  // Net worth trajectory back-projected from current net worth + monthly savings deltas
  const netWorthTrajectory = useMemo(() => {
    let running = netWorth.netWorth;
    const reversed = [...sixMonthsSeries].reverse().map((m, idx) => {
      const point = { label: m.label, value: Math.round(running) };
      if (idx < sixMonthsSeries.length - 1) {
        running -= m.savings;
      }
      return point;
    });
    return reversed.reverse();
  }, [sixMonthsSeries, netWorth.netWorth]);

  // Expense category breakdown
  const expenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of filteredTx) {
      if (tx.status === 'COMPLETED' && tx.type === 'EXPENSE') {
        map[tx.category] = (map[tx.category] || 0) + toNum(tx.amount);
      }
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // Investment allocation breakdown
  const investmentAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of snapshot.investments) {
      map[inv.category] = (map[inv.category] || 0) + toNum(inv.currentValue);
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))
      .sort((a, b) => b.value - a.value);
  }, [snapshot.investments]);

  const kpiCards = [
    {
      label: 'Total Family Net Worth',
      value: formatINR(netWorth.netWorth),
      sub: 'Total Assets − Total Liabilities',
      tone: netWorth.netWorth >= 0 ? 'text-[#0F274A] dark:text-[#D4AF37]' : 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Total Family Assets',
      value: formatINR(netWorth.totalAssets),
      sub: `Liquid + Investments + Physical`,
      tone: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Family Liabilities',
      value: formatINR(netWorth.totalLiabilities),
      sub: `Loans ${formatCompactINR(netWorth.loanLiabilities)} · Cards ${formatCompactINR(netWorth.creditCardLiabilities)}`,
      tone: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Available Cash',
      value: formatINR(netWorth.liquidCash),
      sub: 'Active cash wallets',
      tone: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Bank Balance',
      value: formatINR(netWorth.bankBalance),
      sub: 'Savings, Salary, Joint & Deposits',
      tone: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: `${periodView === 'MONTHLY' ? 'Monthly' : periodView === 'QUARTERLY' ? 'Quarterly' : 'Annual'} Income`,
      value: formatINR(cashFlow.income),
      sub: 'Completed inflows (transfers excluded)',
      tone: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: `${periodView === 'MONTHLY' ? 'Monthly' : periodView === 'QUARTERLY' ? 'Quarterly' : 'Annual'} Expenses`,
      value: formatINR(cashFlow.expenses),
      sub: 'Household outflow & loan interest',
      tone: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: `${periodView === 'MONTHLY' ? 'Monthly' : periodView === 'QUARTERLY' ? 'Quarterly' : 'Annual'} Savings`,
      value: formatINR(cashFlow.savings),
      sub: `Savings Rate: ${cashFlow.savingsRatePct}%`,
      tone: cashFlow.savings >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Investment Portfolio Value',
      value: formatINR(netWorth.investmentValue),
      sub: `${snapshot.investments.length} active holdings`,
      tone: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Emergency Fund Balance',
      value: formatINR(emergencyBalance),
      sub: `Target: ${formatINR(toNum(snapshot.family.monthlyEssentialExpenses) * snapshot.family.emergencyTargetMonths)}`,
      tone: 'text-slate-900 dark:text-slate-100',
    },
  ];

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-8 text-center max-w-2xl mx-auto mt-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Welcome to {snapshot.family.name}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Your PostgreSQL ledger starts clean with zero fabricated figures. Add your first bank
            account, salary, or household expense—or load a realistic middle-class Indian household
            sample dataset to explore all modules immediately.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Add First Bank Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate('income')}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              Record Monthly Income
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onSeedSample}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isBusy ? 'Loading Sample Data...' : 'Load Sample Indian Family Data'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
          {(['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setPeriodView(view)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodView === view
                  ? 'bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {view === 'MONTHLY' ? 'Monthly' : view === 'QUARTERLY' ? 'Quarterly' : 'Financial Year'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {periodView === 'ANNUAL' ? (
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>FY</span>
              <select
                value={selectedFy}
                onChange={(e) => setSelectedFy(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                {[2024, 2025, 2026, 2027].map((yr) => {
                  const lbl = `FY ${yr}-${String((yr + 1) % 100).padStart(2, '0')}`;
                  return (
                    <option key={lbl} value={lbl}>
                      {lbl}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Month</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Member</span>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Family Members</option>
              {snapshot.members.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name} ({m.relationship})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Account</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Accounts</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* 10 Main Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-col justify-between"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-2 text-xl font-bold font-mono tabular-nums ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* 8 Dashboard Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GroupedBarChart
          title="Monthly Income vs Expenses"
          subtitle="6-month household cash flow comparison (internal transfers excluded)"
          data={sixMonthsSeries.map((m) => ({
            label: m.label,
            primary: m.income,
            secondary: m.expenses,
          }))}
          primaryLabel="Income"
          secondaryLabel="Expenses"
        />

        <TrendLineChart
          title="Net Worth Trajectory"
          subtitle="Estimated historical progression from monthly retained savings"
          points={netWorthTrajectory}
          color="#C89B3C"
        />

        <DonutBreakdownChart
          title="Expense Category Distribution"
          subtitle={`Breakdown for selected ${periodView.toLowerCase()} period`}
          items={expenseCategories}
        />

        <TrendLineChart
          title="Monthly Savings Trend"
          subtitle="Net monthly cash surplus (Income − Expenses)"
          points={sixMonthsSeries.map((m) => ({ label: m.label, value: m.savings }))}
          color="#16A34A"
        />

        <DonutBreakdownChart
          title="Investment Portfolio Allocation"
          subtitle="Current valuation by Indian asset class"
          items={investmentAllocation}
        />

        <GroupedBarChart
          title="Assets vs Liabilities & Cash Flow"
          subtitle="Total family balance sheet vs monthly debt & investment allocation"
          data={[
            {
              label: 'Balance Sheet',
              primary: netWorth.totalAssets,
              secondary: netWorth.totalLiabilities,
            },
            {
              label: 'Cash Flow',
              primary: cashFlow.income,
              secondary: cashFlow.expenses + cashFlow.debtRepaymentOutflow,
            },
            {
              label: 'Wealth Action',
              primary: cashFlow.investmentContributionOutflow,
              secondary: Math.max(0, cashFlow.savings),
            },
          ]}
          primaryLabel="Assets / Inflow"
          secondaryLabel="Liabilities / Outflow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HorizontalProgressChart
          title="Financial Goal Progress"
          subtitle="Allocated savings against target corpus"
          rows={snapshot.goals.slice(0, 5).map((g) => ({
            label: g.title,
            current: toNum(g.currentAllocated),
            target: toNum(g.targetAmount),
            caption: `Priority: ${g.priority} · Monthly: ${formatINR(g.monthlyContribution)}`,
          }))}
        />

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Monthly Cash Flow Statement
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cash flow separated strictly from investment valuation
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline whitespace-nowrap shrink-0"
            >
              Full Reports
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Operating Household Income</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                +{formatINR(cashFlow.income)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Household Consumption & Interest</span>
              <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                −{formatINR(cashFlow.expenses)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Net Operating Savings</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {formatINR(cashFlow.savings)} ({cashFlow.savingsRatePct}%)
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Investment Contributions (Capital Outflow)</span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatINR(cashFlow.investmentContributionOutflow)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Loan EMI Repayments (Principal + Interest)</span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatINR(cashFlow.debtRepaymentOutflow)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
