import { and, desc, eq, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  assets,
  assetValuations,
  auditLogs,
  bills,
  budgets,
  documents,
  families,
  familyMembers,
  financialAccounts,
  financialGoals,
  goalContributions,
  investments,
  investmentTransactions,
  loanRepayments,
  loans,
  transactions,
  users,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  photoUrl?: string | null,
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email.toLowerCase(),
        displayName: displayName ?? null,
        photoUrl: photoUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email.toLowerCase(),
          displayName: displayName ?? null,
          photoUrl: photoUrl ?? null,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('getOrCreateUser failed:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserFamilies(userId: number, email: string) {
  const normalizedEmail = email.toLowerCase();
  const memberships = await db
    .select({
      member: familyMembers,
      family: families,
    })
    .from(familyMembers)
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(
      or(
        eq(familyMembers.userId, userId),
        eq(familyMembers.invitedEmail, normalizedEmail),
      ),
    );

  // Automatically link invited email memberships to this authenticated userId
  for (const row of memberships) {
    if (!row.member.userId && row.member.invitedEmail === normalizedEmail) {
      await db
        .update(familyMembers)
        .set({ userId })
        .where(eq(familyMembers.id, row.member.id));
      row.member.userId = userId;
    }
  }

  return memberships;
}

export async function resolveAuthorizedFamily(
  userId: number,
  email: string,
  displayName: string | null | undefined,
  requestedFamilyId?: number,
) {
  let memberships = await getUserFamilies(userId, email);

  if (memberships.length === 0) {
    const defaultName = displayName ? `${displayName.split(' ')[0]}'s Family` : 'My Family';
    const created = await db.transaction(async (tx) => {
      const [fam] = await tx
        .insert(families)
        .values({
          name: defaultName,
          currency: 'INR',
          language: 'en',
          financialYearStartMonth: 4,
          monthlyEssentialExpenses: '0.00',
          emergencyTargetMonths: 6,
          monthlySavingsTarget: '0.00',
          createdByUserId: userId,
        })
        .returning();

      const [member] = await tx
        .insert(familyMembers)
        .values({
          familyId: fam.id,
          userId,
          invitedEmail: email.toLowerCase(),
          name: displayName || email.split('@')[0],
          relationship: 'Family Administrator',
          role: 'OWNER',
          ageGroup: 'ADULT',
          canAddTransactions: true,
          canManageBudgets: true,
          canViewInvestments: true,
          responsibilities: 'Primary Family Owner',
        })
        .returning();

      await tx.insert(auditLogs).values({
        familyId: fam.id,
        actorUid: String(userId),
        actorEmail: email,
        action: 'CREATE_FAMILY',
        entityType: 'FAMILY',
        entityId: String(fam.id),
        details: `Created family workspace "${fam.name}"`,
      });

      return { family: fam, member };
    });
    return created;
  }

  if (requestedFamilyId) {
    const match = memberships.find((m) => m.family.id === requestedFamilyId);
    if (!match) {
      throw new Error('FORBIDDEN_FAMILY');
    }
    return match;
  }

  return memberships[0];
}

export async function getFamilySnapshot(familyId: number, currentMemberId: number) {
  try {
    const [familyRows, memberRows, accountRows, txRows, budgetRows, assetRows, valRows, invRows, invTxRows, loanRows, repRows, goalRows, goalContribRows, billRows, docRows, auditRows] =
      await Promise.all([
        db.select().from(families).where(eq(families.id, familyId)),
        db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId)).orderBy(familyMembers.id),
        db.select().from(financialAccounts).where(eq(financialAccounts.familyId, familyId)).orderBy(financialAccounts.id),
        db.select().from(transactions).where(eq(transactions.familyId, familyId)).orderBy(desc(transactions.transactionDate), desc(transactions.id)),
        db.select().from(budgets).where(eq(budgets.familyId, familyId)).orderBy(budgets.id),
        db.select().from(assets).where(eq(assets.familyId, familyId)).orderBy(assets.id),
        db.select().from(assetValuations).where(eq(assetValuations.familyId, familyId)).orderBy(desc(assetValuations.valuationDate)),
        db.select().from(investments).where(eq(investments.familyId, familyId)).orderBy(investments.id),
        db.select().from(investmentTransactions).where(eq(investmentTransactions.familyId, familyId)).orderBy(desc(investmentTransactions.txDate)),
        db.select().from(loans).where(eq(loans.familyId, familyId)).orderBy(loans.id),
        db.select().from(loanRepayments).where(eq(loanRepayments.familyId, familyId)).orderBy(desc(loanRepayments.paymentDate)),
        db.select().from(financialGoals).where(eq(financialGoals.familyId, familyId)).orderBy(financialGoals.id),
        db.select().from(goalContributions).where(eq(goalContributions.familyId, familyId)).orderBy(desc(goalContributions.txDate)),
        db.select().from(bills).where(eq(bills.familyId, familyId)).orderBy(bills.dueDate),
        db.select().from(documents).where(eq(documents.familyId, familyId)).orderBy(desc(documents.createdAt)),
        db.select().from(auditLogs).where(eq(auditLogs.familyId, familyId)).orderBy(desc(auditLogs.createdAt)).limit(100),
      ]);

    const currentMember = memberRows.find((m) => m.id === currentMemberId) || memberRows[0];
    const isAdminOrOwner = currentMember.role === 'OWNER' || currentMember.role === 'ADMIN';

    // Respect age-appropriate / member-level investment & document privacy
    const visibleInvestments = currentMember.canViewInvestments ? invRows : [];
    const visibleDocuments = docRows.filter((d) => {
      if (d.visibility === 'FAMILY') return true;
      if (d.visibility === 'ADMINS_ONLY') return isAdminOrOwner;
      if (d.visibility === 'OWNER_ONLY') return currentMember.role === 'OWNER' || d.ownerMemberId === currentMember.id;
      return true;
    });

    return {
      family: familyRows[0],
      currentMember,
      members: memberRows,
      accounts: accountRows,
      transactions: txRows,
      budgets: budgetRows,
      assets: assetRows,
      assetValuations: valRows,
      investments: visibleInvestments,
      investmentTransactions: currentMember.canViewInvestments ? invTxRows : [],
      loans: loanRows,
      loanRepayments: repRows,
      goals: goalRows,
      goalContributions: goalContribRows,
      bills: billRows,
      documents: visibleDocuments.map(({ storedFilename: _hidden, ...rest }) => rest),
      auditLogs: isAdminOrOwner ? auditRows : auditRows.slice(0, 15),
    };
  } catch (error) {
    console.error('getFamilySnapshot failed:', error);
    throw new Error('Failed to load family financial records.', { cause: error });
  }
}

