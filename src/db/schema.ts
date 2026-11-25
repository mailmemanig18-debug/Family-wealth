import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const families = pgTable('families', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').default('INR').notNull(),
  language: text('language').default('en').notNull(),
  financialYearStartMonth: integer('financial_year_start_month').default(4).notNull(),
  monthlyEssentialExpenses: numeric('monthly_essential_expenses', { precision: 15, scale: 2 })
    .default('0.00')
    .notNull(),
  emergencyTargetMonths: integer('emergency_target_months').default(6).notNull(),
  monthlySavingsTarget: numeric('monthly_savings_target', { precision: 15, scale: 2 })
    .default('0.00')
    .notNull(),
  createdByUserId: integer('created_by_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const familyMembers = pgTable('family_members', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  invitedEmail: text('invited_email'),
  name: text('name').notNull(),
  relationship: text('relationship').notNull(),
  role: text('role').default('MEMBER').notNull(), // OWNER | ADMIN | MEMBER | READ_ONLY
  ageGroup: text('age_group').default('ADULT').notNull(), // ADULT | MINOR
  canAddTransactions: boolean('can_add_transactions').default(true).notNull(),
  canManageBudgets: boolean('can_manage_budgets').default(false).notNull(),
  canViewInvestments: boolean('can_view_investments').default(true).notNull(),
  responsibilities: text('responsibilities'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialAccounts = pgTable('financial_accounts', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  ownerMemberId: integer('owner_member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  bankName: text('bank_name'),
  accountType: text('account_type').notNull(), // SAVINGS | CURRENT | SALARY | JOINT | CASH | FIXED_DEPOSIT | RECURRING_DEPOSIT | CREDIT_CARD | OTHER
  openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  currentBalance: numeric('current_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  accountId: integer('account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  toAccountId: integer('to_account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  type: text('type').notNull(), // INCOME | EXPENSE | TRANSFER | INVESTMENT_CONTRIBUTION | INVESTMENT_WITHDRAWAL | LOAN_REPAYMENT | GOAL_CONTRIBUTION | GOAL_WITHDRAWAL | BALANCE_ADJUSTMENT
  category: text('category').notNull(),
  subCategory: text('sub_category'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }),
  interestAmount: numeric('interest_amount', { precision: 15, scale: 2 }),
  paymentMethod: text('payment_method').default('UPI').notNull(), // CASH | UPI | BANK_TRANSFER | DEBIT_CARD | CREDIT_CARD | OTHER
  merchantOrSource: text('merchant_or_source'),
  description: text('description'),
  transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurringFrequency: text('recurring_frequency'),
  isExpected: boolean('is_expected').default(false).notNull(),
  status: text('status').default('COMPLETED').notNull(), // COMPLETED | PENDING
  gstTag: boolean('gst_tag').default(false).notNull(),
  linkedEntityType: text('linked_entity_type'),
  linkedEntityId: integer('linked_entity_id'),
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  period: text('period').default('MONTHLY').notNull(), // MONTHLY | WEEKLY | ANNUAL | CUSTOM
  monthKey: text('month_key').notNull(), // YYYY-MM or ALL
  allocatedAmount: numeric('allocated_amount', { precision: 15, scale: 2 }).notNull(),
  alertThresholdPct: integer('alert_threshold_pct').default(80).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  ownerMemberId: integer('owner_member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  purchaseDate: text('purchase_date'),
  purchaseValue: numeric('purchase_value', { precision: 15, scale: 2 }).default('0.00').notNull(),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
  ownershipPercentage: numeric('ownership_percentage', { precision: 5, scale: 2 })
    .default('100.00')
    .notNull(),
  valuationType: text('valuation_type').default('ESTIMATED').notNull(), // ESTIMATED | VERIFIED
  locationOrDescription: text('location_or_description'),
  excludeFromNetWorthDuplicate: boolean('exclude_from_net_worth_duplicate')
    .default(false)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assetValuations = pgTable('asset_valuations', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  assetId: integer('asset_id')
    .references(() => assets.id, { onDelete: 'cascade' })
    .notNull(),
  valuationDate: text('valuation_date').notNull(),
  value: numeric('value', { precision: 15, scale: 2 }).notNull(),
  valuationType: text('valuation_type').default('ESTIMATED').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const investments = pgTable('investments', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  ownerMemberId: integer('owner_member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  purchaseDate: text('purchase_date'),
  investedAmount: numeric('invested_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  units: numeric('units', { precision: 15, scale: 4 }).default('0.0000').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 15, scale: 2 }).default('0.00').notNull(),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).default('0.00').notNull(),
  realizedGain: numeric('realized_gain', { precision: 15, scale: 2 }).default('0.00').notNull(),
  sipMonthlyAmount: numeric('sip_monthly_amount', { precision: 15, scale: 2 })
    .default('0.00')
    .notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const investmentTransactions = pgTable('investment_transactions', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  investmentId: integer('investment_id')
    .references(() => investments.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: integer('account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  txType: text('tx_type').notNull(), // INITIAL_INVESTMENT | CONTRIBUTION | WITHDRAWAL | DIVIDEND_OR_INTEREST | VALUATION_UPDATE
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  units: numeric('units', { precision: 15, scale: 4 }).default('0.0000').notNull(),
  txDate: text('tx_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loans = pgTable('loans', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  lender: text('lender').notNull(),
  principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }).notNull(),
  outstandingPrincipal: numeric('outstanding_principal', { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }).notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  emiAmount: numeric('emi_amount', { precision: 15, scale: 2 }).notNull(),
  emiFrequency: text('emi_frequency').default('MONTHLY').notNull(),
  nextPaymentDate: text('next_payment_date'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loanRepayments = pgTable('loan_repayments', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  loanId: integer('loan_id')
    .references(() => loans.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: integer('account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  paymentDate: text('payment_date').notNull(),
  totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull(),
  principalComponent: numeric('principal_component', { precision: 15, scale: 2 }).notNull(),
  interestComponent: numeric('interest_component', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialGoals = pgTable('financial_goals', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  linkedAccountId: integer('linked_account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  goalType: text('goal_type').notNull(),
  targetAmount: numeric('target_amount', { precision: 15, scale: 2 }).notNull(),
  currentAllocated: numeric('current_allocated', { precision: 15, scale: 2 })
    .default('0.00')
    .notNull(),
  monthlyContribution: numeric('monthly_contribution', { precision: 15, scale: 2 })
    .default('0.00')
    .notNull(),
  targetDate: text('target_date'),
  priority: text('priority').default('MEDIUM').notNull(),
  status: text('status').default('IN_PROGRESS').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goalContributions = pgTable('goal_contributions', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  goalId: integer('goal_id')
    .references(() => financialGoals.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: integer('account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  txType: text('tx_type').notNull(), // CONTRIBUTION | WITHDRAWAL
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  txDate: text('tx_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  accountId: integer('account_id').references(() => financialAccounts.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  frequency: text('frequency').default('MONTHLY').notNull(),
  reminderDaysBefore: integer('reminder_days_before').default(3).notNull(),
  status: text('status').default('UPCOMING').notNull(), // UPCOMING | PAID | OVERDUE
  paidDate: text('paid_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id')
    .references(() => families.id, { onDelete: 'cascade' })
    .notNull(),
  ownerMemberId: integer('owner_member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  originalFilename: text('original_filename').notNull(),
  storedFilename: text('stored_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  expiryDate: text('expiry_date'),
  visibility: text('visibility').default('FAMILY').notNull(), // FAMILY | ADMINS_ONLY | OWNER_ONLY
  notes: text('notes'),
  uploadedByUid: text('uploaded_by_uid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').references(() => families.id, {
    onDelete: 'cascade',
  }),
  actorUid: text('actor_uid').notNull(),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
  accounts: many(financialAccounts),
  transactions: many(transactions),
  budgets: many(budgets),
  assets: many(assets),
  investments: many(investments),
  loans: many(loans),
  goals: many(financialGoals),
  bills: many(bills),
  documents: many(documents),
}));
