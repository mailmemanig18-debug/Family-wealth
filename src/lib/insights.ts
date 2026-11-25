import {
  computeBudgetUtilization,
  computeCashFlowSummary,
  computeEmergencyFundSummary,
  computeNetWorthSummary,
  formatINR,
  toNum,
} from './finance';
import type { FamilyWorkspaceSnapshot } from './types';

export interface FinancialInsight {
  id: string;
  severity: 'POSITIVE' | 'INFO' | 'WARNING' | 'ALERT';
  title: string;
  summary: string;
  evidence: string;
  module: string;
}

export function generateFinancialInsights(
  snapshot: FamilyWorkspaceSnapshot,
  activeMonthKey: string,
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const { family, accounts, transactions, budgets, assets, investments, loans, bills } = snapshot;

  // Compute previous month key
  const [yr, mo] = activeMonthKey.split('-').map(Number);
  const prevDate = new Date(yr, mo - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currentFlow = computeCashFlowSummary(transactions, activeMonthKey);
  const prevFlow = computeCashFlowSummary(transactions, prevMonthKey);
  const netWorth = computeNetWorthSummary(accounts, assets, investments, loans);

  // 1. Month-over-month expense comparison
  if (prevFlow.expenses > 0 && currentFlow.expenses > 0) {
    const deltaPct = ((currentFlow.expenses - prevFlow.expenses) / prevFlow.expenses) * 100;
    const rounded = Math.abs(deltaPct).toFixed(1);
    if (deltaPct >= 10) {
      insights.push({
        id: 'expense-spike',
        severity: 'WARNING',
        title: `Monthly expenses rose by ${rounded}%`,
        summary: `Spending increased from ${formatINR(prevFlow.expenses)} last month to ${formatINR(currentFlow.expenses)} this month.`,
        evidence: `Calculated from completed EXPENSE transactions in ${prevMonthKey} vs ${activeMonthKey}.`,
        module: 'Expenses',
      });
    } else if (deltaPct <= -5) {
      insights.push({
        id: 'expense-drop',
        severity: 'POSITIVE',
        title: `Monthly expenses reduced by ${rounded}%`,
        summary: `Spending dropped from ${formatINR(prevFlow.expenses)} to ${formatINR(currentFlow.expenses)} compared with last month.`,
        evidence: `Calculated from completed EXPENSE transactions in ${prevMonthKey} vs ${activeMonthKey}.`,
        module: 'Expenses',
      });
    }
  }

  // 2. Highest expense category
  const categoryTotals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.status === 'COMPLETED' && tx.type === 'EXPENSE' && tx.transactionDate.startsWith(activeMonthKey)) {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + toNum(tx.amount);
    }
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0 && currentFlow.expenses > 0) {
    const [topCat, topVal] = sortedCategories[0];
    const sharePct = ((topVal / currentFlow.expenses) * 100).toFixed(1);
    insights.push({
      id: 'top-expense-cat',
      severity: 'INFO',
      title: `${topCat} is the highest spending category`,
      summary: `${topCat} accounts for ${formatINR(topVal)} (${sharePct}% of total monthly expenses).`,
      evidence: `Aggregated from ${activeMonthKey} household expense records.`,
      module: 'Expenses',
    });
  }

  // 3. Savings rate evaluation
  if (currentFlow.income > 0) {
    if (currentFlow.savingsRatePct >= 25) {
      insights.push({
        id: 'strong-savings',
        severity: 'POSITIVE',
        title: `Healthy savings rate at ${currentFlow.savingsRatePct}%`,
        summary: `Your family retained ${formatINR(currentFlow.savings)} out of ${formatINR(currentFlow.income)} income this month.`,
        evidence: `Formula: (Monthly Income − Monthly Expenses) ÷ Monthly Income.`,
        module: 'Savings',
      });
    } else if (currentFlow.savings < 0) {
      insights.push({
        id: 'deficit-warning',
        severity: 'ALERT',
        title: `Expenses exceed monthly income by ${formatINR(Math.abs(currentFlow.savings))}`,
        summary: `Cash outflow (${formatINR(currentFlow.expenses)}) is higher than income (${formatINR(currentFlow.income)}).`,
        evidence: `Based on completed transactions for ${activeMonthKey}.`,
        module: 'Budget Planner',
      });
    }
  }

  // 4. Budget alerts
  const budgetStatuses = computeBudgetUtilization(budgets, transactions, activeMonthKey);
  const breached = budgetStatuses.filter((b) => b.status === 'EXCEEDED' || b.status === 'WARNING');
  if (breached.length > 0) {
    const worst = breached.sort((a, b) => b.utilizationPct - a.utilizationPct)[0];
    insights.push({
      id: 'budget-alert',
      severity: worst.status === 'EXCEEDED' ? 'ALERT' : 'WARNING',
      title: `${worst.budget.name} budget at ${worst.utilizationPct}%`,
      summary: `Spent ${formatINR(worst.spent)} of ${formatINR(worst.budget.allocatedAmount)} allocated for ${worst.budget.category}.`,
      evidence: `Alert threshold configured at ${worst.budget.alertThresholdPct}%.`,
      module: 'Budget Planner',
    });
  }

  // 5. Emergency fund readiness
  const essential = toNum(family.monthlyEssentialExpenses);
  if (essential > 0) {
    const emergencyGoals = snapshot.goals.filter((g) => g.goalType === 'EMERGENCY_FUND');
    const emergencyAllocated = emergencyGoals.reduce((acc, g) => acc + toNum(g.currentAllocated), 0);
    const emergencyBalance =
      emergencyAllocated > 0 ? emergencyAllocated : netWorth.liquidCash + netWorth.bankBalance;
    const ef = computeEmergencyFundSummary(essential, family.emergencyTargetMonths, emergencyBalance, 0);
    insights.push({
      id: 'emergency-readiness',
      severity: ef.completionPct >= 100 ? 'POSITIVE' : ef.completionPct >= 50 ? 'INFO' : 'WARNING',
      title: `Emergency fund at ${ef.completionPct}% of ${family.emergencyTargetMonths}-month target`,
      summary: `Covered ${formatINR(ef.currentBalance)} against target of ${formatINR(ef.targetAmount)} (${formatINR(essential)}/mo essentials).`,
      evidence: `Target = Monthly Essential Expenses × ${family.emergencyTargetMonths} months.`,
      module: 'Emergency Fund',
    });
  }

  // 6. Upcoming bills due soon
  const today = new Date().toISOString().slice(0, 10);
  const upcomingBills = bills.filter((b) => b.status !== 'PAID');
  const overdueCount = upcomingBills.filter((b) => b.dueDate < today).length;
  if (overdueCount > 0) {
    insights.push({
      id: 'overdue-bills',
      severity: 'ALERT',
      title: `${overdueCount} overdue bill${overdueCount > 1 ? 's' : ''} require attention`,
      summary: `Unpaid recurring bills or EMIs have passed their scheduled due date.`,
      evidence: `Checked against Bills & Reminders status != PAID and due date < ${today}.`,
      module: 'Bills & Reminders',
    });
  }

  return insights;
}