export async function logAudit(
  familyId: number,
  actorUid: string,
  actorEmail: string | undefined,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: string,
) {
  await db.insert(auditLogs).values({
    familyId,
    actorUid,
    actorEmail: actorEmail ?? null,
    action,
    entityType,
    entityId: entityId !== null ? String(entityId) : null,
    details,
  });
}

export async function seedMiddleClassSampleFamily(familyId: number, ownerMemberId: number, actorUid: string, actorEmail?: string) {
  return db.transaction(async (tx) => {
    // Only seed if family has no accounts or transactions yet to protect existing data
    const existingAccounts = await tx
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.familyId, familyId));
    if (existingAccounts.length > 0) {
      throw new Error('Family already contains financial records. Clear or add records manually.');
    }

    await tx
      .update(families)
      .set({
        monthlyEssentialExpenses: '28000.00',
        emergencyTargetMonths: 6,
        monthlySavingsTarget: '14000.00',
      })
      .where(eq(families.id, familyId));

    const [spouse] = await tx
      .insert(familyMembers)
      .values({
        familyId,
        name: 'Priya',
        relationship: 'Spouse',
        role: 'ADMIN',
        ageGroup: 'ADULT',
        canAddTransactions: true,
        canManageBudgets: true,
        canViewInvestments: true,
        responsibilities: 'Household Budgets & Groceries',
      })
      .returning();

    const [child] = await tx
      .insert(familyMembers)
      .values({
        familyId,
        name: 'Aarav',
        relationship: 'Child',
        role: 'READ_ONLY',
        ageGroup: 'MINOR',
        canAddTransactions: false,
        canManageBudgets: false,
        canViewInvestments: false,
        responsibilities: 'Education Savings Observer',
      })
      .returning();

    const [sbiAcc, hdfcJoint, cashWallet, iciciCard] = await tx
      .insert(financialAccounts)
      .values([
        {
          familyId,
          ownerMemberId,
          name: 'SBI Salary Account',
          bankName: 'State Bank of India',
          accountType: 'SALARY',
          openingBalance: '45000.00',
          currentBalance: '78500.00',
          status: 'ACTIVE',
        },
        {
          familyId,
          ownerMemberId: spouse.id,
          name: 'HDFC Family Savings',
          bankName: 'HDFC Bank',
          accountType: 'JOINT',
          openingBalance: '110000.00',
          currentBalance: '132000.00',
          status: 'ACTIVE',
        },
        {
          familyId,
          ownerMemberId,
          name: 'Household Cash Wallet',
          bankName: 'Cash',
          accountType: 'CASH',
          openingBalance: '8000.00',
          currentBalance: '6500.00',
          status: 'ACTIVE',
        },
        {
          familyId,
          ownerMemberId,
          name: 'ICICI Platinum Card',
          bankName: 'ICICI Bank',
          accountType: 'CREDIT_CARD',
          openingBalance: '0.00',
          currentBalance: '-6400.00',
          status: 'ACTIVE',
        },
      ])
      .returning();

    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const prevD = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevYm = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;

    await tx.insert(transactions).values([
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        type: 'INCOME',
        category: 'Monthly salary',
        amount: '48000.00',
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: 'TechServe India Pvt Ltd',
        description: 'Monthly net salary credited',
        transactionDate: `${ym}-01`,
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: hdfcJoint.id,
        type: 'INCOME',
        category: 'Freelance income',
        amount: '12000.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'Home Tailoring & Tuition',
        description: 'Monthly tuition fees received',
        transactionDate: `${ym}-05`,
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        type: 'EXPENSE',
        category: 'House rent',
        amount: '14000.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'Landlord Rajesh Kumar',
        description: '2BHK monthly house rent',
        transactionDate: `${ym}-03`,
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: hdfcJoint.id,
        type: 'EXPENSE',
        category: 'Groceries',
        amount: '6800.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'DMart & Local Vegetable Market',
        description: 'Monthly provisions and fresh produce',
        transactionDate: `${ym}-07`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: sbiAcc.id,
        type: 'EXPENSE',
        category: 'Education',
        amount: '4500.00',
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: 'Kendriya Vidyalaya Fee',
        description: 'School tuition & transport',
        transactionDate: `${ym}-08`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        type: 'EXPENSE',
        category: 'Electricity',
        amount: '1850.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'TANGEDCO / BESCOM',
        description: 'Bi-monthly electricity bill',
        transactionDate: `${ym}-10`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: cashWallet.id,
        type: 'EXPENSE',
        category: 'Fuel',
        amount: '2400.00',
        paymentMethod: 'CASH',
        merchantOrSource: 'IndianOil Petrol Bunk',
        description: 'Two-wheeler petrol',
        transactionDate: `${ym}-12`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        toAccountId: hdfcJoint.id,
        type: 'TRANSFER',
        category: 'Internal Transfer',
        amount: '10000.00',
        paymentMethod: 'BANK_TRANSFER',
        description: 'Monthly household pool transfer',
        transactionDate: `${ym}-02`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        type: 'INCOME',
        category: 'Monthly salary',
        amount: '48000.00',
        paymentMethod: 'BANK_TRANSFER',
        merchantOrSource: 'TechServe India Pvt Ltd',
        transactionDate: `${prevYm}-01`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: hdfcJoint.id,
        type: 'EXPENSE',
        category: 'House rent',
        amount: '14000.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'Landlord Rajesh Kumar',
        transactionDate: `${prevYm}-03`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: hdfcJoint.id,
        type: 'EXPENSE',
        category: 'Groceries',
        amount: '6100.00',
        paymentMethod: 'UPI',
        merchantOrSource: 'Local Kirana & Supermarket',
        transactionDate: `${prevYm}-09`,
        status: 'COMPLETED',
        createdByUid: actorUid,
      },
    ]);

    await tx.insert(budgets).values([
      {
        familyId,
        name: 'Household Groceries',
        category: 'Groceries',
        period: 'MONTHLY',
        monthKey: ym,
        allocatedAmount: '8000.00',
        alertThresholdPct: 80,
      },
      {
        familyId,
        name: 'House Rent',
        category: 'House rent',
        period: 'MONTHLY',
        monthKey: ym,
        allocatedAmount: '14000.00',
        alertThresholdPct: 95,
      },
      {
        familyId,
        name: 'Fuel & Commute',
        category: 'Fuel',
        period: 'MONTHLY',
        monthKey: ym,
        allocatedAmount: '3500.00',
        alertThresholdPct: 80,
      },
    ]);

    await tx.insert(assets).values([
      {
        familyId,
        ownerMemberId: spouse.id,
        name: 'Family Gold Jewellery (80g)',
        category: 'GOLD',
        purchaseDate: '2019-11-14',
        purchaseValue: '320000.00',
        currentValue: '580000.00',
        ownershipPercentage: '100.00',
        valuationType: 'ESTIMATED',
        locationOrDescription: 'Bank Locker - SBI Branch',
        excludeFromNetWorthDuplicate: false,
      },
      {
        familyId,
        ownerMemberId,
        name: 'Honda Activa 6G',
        category: 'VEHICLES',
        purchaseDate: '2023-03-10',
        purchaseValue: '92000.00',
        currentValue: '65000.00',
        ownershipPercentage: '100.00',
        valuationType: 'ESTIMATED',
        locationOrDescription: 'Primary Family Two-Wheeler',
        excludeFromNetWorthDuplicate: false,
      },
    ]);

    await tx.insert(investments).values([
      {
        familyId,
        ownerMemberId,
        name: 'Nifty 50 Index Direct Growth SIP',
        category: 'SIP',
        purchaseDate: '2024-04-05',
        investedAmount: '120000.00',
        units: '612.4000',
        purchasePrice: '195.95',
        currentValue: '146500.00',
        sipMonthlyAmount: '5000.00',
        notes: 'Long-term wealth creation SIP',
      },
      {
        familyId,
        ownerMemberId,
        name: 'Public Provident Fund (PPF)',
        category: 'PPF',
        purchaseDate: '2021-07-01',
        investedAmount: '180000.00',
        units: '1.0000',
        purchasePrice: '180000.00',
        currentValue: '218400.00',
        sipMonthlyAmount: '3000.00',
        notes: '15-year tax-exempt sovereign debt',
      },
      {
        familyId,
        ownerMemberId: spouse.id,
        name: 'Post Office Recurring Deposit',
        category: 'RECURRING_DEPOSITS',
        purchaseDate: '2025-01-10',
        investedAmount: '44000.00',
        units: '1.0000',
        purchasePrice: '44000.00',
        currentValue: '46800.00',
        sipMonthlyAmount: '2000.00',
        notes: 'Festival & school annual fee reserve',
      },
    ]);

    await tx.insert(loans).values([
      {
        familyId,
        memberId: ownerMemberId,
        name: 'Two-Wheeler & Appliance Loan',
        category: 'VEHICLE_LOAN',
        lender: 'HDFC Bank',
        principalAmount: '100000.00',
        outstandingPrincipal: '42000.00',
        interestRate: '10.50',
        startDate: '2024-06-01',
        endDate: '2027-06-01',
        emiAmount: '3250.00',
        emiFrequency: 'MONTHLY',
        nextPaymentDate: `${ym}-28`,
        status: 'ACTIVE',
      },
    ]);

    await tx.insert(financialGoals).values([
      {
        familyId,
        memberId: ownerMemberId,
        linkedAccountId: hdfcJoint.id,
        title: '6-Month Family Emergency Fund',
        goalType: 'EMERGENCY_FUND',
        targetAmount: '168000.00',
        currentAllocated: '112000.00',
        monthlyContribution: '6000.00',
        targetDate: '2027-08-01',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      },
      {
        familyId,
        memberId: child.id,
        linkedAccountId: sbiAcc.id,
        title: "Aarav's Higher Education Corpus",
        goalType: 'CHILDREN_EDUCATION',
        targetAmount: '1200000.00',
        currentAllocated: '146500.00',
        monthlyContribution: '5000.00',
        targetDate: '2036-06-01',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      },
      {
        familyId,
        memberId: ownerMemberId,
        title: 'Own 2BHK Home Down Payment',
        goalType: 'HOUSE_PURCHASE',
        targetAmount: '800000.00',
        currentAllocated: '95000.00',
        monthlyContribution: '4000.00',
        targetDate: '2031-03-01',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
      },
    ]);

    const nextDue = new Date(today.getFullYear(), today.getMonth(), Math.min(28, today.getDate() + 3))
      .toISOString()
      .slice(0, 10);

    await tx.insert(bills).values([
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        title: 'HDFC Loan EMI',
        category: 'LOAN_EMI',
        amount: '3250.00',
        dueDate: nextDue,
        frequency: 'MONTHLY',
        reminderDaysBefore: 3,
        status: 'UPCOMING',
      },
      {
        familyId,
        memberId: spouse.id,
        accountId: hdfcJoint.id,
        title: 'Broadband Internet Bill',
        category: 'OTHER',
        amount: '799.00',
        dueDate: `${ym}-27`,
        frequency: 'MONTHLY',
        reminderDaysBefore: 3,
        status: 'UPCOMING',
      },
      {
        familyId,
        memberId: ownerMemberId,
        accountId: sbiAcc.id,
        title: 'Term Life Insurance Premium',
        category: 'INSURANCE',
        amount: '14500.00',
        dueDate: `${today.getFullYear()}-12-15`,
        frequency: 'ANNUAL',
        reminderDaysBefore: 14,
        status: 'UPCOMING',
      },
    ]);

    await tx.insert(auditLogs).values({
      familyId,
      actorUid,
      actorEmail: actorEmail ?? null,
      action: 'SEED_SAMPLE_DATA',
      entityType: 'FAMILY',
      entityId: String(familyId),
      details: 'Loaded sample Indian middle-class household dataset',
    });

    return { seeded: true };
  });
}
