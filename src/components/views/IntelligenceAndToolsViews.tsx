import React, { useMemo, useState } from 'react';
import { Download, Printer, Send, Trash2, Upload } from 'lucide-react';
import type { WorkspaceActions } from '../../lib/actions';
import {
  calculateCompoundInterest,
  calculateEmergencyFundCalc,
  calculateFinancialFreedom,
  calculateHomePurchase,
  calculateLoanEMI,
  calculateNetWorthProjection,
  calculateRetirement,
  calculateSIP,
} from '../../lib/calculators';
import { downloadCSV, downloadExcel } from '../../lib/exporters';
import {
  computeBudgetUtilization,
  computeCashFlowSummary,
  computeNetWorthSummary,
  formatDateDDMMYYYY,
  formatINR,
  toNum,
} from '../../lib/finance';
import { generateFinancialInsights } from '../../lib/insights';
import type { FamilyWorkspaceSnapshot, NavSectionId } from '../../lib/types';

export function CalculatorsView() {
  const [activeCalc, setActiveCalc] = useState<
    'SIP' | 'CI' | 'RETIREMENT' | 'FREEDOM' | 'EMERGENCY' | 'HOME' | 'EMI' | 'NETWORTH'
  >('SIP');

  // SIP
  const [sipMonthly, setSipMonthly] = useState(5000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(15);
  const sipRes = calculateSIP({ monthlyInvestment: sipMonthly, annualReturnPct: sipRate, years: sipYears });

  // Compound Interest
  const [ciInit, setCiInit] = useState(100000);
  const [ciAdd, setCiAdd] = useState(2000);
  const [ciRate, setCiRate] = useState(10);
  const [ciYears, setCiYears] = useState(10);
  const [ciComp, setCiComp] = useState(4);
  const ciRes = calculateCompoundInterest({
    initialAmount: ciInit,
    monthlyContribution: ciAdd,
    annualRatePct: ciRate,
    years: ciYears,
    compoundingPerYear: ciComp,
  });

  // Retirement
  const [retAgeNow, setRetAgeNow] = useState(32);
  const [retAgeTarget, setRetAgeTarget] = useState(60);
  const [retExpense, setRetExpense] = useState(35000);
  const [retInf, setRetInf] = useState(6);
  const [retReturn, setRetReturn] = useState(11);
  const [retExisting, setRetExisting] = useState(250000);
  const retRes = calculateRetirement({
    currentAge: retAgeNow,
    retirementAge: retAgeTarget,
    currentMonthlyExpenses: retExpense,
    inflationPct: retInf,
    expectedReturnPct: retReturn,
    existingSavings: retExisting,
  });

  // Financial Freedom
  const [ffAnnual, setFfAnnual] = useState(480000);
  const [ffInf, setFfInf] = useState(6);
  const [ffYears, setFfYears] = useState(15);
  const [ffSwr, setFfSwr] = useState(3.5);
  const [ffRet, setFfRet] = useState(11);
  const [ffCur, setFfCur] = useState(300000);
  const ffRes = calculateFinancialFreedom({
    annualExpenses: ffAnnual,
    inflationPct: ffInf,
    yearsToFreedom: ffYears,
    safeWithdrawalRatePct: ffSwr,
    expectedReturnPct: ffRet,
    currentCorpus: ffCur,
  });

  // Emergency
  const [efExp, setEfExp] = useState(28000);
  const [efMonths, setEfMonths] = useState(6);
  const [efCur, setEfCur] = useState(90000);
  const [efMonthly, setEfMonthly] = useState(6000);
  const efRes = calculateEmergencyFundCalc({
    monthlyEssentialExpenses: efExp,
    months: efMonths,
    currentSavings: efCur,
    monthlyContribution: efMonthly,
  });

  // Home Purchase
  const [hpCost, setHpCost] = useState(4500000);
  const [hpDown, setHpDown] = useState(20);
  const [hpRate, setHpRate] = useState(8.5);
  const [hpYears, setHpYears] = useState(20);
  const [hpExtra, setHpExtra] = useState(7);
  const hpRes = calculateHomePurchase({
    propertyCost: hpCost,
    downPaymentPct: hpDown,
    interestRatePct: hpRate,
    tenureYears: hpYears,
    additionalCostsPct: hpExtra,
  });

  // Loan EMI
  const [emiPrin, setEmiPrin] = useState(1000000);
  const [emiRate, setEmiRate] = useState(9.2);
  const [emiMonths, setEmiMonths] = useState(120);
  const emiRes = calculateLoanEMI({ principal: emiPrin, annualRatePct: emiRate, tenureMonths: emiMonths });

  // Net Worth Projection
  const [nwCur, setNwCur] = useState(500000);
  const [nwSave, setNwSave] = useState(15000);
  const [nwRet, setNwRet] = useState(10);
  const nwRes = calculateNetWorthProjection({
    currentNetWorth: nwCur,
    monthlySavings: nwSave,
    expectedReturnPct: nwRet,
  });

  const tabs: Array<{ id: typeof activeCalc; label: string }> = [
    { id: 'SIP', label: 'SIP' },
    { id: 'CI', label: 'Compound Interest' },
    { id: 'RETIREMENT', label: 'Retirement' },
    { id: 'FREEDOM', label: 'Financial Freedom' },
    { id: 'EMERGENCY', label: 'Emergency Fund' },
    { id: 'HOME', label: 'Home Purchase' },
    { id: 'EMI', label: 'Loan EMI' },
    { id: 'NETWORTH', label: 'Net Worth Projection' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveCalc(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeCalc === t.id
                ? 'bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-6 space-y-5">
        {activeCalc === 'SIP' && (
          <>
            <h3 className="text-base font-semibold">SIP Wealth Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CalcInput label="Monthly SIP (₹)" value={sipMonthly} onChange={setSipMonthly} />
              <CalcInput label="Expected Return (% p.a.)" value={sipRate} step="0.5" onChange={setSipRate} />
              <CalcInput label="Duration (Years)" value={sipYears} onChange={setSipYears} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Total Invested" value={formatINR(sipRes.investedAmount)} />
              <ResultTile label="Estimated Returns" value={formatINR(sipRes.estimatedReturns)} accent />
              <ResultTile label="Estimated Maturity Value" value={formatINR(sipRes.maturityValue)} />
            </div>
          </>
        )}

        {activeCalc === 'CI' && (
          <>
            <h3 className="text-base font-semibold">Compound Interest Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <CalcInput label="Initial Amount (₹)" value={ciInit} onChange={setCiInit} />
              <CalcInput label="Monthly Addition (₹)" value={ciAdd} onChange={setCiAdd} />
              <CalcInput label="Annual Rate (%)" value={ciRate} step="0.5" onChange={setCiRate} />
              <CalcInput label="Years" value={ciYears} onChange={setCiYears} />
              <CalcInput label="Compounding / Yr" value={ciComp} onChange={setCiComp} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Total Invested" value={formatINR(ciRes.totalInvested)} />
              <ResultTile label="Interest Earned" value={formatINR(ciRes.totalInterest)} accent />
              <ResultTile label="Maturity Value" value={formatINR(ciRes.maturityValue)} />
            </div>
          </>
        )}

        {activeCalc === 'RETIREMENT' && (
          <>
            <h3 className="text-base font-semibold">Retirement Corpus Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CalcInput label="Current Age" value={retAgeNow} onChange={setRetAgeNow} />
              <CalcInput label="Retirement Age" value={retAgeTarget} onChange={setRetAgeTarget} />
              <CalcInput label="Current Monthly Expenses (₹)" value={retExpense} onChange={setRetExpense} />
              <CalcInput label="Inflation (% p.a.)" value={retInf} step="0.5" onChange={setRetInf} />
              <CalcInput label="Expected Return (% p.a.)" value={retReturn} step="0.5" onChange={setRetReturn} />
              <CalcInput label="Existing Retirement Savings (₹)" value={retExisting} onChange={setRetExisting} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Monthly Expense at Retirement" value={formatINR(retRes.monthlyExpenseAtRetirement)} />
              <ResultTile label="Required Corpus" value={formatINR(retRes.requiredCorpus)} />
              <ResultTile label="Monthly SIP Needed" value={formatINR(retRes.requiredMonthlySip)} accent />
            </div>
          </>
        )}

        {activeCalc === 'FREEDOM' && (
          <>
            <h3 className="text-base font-semibold">Financial Freedom (FIRE) Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CalcInput label="Current Annual Expenses (₹)" value={ffAnnual} onChange={setFfAnnual} />
              <CalcInput label="Inflation (%)" value={ffInf} step="0.5" onChange={setFfInf} />
              <CalcInput label="Target Years" value={ffYears} onChange={setFfYears} />
              <CalcInput label="Withdrawal Rate (%)" value={ffSwr} step="0.25" onChange={setFfSwr} />
              <CalcInput label="Expected Return (%)" value={ffRet} step="0.5" onChange={setFfRet} />
              <CalcInput label="Current Corpus (₹)" value={ffCur} onChange={setFfCur} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Future Annual Expenses" value={formatINR(ffRes.futureAnnualExpenses)} />
              <ResultTile label="Freedom Corpus Needed" value={formatINR(ffRes.targetFreedomCorpus)} />
              <ResultTile label="Monthly Investment Needed" value={formatINR(ffRes.requiredMonthlyInvestment)} accent />
            </div>
          </>
        )}

        {activeCalc === 'EMERGENCY' && (
          <>
            <h3 className="text-base font-semibold">Emergency Fund Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <CalcInput label="Monthly Essentials (₹)" value={efExp} onChange={setEfExp} />
              <CalcInput label="Target Months" value={efMonths} onChange={setEfMonths} />
              <CalcInput label="Current Savings (₹)" value={efCur} onChange={setEfCur} />
              <CalcInput label="Monthly Contribution (₹)" value={efMonthly} onChange={setEfMonthly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Target Emergency Fund" value={formatINR(efRes.targetFund)} />
              <ResultTile label="Remaining Shortfall" value={formatINR(efRes.shortfall)} />
              <ResultTile
                label="Estimated Time"
                value={efRes.monthsToComplete === null ? '—' : `${efRes.monthsToComplete} months`}
                accent
              />
            </div>
          </>
        )}

        {activeCalc === 'HOME' && (
          <>
            <h3 className="text-base font-semibold">Home Purchase & Registration Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <CalcInput label="Property Cost (₹)" value={hpCost} onChange={setHpCost} />
              <CalcInput label="Down Payment (%)" value={hpDown} onChange={setHpDown} />
              <CalcInput label="Loan Interest (%)" value={hpRate} step="0.25" onChange={setHpRate} />
              <CalcInput label="Tenure (Years)" value={hpYears} onChange={setHpYears} />
              <CalcInput label="Stamp Duty & Reg (%)" value={hpExtra} step="0.5" onChange={setHpExtra} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Down Payment" value={formatINR(hpRes.downPayment)} />
              <ResultTile label="Upfront Cash (incl. Reg)" value={formatINR(hpRes.upfrontCashRequired)} />
              <ResultTile label="Home Loan Amount" value={formatINR(hpRes.loanAmount)} />
              <ResultTile label="Estimated Monthly EMI" value={formatINR(hpRes.estimatedEmi)} accent />
            </div>
          </>
        )}

        {activeCalc === 'EMI' && (
          <>
            <h3 className="text-base font-semibold">Loan EMI Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CalcInput label="Loan Principal (₹)" value={emiPrin} onChange={setEmiPrin} />
              <CalcInput label="Interest Rate (% p.a.)" value={emiRate} step="0.1" onChange={setEmiRate} />
              <CalcInput label="Tenure (Months)" value={emiMonths} onChange={setEmiMonths} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultTile label="Monthly EMI" value={formatINR(emiRes.emi)} accent />
              <ResultTile label="Total Interest Payable" value={formatINR(emiRes.totalInterest)} />
              <ResultTile label="Total Repayment" value={formatINR(emiRes.totalRepayment)} />
            </div>
          </>
        )}

        {activeCalc === 'NETWORTH' && (
          <>
            <h3 className="text-base font-semibold">Net Worth Projection (1–20 Years)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CalcInput label="Current Net Worth (₹)" value={nwCur} onChange={setNwCur} />
              <CalcInput label="Monthly Savings Added (₹)" value={nwSave} onChange={setNwSave} />
              <CalcInput label="Expected Blended Return (%)" value={nwRet} step="0.5" onChange={setNwRet} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {nwRes.map((item) => (
                <ResultTile
                  key={item.years}
                  label={`${item.years} Year${item.years > 1 ? 's' : ''}`}
                  value={formatINR(item.projectedNetWorth)}
                  accent={item.years === 20}
                />
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-slate-500 pt-2">
          Note: All calculator outputs are mathematical projections based on user-defined assumptions and are not guaranteed returns.
        </p>
      </div>
    </div>
  );
}

function CalcInput({
  label,
  value,
  onChange,
  step = '1',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
      />
    </label>
  );
}

function ResultTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold font-mono tabular-nums ${accent ? 'text-[#0F274A] dark:text-[#D4AF37]' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

const REPORT_LIST = [
  { id: 'daily_tx', title: '1. Daily Transaction Report' },
  { id: 'weekly_spend', title: '2. Weekly Spending Report' },
  { id: 'monthly_income', title: '3. Monthly Income Report' },
  { id: 'monthly_expense', title: '4. Monthly Expense Report' },
  { id: 'annual_financial', title: '5. Annual Financial Report' },
  { id: 'net_worth', title: '6. Family Net Worth Report' },
  { id: 'investments', title: '7. Investment Portfolio Report' },
  { id: 'loans', title: '8. Loan and Debt Report' },
  { id: 'savings', title: '9. Savings Report' },
  { id: 'budgets', title: '10. Budget Performance Report' },
  { id: 'goals', title: '11. Financial Goals Report' },
  { id: 'cash_flow', title: '12. Cash Flow Statement' },
  { id: 'assets_liabilities', title: '13. Asset and Liability Statement' },
] as const;

export function ReportsView({ snapshot }: { snapshot: FamilyWorkspaceSnapshot }) {
  const [selectedReport, setSelectedReport] = useState<(typeof REPORT_LIST)[number]['id']>('daily_tx');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState('ALL');
  const [accountId, setAccountId] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const filteredTx = useMemo(() => {
    return snapshot.transactions.filter((tx) => {
      if (tx.transactionDate < fromDate || tx.transactionDate > toDate) return false;
      if (memberId !== 'ALL' && tx.memberId !== Number(memberId)) return false;
      if (accountId !== 'ALL' && tx.accountId !== Number(accountId)) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
      return true;
    });
  }, [snapshot.transactions, fromDate, toDate, memberId, accountId, categoryFilter]);

  const reportData = useMemo(() => {
    const nw = computeNetWorthSummary(snapshot.accounts, snapshot.assets, snapshot.investments, snapshot.loans);
    const flow = computeCashFlowSummary(filteredTx);

    switch (selectedReport) {
      case 'monthly_income':
        return {
          headers: ['Date', 'Category', 'Source', 'Member', 'Status', 'Amount (INR)'],
          rows: filteredTx
            .filter((t) => t.type === 'INCOME')
            .map((t) => [
              formatDateDDMMYYYY(t.transactionDate),
              t.category,
              t.merchantOrSource || '—',
              snapshot.members.find((m) => m.id === t.memberId)?.name || 'Family',
              t.status,
              toNum(t.amount),
            ]),
        };
      case 'monthly_expense':
      case 'weekly_spend':
        return {
          headers: ['Date', 'Category', 'Merchant', 'Method', 'Amount (INR)'],
          rows: filteredTx
            .filter((t) => t.type === 'EXPENSE')
            .map((t) => [
              formatDateDDMMYYYY(t.transactionDate),
              t.category,
              t.merchantOrSource || '—',
              t.paymentMethod,
              toNum(t.amount),
            ]),
        };
      case 'net_worth':
      case 'assets_liabilities':
        return {
          headers: ['Line Item', 'Classification', 'Amount (INR)'],
          rows: [
            ['Cash Wallets', 'Asset', nw.liquidCash],
            ['Bank Accounts & Deposits', 'Asset', nw.bankBalance],
            ['Investment Portfolio', 'Asset', nw.investmentValue],
            ['Physical & Other Assets (Ownership-Weighted)', 'Asset', nw.physicalAssetsValue],
            ['Total Family Assets', 'Summary', nw.totalAssets],
            ['Active Loans Outstanding', 'Liability', nw.loanLiabilities],
            ['Credit Card Outstanding', 'Liability', nw.creditCardLiabilities],
            ['Total Family Liabilities', 'Summary', nw.totalLiabilities],
            ['Net Family Worth (Assets - Liabilities)', 'Net Worth', nw.netWorth],
          ],
        };
      case 'investments':
        return {
          headers: ['Holding', 'Category', 'Invested (INR)', 'Current Value (INR)', 'Unrealized Gain (INR)'],
          rows: snapshot.investments.map((i) => [
            i.name,
            i.category,
            toNum(i.investedAmount),
            toNum(i.currentValue),
            toNum(i.currentValue) - toNum(i.investedAmount),
          ]),
        };
      case 'loans':
        return {
          headers: ['Loan', 'Lender', 'Principal (INR)', 'Outstanding (INR)', 'Rate %', 'EMI (INR)'],
          rows: snapshot.loans.map((l) => [
            l.name,
            l.lender,
            toNum(l.principalAmount),
            toNum(l.outstandingPrincipal),
            toNum(l.interestRate),
            toNum(l.emiAmount),
          ]),
        };
      case 'budgets':
        return {
          headers: ['Budget', 'Category', 'Allocated (INR)', 'Spent (INR)', 'Remaining (INR)', 'Utilization %'],
          rows: computeBudgetUtilization(snapshot.budgets, snapshot.transactions, toDate.slice(0, 7)).map((b) => [
            b.budget.name,
            b.budget.category,
            toNum(b.budget.allocatedAmount),
            b.spent,
            b.remaining,
            b.utilizationPct,
          ]),
        };
      case 'goals':
        return {
          headers: ['Goal', 'Type', 'Target (INR)', 'Allocated (INR)', 'Remaining (INR)', 'Status'],
          rows: snapshot.goals.map((g) => [
            g.title,
            g.goalType,
            toNum(g.targetAmount),
            toNum(g.currentAllocated),
            Math.max(0, toNum(g.targetAmount) - toNum(g.currentAllocated)),
            g.status,
          ]),
        };
      case 'cash_flow':
      case 'annual_financial':
      case 'savings':
        return {
          headers: ['Cash Flow Metric', 'Period Total (INR)'],
          rows: [
            ['Operating Income', flow.income],
            ['Household Expenses & Loan Interest', flow.expenses],
            ['Net Operating Savings', flow.savings],
            ['Savings Rate (%)', flow.savingsRatePct],
            ['Investment Contributions', flow.investmentContributionOutflow],
            ['Debt Repayment Outflow', flow.debtRepaymentOutflow],
          ],
        };
      default:
        return {
          headers: ['Date', 'Type', 'Category', 'Merchant / Source', 'Amount (INR)'],
          rows: filteredTx.map((t) => [
            formatDateDDMMYYYY(t.transactionDate),
            t.type,
            t.category,
            t.merchantOrSource || t.description || '—',
            toNum(t.amount),
          ]),
        };
    }
  }, [selectedReport, filteredTx, snapshot, toDate]);

  const activeTitle = REPORT_LIST.find((r) => r.id === selectedReport)?.title || 'Financial Report';

  return (
    <div className="space-y-6">
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            aria-label="Select financial report"
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as typeof selectedReport)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold"
          >
            {REPORT_LIST.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCSV(`${selectedReport}.csv`, reportData.headers, reportData.rows)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                downloadExcel(`${selectedReport}.xls`, activeTitle, reportData.headers, reportData.rows)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <label className="block">
            <span className="text-slate-500">From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-slate-500">To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-slate-500">Member</span>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
            >
              <option value="ALL">All Members</option>
              {snapshot.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500">Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
            >
              <option value="ALL">All Accounts</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
            >
              <option value="ALL">All Categories</option>
              {Array.from(new Set(snapshot.transactions.map((t) => t.category))).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto p-5">
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{activeTitle}</h3>
          <p className="text-xs text-slate-500">
            {snapshot.family.name} · Period: {formatDateDDMMYYYY(fromDate)} to {formatDateDDMMYYYY(toDate)}
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <tr>
              {reportData.headers.map((h) => (
                <th key={h} className="py-2.5 px-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {reportData.rows.length === 0 ? (
              <tr>
                <td colSpan={reportData.headers.length} className="py-8 text-center text-xs text-slate-500">
                  No records match the selected filters.
                </td>
              </tr>
            ) : (
              reportData.rows.map((row, idx) => (
                <tr key={idx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-2.5 px-3 ${typeof cell === 'number' ? 'font-mono tabular-nums font-medium' : ''}`}
                    >
                      {typeof cell === 'number' && !reportData.headers[cIdx].includes('%')
                        ? formatINR(cell)
                        : cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IntelligenceView({
  snapshot,
  onNavigate,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  onNavigate: (tab: NavSectionId) => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const insights = useMemo(
    () => generateFinancialInsights(snapshot, currentMonth),
    [snapshot, currentMonth],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Explainable Financial Intelligence
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Every insight below is computed directly from your family ledger with traceable evidence.
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-8 text-center text-xs text-slate-500">
          Add income, expenses, budgets, or emergency goals to generate automated insights.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`font-semibold ${
                    ins.severity === 'POSITIVE'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : ins.severity === 'ALERT'
                        ? 'text-red-600 dark:text-red-400'
                        : ins.severity === 'WARNING'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[#0F274A] dark:text-[#D4AF37]'
                  }`}
                >
                  {ins.severity} · {ins.module}
                </span>
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">{ins.title}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{ins.summary}</p>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                Source: {ins.evidence}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BillsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ELECTRICITY');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState('MONTHLY');
  const [accountId, setAccountId] = useState(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');

  const today = new Date().toISOString().slice(0, 10);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || Number(amount) <= 0) return;
    await actions.onAddBill({
      title: title.trim(),
      category,
      amount: Number(amount),
      dueDate,
      frequency,
      accountId: accountId ? Number(accountId) : null,
    });
    setTitle('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <tr>
              <th className="py-3 px-4 font-medium">Due Date</th>
              <th className="py-3 px-4 font-medium">Bill / Reminder</th>
              <th className="py-3 px-4 font-medium">Frequency</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Amount</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {snapshot.bills.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                  No recurring bills or reminders added yet.
                </td>
              </tr>
            ) : (
              snapshot.bills.map((b) => {
                const effectiveStatus = b.status === 'PAID' ? 'PAID' : b.dueDate < today ? 'OVERDUE' : 'UPCOMING';
                return (
                  <tr key={b.id}>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs">
                      {formatDateDDMMYYYY(b.dueDate)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{b.title}</div>
                      <div className="text-xs text-slate-500">{b.category.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">{b.frequency}</td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          effectiveStatus === 'PAID'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : effectiveStatus === 'OVERDUE'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatINR(b.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      {b.status !== 'PAID' && (
                        <button
                          type="button"
                          onClick={() => actions.onPayBill(b.id, { accountId: b.accountId, recordExpense: true })}
                          className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete bill ${b.title}`}
                        onClick={() => actions.onDeleteBill(b.id)}
                        className="p-1 text-slate-400 hover:text-red-600 inline-flex align-middle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Bill or Smart Reminder</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. BESCOM Electricity / School Fee)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="ELECTRICITY">Electricity Bill</option>
            <option value="WATER">Water Bill</option>
            <option value="GAS">Gas Bill</option>
            <option value="RENT">Rent</option>
            <option value="SCHOOL_FEES">School Fees</option>
            <option value="INSURANCE">Insurance Premium</option>
            <option value="LOAN_EMI">Loan EMI</option>
            <option value="CREDIT_CARD">Credit Card Bill</option>
            <option value="SIP">SIP Contribution</option>
            <option value="RD">Recurring Deposit</option>
            <option value="INVESTMENT_MATURITY">Investment Maturity</option>
            <option value="TAX_DEADLINE">Tax Deadline</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="number"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
            <option value="ONE_TIME">One Time</option>
          </select>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">No linked account</option>
            {snapshot.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={actions.isBusy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
        >
          Schedule Reminder
        </button>
      </form>
    </div>
  );
}

export function DocumentsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('BANK_STATEMENT');
  const [visibility, setVisibility] = useState('FAMILY');
  const [expiryDate, setExpiryDate] = useState('');
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const filtered = snapshot.documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase()),
  );

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim() || file.name);
    fd.append('category', category);
    fd.append('visibility', visibility);
    if (expiryDate) fd.append('expiryDate', expiryDate);
    await actions.onUploadDocument(fd);
    setTitle('');
    setFile(null);
    setExpiryDate('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by title or category..."
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm w-full sm:w-72"
        />
        <span className="text-xs text-slate-500">
          Private storage · Authenticated family access only (no public URLs)
        </span>
      </div>

      {actions.isPreviewMode ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-6 text-sm text-slate-600 dark:text-slate-300">
          Sign in with Google to upload and download encrypted private family documents stored on the server.
        </div>
      ) : (
        <>
          <form
            onSubmit={handleUpload}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold">Upload Private Financial Document</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="BANK_STATEMENT">Bank Statement</option>
                <option value="INSURANCE_POLICY">Insurance Policy</option>
                <option value="PROPERTY_DOCUMENT">Property Document</option>
                <option value="LOAN_AGREEMENT">Loan Agreement</option>
                <option value="INVESTMENT_STATEMENT">Investment Statement</option>
                <option value="TAX_DOCUMENT">Tax / Form 16 / ITR</option>
                <option value="RECEIPT">Receipt</option>
                <option value="CERTIFICATE">Financial Certificate</option>
              </select>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="FAMILY">Visible to Family</option>
                <option value="ADMINS_ONLY">Admins & Owner Only</option>
                <option value="OWNER_ONLY">Owner Only</option>
              </select>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                title="Optional expiry/renewal date"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 dark:text-slate-300"
              />
              <button
                type="submit"
                disabled={actions.isBusy || !file}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
              >
                <Upload className="w-4 h-4" /> Upload Document
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Document</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Access</th>
                  <th className="py-3 px-4 font-medium">Expiry</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      No documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-xs text-slate-500">{doc.originalFilename}</div>
                      </td>
                      <td className="py-2.5 px-4 text-xs">{doc.category.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-4 text-xs">{doc.visibility.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs">
                        {formatDateDDMMYYYY(doc.expiryDate)}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => actions.onDownloadDocument(doc.id, doc.originalFilename)}
                          className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete document ${doc.title}`}
                          onClick={() => actions.onDeleteDocument(doc.id)}
                          className="text-slate-400 hover:text-red-600 inline-flex align-middle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const SAMPLE_PROMPTS = [
  'What is our total family net worth?',
  'How much did we spend this month and which category is highest?',
  'How much do we need to save for our emergency fund?',
  'Compare our last six months of income and expenses.',
  'How much is remaining for our financial goals?',
];

export function AssistantView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      factsUsed?: string[];
      disclaimer?: string;
    }>
  >([]);

  const handleAsk = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setQuestion('');

    if (actions.isPreviewMode) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sign in with Google to ask the AI Family Financial Assistant questions grounded directly in your encrypted PostgreSQL family ledger.',
          factsUsed: [`Preview workspace: ${snapshot.family.name}`],
          disclaimer: 'Educational guidance only. Not a licensed financial advisor.',
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await actions.onAskAssistant(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer,
          factsUsed: res.factsUsed,
          disclaimer: res.assumptionsOrDisclaimer,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          AI Family Financial Assistant
        </h3>
        <p className="text-xs text-slate-500">
          Answers are generated exclusively from your authorized family PostgreSQL records. Provides educational guidance only—not licensed financial advice.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleAsk(p)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4 min-h-72 flex flex-col justify-between">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">
              Ask a question about your net worth, expenses, budgets, loans, or goals above.
            </p>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg text-sm ${
                  m.role === 'user'
                    ? 'bg-[#0F274A] text-white ml-8'
                    : 'bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 mr-8 space-y-2'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.factsUsed && m.factsUsed.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <span className="font-semibold">Database Evidence:</span> {m.factsUsed.join(' · ')}
                  </div>
                )}
                {m.disclaimer && (
                  <p className="text-[11px] text-slate-500">{m.disclaimer}</p>
                )}
              </div>
            ))
          )}
          {loading && <p className="text-xs text-slate-500">Analyzing authorized family records...</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your family net worth, spending, or savings..."
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> Ask
          </button>
        </form>
      </div>
    </div>
  );
}

export function SettingsView({
  snapshot,
  actions,
  theme,
  onToggleTheme,
  language,
  onChangeLanguage,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: 'en' | 'ta';
  onChangeLanguage: (lang: 'en' | 'ta') => void;
}) {
  const [familyName, setFamilyName] = useState(snapshot.family.name);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4">
          <h3 className="text-sm font-semibold">Appearance & Regional Preferences</h3>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium">Theme Mode</p>
              <p className="text-xs text-slate-500">Switch between Clean Light and Navy & Gold Dark</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Current: {theme === 'dark' ? 'Dark Navy' : 'Light'}
            </button>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium">Display Language</p>
              <p className="text-xs text-slate-500">English active · Tamil navigation ready</p>
            </div>
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as 'en' | 'ta')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
            >
              <option value="en">English (INR · DD-MM-YYYY)</option>
              <option value="ta">தமிழ் (Tamil Navigation)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => actions.onUpdateFamilySettings({ name: familyName })}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
            >
              Rename Family
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4">
          <h3 className="text-sm font-semibold">Security, Isolation & Backup</h3>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <li>· Family-level PostgreSQL isolation: API routes verify your membership before returning or mutating any record.</li>
            <li>· Zero credential storage: Banking passwords, UPI PINs, ATM PINs, and OTPs are never collected or stored.</li>
            <li>· Multi-record operations (transfers, repayments, redemptions) run inside atomic database transactions.</li>
          </ul>
          <button
            type="button"
            onClick={() => actions.onExportBackup()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> Download Complete Family JSON Backup
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
        <h3 className="text-sm font-semibold mb-3">Recent Family Audit History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Entity</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.auditLogs.slice(0, 20).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-3 font-mono font-medium">{log.action}</td>
                  <td className="py-2 px-3">{log.entityType}</td>
                  <td className="py-2 px-3 text-slate-500">{log.actorEmail || log.actorUid}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
