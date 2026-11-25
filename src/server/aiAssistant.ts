import { GoogleGenAI, Type } from '@google/genai';
import {
  computeBudgetUtilization,
  computeCashFlowSummary,
  computeEmergencyFundSummary,
  computeNetWorthSummary,
  formatINR,
  toNum,
} from '../lib/finance.ts';
import type { FamilyWorkspaceSnapshot } from '../lib/types.ts';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function askFamilyWealthAssistant(
  question: string,
  snapshot: FamilyWorkspaceSnapshot,
) {
  const ai = getAiClient();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const netWorth = computeNetWorthSummary(
    snapshot.accounts,
    snapshot.assets,
    snapshot.investments,
    snapshot.loans,
  );
  const currentMonthFlow = computeCashFlowSummary(snapshot.transactions, currentMonth);

  // Last 6 months cash flow history
  const monthlyHistory = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyHistory.push({ month: key, ...computeCashFlowSummary(snapshot.transactions, key) });
  }

  // Expense breakdown for current month
  const categoryTotals: Record<string, number> = {};
  for (const tx of snapshot.transactions) {
    if (tx.status === 'COMPLETED' && tx.type === 'EXPENSE' && tx.transactionDate.startsWith(currentMonth)) {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + toNum(tx.amount);
    }
  }

  const budgets = computeBudgetUtilization(snapshot.budgets, snapshot.transactions, currentMonth);
  const efGoalBal = snapshot.goals
    .filter((g) => g.goalType === 'EMERGENCY_FUND')
    .reduce((acc, g) => acc + toNum(g.currentAllocated), 0);
  const efSummary = computeEmergencyFundSummary(
    toNum(snapshot.family.monthlyEssentialExpenses),
    snapshot.family.emergencyTargetMonths,
    efGoalBal,
    0,
  );

  const authorizedContext = {
    familyName: snapshot.family.name,
    currentUserRole: snapshot.currentMember.role,
    currentMonth,
    netWorthSummary: netWorth,
    currentMonthCashFlow: currentMonthFlow,
    last6MonthsCashFlow: monthlyHistory,
    currentMonthExpenseByCategory: categoryTotals,
    budgets: budgets.map((b) => ({
      name: b.budget.name,
      category: b.budget.category,
      allocated: toNum(b.budget.allocatedAmount),
      spent: b.spent,
      utilizationPct: b.utilizationPct,
    })),
    emergencyFund: efSummary,
    goals: snapshot.goals.map((g) => ({
      title: g.title,
      type: g.goalType,
      target: toNum(g.targetAmount),
      allocated: toNum(g.currentAllocated),
      remaining: Math.max(0, toNum(g.targetAmount) - toNum(g.currentAllocated)),
      targetDate: g.targetDate,
    })),
    loans: snapshot.loans.map((l) => ({
      name: l.name,
      lender: l.lender,
      outstandingPrincipal: toNum(l.outstandingPrincipal),
      interestRatePct: toNum(l.interestRate),
      emiAmount: toNum(l.emiAmount),
    })),
    investmentsAllowed: snapshot.currentMember.canViewInvestments,
    investments: snapshot.currentMember.canViewInvestments
      ? snapshot.investments.map((i) => ({
          name: i.name,
          category: i.category,
          invested: toNum(i.investedAmount),
          currentValue: toNum(i.currentValue),
        }))
      : 'Restricted by family permissions',
    upcomingBills: snapshot.bills
      .filter((b) => b.status !== 'PAID')
      .map((b) => ({ title: b.title, amount: toNum(b.amount), dueDate: b.dueDate, status: b.status })),
  };

  const systemInstruction = `You are the Family Wealth OS educational financial assistant for an Indian household.
Rules:
1. Answer ONLY using the authorized family financial data provided in the JSON context.
2. NEVER fabricate transactions, balances, or account numbers. If a record is zero or empty, state clearly that no records exist yet.
3. Format all currency in Indian Rupees (₹) using Indian numbering (e.g., ${formatINR(125000)}).
4. Clearly distinguish historical database facts from mathematical estimates or projections, and state assumptions explicitly.
5. You provide educational financial guidance only, NOT licensed investment, tax, or legal advice.
6. Never claim to execute transactions autonomously. If the user asks to log an expense, income, or goal, explain that they can confirm the action using the confirmation prompt, and populate suggestedAction only when appropriate.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Authorized Family Financial Context:\n${JSON.stringify(authorizedContext, null, 2)}\n\nUser Question: ${question}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: 'Clear, helpful answer grounded strictly in the authorized context, with INR formatting and educational disclaimer if projecting.',
          },
          factsUsed: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Bullet list of exact database metrics cited.',
          },
          assumptionsOrDisclaimer: {
            type: Type.STRING,
            description: 'Assumptions used for any estimate plus educational-only notice.',
          },
        },
        required: ['answer', 'factsUsed', 'assumptionsOrDisclaimer'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return parsed;
}
