import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import type { WorkspaceActions } from './lib/actions';
import { toNum } from './lib/finance';
import type { SupportedLanguage } from './lib/i18n';
import { createSampleWorkspace } from './lib/sampleWorkspace';
import type { FamilyWorkspaceSnapshot, NavSectionId } from './lib/types';
import { WorkspaceShell } from './components/WorkspaceShell';
import { DashboardView } from './components/views/DashboardView';
import { AccountsView, ExpensesView, IncomeView, TransactionsView } from './components/views/LedgerViews';
import {
  BudgetsView,
  EmergencyFundView,
  FamilyView,
  GoalsView,
  SavingsView,
} from './components/views/PlanningViews';
import { AssetsView, InvestmentsView, LoansView } from './components/views/WealthViews';
import {
  AssistantView,
  BillsView,
  CalculatorsView,
  DocumentsView,
  IntelligenceView,
  ReportsView,
  SettingsView,
} from './components/views/IntelligenceAndToolsViews';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  });

  const [snapshot, setSnapshot] = useState<FamilyWorkspaceSnapshot | null>(() =>
    new URLSearchParams(window.location.search).get('autostart') === '1'
      ? createSampleWorkspace()
      : null,
  );
  const [activeTab, setActiveTab] = useState<NavSectionId>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isBusy, setIsBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const showToast = (type: 'error' | 'success', text: string) => {
    setBanner({ type, text });
    if (type === 'success') {
      setTimeout(() => {
        setBanner((cur) => (cur?.text === text ? null : cur));
      }, 3500);
    }
  };

  const fetchWorkspace = useCallback(async (user: User, familyId?: number) => {
    setIsBusy(true);
    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const url = familyId ? `/api/workspace?familyId=${familyId}` : '/api/workspace';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load family workspace.');
      }
      const data = await res.json();
      setSnapshot(data.snapshot);
      if (data.snapshot?.family?.language === 'ta') setLanguage('ta');
      setIsPreviewMode(false);
    } catch (err: any) {
      showToast('error', err.message || 'Unable to connect to workspace.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        await fetchWorkspace(user);
      } else {
        setIdToken(null);
      }
    });
    return () => unsub();
  }, [fetchWorkspace]);

  const handleSignIn = async () => {
    setBanner(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        await fetchWorkspace(result.user);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Google Sign-In did not complete.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSnapshot(null);
    setIsPreviewMode(false);
    setIdToken(null);
  };

  const enterPreview = () => {
    setIsPreviewMode(true);
    setSnapshot(createSampleWorkspace());
    setBanner(null);
  };

  const apiRequest = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!firebaseUser) throw new Error('Not signed in.');
      const token = (await firebaseUser.getIdToken()) || idToken;
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      if (snapshot?.family?.id) {
        headers.set('x-family-id', String(snapshot.family.id));
      }
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed.');
      }
      return data;
    },
    [firebaseUser, idToken, snapshot?.family?.id],
  );

  const runMutation = useCallback(
    async (
      serverCall: () => Promise<unknown>,
      previewUpdater: (prev: FamilyWorkspaceSnapshot) => FamilyWorkspaceSnapshot,
      successMsg: string,
    ) => {
      setIsBusy(true);
      setBanner(null);
      try {
        if (isPreviewMode) {
          setSnapshot((prev) => (prev ? previewUpdater(prev) : prev));
        } else {
          await serverCall();
          if (firebaseUser) {
            await fetchWorkspace(firebaseUser, snapshot?.family?.id);
          }
        }
        showToast('success', successMsg);
      } catch (err: any) {
        showToast('error', err.message || 'Operation failed.');
      } finally {
        setIsBusy(false);
      }
    },
    [isPreviewMode, firebaseUser, fetchWorkspace, snapshot?.family?.id],
  );

  const actions: WorkspaceActions = useMemo(
    () => ({
      isPreviewMode,
      isBusy,
      onSeedSample: () =>
        runMutation(
          () => apiRequest('/api/family/seed-sample', { method: 'POST' }),
          () => createSampleWorkspace(),
          'Loaded realistic middle-class Indian family dataset.',
        ),
      onUpdateFamilySettings: (payload) =>
        runMutation(
          () => apiRequest('/api/family', { method: 'PATCH', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            family: {
              ...prev.family,
              name: (payload.name as string) ?? prev.family.name,
              monthlyEssentialExpenses:
                payload.monthlyEssentialExpenses !== undefined
                  ? Number(payload.monthlyEssentialExpenses).toFixed(2)
                  : prev.family.monthlyEssentialExpenses,
              emergencyTargetMonths:
                (payload.emergencyTargetMonths as number) ?? prev.family.emergencyTargetMonths,
              monthlySavingsTarget:
                payload.monthlySavingsTarget !== undefined
                  ? Number(payload.monthlySavingsTarget).toFixed(2)
                  : prev.family.monthlySavingsTarget,
            },
          }),
          'Family settings updated.',
        ),
      onAddMember: (payload) =>
        runMutation(
          () => apiRequest('/api/family/members', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            members: [
              ...prev.members,
              {
                id: Date.now(),
                familyId: prev.family.id,
                userId: null,
                invitedEmail: (payload.invitedEmail as string) || null,
                name: String(payload.name),
                relationship: String(payload.relationship),
                role: (payload.role as any) || 'MEMBER',
                ageGroup: (payload.ageGroup as any) || 'ADULT',
                canAddTransactions: Boolean(payload.canAddTransactions ?? true),
                canManageBudgets: Boolean(payload.canManageBudgets ?? false),
                canViewInvestments: Boolean(payload.canViewInvestments ?? true),
                responsibilities: (payload.responsibilities as string) || null,
              },
            ],
          }),
          'Family member added.',
        ),
      onUpdateMember: (id, payload) =>
        runMutation(
          () => apiRequest(`/api/family/members/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            members: prev.members.map((m) => (m.id === id ? { ...m, ...(payload as any) } : m)),
          }),
          'Member permissions updated.',
        ),
      onDeleteMember: (id) =>
        runMutation(
          () => apiRequest(`/api/family/members/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }),
          'Member removed.',
        ),
      onAddAccount: (payload) =>
        runMutation(
          () => apiRequest('/api/accounts', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            accounts: [
              ...prev.accounts,
              {
                id: Date.now(),
                familyId: prev.family.id,
                ownerMemberId: (payload.ownerMemberId as number) || prev.currentMember.id,
                name: String(payload.name),
                bankName: (payload.bankName as string) || null,
                accountType: String(payload.accountType || 'SAVINGS'),
                openingBalance: Number(payload.openingBalance || 0).toFixed(2),
                currentBalance: Number(payload.openingBalance || 0).toFixed(2),
                status: 'ACTIVE',
                notes: null,
              },
            ],
          }),
          'Account added.',
        ),
      onReconcileAccount: (id, actualBalance, notes) =>
        runMutation(
          () =>
            apiRequest(`/api/accounts/${id}/reconcile`, {
              method: 'POST',
              body: JSON.stringify({ actualBalance, notes }),
            }),
          (prev) => ({
            ...prev,
            accounts: prev.accounts.map((a) =>
              a.id === id ? { ...a, currentBalance: actualBalance.toFixed(2) } : a,
            ),
          }),
          'Account balance reconciled.',
        ),
      onAddTransaction: (payload) =>
        runMutation(
          () => apiRequest('/api/transactions', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => {
            const amt = Number(payload.amount);
            const type = payload.type as any;
            const status = (payload.status as string) || 'COMPLETED';
            const srcId = payload.accountId ? Number(payload.accountId) : null;
            const dstId = payload.toAccountId ? Number(payload.toAccountId) : null;

            const updatedAccounts = prev.accounts.map((a) => {
              if (status !== 'COMPLETED') return a;
              let bal = toNum(a.currentBalance);
              if (a.id === srcId) {
                bal += type === 'INCOME' ? amt : -amt;
              }
              if (type === 'TRANSFER' && a.id === dstId) {
                bal += amt;
              }
              return { ...a, currentBalance: bal.toFixed(2) };
            });

            return {
              ...prev,
              accounts: updatedAccounts,
              transactions: [
                {
                  id: Date.now(),
                  familyId: prev.family.id,
                  memberId: (payload.memberId as number) || prev.currentMember.id,
                  accountId: srcId,
                  toAccountId: dstId,
                  type,
                  category: String(payload.category || 'Other'),
                  subCategory: null,
                  amount: amt.toFixed(2),
                  principalAmount: null,
                  interestAmount: null,
                  paymentMethod: String(payload.paymentMethod || 'UPI'),
                  merchantOrSource: (payload.merchantOrSource as string) || null,
                  description: (payload.description as string) || null,
                  transactionDate: String(payload.transactionDate || new Date().toISOString().slice(0, 10)),
                  isRecurring: Boolean(payload.isRecurring),
                  recurringFrequency: (payload.recurringFrequency as string) || null,
                  isExpected: Boolean(payload.isExpected),
                  status,
                  gstTag: Boolean(payload.gstTag),
                  linkedEntityType: null,
                  linkedEntityId: null,
                },
                ...prev.transactions,
              ],
            };
          },
          'Transaction saved.',
        ),
      onDeleteTransaction: (id) =>
        runMutation(
          () => apiRequest(`/api/transactions/${id}`, { method: 'DELETE' }),
          (prev) => {
            const existing = prev.transactions.find((t) => t.id === id);
            let accounts = prev.accounts;
            if (existing && existing.status === 'COMPLETED') {
              const amt = toNum(existing.amount);
              accounts = prev.accounts.map((a) => {
                let bal = toNum(a.currentBalance);
                if (a.id === existing.accountId) {
                  bal += existing.type === 'INCOME' ? -amt : amt;
                }
                if (existing.type === 'TRANSFER' && a.id === existing.toAccountId) {
                  bal -= amt;
                }
                return { ...a, currentBalance: bal.toFixed(2) };
              });
            }
            return {
              ...prev,
              accounts,
              transactions: prev.transactions.filter((t) => t.id !== id),
            };
          },
          'Transaction deleted.',
        ),
      onAddBudget: (payload) =>
        runMutation(
          () => apiRequest('/api/budgets', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            budgets: [
              ...prev.budgets,
              {
                id: Date.now() + Math.floor(Math.random() * 1000),
                familyId: prev.family.id,
                memberId: (payload.memberId as number) || null,
                name: String(payload.name),
                category: String(payload.category),
                period: String(payload.period || 'MONTHLY'),
                monthKey: String(payload.monthKey),
                allocatedAmount: Number(payload.allocatedAmount).toFixed(2),
                alertThresholdPct: Number(payload.alertThresholdPct || 80),
              },
            ],
          }),
          'Budget created.',
        ),
      onDeleteBudget: (id) =>
        runMutation(
          () => apiRequest(`/api/budgets/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }),
          'Budget removed.',
        ),
      onAddAsset: (payload) =>
        runMutation(
          () => apiRequest('/api/assets', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            assets: [
              ...prev.assets,
              {
                id: Date.now(),
                familyId: prev.family.id,
                ownerMemberId: prev.currentMember.id,
                name: String(payload.name),
                category: String(payload.category),
                purchaseDate: null,
                purchaseValue: Number(payload.purchaseValue || 0).toFixed(2),
                currentValue: Number(payload.currentValue || 0).toFixed(2),
                ownershipPercentage: Number(payload.ownershipPercentage || 100).toFixed(2),
                valuationType: (payload.valuationType as any) || 'ESTIMATED',
                locationOrDescription: (payload.locationOrDescription as string) || null,
                excludeFromNetWorthDuplicate: Boolean(payload.excludeFromNetWorthDuplicate),
              },
            ],
          }),
          'Asset added.',
        ),
      onAddAssetValuation: (id, payload) =>
        runMutation(
          () => apiRequest(`/api/assets/${id}/valuations`, { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            assets: prev.assets.map((a) =>
              a.id === id
                ? {
                    ...a,
                    currentValue: Number(payload.value).toFixed(2),
                    valuationType: (payload.valuationType as any) || a.valuationType,
                  }
                : a,
            ),
          }),
          'Asset valuation updated.',
        ),
      onDeleteAsset: (id) =>
        runMutation(
          () => apiRequest(`/api/assets/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, assets: prev.assets.filter((a) => a.id !== id) }),
          'Asset removed.',
        ),
      onAddInvestment: (payload) =>
        runMutation(
          () => apiRequest('/api/investments', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            investments: [
              ...prev.investments,
              {
                id: Date.now(),
                familyId: prev.family.id,
                ownerMemberId: prev.currentMember.id,
                name: String(payload.name),
                category: String(payload.category),
                purchaseDate: new Date().toISOString().slice(0, 10),
                investedAmount: Number(payload.investedAmount).toFixed(2),
                units: Number(payload.units || 0).toFixed(4),
                purchasePrice: '0.00',
                currentValue: Number(payload.currentValue || payload.investedAmount).toFixed(2),
                realizedGain: '0.00',
                sipMonthlyAmount: Number(payload.sipMonthlyAmount || 0).toFixed(2),
                notes: null,
              },
            ],
          }),
          'Investment holding added.',
        ),
      onAddInvestmentTx: (id, payload) =>
        runMutation(
          () =>
            apiRequest(`/api/investments/${id}/transactions`, {
              method: 'POST',
              body: JSON.stringify(payload),
            }),
          (prev) => {
            const amt = Number(payload.amount);
            const txType = String(payload.txType);
            return {
              ...prev,
              investments: prev.investments.map((i) => {
                if (i.id !== id) return i;
                if (txType === 'CONTRIBUTION') {
                  return {
                    ...i,
                    investedAmount: (toNum(i.investedAmount) + amt).toFixed(2),
                    currentValue: (toNum(i.currentValue) + amt).toFixed(2),
                  };
                }
                if (txType === 'WITHDRAWAL') {
                  return {
                    ...i,
                    currentValue: Math.max(0, toNum(i.currentValue) - amt).toFixed(2),
                  };
                }
                if (txType === 'VALUATION_UPDATE') {
                  return { ...i, currentValue: amt.toFixed(2) };
                }
                return i;
              }),
            };
          },
          'Investment record updated.',
        ),
      onDeleteInvestment: (id) =>
        runMutation(
          () => apiRequest(`/api/investments/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, investments: prev.investments.filter((i) => i.id !== id) }),
          'Investment removed.',
        ),
      onAddLoan: (payload) =>
        runMutation(
          () => apiRequest('/api/loans', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            loans: [
              ...prev.loans,
              {
                id: Date.now(),
                familyId: prev.family.id,
                memberId: prev.currentMember.id,
                name: String(payload.name),
                category: String(payload.category),
                lender: String(payload.lender),
                principalAmount: Number(payload.principalAmount).toFixed(2),
                outstandingPrincipal: Number(payload.outstandingPrincipal).toFixed(2),
                interestRate: Number(payload.interestRate).toFixed(2),
                startDate: null,
                endDate: null,
                emiAmount: Number(payload.emiAmount).toFixed(2),
                emiFrequency: 'MONTHLY',
                nextPaymentDate: null,
                status: 'ACTIVE',
              },
            ],
          }),
          'Loan recorded.',
        ),
      onAddLoanRepayment: (id, payload) =>
        runMutation(
          () => apiRequest(`/api/loans/${id}/repayments`, { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            loans: prev.loans.map((l) =>
              l.id === id
                ? {
                    ...l,
                    outstandingPrincipal: Math.max(
                      0,
                      toNum(l.outstandingPrincipal) - Number(payload.principalComponent || 0),
                    ).toFixed(2),
                  }
                : l,
            ),
          }),
          'Loan repayment recorded.',
        ),
      onDeleteLoan: (id) =>
        runMutation(
          () => apiRequest(`/api/loans/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, loans: prev.loans.filter((l) => l.id !== id) }),
          'Loan removed.',
        ),
      onAddGoal: (payload) =>
        runMutation(
          () => apiRequest('/api/goals', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            goals: [
              ...prev.goals,
              {
                id: Date.now(),
                familyId: prev.family.id,
                memberId: prev.currentMember.id,
                linkedAccountId: null,
                title: String(payload.title),
                goalType: String(payload.goalType),
                targetAmount: Number(payload.targetAmount).toFixed(2),
                currentAllocated: Number(payload.currentAllocated || 0).toFixed(2),
                monthlyContribution: Number(payload.monthlyContribution || 0).toFixed(2),
                targetDate: (payload.targetDate as string) || null,
                priority: (payload.priority as any) || 'MEDIUM',
                status: 'IN_PROGRESS',
              },
            ],
          }),
          'Financial goal created.',
        ),
      onAddGoalTx: (id, payload) =>
        runMutation(
          () => apiRequest(`/api/goals/${id}/transactions`, { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            goals: prev.goals.map((g) => {
              if (g.id !== id) return g;
              const amt = Number(payload.amount);
              const next =
                payload.txType === 'WITHDRAWAL'
                  ? Math.max(0, toNum(g.currentAllocated) - amt)
                  : toNum(g.currentAllocated) + amt;
              return { ...g, currentAllocated: next.toFixed(2) };
            }),
          }),
          'Goal allocation updated.',
        ),
      onDeleteGoal: (id) =>
        runMutation(
          () => apiRequest(`/api/goals/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }),
          'Goal removed.',
        ),
      onAddBill: (payload) =>
        runMutation(
          () => apiRequest('/api/bills', { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            bills: [
              ...prev.bills,
              {
                id: Date.now(),
                familyId: prev.family.id,
                memberId: prev.currentMember.id,
                accountId: (payload.accountId as number) || null,
                title: String(payload.title),
                category: String(payload.category),
                amount: Number(payload.amount).toFixed(2),
                dueDate: String(payload.dueDate),
                frequency: String(payload.frequency || 'MONTHLY'),
                reminderDaysBefore: 3,
                status: 'UPCOMING',
                paidDate: null,
                notes: null,
              },
            ],
          }),
          'Bill reminder scheduled.',
        ),
      onPayBill: (id, payload) =>
        runMutation(
          () => apiRequest(`/api/bills/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) }),
          (prev) => ({
            ...prev,
            bills: prev.bills.map((b) =>
              b.id === id ? { ...b, status: 'PAID', paidDate: new Date().toISOString().slice(0, 10) } : b,
            ),
          }),
          'Bill marked as paid.',
        ),
      onDeleteBill: (id) =>
        runMutation(
          () => apiRequest(`/api/bills/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, bills: prev.bills.filter((b) => b.id !== id) }),
          'Bill deleted.',
        ),
      onUploadDocument: (formData) =>
        runMutation(
          () => apiRequest('/api/documents', { method: 'POST', body: formData }),
          (prev) => prev,
          'Document uploaded securely.',
        ),
      onDownloadDocument: async (id, filename) => {
        if (!firebaseUser) return;
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`/api/documents/${id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          showToast('error', 'Failed to download document.');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      onDeleteDocument: (id) =>
        runMutation(
          () => apiRequest(`/api/documents/${id}`, { method: 'DELETE' }),
          (prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== id) }),
          'Document deleted.',
        ),
      onAskAssistant: (question) =>
        apiRequest('/api/assistant/ask', {
          method: 'POST',
          body: JSON.stringify({ question }),
        }),
      onExportBackup: async () => {
        if (isPreviewMode && snapshot) {
          const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'family-wealth-os-preview-backup.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        const data = await apiRequest('/api/backup/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `family-wealth-os-backup-${snapshot?.family.id}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    }),
    [isPreviewMode, isBusy, runMutation, apiRequest, firebaseUser, snapshot],
  );

  // Loading state while Firebase resolves session
  if (!authReady && !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1221] text-slate-700 dark:text-slate-200 text-sm">
        Initializing Family Wealth OS...
      </div>
    );
  }

  // Unauthenticated Landing / Sign-In Screen
  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1221] text-slate-900 dark:text-slate-100 flex flex-col justify-between">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display font-bold text-lg tracking-tight text-[#0F274A] dark:text-[#D4AF37] whitespace-nowrap shrink-0">
            FAMILY WEALTH OS
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              type="button"
              onClick={handleSignIn}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] whitespace-nowrap shrink-0"
            >
              Sign in with Google
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-semibold tracking-wide text-[#C89B3C]">
              PERSONAL & FAMILY FINANCIAL COMMAND CENTER
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#0F274A] dark:text-white leading-tight [text-wrap:balance]">
              Manage money, build assets, and create generational family wealth.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Built for Indian households across every income level—from ₹15,000 to ₹2,00,000+ per
              month. Track every rupee, control budgets, protect your emergency fund, manage loans,
              and grow investments inside a private, family-isolated PostgreSQL workspace.
            </p>

            {banner && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                {banner.text}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSignIn}
                className="px-5 py-3 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] hover:opacity-90 whitespace-nowrap"
              >
                Sign in with Google (Cloud SQL)
              </button>
              <button
                type="button"
                onClick={enterPreview}
                className="px-5 py-3 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Explore Sample Workspace
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#0F274A] dark:text-[#D4AF37]">
              Core Accounting & Privacy Guarantees
            </h2>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>· Internal transfers between family accounts never inflate income or expenses.</li>
              <li>· Investments, joint assets, and loan principal repayments reconcile without double counting.</li>
              <li>· Indian Rupee (₹), DD-MM-YYYY dates, April–March Financial Year, PPF/EPF/NPS/SIP support.</li>
              <li>· Role-based permissions for Family Owner, Administrator, Member, and Child accounts.</li>
              <li>· Zero banking passwords, UPI PINs, or ATM PINs ever collected or stored.</li>
            </ul>
          </div>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
          <span>Family Wealth OS · Earn. Control. Save. Invest. Protect.</span>
          <span>Educational financial planning & household accounting</span>
        </footer>
      </div>
    );
  }

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      familyName={snapshot.family.name}
      memberRole={snapshot.currentMember.role}
      isPreviewMode={isPreviewMode}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      language={language}
      onSignOut={handleSignOut}
      onRequestSignIn={handleSignIn}
    >
      {banner && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-2.5 text-xs flex items-center justify-between ${
            banner.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-semibold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          snapshot={snapshot}
          onNavigate={setActiveTab}
          onSeedSample={actions.onSeedSample}
          isBusy={isBusy}
        />
      )}
      {activeTab === 'family' && <FamilyView snapshot={snapshot} actions={actions} />}
      {activeTab === 'income' && <IncomeView snapshot={snapshot} actions={actions} />}
      {activeTab === 'expenses' && <ExpensesView snapshot={snapshot} actions={actions} />}
      {activeTab === 'transactions' && <TransactionsView snapshot={snapshot} />}
      {activeTab === 'accounts' && <AccountsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'budgets' && <BudgetsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'savings' && <SavingsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'emergency' && <EmergencyFundView snapshot={snapshot} actions={actions} />}
      {activeTab === 'assets' && <AssetsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'investments' && <InvestmentsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'loans' && <LoansView snapshot={snapshot} actions={actions} />}
      {activeTab === 'goals' && <GoalsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'calculators' && <CalculatorsView />}
      {activeTab === 'reports' && <ReportsView snapshot={snapshot} />}
      {activeTab === 'intelligence' && (
        <IntelligenceView snapshot={snapshot} onNavigate={setActiveTab} />
      )}
      {activeTab === 'bills' && <BillsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'documents' && <DocumentsView snapshot={snapshot} actions={actions} />}
      {activeTab === 'assistant' && <AssistantView snapshot={snapshot} actions={actions} />}
      {activeTab === 'settings' && (
        <SettingsView
          snapshot={snapshot}
          actions={actions}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          language={language}
          onChangeLanguage={(lang) => {
            setLanguage(lang);
            if (!isPreviewMode) {
              actions.onUpdateFamilySettings({ language: lang });
            }
          }}
        />
      )}
    </WorkspaceShell>
  );
}
