export function calculateSIP(input: {
  monthlyInvestment: number;
  annualReturnPct: number;
  years: number;
}) {
  const P = Math.max(0, input.monthlyInvestment);
  const months = Math.max(1, Math.round(input.years * 12));
  const r = Math.max(0, input.annualReturnPct) / 100 / 12;

  const investedAmount = P * months;
  const maturityValue =
    r === 0 ? investedAmount : P * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);

  return {
    investedAmount: Math.round(investedAmount),
    estimatedReturns: Math.round(maturityValue - investedAmount),
    maturityValue: Math.round(maturityValue),
  };
}

export function calculateCompoundInterest(input: {
  initialAmount: number;
  monthlyContribution: number;
  annualRatePct: number;
  years: number;
  compoundingPerYear: number;
}) {
  const P = Math.max(0, input.initialAmount);
  const PMT = Math.max(0, input.monthlyContribution);
  const r = Math.max(0, input.annualRatePct) / 100;
  const t = Math.max(0, input.years);
  const n = Math.max(1, input.compoundingPerYear);

  const principalFuture = P * Math.pow(1 + r / n, n * t);
  const monthlyRate = Math.pow(1 + r / n, n / 12) - 1;
  const months = Math.round(t * 12);
  const contributionFuture =
    monthlyRate === 0
      ? PMT * months
      : PMT * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  const totalInvested = P + PMT * months;
  const totalValue = principalFuture + contributionFuture;

  return {
    totalInvested: Math.round(totalInvested),
    totalInterest: Math.round(totalValue - totalInvested),
    maturityValue: Math.round(totalValue),
  };
}

export function calculateRetirement(input: {
  currentAge: number;
  retirementAge: number;
  currentMonthlyExpenses: number;
  inflationPct: number;
  expectedReturnPct: number;
  existingSavings: number;
  postRetirementYears?: number;
}) {
  const yearsToRetire = Math.max(1, input.retirementAge - input.currentAge);
  const postYears = input.postRetirementYears ?? 25;
  const inf = Math.max(0, input.inflationPct) / 100;
  const ret = Math.max(0, input.expectedReturnPct) / 100;

  const monthlyExpenseAtRetirement = input.currentMonthlyExpenses * Math.pow(1 + inf, yearsToRetire);
  const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12;

  // Real return post-retirement (assuming conservative 7% post-retirement or ret - 1%)
  const postRetReturn = Math.max(0.04, ret - 0.02);
  const realRate = (1 + postRetReturn) / (1 + inf) - 1;
  const requiredCorpus =
    Math.abs(realRate) < 0.0001
      ? annualExpenseAtRetirement * postYears
      : annualExpenseAtRetirement * ((1 - Math.pow(1 + realRate, -postYears)) / realRate);

  const existingSavingsFuture = input.existingSavings * Math.pow(1 + ret, yearsToRetire);
  const shortfall = Math.max(0, requiredCorpus - existingSavingsFuture);

  const monthlyRate = ret / 12;
  const months = yearsToRetire * 12;
  const requiredMonthlySip =
    shortfall === 0
      ? 0
      : monthlyRate === 0
        ? shortfall / months
        : shortfall / (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));

  return {
    yearsToRetire,
    monthlyExpenseAtRetirement: Math.round(monthlyExpenseAtRetirement),
    requiredCorpus: Math.round(requiredCorpus),
    existingSavingsFuture: Math.round(existingSavingsFuture),
    shortfall: Math.round(shortfall),
    requiredMonthlySip: Math.round(requiredMonthlySip),
  };
}

