import type {
  AssetRecord,
  BudgetRecord,
  FinancialAccountRecord,
  InvestmentRecord,
  LoanRecord,
  TransactionRecord,
} from './types';

export function toPaise(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function toNum(value: number | string | null | undefined): number {
  return fromPaise(toPaise(value));
}

export function formatINR(value: number | string | null | undefined, showDecimals = false): string {
  const num = toNum(value);
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(abs);
  return num < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

export function formatCompactINR(value: number | string | null | undefined): string {
  const num = toNum(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  }
  return formatINR(num, false);
}

export function formatDateDDMMYYYY(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function getIndianFinancialYear(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match) {
    const now = new Date();
    const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `FY ${yr}-${String((yr + 1) % 100).padStart(2, '0')}`;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const fyStart = month >= 4 ? year : year - 1;
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

export function isDateInIndianFY(isoDate: string, fyLabel: string): boolean {
  return getIndianFinancialYear(isoDate) === fyLabel;
}

export interface NetWorthSummary {
  liquidCash: number;
  bankBalance: number;
  investmentValue: number;
  physicalAssetsValue: number;
  totalAssets: number;
  loanLiabilities: number;
  creditCardLiabilities: number;
  totalLiabilities: number;
  netWorth: number;
}

export function computeNetWorthSummary(
  accounts: FinancialAccountRecord[],
  assets: AssetRecord[],
  investments: InvestmentRecord[],
  loans: LoanRecord[],
): NetWorthSummary {
  let cashPaise = 0;
  let bankPaise = 0;
  let cardLiabilityPaise = 0;

  for (const acc of accounts) {
    if (acc.status !== 'ACTIVE') continue;
    const bal = toPaise(acc.currentBalance);
    if (acc.accountType === 'CASH') {
      cashPaise += bal;
    } else if (acc.accountType === 'CREDIT_CARD') {
      // Credit card balances stored as negative (owed) or positive owed
      cardLiabilityPaise += bal < 0 ? Math.abs(bal) : bal;
    } else {
      bankPaise += bal;
    }
  }

  let investmentPaise = 0;
  for (const inv of investments) {
    investmentPaise += toPaise(inv.currentValue);
  }

  let physicalAssetPaise = 0;
  for (const asset of assets) {
    if (asset.excludeFromNetWorthDuplicate) continue;
    const pct = Number(asset.ownershipPercentage || '100') / 100;
    physicalAssetPaise += Math.round(toPaise(asset.currentValue) * Math.max(0, Math.min(1, pct)));
  }

  let loanLiabilityPaise = 0;
  for (const loan of loans) {
    if (loan.status !== 'ACTIVE') continue;
    loanLiabilityPaise += Math.max(0, toPaise(loan.outstandingPrincipal));
  }

  const totalAssetsPaise = cashPaise + bankPaise + investmentPaise + physicalAssetPaise;
  const totalLiabilitiesPaise = loanLiabilityPaise + cardLiabilityPaise;

  return {
    liquidCash: fromPaise(cashPaise),
    bankBalance: fromPaise(bankPaise),
    investmentValue: fromPaise(investmentPaise),
    physicalAssetsValue: fromPaise(physicalAssetPaise),
    totalAssets: fromPaise(totalAssetsPaise),
    loanLiabilities: fromPaise(loanLiabilityPaise),
    creditCardLiabilities: fromPaise(cardLiabilityPaise),
    totalLiabilities: fromPaise(totalLiabilitiesPaise),
    netWorth: fromPaise(totalAssetsPaise - totalLiabilitiesPaise),
  };
}

export interface CashFlowSummary {
  income: number;
  expenses: number;
  debtRepaymentOutflow: number;
  investmentContributionOutflow: number;
  savings: number;
  savingsRatePct: number;
}

export function computeCashFlowSummary(
  transactions: TransactionRecord[],
  monthPrefix?: string,
  memberId?: number | null,
  accountId?: number | null,
): CashFlowSummary {
  let incomePaise = 0;
  let expensePaise = 0;
  let debtPaise = 0;
  let investPaise = 0;

  for (const tx of transactions) {
    if (tx.status !== 'COMPLETED') continue;
    if (monthPrefix && !tx.transactionDate.startsWith(monthPrefix)) continue;
    if (memberId && tx.memberId !== memberId) continue;
    if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) continue;

    const amt = toPaise(tx.amount);
    switch (tx.type) {
      case 'INCOME':
        incomePaise += amt;
        break;
      case 'EXPENSE':
        expensePaise += amt;
        break;
      case 'LOAN_REPAYMENT':
        debtPaise += amt;
        // Interest portion is a financing expense, principal reduces liability
        if (tx.interestAmount) {
          expensePaise += toPaise(tx.interestAmount);
        }
        break;
      case 'INVESTMENT_CONTRIBUTION':
        investPaise += amt;
        break;
      // TRANSFER, GOAL_CONTRIBUTION, GOAL_WITHDRAWAL, BALANCE_ADJUSTMENT never inflate income/expenses
      default:
        break;
    }
  }

  const savingsPaise = incomePaise - expensePaise;
  const savingsRatePct =
    incomePaise > 0 ? Number(((savingsPaise / incomePaise) * 100).toFixed(1)) : 0;

  return {
    income: fromPaise(incomePaise),
    expenses: fromPaise(expensePaise),
    debtRepaymentOutflow: fromPaise(debtPaise),
    investmentContributionOutflow: fromPaise(investPaise),
    savings: fromPaise(savingsPaise),
    savingsRatePct,
  };
}

export interface BudgetUtilization {
  budget: BudgetRecord;
  spent: number;
  remaining: number;
  utilizationPct: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
}

export function computeBudgetUtilization(
  budgets: BudgetRecord[],
  transactions: TransactionRecord[],
  activeMonthKey: string,
): BudgetUtilization[] {
  return budgets.map((budget) => {
    const allocatedPaise = toPaise(budget.allocatedAmount);
    let spentPaise = 0;

    for (const tx of transactions) {
      if (tx.status !== 'COMPLETED' || tx.type !== 'EXPENSE') continue;
      if (budget.category !== 'ALL' && tx.category !== budget.category) continue;
      if (budget.memberId && tx.memberId !== budget.memberId) continue;

      if (budget.period === 'MONTHLY') {
        const key = budget.monthKey === 'ALL' ? activeMonthKey : budget.monthKey;
        if (!tx.transactionDate.startsWith(key)) continue;
      } else if (budget.period === 'ANNUAL') {
        const yr = activeMonthKey.slice(0, 4);
        if (!tx.transactionDate.startsWith(yr)) continue;
      } else if (budget.monthKey !== 'ALL' && !tx.transactionDate.startsWith(budget.monthKey)) {
        continue;
      }

      spentPaise += toPaise(tx.amount);
    }

    const utilizationPct =
      allocatedPaise > 0 ? Number(((spentPaise / allocatedPaise) * 100).toFixed(1)) : 0;
    const status: 'OK' | 'WARNING' | 'EXCEEDED' =
      spentPaise > allocatedPaise
        ? 'EXCEEDED'
        : utilizationPct >= budget.alertThresholdPct
          ? 'WARNING'
          : 'OK';

    return {
      budget,
      spent: fromPaise(spentPaise),
      remaining: fromPaise(allocatedPaise - spentPaise),
      utilizationPct,
      status,
    };
  });
}

export interface EmergencyFundSummary {
  targetAmount: number;
  currentBalance: number;
  completionPct: number;
  remainingAmount: number;
  estimatedMonthsToTarget: number | null;
}

export function computeEmergencyFundSummary(
  monthlyEssentialExpenses: number,
  targetMonths: number,
  currentEmergencyBalance: number,
  monthlyContribution: number,
): EmergencyFundSummary {
  const targetPaise = toPaise(monthlyEssentialExpenses) * Math.max(1, targetMonths);
  const currentPaise = Math.max(0, toPaise(currentEmergencyBalance));
  const remainingPaise = Math.max(0, targetPaise - currentPaise);
  const completionPct =
    targetPaise > 0 ? Math.min(100, Number(((currentPaise / targetPaise) * 100).toFixed(1))) : 0;

  let estimatedMonthsToTarget: number | null = null;
  if (remainingPaise === 0 && targetPaise > 0) {
    estimatedMonthsToTarget = 0;
  } else if (monthlyContribution > 0 && remainingPaise > 0) {
    estimatedMonthsToTarget = Math.ceil(remainingPaise / toPaise(monthlyContribution));
  }

  return {
    targetAmount: fromPaise(targetPaise),
    currentBalance: fromPaise(currentPaise),
    completionPct,
    remainingAmount: fromPaise(remainingPaise),
    estimatedMonthsToTarget,
  };
}

export interface DebtPayoffPlan {
  strategy: 'AVALANCHE' | 'SNOWBALL' | 'CUSTOM';
  totalMonths: number;
  totalInterestPaid: number;
  baselineInterestPaid: number;
  interestSaved: number;
  payoffOrder: Array<{
    loanId: number;
    name: string;
    lender: string;
    outstandingPrincipal: number;
    interestRate: number;
    emiAmount: number;
    monthsToPayoff: number;
  }>;
}

export function simulateDebtPayoff(
  loans: LoanRecord[],
  extraMonthlyPayment: number,
  strategy: 'AVALANCHE' | 'SNOWBALL' | 'CUSTOM',
  customOrderIds?: number[],
): DebtPayoffPlan {
  const active = loans
    .filter((l) => l.status === 'ACTIVE' && toNum(l.outstandingPrincipal) > 0)
    .map((l) => ({
      id: l.id,
      name: l.name,
      lender: l.lender,
      balance: toNum(l.outstandingPrincipal),
      rate: toNum(l.interestRate),
      emi: Math.max(1, toNum(l.emiAmount)),
    }));

  if (active.length === 0) {
    return {
      strategy,
      totalMonths: 0,
      totalInterestPaid: 0,
      baselineInterestPaid: 0,
      interestSaved: 0,
      payoffOrder: [],
    };
  }

  const runSimulation = (extra: number) => {
    const items = active.map((a) => ({ ...a, monthsToPayoff: 0 }));
    if (strategy === 'AVALANCHE') {
      items.sort((a, b) => b.rate - a.rate);
    } else if (strategy === 'SNOWBALL') {
      items.sort((a, b) => a.balance - b.balance);
    } else if (strategy === 'CUSTOM' && customOrderIds?.length) {
      items.sort((a, b) => {
        const ia = customOrderIds.indexOf(a.id);
        const ib = customOrderIds.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }

    let months = 0;
    let totalInterest = 0;
    const maxMonths = 480;

    while (items.some((i) => i.balance > 0.01) && months < maxMonths) {
      months += 1;
      let freedEmiPool = extra;

      for (const item of items) {
        if (item.balance <= 0.01) {
          freedEmiPool += item.emi;
          continue;
        }
        const monthlyInterest = (item.balance * (item.rate / 100)) / 12;
        totalInterest += monthlyInterest;
        const payment = Math.min(item.balance + monthlyInterest, item.emi);
        item.balance = Math.max(0, item.balance + monthlyInterest - payment);
        if (item.balance <= 0.01 && item.monthsToPayoff === 0) {
          item.monthsToPayoff = months;
        }
      }

      // Apply snowball/avalanche extra pool to highest-priority remaining loan
      for (const item of items) {
        if (item.balance > 0.01 && freedEmiPool > 0) {
          const extraApplied = Math.min(item.balance, freedEmiPool);
          item.balance = Math.max(0, item.balance - extraApplied);
          freedEmiPool -= extraApplied;
          if (item.balance <= 0.01 && item.monthsToPayoff === 0) {
            item.monthsToPayoff = months;
          }
        }
      }
    }

    return {
      months,
      totalInterest: Number(totalInterest.toFixed(2)),
      items,
    };
  };

  const baseline = runSimulation(0);
  const accelerated = runSimulation(Math.max(0, extraMonthlyPayment));

  return {
    strategy,
    totalMonths: accelerated.months,
    totalInterestPaid: accelerated.totalInterest,
    baselineInterestPaid: baseline.totalInterest,
    interestSaved: Math.max(0, Number((baseline.totalInterest - accelerated.totalInterest).toFixed(2))),
    payoffOrder: accelerated.items.map((item) => {
      const orig = active.find((a) => a.id === item.id)!;
      return {
        loanId: item.id,
        name: item.name,
        lender: item.lender,
        outstandingPrincipal: orig.balance,
        interestRate: orig.rate,
        emiAmount: orig.emi,
        monthsToPayoff: item.monthsToPayoff || accelerated.months,
      };
    }),
  };
}
