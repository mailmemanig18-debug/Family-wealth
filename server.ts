import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  assets,
  assetValuations,
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
} from './src/db/schema.ts';
import {
  getFamilySnapshot,
  getOrCreateUser,
  getUserFamilies,
  logAudit,
  resolveAuthorizedFamily,
  seedMiddleClassSampleFamily,
} from './src/db/familyService.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { askFamilyWealthAssistant } from './src/server/aiAssistant.ts';
import { toNum } from './src/lib/finance.ts';

const PORT = 3000;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Upload PDF, image, CSV, or Excel files.'));
    }
  },
});

// Simple sliding-window rate limiter per IP
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 240) {
    return res.status(429).json({ error: 'Too many requests. Please slow down briefly.' });
  }
  return next();
}

function parsePositiveAmount(val: unknown): string {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  return num.toFixed(2);
}

function parseNonNegativeAmount(val: unknown): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error('Amount must be zero or positive.');
  }
  return num.toFixed(2);
}

function parseNumericString(val: unknown): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) {
    throw new Error('Invalid numeric value.');
  }
  return num.toFixed(2);
}

async function resolveContext(req: AuthRequest) {
  if (!req.user) throw new Error('UNAUTHORIZED');
  const email = req.user.email || `${req.user.uid}@user.local`;
  const user = await getOrCreateUser(req.user.uid, email, req.user.name, req.user.picture);
  const rawFamilyId = req.headers['x-family-id'] || req.query.familyId;
  const requestedFamilyId = rawFamilyId ? Number(rawFamilyId) : undefined;
  const { family, member } = await resolveAuthorizedFamily(
    user.id,
    email,
    req.user.name,
    Number.isFinite(requestedFamilyId) ? requestedFamilyId : undefined,
  );
  return { user, family, member, uid: req.user.uid, email };
}

