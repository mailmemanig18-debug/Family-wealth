import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBudgetUtilization,
  computeCashFlowSummary,
  computeEmergencyFundSummary,
  computeNetWorthSummary,
  formatDateDDMMYYYY,
  formatINR,
  getIndianFinancialYear,
  simulateDebtPayoff,
} from './finance';
import {
  calculateCompoundInterest,
  calculateHomePurchase,
  calculateLoanEMI,
  calculateNetWorthProjection,
  calculateSIP,
} from './calculators';

test('Indian currency & date formatting works accurately', () => {
  assert.equal(formatINR(125000), '₹1,25,000');
  assert.equal(formatINR(-4500), '-₹4,500');
  assert.equal(formatDateDDMMYYYY('2026-11-25'), '25-11-2026');
  assert.equal(getIndianFinancialYear('2026-04-01'), 'FY 2026-27');
  assert.equal(getIndianFinancialYear('2026-03-31'), 'FY 2025-26');
});

test('Net worth respects ownership percentages, avoids duplicates, and deducts loans', () => {
  const summary = computeNetWorthSummary(
    [
      {
        id: 1,
        familyId: 1,
        ownerMemberId: 1,
        name: 'SBI Savings',
        bankName: 'SBI',
        accountType: 'SAVINGS',
        openingBalance: '10000',
        currentBalance: '50000',
        status: 'ACTIVE',
        notes: null,
      },
      {
        id: 2,
        familyId: 1,
        ownerMemberId: 1,
        name: 'Home Cash',
        bankName: null,
        accountType: 'CASH',
        openingBalance: '5000',
        currentBalance: '10000',
        status: 'ACTIVE',
        notes: null,
      },
      {
        id: 3,
        familyId: 1,
        ownerMemberId: 1,
        name: 'HDFC Credit Card',
        bankName: 'HDFC',
        accountType: 'CREDIT_CARD',
        openingBalance: '0',
        currentBalance: '-8000',
        status: 'ACTIVE',
        notes: null,
      },
    ],
    [
      {
        id: 1,
        familyId: 1,
        ownerMemberId: 1,
        name: 'Joint Flat',
        category: 'RESIDENTIAL_PROPERTY',
        purchaseDate: '2022-01-01',
        purchaseValue: '3000000',
        currentValue: '4000000',
        ownershipPercentage: '50',
        valuationType: 'ESTIMATED',
        locationOrDescription: null,
        excludeFromNetWorthDuplicate: false,
      },
      {
        id: 2,
        familyId: 1,
        ownerMemberId: 1,
        name: 'SBI Savings Mirror',
        category: 'BANK_DEPOSITS',
        purchaseDate: null,
        purchaseValue: '50000',
        currentValue: '50000',
        ownershipPercentage: '100',
        valuationType: 'VERIFIED',
        locationOrDescription: null,
        excludeFromNetWorthDuplicate: true,
      },
    ],
    [
      {
        id: 1,
        familyId: 1,
        ownerMemberId: 1,
        name: 'Nifty 50 Index Fund',
        category: 'MUTUAL_FUNDS',
        purchaseDate: '2023-05-10',
        investedAmount: '100000',
        units: '500',
        purchasePrice: '200',
        currentValue: '140000',
        realizedGain: '0',
        sipMonthlyAmount: '5000',
        notes: null,
      },
    ],
    [
      {
        id: 1,
        familyId: 1,
        memberId: 1,
        name: 'Home Loan',
        category: 'HOME_LOAN',
        lender: 'SBI',
        principalAmount: '2000000',
        outstandingPrincipal: '1200000',
        interestRate: '8.5',
        startDate: '2022-01-01',
        endDate: '2042-01-01',
        emiAmount: '17500',
        emiFrequency: 'MONTHLY',
        nextPaymentDate: '2026-12-05',
        status: 'ACTIVE',
      },
    ],
  );

  // Total assets = 50k (bank) + 10k (cash) + 140k (inv) + 2000k (50% of 40L) = 22,00,000
  assert.equal(summary.totalAssets, 2200000);
  // Total liabilities = 12,00,000 + 8,000 = 12,08,000
  assert.equal(summary.totalLiabilities, 1208000);
  assert.equal(summary.netWorth, 992000);
});