export function calculateFinancialFreedom(input: {
  annualExpenses: number;
  inflationPct: number;
  yearsToFreedom: number;
  safeWithdrawalRatePct: number;
  expectedReturnPct: number;
  currentCorpus: number;
}) {
  const inf = Math.max(0, input.inflationPct) / 100;
  const swr = Math.max(1, input.safeWithdrawalRatePct) / 100;
  const ret = Math.max(0, input.expectedReturnPct) / 100;
  const years = Math.max(1, input.yearsToFreedom);

  const futureAnnualExpenses = input.annualExpenses * Math.pow(1 + inf, years);
  const targetFreedomCorpus = futureAnnualExpenses / swr;
  const futureExistingCorpus = input.currentCorpus * Math.pow(1 + ret, years);
  const gap = Math.max(0, targetFreedomCorpus - futureExistingCorpus);

  const r = ret / 12;
  const n = years * 12;
  const requiredMonthlyInvestment =
    gap === 0 ? 0 : r === 0 ? gap / n : gap / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));

  return {
    futureAnnualExpenses: Math.round(futureAnnualExpenses),
    targetFreedomCorpus: Math.round(targetFreedomCorpus),
    futureExistingCorpus: Math.round(futureExistingCorpus),
    requiredMonthlyInvestment: Math.round(requiredMonthlyInvestment),
  };
}

export function calculateEmergencyFundCalc(input: {
  monthlyEssentialExpenses: number;
  months: number;
  currentSavings: number;
  monthlyContribution: number;
}) {
  const targetFund = Math.max(0, input.monthlyEssentialExpenses) * Math.max(1, input.months);
  const shortfall = Math.max(0, targetFund - Math.max(0, input.currentSavings));
  const monthsToComplete =
    shortfall === 0 ? 0 : input.monthlyContribution > 0 ? Math.ceil(shortfall / input.monthlyContribution) : null;

  return {
    targetFund: Math.round(targetFund),
    shortfall: Math.round(shortfall),
    monthsToComplete,
  };
}

export function calculateLoanEMI(input: {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
}) {
  const P = Math.max(0, input.principal);
  const n = Math.max(1, Math.round(input.tenureMonths));
  const r = Math.max(0, input.annualRatePct) / 100 / 12;

  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalRepayment = emi * n;
  const totalInterest = Math.max(0, totalRepayment - P);

  return {
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalRepayment: Math.round(totalRepayment),
  };
}

export function calculateHomePurchase(input: {
  propertyCost: number;
  downPaymentPct: number;
  interestRatePct: number;
  tenureYears: number;
  additionalCostsPct: number;
}) {
  const cost = Math.max(0, input.propertyCost);
  const downPayment = cost * (Math.max(0, Math.min(100, input.downPaymentPct)) / 100);
  const loanAmount = Math.max(0, cost - downPayment);
  const additionalCosts = cost * (Math.max(0, input.additionalCostsPct) / 100);
  const emiResult = calculateLoanEMI({
    principal: loanAmount,
    annualRatePct: input.interestRatePct,
    tenureMonths: Math.max(1, input.tenureYears) * 12,
  });

  return {
    downPayment: Math.round(downPayment),
    additionalCosts: Math.round(additionalCosts),
    upfrontCashRequired: Math.round(downPayment + additionalCosts),
    loanAmount: Math.round(loanAmount),
    estimatedEmi: emiResult.emi,
    totalLoanInterest: emiResult.totalInterest,
  };
}

export function calculateNetWorthProjection(input: {
  currentNetWorth: number;
  monthlySavings: number;
  expectedReturnPct: number;
}) {
  const horizons = [1, 5, 10, 15, 20];
  const r = Math.max(0, input.expectedReturnPct) / 100 / 12;

  return horizons.map((years) => {
    const months = years * 12;
    const baseFuture = input.currentNetWorth * Math.pow(1 + r, months);
    const contribFuture =
      r === 0
        ? input.monthlySavings * months
        : input.monthlySavings * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
    const projectedNetWorth = Math.round(baseFuture + contribFuture);
    const totalContributions = Math.round(input.currentNetWorth + input.monthlySavings * months);

    return {
      years,
      projectedNetWorth,
      totalContributions,
      estimatedGrowth: projectedNetWorth - totalContributions,
    };
  });
}