function assertWritable(role: string, allowMember = true) {
  if (role === 'READ_ONLY') {
    throw new Error('FORBIDDEN_ACTION');
  }
  if (!allowMember && role === 'MEMBER') {
    throw new Error('FORBIDDEN_ACTION');
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use('/api', rateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'family-wealth-os' });
  });

  // Workspace bootstrap & snapshot
  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      const [snapshot, allFamilies] = await Promise.all([
        getFamilySnapshot(ctx.family.id, ctx.member.id),
        getUserFamilies(ctx.user.id, ctx.email),
      ]);
      res.json({
        snapshot,
        availableFamilies: allFamilies.map((f) => ({
          id: f.family.id,
          name: f.family.name,
          role: f.member.role,
        })),
      });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_FAMILY') {
        return res.status(403).json({ error: 'Access denied to requested family.' });
      }
      console.error('GET /api/workspace error:', err);
      res.status(500).json({ error: err.message || 'Failed to load workspace.' });
    }
  });

  // Create additional family
  app.post('/api/families', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Family name is required.' });

      const created = await db.transaction(async (tx) => {
        const [fam] = await tx
          .insert(families)
          .values({
            name,
            currency: 'INR',
            language: 'en',
            financialYearStartMonth: 4,
            createdByUserId: ctx.user.id,
          })
          .returning();

        await tx.insert(familyMembers).values({
          familyId: fam.id,
          userId: ctx.user.id,
          invitedEmail: ctx.email,
          name: ctx.user.displayName || ctx.email.split('@')[0],
          relationship: 'Family Administrator',
          role: 'OWNER',
          ageGroup: 'ADULT',
          canAddTransactions: true,
          canManageBudgets: true,
          canViewInvestments: true,
          responsibilities: 'Primary Family Owner',
        });

        return fam;
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create family.' });
    }
  });

  // Update family settings
  app.patch('/api/family', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);

      const updates: Record<string, unknown> = {};
      if (req.body.name) updates.name = String(req.body.name).trim();
      if (req.body.language === 'en' || req.body.language === 'ta') updates.language = req.body.language;
      if (req.body.monthlyEssentialExpenses !== undefined) {
        updates.monthlyEssentialExpenses = parseNonNegativeAmount(req.body.monthlyEssentialExpenses);
      }
      if (req.body.emergencyTargetMonths !== undefined) {
        const months = Number(req.body.emergencyTargetMonths);
        if (!Number.isInteger(months) || months < 1 || months > 36) {
          return res.status(400).json({ error: 'Emergency target months must be between 1 and 36.' });
        }
        updates.emergencyTargetMonths = months;
      }
      if (req.body.monthlySavingsTarget !== undefined) {
        updates.monthlySavingsTarget = parseNonNegativeAmount(req.body.monthlySavingsTarget);
      }

      const [updated] = await db
        .update(families)
        .set(updates)
        .where(eq(families.id, ctx.family.id))
        .returning();

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'UPDATE_SETTINGS', 'FAMILY', ctx.family.id, JSON.stringify(updates));
      res.json(updated);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_ACTION') return res.status(403).json({ error: 'Admin or Owner permission required.' });
      res.status(400).json({ error: err.message || 'Failed to update family settings.' });
    }
  });

  // Explicit sample data loader for empty family
  app.post('/api/family/seed-sample', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role !== 'OWNER' && ctx.member.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only Family Owner or Admin can load sample data.' });
      }
      await seedMiddleClassSampleFamily(ctx.family.id, ctx.member.id, ctx.uid, ctx.email);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not seed sample data.' });
    }
  });

  // Family Members & RBAC
  app.post('/api/family/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role !== 'OWNER' && ctx.member.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only Owner or Administrator can add family members.' });
      }
      const name = String(req.body.name || '').trim();
      const relationship = String(req.body.relationship || 'Other').trim();
      const role = ['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY'].includes(req.body.role) ? req.body.role : 'MEMBER';
      if (role === 'OWNER' && ctx.member.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only an existing Owner can assign Owner role.' });
      }
      if (!name) return res.status(400).json({ error: 'Member name is required.' });

      const ageGroup = req.body.ageGroup === 'MINOR' ? 'MINOR' : 'ADULT';
      const [created] = await db
        .insert(familyMembers)
        .values({
          familyId: ctx.family.id,
          name,
          relationship,
          role: ageGroup === 'MINOR' && role === 'OWNER' ? 'READ_ONLY' : role,
          ageGroup,
          invitedEmail: req.body.invitedEmail ? String(req.body.invitedEmail).trim().toLowerCase() : null,
          canAddTransactions: ageGroup === 'MINOR' ? Boolean(req.body.canAddTransactions && role !== 'READ_ONLY') : role !== 'READ_ONLY',
          canManageBudgets: ageGroup === 'MINOR' ? false : role === 'OWNER' || role === 'ADMIN' || Boolean(req.body.canManageBudgets),
          canViewInvestments: ageGroup === 'MINOR' ? Boolean(req.body.canViewInvestments) : true,
          responsibilities: req.body.responsibilities ? String(req.body.responsibilities).trim() : null,
        })
        .returning();

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'ADD_MEMBER', 'FAMILY_MEMBER', created.id, `Added ${name} (${role})`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add member.' });
    }
  });

  app.patch('/api/family/members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role !== 'OWNER' && ctx.member.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Permission denied.' });
      }
      const id = Number(req.params.id);
      const [target] = await db
        .select()
        .from(familyMembers)
        .where(and(eq(familyMembers.id, id), eq(familyMembers.familyId, ctx.family.id)));
      if (!target) return res.status(404).json({ error: 'Member not found.' });
      if (target.role === 'OWNER' && ctx.member.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only Owner can modify an Owner.' });
      }

      const [updated] = await db
        .update(familyMembers)
        .set({
          name: req.body.name ? String(req.body.name).trim() : target.name,
          relationship: req.body.relationship ? String(req.body.relationship).trim() : target.relationship,
          role: ['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY'].includes(req.body.role) && ctx.member.role === 'OWNER' ? req.body.role : target.role,
          ageGroup: req.body.ageGroup === 'MINOR' ? 'MINOR' : req.body.ageGroup === 'ADULT' ? 'ADULT' : target.ageGroup,
          canAddTransactions: req.body.canAddTransactions ?? target.canAddTransactions,
          canManageBudgets: req.body.canManageBudgets ?? target.canManageBudgets,
          canViewInvestments: req.body.canViewInvestments ?? target.canViewInvestments,
          responsibilities: req.body.responsibilities !== undefined ? String(req.body.responsibilities) : target.responsibilities,
        })
        .where(and(eq(familyMembers.id, id), eq(familyMembers.familyId, ctx.family.id)))
        .returning();

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'UPDATE_MEMBER', 'FAMILY_MEMBER', id, `Updated permissions for ${updated.name}`);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update member.' });
    }
  });

  app.delete('/api/family/members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only Family Owner can remove members.' });
      }
      const id = Number(req.params.id);
      if (id === ctx.member.id) {
        return res.status(400).json({ error: 'You cannot remove your own owner profile.' });
      }
      await db.delete(familyMembers).where(and(eq(familyMembers.id, id), eq(familyMembers.familyId, ctx.family.id)));
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'REMOVE_MEMBER', 'FAMILY_MEMBER', id, `Removed member #${id}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to remove member.' });
    }
  });

  // Accounts & Banks
  app.post('/api/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Account name is required.' });
      const openingBalance = parseNumericString(req.body.openingBalance ?? 0);

      const [created] = await db
        .insert(financialAccounts)
        .values({
          familyId: ctx.family.id,
          ownerMemberId: req.body.ownerMemberId ? Number(req.body.ownerMemberId) : ctx.member.id,
          name,
          bankName: req.body.bankName ? String(req.body.bankName).trim() : null,
          accountType: String(req.body.accountType || 'SAVINGS'),
          openingBalance,
          currentBalance: openingBalance,
          status: 'ACTIVE',
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        })
        .returning();

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'CREATE_ACCOUNT', 'ACCOUNT', created.id, `Added account "${name}"`);
      res.status(201).json(created);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_ACTION') return res.status(403).json({ error: 'Read-only users cannot add accounts.' });
      res.status(400).json({ error: err.message || 'Failed to create account.' });
    }
  });

  app.post('/api/accounts/:id/reconcile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      const accountId = Number(req.params.id);
      const targetBalance = toNum(parseNumericString(req.body.actualBalance));

      const result = await db.transaction(async (tx) => {
        const [acc] = await tx
          .select()
          .from(financialAccounts)
          .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
        if (!acc) throw new Error('Account not found.');

        const current = toNum(acc.currentBalance);
        const diff = Number((targetBalance - current).toFixed(2));

        const [updated] = await tx
          .update(financialAccounts)
          .set({ currentBalance: targetBalance.toFixed(2) })
          .where(eq(financialAccounts.id, accountId))
          .returning();

        if (diff !== 0) {
          await tx.insert(transactions).values({
            familyId: ctx.family.id,
            memberId: ctx.member.id,
            accountId,
            type: 'BALANCE_ADJUSTMENT',
            category: 'Account Reconciliation',
            amount: Math.abs(diff).toFixed(2),
            paymentMethod: 'OTHER',
            description: `Reconciled balance from ₹${current} to ₹${targetBalance}. ${req.body.notes || ''}`.trim(),
            transactionDate: new Date().toISOString().slice(0, 10),
            status: 'COMPLETED',
            createdByUid: ctx.uid,
          });
        }
        return updated;
      });

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'RECONCILE_ACCOUNT', 'ACCOUNT', accountId, `Reconciled to ₹${targetBalance}`);
      res.json(result);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_ACTION') return res.status(403).json({ error: 'Admin or Owner permission required.' });
      res.status(400).json({ error: err.message || 'Reconciliation failed.' });
    }
  });

  // Transactions (Income, Expense, Transfer)
  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      if (!ctx.member.canAddTransactions) {
        return res.status(403).json({ error: 'Your member permissions do not allow adding transactions.' });
      }

      const type = String(req.body.type || 'EXPENSE');
      if (!['INCOME', 'EXPENSE', 'TRANSFER'].includes(type)) {
        return res.status(400).json({ error: 'Invalid transaction type.' });
      }
      const amount = parsePositiveAmount(req.body.amount);
      const amtNum = Number(amount);
      const accountId = req.body.accountId ? Number(req.body.accountId) : null;
      const toAccountId = req.body.toAccountId ? Number(req.body.toAccountId) : null;
      const status = req.body.status === 'PENDING' ? 'PENDING' : 'COMPLETED';

      if (type === 'TRANSFER') {
        if (!accountId || !toAccountId || accountId === toAccountId) {
          return res.status(400).json({ error: 'Select two distinct accounts for a transfer.' });
        }
      }

      const created = await db.transaction(async (tx) => {
        if (accountId) {
          const [src] = await tx
            .select()
            .from(financialAccounts)
            .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
          if (!src) throw new Error('Source account not found in your family.');

          if (status === 'COMPLETED') {
            const delta = type === 'INCOME' ? amtNum : -amtNum;
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${delta.toFixed(2)}::numeric` })
              .where(eq(financialAccounts.id, accountId));
          }
        }

        if (type === 'TRANSFER' && toAccountId) {
          const [dst] = await tx
            .select()
            .from(financialAccounts)
            .where(and(eq(financialAccounts.id, toAccountId), eq(financialAccounts.familyId, ctx.family.id)));
          if (!dst) throw new Error('Destination account not found in your family.');

          if (status === 'COMPLETED') {
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${amtNum.toFixed(2)}::numeric` })
              .where(eq(financialAccounts.id, toAccountId));
          }
        }

        const [row] = await tx
          .insert(transactions)
          .values({
            familyId: ctx.family.id,
            memberId: req.body.memberId ? Number(req.body.memberId) : ctx.member.id,
            accountId,
            toAccountId: type === 'TRANSFER' ? toAccountId : null,
            type,
            category: String(req.body.category || (type === 'TRANSFER' ? 'Internal Transfer' : 'Other')),
            amount,
            paymentMethod: String(req.body.paymentMethod || 'UPI'),
            merchantOrSource: req.body.merchantOrSource ? String(req.body.merchantOrSource).trim() : null,
            description: req.body.description ? String(req.body.description).trim() : null,
            transactionDate: String(req.body.transactionDate || new Date().toISOString().slice(0, 10)),
            isRecurring: Boolean(req.body.isRecurring),
            recurringFrequency: req.body.recurringFrequency ? String(req.body.recurringFrequency) : null,
            isExpected: Boolean(req.body.isExpected),
            status,
            gstTag: Boolean(req.body.gstTag),
            createdByUid: ctx.uid,
          })
          .returning();

        return row;
      });

      await logAudit(ctx.family.id, ctx.uid, ctx.email, `CREATE_${type}`, 'TRANSACTION', created.id, `${type} ₹${amount} (${created.category})`);
      res.status(201).json(created);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_ACTION') return res.status(403).json({ error: 'Read-only permission.' });
      res.status(400).json({ error: err.message || 'Failed to save transaction.' });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const id = Number(req.params.id);

      await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, id), eq(transactions.familyId, ctx.family.id)));
        if (!existing) throw new Error('Transaction not found.');

        if (existing.status === 'COMPLETED') {
          const amt = toNum(existing.amount);
          if (existing.accountId) {
            const reverseDelta =
              existing.type === 'INCOME' ? -amt : existing.type === 'EXPENSE' || existing.type === 'TRANSFER' ? amt : 0;
            if (reverseDelta !== 0) {
              await tx
                .update(financialAccounts)
                .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${reverseDelta.toFixed(2)}::numeric` })
                .where(eq(financialAccounts.id, existing.accountId));
            }
          }
          if (existing.type === 'TRANSFER' && existing.toAccountId) {
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} - ${amt.toFixed(2)}::numeric` })
              .where(eq(financialAccounts.id, existing.toAccountId));
          }
        }

        await tx.delete(transactions).where(eq(transactions.id, id));
      });

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'DELETE_TRANSACTION', 'TRANSACTION', id, `Deleted transaction #${id}`);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_ACTION') return res.status(403).json({ error: 'Permission denied.' });
      res.status(400).json({ error: err.message || 'Failed to delete transaction.' });
    }
  });

  // Budgets
  app.post('/api/budgets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role === 'READ_ONLY' || (!ctx.member.canManageBudgets && ctx.member.role === 'MEMBER')) {
        return res.status(403).json({ error: 'Budget management permission required.' });
      }
      const allocatedAmount = parsePositiveAmount(req.body.allocatedAmount);
      const [created] = await db
        .insert(budgets)
        .values({
          familyId: ctx.family.id,
          memberId: req.body.memberId ? Number(req.body.memberId) : null,
          name: String(req.body.name || req.body.category || 'Monthly Budget').trim(),
          category: String(req.body.category || 'Groceries'),
          period: String(req.body.period || 'MONTHLY'),
          monthKey: String(req.body.monthKey || new Date().toISOString().slice(0, 7)),
          allocatedAmount,
          alertThresholdPct: Number(req.body.alertThresholdPct || 80),
        })
        .returning();
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'CREATE_BUDGET', 'BUDGET', created.id, `${created.name} ₹${allocatedAmount}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create budget.' });
    }
  });

  app.delete('/api/budgets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role === 'READ_ONLY' || (!ctx.member.canManageBudgets && ctx.member.role === 'MEMBER')) {
        return res.status(403).json({ error: 'Budget management permission required.' });
      }
      const id = Number(req.params.id);
      await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete budget.' });
    }
  });

  // Assets & Valuations
  app.post('/api/assets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const currentValue = parseNonNegativeAmount(req.body.currentValue);
      const purchaseValue = parseNonNegativeAmount(req.body.purchaseValue ?? currentValue);
      const ownershipPercentage = Math.max(0.01, Math.min(100, Number(req.body.ownershipPercentage ?? 100))).toFixed(2);

      const created = await db.transaction(async (tx) => {
        const [asset] = await tx
          .insert(assets)
          .values({
            familyId: ctx.family.id,
            ownerMemberId: req.body.ownerMemberId ? Number(req.body.ownerMemberId) : ctx.member.id,
            name: String(req.body.name || '').trim(),
            category: String(req.body.category || 'OTHER'),
            purchaseDate: req.body.purchaseDate ? String(req.body.purchaseDate) : null,
            purchaseValue,
            currentValue,
            ownershipPercentage,
            valuationType: req.body.valuationType === 'VERIFIED' ? 'VERIFIED' : 'ESTIMATED',
            locationOrDescription: req.body.locationOrDescription ? String(req.body.locationOrDescription).trim() : null,
            excludeFromNetWorthDuplicate: Boolean(req.body.excludeFromNetWorthDuplicate),
          })
          .returning();

        await tx.insert(assetValuations).values({
          familyId: ctx.family.id,
          assetId: asset.id,
          valuationDate: new Date().toISOString().slice(0, 10),
          value: currentValue,
          valuationType: asset.valuationType,
          notes: 'Initial asset valuation',
        });

        return asset;
      });
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'CREATE_ASSET', 'ASSET', created.id, `${created.name} ₹${currentValue}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create asset.' });
    }
  });

  app.post('/api/assets/:id/valuations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      const assetId = Number(req.params.id);
      const value = parseNonNegativeAmount(req.body.value);
      const valuationType = req.body.valuationType === 'VERIFIED' ? 'VERIFIED' : 'ESTIMATED';

      await db.transaction(async (tx) => {
        const [asset] = await tx
          .select()
          .from(assets)
          .where(and(eq(assets.id, assetId), eq(assets.familyId, ctx.family.id)));
        if (!asset) throw new Error('Asset not found.');

        await tx
          .update(assets)
          .set({ currentValue: value, valuationType })
          .where(eq(assets.id, assetId));

        await tx.insert(assetValuations).values({
          familyId: ctx.family.id,
          assetId,
          valuationDate: String(req.body.valuationDate || new Date().toISOString().slice(0, 10)),
          value,
          valuationType,
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        });
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update valuation.' });
    }
  });

  app.delete('/api/assets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      await db.delete(assets).where(and(eq(assets.id, Number(req.params.id)), eq(assets.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete asset.' });
    }
  });

  // Investments & Investment Transactions
  app.post('/api/investments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const investedAmount = parseNonNegativeAmount(req.body.investedAmount);
      const currentValue = parseNonNegativeAmount(req.body.currentValue ?? investedAmount);

      const created = await db.transaction(async (tx) => {
        const [inv] = await tx
          .insert(investments)
          .values({
            familyId: ctx.family.id,
            ownerMemberId: req.body.ownerMemberId ? Number(req.body.ownerMemberId) : ctx.member.id,
            name: String(req.body.name || '').trim(),
            category: String(req.body.category || 'MUTUAL_FUNDS'),
            purchaseDate: req.body.purchaseDate ? String(req.body.purchaseDate) : null,
            investedAmount,
            units: Number(req.body.units || 0).toFixed(4),
            purchasePrice: parseNonNegativeAmount(req.body.purchasePrice ?? 0),
            currentValue,
            sipMonthlyAmount: parseNonNegativeAmount(req.body.sipMonthlyAmount ?? 0),
            notes: req.body.notes ? String(req.body.notes).trim() : null,
          })
          .returning();

        await tx.insert(investmentTransactions).values({
          familyId: ctx.family.id,
          investmentId: inv.id,
          txType: 'INITIAL_INVESTMENT',
          amount: investedAmount,
          units: inv.units,
          txDate: inv.purchaseDate || new Date().toISOString().slice(0, 10),
          notes: 'Initial portfolio holding',
        });

        return inv;
      });
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'CREATE_INVESTMENT', 'INVESTMENT', created.id, `${created.name} ₹${investedAmount}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add investment.' });
    }
  });

  app.post('/api/investments/:id/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const investmentId = Number(req.params.id);
      const txType = String(req.body.txType || 'CONTRIBUTION');
      const amount = parsePositiveAmount(req.body.amount);
      const amtNum = Number(amount);
      const accountId = req.body.accountId ? Number(req.body.accountId) : null;
      const txDate = String(req.body.txDate || new Date().toISOString().slice(0, 10));

      await db.transaction(async (tx) => {
        const [inv] = await tx
          .select()
          .from(investments)
          .where(and(eq(investments.id, investmentId), eq(investments.familyId, ctx.family.id)));
        if (!inv) throw new Error('Investment not found.');

        if (txType === 'CONTRIBUTION') {
          await tx
            .update(investments)
            .set({
              investedAmount: sql`${investments.investedAmount} + ${amount}::numeric`,
              currentValue: sql`${investments.currentValue} + ${amount}::numeric`,
            })
            .where(eq(investments.id, investmentId));

          if (accountId) {
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} - ${amount}::numeric` })
              .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
            await tx.insert(transactions).values({
              familyId: ctx.family.id,
              memberId: ctx.member.id,
              accountId,
              type: 'INVESTMENT_CONTRIBUTION',
              category: inv.category,
              amount,
              paymentMethod: 'BANK_TRANSFER',
              merchantOrSource: inv.name,
              description: `Investment contribution to ${inv.name}`,
              transactionDate: txDate,
              status: 'COMPLETED',
              linkedEntityType: 'INVESTMENT',
              linkedEntityId: inv.id,
              createdByUid: ctx.uid,
            });
          }
        } else if (txType === 'WITHDRAWAL') {
          const prevInvested = toNum(inv.investedAmount);
          const prevValue = toNum(inv.currentValue);
          const ratio = prevValue > 0 ? Math.min(1, amtNum / prevValue) : 0;
          const costBasisRemoved = Number((prevInvested * ratio).toFixed(2));
          const realized = Number((amtNum - costBasisRemoved).toFixed(2));

          await tx
            .update(investments)
            .set({
              investedAmount: Math.max(0, prevInvested - costBasisRemoved).toFixed(2),
              currentValue: Math.max(0, prevValue - amtNum).toFixed(2),
              realizedGain: (toNum(inv.realizedGain) + realized).toFixed(2),
            })
            .where(eq(investments.id, investmentId));

          if (accountId) {
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${amount}::numeric` })
              .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
            await tx.insert(transactions).values({
              familyId: ctx.family.id,
              memberId: ctx.member.id,
              accountId,
              type: 'INVESTMENT_WITHDRAWAL',
              category: inv.category,
              amount,
              paymentMethod: 'BANK_TRANSFER',
              merchantOrSource: inv.name,
              description: `Redemption from ${inv.name}`,
              transactionDate: txDate,
              status: 'COMPLETED',
              linkedEntityType: 'INVESTMENT',
              linkedEntityId: inv.id,
              createdByUid: ctx.uid,
            });
          }
        } else if (txType === 'VALUATION_UPDATE') {
          await tx
            .update(investments)
            .set({ currentValue: amount })
            .where(eq(investments.id, investmentId));
        } else if (txType === 'DIVIDEND_OR_INTEREST' && accountId) {
          await tx
            .update(financialAccounts)
            .set({ currentBalance: sql`${financialAccounts.currentBalance} + ${amount}::numeric` })
            .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
          await tx.insert(transactions).values({
            familyId: ctx.family.id,
            memberId: ctx.member.id,
            accountId,
            type: 'INCOME',
            category: 'Dividend income',
            amount,
            paymentMethod: 'BANK_TRANSFER',
            merchantOrSource: inv.name,
            description: `Dividend/interest from ${inv.name}`,
            transactionDate: txDate,
            status: 'COMPLETED',
            createdByUid: ctx.uid,
          });
        }

        await tx.insert(investmentTransactions).values({
          familyId: ctx.family.id,
          investmentId,
          accountId,
          txType,
          amount,
          units: Number(req.body.units || 0).toFixed(4),
          txDate,
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        });
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Investment transaction failed.' });
    }
  });

  app.delete('/api/investments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      await db.delete(investments).where(and(eq(investments.id, Number(req.params.id)), eq(investments.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete investment.' });
    }
  });

  // Loans & Repayments
  app.post('/api/loans', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const principalAmount = parsePositiveAmount(req.body.principalAmount);
      const outstandingPrincipal = parseNonNegativeAmount(req.body.outstandingPrincipal ?? principalAmount);
      const [created] = await db
        .insert(loans)
        .values({
          familyId: ctx.family.id,
          memberId: req.body.memberId ? Number(req.body.memberId) : ctx.member.id,
          name: String(req.body.name || '').trim(),
          category: String(req.body.category || 'PERSONAL_LOAN'),
          lender: String(req.body.lender || '').trim(),
          principalAmount,
          outstandingPrincipal,
          interestRate: parseNonNegativeAmount(req.body.interestRate ?? 9),
          startDate: req.body.startDate ? String(req.body.startDate) : null,
          endDate: req.body.endDate ? String(req.body.endDate) : null,
          emiAmount: parsePositiveAmount(req.body.emiAmount),
          emiFrequency: String(req.body.emiFrequency || 'MONTHLY'),
          nextPaymentDate: req.body.nextPaymentDate ? String(req.body.nextPaymentDate) : null,
          status: 'ACTIVE',
        })
        .returning();
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'CREATE_LOAN', 'LOAN', created.id, `${created.name} (${created.lender})`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add loan.' });
    }
  });

  app.post('/api/loans/:id/repayments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const loanId = Number(req.params.id);
      const principalComponent = parseNonNegativeAmount(req.body.principalComponent);
      const interestComponent = parseNonNegativeAmount(req.body.interestComponent ?? 0);
      const totalPaid = (Number(principalComponent) + Number(interestComponent)).toFixed(2);
      if (Number(totalPaid) <= 0) return res.status(400).json({ error: 'Total repayment must be positive.' });

      const accountId = req.body.accountId ? Number(req.body.accountId) : null;
      const paymentDate = String(req.body.paymentDate || new Date().toISOString().slice(0, 10));

      await db.transaction(async (tx) => {
        const [loan] = await tx
          .select()
          .from(loans)
          .where(and(eq(loans.id, loanId), eq(loans.familyId, ctx.family.id)));
        if (!loan) throw new Error('Loan not found.');

        const newOutstanding = Math.max(0, toNum(loan.outstandingPrincipal) - Number(principalComponent));
        await tx
          .update(loans)
          .set({
            outstandingPrincipal: newOutstanding.toFixed(2),
            status: newOutstanding <= 0.01 ? 'CLOSED' : 'ACTIVE',
          })
          .where(eq(loans.id, loanId));

        if (accountId) {
          await tx
            .update(financialAccounts)
            .set({ currentBalance: sql`${financialAccounts.currentBalance} - ${totalPaid}::numeric` })
            .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.familyId, ctx.family.id)));
        }

        await tx.insert(loanRepayments).values({
          familyId: ctx.family.id,
          loanId,
          accountId,
          paymentDate,
          totalPaid,
          principalComponent,
          interestComponent,
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        });

        await tx.insert(transactions).values({
          familyId: ctx.family.id,
          memberId: ctx.member.id,
          accountId,
          type: 'LOAN_REPAYMENT',
          category: 'EMI',
          amount: totalPaid,
          principalAmount: principalComponent,
          interestAmount: interestComponent,
          paymentMethod: 'BANK_TRANSFER',
          merchantOrSource: loan.lender,
          description: `Repayment for ${loan.name}`,
          transactionDate: paymentDate,
          status: 'COMPLETED',
          linkedEntityType: 'LOAN',
          linkedEntityId: loanId,
          createdByUid: ctx.uid,
        });
      });

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'LOAN_REPAYMENT', 'LOAN', loanId, `Paid ₹${totalPaid} (Principal ₹${principalComponent})`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Repayment failed.' });
    }
  });

  app.delete('/api/loans/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      await db.delete(loans).where(and(eq(loans.id, Number(req.params.id)), eq(loans.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete loan.' });
    }
  });

  // Financial Goals & Contributions
  app.post('/api/goals', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const targetAmount = parsePositiveAmount(req.body.targetAmount);
      const currentAllocated = parseNonNegativeAmount(req.body.currentAllocated ?? 0);
      const [created] = await db
        .insert(financialGoals)
        .values({
          familyId: ctx.family.id,
          memberId: req.body.memberId ? Number(req.body.memberId) : ctx.member.id,
          linkedAccountId: req.body.linkedAccountId ? Number(req.body.linkedAccountId) : null,
          title: String(req.body.title || '').trim(),
          goalType: String(req.body.goalType || 'WEALTH_CREATION'),
          targetAmount,
          currentAllocated,
          monthlyContribution: parseNonNegativeAmount(req.body.monthlyContribution ?? 0),
          targetDate: req.body.targetDate ? String(req.body.targetDate) : null,
          priority: ['HIGH', 'MEDIUM', 'LOW'].includes(req.body.priority) ? req.body.priority : 'MEDIUM',
          status: Number(currentAllocated) >= Number(targetAmount) ? 'COMPLETED' : 'IN_PROGRESS',
        })
        .returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create goal.' });
    }
  });

  app.post('/api/goals/:id/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const goalId = Number(req.params.id);
      const txType = req.body.txType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'CONTRIBUTION';
      const amount = parsePositiveAmount(req.body.amount);
      const amtNum = Number(amount);
      const accountId = req.body.accountId ? Number(req.body.accountId) : null;
      const txDate = String(req.body.txDate || new Date().toISOString().slice(0, 10));

      await db.transaction(async (tx) => {
        const [goal] = await tx
          .select()
          .from(financialGoals)
          .where(and(eq(financialGoals.id, goalId), eq(financialGoals.familyId, ctx.family.id)));
        if (!goal) throw new Error('Goal not found.');

        const nextAllocated =
          txType === 'CONTRIBUTION'
            ? toNum(goal.currentAllocated) + amtNum
            : Math.max(0, toNum(goal.currentAllocated) - amtNum);

        await tx
          .update(financialGoals)
          .set({
            currentAllocated: nextAllocated.toFixed(2),
            status: nextAllocated >= toNum(goal.targetAmount) ? 'COMPLETED' : 'IN_PROGRESS',
          })
          .where(eq(financialGoals.id, goalId));

        await tx.insert(goalContributions).values({
          familyId: ctx.family.id,
          goalId,
          accountId,
          txType,
          amount,
          txDate,
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        });

        await tx.insert(transactions).values({
          familyId: ctx.family.id,
          memberId: ctx.member.id,
          accountId,
          type: txType === 'CONTRIBUTION' ? 'GOAL_CONTRIBUTION' : 'GOAL_WITHDRAWAL',
          category: goal.goalType,
          amount,
          paymentMethod: 'BANK_TRANSFER',
          merchantOrSource: goal.title,
          description: `${txType === 'CONTRIBUTION' ? 'Allocated to' : 'Withdrawn from'} goal "${goal.title}"`,
          transactionDate: txDate,
          status: 'COMPLETED',
          linkedEntityType: 'GOAL',
          linkedEntityId: goalId,
          createdByUid: ctx.uid,
        });
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Goal update failed.' });
    }
  });

  app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      await db.delete(financialGoals).where(and(eq(financialGoals.id, Number(req.params.id)), eq(financialGoals.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete goal.' });
    }
  });

  // Bills & Smart Reminders
  app.post('/api/bills', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const amount = parsePositiveAmount(req.body.amount);
      const [created] = await db
        .insert(bills)
        .values({
          familyId: ctx.family.id,
          memberId: req.body.memberId ? Number(req.body.memberId) : ctx.member.id,
          accountId: req.body.accountId ? Number(req.body.accountId) : null,
          title: String(req.body.title || '').trim(),
          category: String(req.body.category || 'OTHER'),
          amount,
          dueDate: String(req.body.dueDate),
          frequency: String(req.body.frequency || 'MONTHLY'),
          reminderDaysBefore: Number(req.body.reminderDaysBefore ?? 3),
          status: 'UPCOMING',
          notes: req.body.notes ? String(req.body.notes).trim() : null,
        })
        .returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add bill.' });
    }
  });

  app.post('/api/bills/:id/pay', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      const billId = Number(req.params.id);
      const accountId = req.body.accountId ? Number(req.body.accountId) : null;
      const paidDate = String(req.body.paidDate || new Date().toISOString().slice(0, 10));

      await db.transaction(async (tx) => {
        const [bill] = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.familyId, ctx.family.id)));
        if (!bill) throw new Error('Bill not found.');

        await tx
          .update(bills)
          .set({ status: 'PAID', paidDate })
          .where(eq(bills.id, billId));

        if (req.body.recordExpense !== false) {
          const useAccount = accountId || bill.accountId;
          if (useAccount) {
            await tx
              .update(financialAccounts)
              .set({ currentBalance: sql`${financialAccounts.currentBalance} - ${bill.amount}::numeric` })
              .where(and(eq(financialAccounts.id, useAccount), eq(financialAccounts.familyId, ctx.family.id)));
          }
          await tx.insert(transactions).values({
            familyId: ctx.family.id,
            memberId: ctx.member.id,
            accountId: useAccount,
            type: 'EXPENSE',
            category: bill.category === 'LOAN_EMI' ? 'EMI' : bill.category === 'INSURANCE' ? 'Insurance' : 'Other expenses',
            amount: bill.amount,
            paymentMethod: String(req.body.paymentMethod || 'UPI'),
            merchantOrSource: bill.title,
            description: `Paid bill: ${bill.title}`,
            transactionDate: paidDate,
            status: 'COMPLETED',
            createdByUid: ctx.uid,
          });
        }
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to mark bill paid.' });
    }
  });

  app.delete('/api/bills/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      await db.delete(bills).where(and(eq(bills.id, Number(req.params.id)), eq(bills.familyId, ctx.family.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete bill.' });
    }
  });

  // Private Documents & Records
  app.post('/api/documents', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, true);
      if (!req.file) return res.status(400).json({ error: 'File upload is required.' });

      const [created] = await db
        .insert(documents)
        .values({
          familyId: ctx.family.id,
          ownerMemberId: req.body.ownerMemberId ? Number(req.body.ownerMemberId) : ctx.member.id,
          title: String(req.body.title || req.file.originalname).trim(),
          category: String(req.body.category || 'OTHER'),
          originalFilename: req.file.originalname,
          storedFilename: req.file.filename,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          expiryDate: req.body.expiryDate ? String(req.body.expiryDate) : null,
          visibility: ['FAMILY', 'ADMINS_ONLY', 'OWNER_ONLY'].includes(req.body.visibility) ? req.body.visibility : 'FAMILY',
          notes: req.body.notes ? String(req.body.notes).trim() : null,
          uploadedByUid: ctx.uid,
        })
        .returning();

      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'UPLOAD_DOCUMENT', 'DOCUMENT', created.id, created.title);
      const { storedFilename: _hidden, ...safeDoc } = created;
      res.status(201).json(safeDoc);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Document upload failed.' });
    }
  });

  app.get('/api/documents/:id/download', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      const docId = Number(req.params.id);
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.familyId, ctx.family.id)));
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      const isAdminOrOwner = ctx.member.role === 'OWNER' || ctx.member.role === 'ADMIN';
      if (doc.visibility === 'ADMINS_ONLY' && !isAdminOrOwner) {
        return res.status(403).json({ error: 'Document restricted to family admins.' });
      }
      if (doc.visibility === 'OWNER_ONLY' && ctx.member.role !== 'OWNER' && doc.ownerMemberId !== ctx.member.id) {
        return res.status(403).json({ error: 'Document restricted to owner.' });
      }

      const resolvedPath = path.resolve(UPLOAD_DIR, doc.storedFilename);
      if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'Document file missing on server.' });
      }

      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(doc.originalFilename).replace(/"/g, '')}"`);
      fs.createReadStream(resolvedPath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Download failed.' });
    }
  });

  app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      assertWritable(ctx.member.role, false);
      const docId = Number(req.params.id);
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.familyId, ctx.family.id)));
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      const resolvedPath = path.resolve(UPLOAD_DIR, doc.storedFilename);
      if (resolvedPath.startsWith(UPLOAD_DIR + path.sep) && fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      await db.delete(documents).where(eq(documents.id, docId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Delete failed.' });
    }
  });

  // AI Family Financial Assistant (Server-Side Gemini)
  app.post('/api/assistant/ask', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      const question = String(req.body.question || '').trim();
      if (!question) return res.status(400).json({ error: 'Please enter a financial question.' });

      const snapshot = await getFamilySnapshot(ctx.family.id, ctx.member.id);
      const reply = await askFamilyWealthAssistant(question, snapshot as any);
      res.json(reply);
    } catch (err: any) {
      console.error('AI Assistant error:', err);
      res.status(500).json({ error: err.message || 'AI Assistant could not process the request.' });
    }
  });

  // Family JSON Backup Export (Owner/Admin only)
  app.get('/api/backup/export', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await resolveContext(req);
      if (ctx.member.role !== 'OWNER' && ctx.member.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only Owner or Administrator can export a family backup.' });
      }
      const snapshot = await getFamilySnapshot(ctx.family.id, ctx.member.id);
      await logAudit(ctx.family.id, ctx.uid, ctx.email, 'EXPORT_BACKUP', 'FAMILY', ctx.family.id, 'Downloaded full JSON backup');
      res.setHeader('Content-Disposition', `attachment; filename="family-wealth-os-backup-${ctx.family.id}.json"`);
      res.json({ exportedAt: new Date().toISOString(), ...snapshot });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Backup export failed.' });
    }
  });

  // Serve Vite in dev or built static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Family Wealth OS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
