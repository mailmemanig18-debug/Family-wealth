export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'READ_ONLY';

export type NavSectionId =
  | 'dashboard'
  | 'family'
  | 'income'
  | 'expenses'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'savings'
  | 'emergency'
  | 'assets'
  | 'investments'
  | 'loans'
  | 'goals'
  | 'calculators'
  | 'reports'
  | 'intelligence'
  | 'bills'
  | 'documents'
  | 'assistant'
  | 'settings';

export interface FamilyProfile {
  id: number;
  name: string;
  currency: string;
  language: string;
  financialYearStartMonth: number;
  monthlyEssentialExpenses: string;
  emergencyTargetMonths: number;
  monthlySavingsTarget: string;
}

export interface FamilyMemberRecord {
  id: number;
  familyId: number;
  userId: number | null;
  invitedEmail: string | null;
  name: string;
  relationship: string;
  role: Role;
  ageGroup: 'ADULT' | 'MINOR';
  canAddTransactions: boolean;
  canManageBudgets: boolean;
  canViewInvestments: boolean;
  responsibilities: string | null;
}

export interface FinancialAccountRecord {
  id: number;
  familyId: number;
  ownerMemberId: number | null;
  name: string;
  bankName: string | null;
  accountType: string;
  openingBalance: string;
  currentBalance: string;
  status: string;
  notes: string | null;
}

export interface TransactionRecord {
  id: number;
  familyId: number;
  memberId: number | null;
  accountId: number | null;
  toAccountId: number | null;
  type:
    | 'INCOME'
    | 'EXPENSE'
    | 'TRANSFER'
    | 'INVESTMENT_CONTRIBUTION'
    | 'INVESTMENT_WITHDRAWAL'
    | 'LOAN_REPAYMENT'
    | 'GOAL_CONTRIBUTION'
    | 'GOAL_WITHDRAWAL'
    | 'BALANCE_ADJUSTMENT';
  category: string;
  subCategory: string | null;
  amount: string;
  principalAmount: string | null;
  interestAmount: string | null;
  paymentMethod: string;
  merchantOrSource: string | null;
  description: string | null;
  transactionDate: string;
  isRecurring: boolean;
  recurringFrequency: string | null;
  isExpected: boolean;
  status: string;
  gstTag: boolean;
  linkedEntityType: string | null;
  linkedEntityId: number | null;
}

export interface BudgetRecord {
  id: number;
  familyId: number;
  memberId: number | null;
  name: string;
  category: string;
  period: string;
  monthKey: string;
  allocatedAmount: string;
  alertThresholdPct: number;
}

export interface AssetRecord {
  id: number;
  familyId: number;
  ownerMemberId: number | null;
  name: string;
  category: string;
  purchaseDate: string | null;
  purchaseValue: string;
  currentValue: string;
  ownershipPercentage: string;
  valuationType: 'ESTIMATED' | 'VERIFIED';
  locationOrDescription: string | null;
  excludeFromNetWorthDuplicate: boolean;
}

export interface AssetValuationRecord {
  id: number;
  assetId: number;
  valuationDate: string;
  value: string;
  valuationType: string;
  notes: string | null;
}

export interface InvestmentRecord {
  id: number;
  familyId: number;
  ownerMemberId: number | null;
  name: string;
  category: string;
  purchaseDate: string | null;
  investedAmount: string;
  units: string;
  purchasePrice: string;
  currentValue: string;
  realizedGain: string;
  sipMonthlyAmount: string;
  notes: string | null;
}

export interface InvestmentTransactionRecord {
  id: number;
  investmentId: number;
  accountId: number | null;
  txType: string;
  amount: string;
  units: string;
  txDate: string;
  notes: string | null;
}

export interface LoanRecord {
  id: number;
  familyId: number;
  memberId: number | null;
  name: string;
  category: string;
  lender: string;
  principalAmount: string;
  outstandingPrincipal: string;
  interestRate: string;
  startDate: string | null;
  endDate: string | null;
  emiAmount: string;
  emiFrequency: string;
  nextPaymentDate: string | null;
  status: string;
}

export interface LoanRepaymentRecord {
  id: number;
  loanId: number;
  accountId: number | null;
  paymentDate: string;
  totalPaid: string;
  principalComponent: string;
  interestComponent: string;
  notes: string | null;
}

export interface FinancialGoalRecord {
  id: number;
  familyId: number;
  memberId: number | null;
  linkedAccountId: number | null;
  title: string;
  goalType: string;
  targetAmount: string;
  currentAllocated: string;
  monthlyContribution: string;
  targetDate: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
}

export interface GoalContributionRecord {
  id: number;
  goalId: number;
  accountId: number | null;
  txType: string;
  amount: string;
  txDate: string;
  notes: string | null;
}

export interface BillRecord {
  id: number;
  familyId: number;
  memberId: number | null;
  accountId: number | null;
  title: string;
  category: string;
  amount: string;
  dueDate: string;
  frequency: string;
  reminderDaysBefore: number;
  status: 'UPCOMING' | 'PAID' | 'OVERDUE';
  paidDate: string | null;
  notes: string | null;
}

export interface DocumentRecord {
  id: number;
  familyId: number;
  ownerMemberId: number | null;
  title: string;
  category: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  expiryDate: string | null;
  visibility: string;
  notes: string | null;
  createdAt: string;
}

export interface AuditLogRecord {
  id: number;
  familyId: number | null;
  actorUid: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface FamilyWorkspaceSnapshot {
  family: FamilyProfile;
  currentMember: FamilyMemberRecord;
  members: FamilyMemberRecord[];
  accounts: FinancialAccountRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  assets: AssetRecord[];
  assetValuations: AssetValuationRecord[];
  investments: InvestmentRecord[];
  investmentTransactions: InvestmentTransactionRecord[];
  loans: LoanRecord[];
  loanRepayments: LoanRepaymentRecord[];
  goals: FinancialGoalRecord[];
  goalContributions: GoalContributionRecord[];
  bills: BillRecord[];
  documents: DocumentRecord[];
  auditLogs: AuditLogRecord[];
}