test('Internal transfers and investment contributions do not inflate income or expenses', () => {
  const flow = computeCashFlowSummary(
    [
      {
        id: 1,
        familyId: 1,
        memberId: 1,
        accountId: 1,
        toAccountId: null,
        type: 'INCOME',
        category: 'Monthly Salary',
        subCategory: null,
        amount: '60000',
        principalAmount: null,
        interestAmount: null,
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: 'Employer',
        description: null,
        transactionDate: '2026-11-01',
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        isExpected: false,
        status: 'COMPLETED',
        gstTag: false,
        linkedEntityType: null,
        linkedEntityId: null,
      },
      {
        id: 2,
        familyId: 1,
        memberId: 1,
        accountId: 1,
        toAccountId: null,
        type: 'EXPENSE',
        category: 'Groceries',
        subCategory: null,
        amount: '15000',
        principalAmount: null,
        interestAmount: null,
        paymentMethod: 'UPI',
        merchantOrSource: 'Reliance Fresh',
        description: null,
        transactionDate: '2026-11-05',
        isRecurring: false,
        recurringFrequency: null,
        isExpected: false,
        status: 'COMPLETED',
        gstTag: false,
        linkedEntityType: null,
        linkedEntityId: null,
      },
      {
        id: 3,
        familyId: 1,
        memberId: 1,
        accountId: 1,
        toAccountId: 2,
        type: 'TRANSFER',
        category: 'Account Transfer',
        subCategory: null,
        amount: '20000',
        principalAmount: null,
        interestAmount: null,
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: null,
        description: null,
        transactionDate: '2026-11-06',
        isRecurring: false,
        recurringFrequency: null,
        isExpected: false,
        status: 'COMPLETED',
        gstTag: false,
        linkedEntityType: null,
        linkedEntityId: null,
      },
      {
        id: 4,
        familyId: 1,
        memberId: 1,
        accountId: 1,
        toAccountId: null,
        type: 'INVESTMENT_CONTRIBUTION',
        category: 'SIP',
        subCategory: null,
        amount: '10000',
        principalAmount: null,
        interestAmount: null,
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: 'Zerodha',
        description: null,
        transactionDate: '2026-11-10',
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        isExpected: false,
        status: 'COMPLETED',
        gstTag: false,
        linkedEntityType: null,
        linkedEntityId: null,
      },
    ],
    '2026-11',
  );

  assert.equal(flow.income, 60000);
  assert.equal(flow.expenses, 15000);
  assert.equal(flow.investmentContributionOutflow, 10000);
  assert.equal(flow.savings, 45000);
  assert.equal(flow.savingsRatePct, 75);
});

test('Budget utilization, emergency fund, and debt payoff strategies compute accurately', () => {
  const budgets = computeBudgetUtilization(
    [
      {
        id: 1,
        familyId: 1,
        memberId: null,
        name: 'Household Groceries',
        category: 'Groceries',
        period: 'MONTHLY',
        monthKey: '2026-11',
        allocatedAmount: '10000',
        alertThresholdPct: 80,
      },
    ],
    [
      {
        id: 1,
        familyId: 1,
        memberId: 1,
        accountId: 1,
        toAccountId: null,
        type: 'EXPENSE',
        category: 'Groceries',
        subCategory: null,
        amount: '8500',
        principalAmount: null,
        interestAmount: null,
        paymentMethod: 'UPI',
        merchantOrSource: 'DMart',
        description: null,
        transactionDate: '2026-11-10',
        isRecurring: false,
        recurringFrequency: null,
        isExpected: false,
        status: 'COMPLETED',
        gstTag: false,
        linkedEntityType: null,
        linkedEntityId: null,
      },
    ],
    '2026-11',
  );
  assert.equal(budgets[0].utilizationPct, 85);
  assert.equal(budgets[0].status, 'WARNING');

  const ef = computeEmergencyFundSummary(25000, 6, 90000, 10000);
  assert.equal(ef.targetAmount, 150000);
  assert.equal(ef.completionPct, 60);
  assert.equal(ef.estimatedMonthsToTarget, 6);

  const avalanche = simulateDebtPayoff(
    [
      {
        id: 1,
        familyId: 1,
        memberId: 1,
        name: 'Personal Loan',
        category: 'PERSONAL_LOAN',
        lender: 'HDFC',
        principalAmount: '100000',
        outstandingPrincipal: '60000',
        interestRate: '14',
        startDate: '2025-01-01',
        endDate: null,
        emiAmount: '4000',
        emiFrequency: 'MONTHLY',
        nextPaymentDate: null,
        status: 'ACTIVE',
      },
      {
        id: 2,
        familyId: 1,
        memberId: 1,
        name: 'Gold Loan',
        category: 'GOLD_LOAN',
        lender: 'SBI',
        principalAmount: '50000',
        outstandingPrincipal: '40000',
        interestRate: '9',
        startDate: '2025-06-01',
        endDate: null,
        emiAmount: '2500',
        emiFrequency: 'MONTHLY',
        nextPaymentDate: null,
        status: 'ACTIVE',
      },
    ],
    3000,
    'AVALANCHE',
  );
  assert.equal(avalanche.payoffOrder[0].loanId, 1);
  assert.ok(avalanche.interestSaved > 0);
});

test('Financial calculators match standard formulas', () => {
  const sip = calculateSIP({ monthlyInvestment: 5000, annualReturnPct: 12, years: 10 });
  assert.equal(sip.investedAmount, 600000);
  assert.ok(sip.maturityValue > 1100000 && sip.maturityValue < 1200000);

  const ci = calculateCompoundInterest({
    initialAmount: 100000,
    monthlyContribution: 0,
    annualRatePct: 10,
    years: 5,
    compoundingPerYear: 1,
  });
  assert.equal(ci.maturityValue, 161051);

  const emi = calculateLoanEMI({ principal: 1000000, annualRatePct: 9, tenureMonths: 120 });
  assert.equal(emi.emi, 12668);

  const home = calculateHomePurchase({
    propertyCost: 5000000,
    downPaymentPct: 20,
    interestRatePct: 8.5,
    tenureYears: 20,
    additionalCostsPct: 7,
  });
  assert.equal(home.loanAmount, 4000000);
  assert.equal(home.upfrontCashRequired, 1350000);

  const proj = calculateNetWorthProjection({
    currentNetWorth: 500000,
    monthlySavings: 15000,
    expectedReturnPct: 10,
  });
  assert.equal(proj.length, 5);
  assert.ok(proj[4].projectedNetWorth > proj[0].projectedNetWorth);
});
