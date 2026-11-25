import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WorkspaceActions } from '../../lib/actions';
import { formatDateDDMMYYYY, formatINR, simulateDebtPayoff, toNum } from '../../lib/finance';
import type { FamilyWorkspaceSnapshot } from '../../lib/types';

export function AssetsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('RESIDENTIAL_PROPERTY');
  const [purchaseValue, setPurchaseValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [ownershipPercentage, setOwnershipPercentage] = useState('100');
  const [valuationType, setValuationType] = useState<'ESTIMATED' | 'VERIFIED'>('ESTIMATED');
  const [locationOrDescription, setLocationOrDescription] = useState('');
  const [excludeDuplicate, setExcludeDuplicate] = useState(false);

  const [valAssetId, setValAssetId] = useState<number | null>(null);
  const [newVal, setNewVal] = useState('');
  const [newValType, setNewValType] = useState<'ESTIMATED' | 'VERIFIED'>('ESTIMATED');

  const totalEffectiveValue = snapshot.assets.reduce((sum, a) => {
    if (a.excludeFromNetWorthDuplicate) return sum;
    return sum + toNum(a.currentValue) * (toNum(a.ownershipPercentage) / 100);
  }, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || currentValue === '') return;
    await actions.onAddAsset({
      name: name.trim(),
      category,
      purchaseValue: Number(purchaseValue || currentValue),
      currentValue: Number(currentValue),
      ownershipPercentage: Number(ownershipPercentage || 100),
      valuationType,
      locationOrDescription: locationOrDescription.trim() || null,
      excludeFromNetWorthDuplicate: excludeDuplicate,
    });
    setName('');
    setPurchaseValue('');
    setCurrentValue('');
    setLocationOrDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">Total Ownership-Weighted Physical & Other Assets</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0F274A] dark:text-[#D4AF37]">
            {formatINR(totalEffectiveValue)}
          </p>
        </div>
        <span className="text-xs text-slate-500">
          Joint ownership % applied · Bank & investment mirrors can be excluded from net worth double-counting
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.assets.map((a) => {
          const shareVal = toNum(a.currentValue) * (toNum(a.ownershipPercentage) / 100);
          return (
            <div
              key={a.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{a.name}</h4>
                  <p className="text-xs text-slate-500">
                    {a.category.replace(/_/g, ' ')} · {a.valuationType} Valuation · {a.ownershipPercentage}% ownership
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete asset ${a.name}`}
                  onClick={() => actions.onDeleteAsset(a.id)}
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatINR(shareVal)}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Full value: {formatINR(a.currentValue)}
                </span>
              </div>
              {a.locationOrDescription && (
                <p className="text-xs text-slate-600 dark:text-slate-300">{a.locationOrDescription}</p>
              )}
              {a.excludeFromNetWorthDuplicate && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Excluded from Net Worth total (already tracked in accounts/investments)
                </p>
              )}

              {valAssetId === a.id ? (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    placeholder="New value ₹"
                    className="w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                  />
                  <select
                    value={newValType}
                    onChange={(e) => setNewValType(e.target.value as 'ESTIMATED' | 'VERIFIED')}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="ESTIMATED">Estimated</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      await actions.onAddAssetValuation(a.id, {
                        value: Number(newVal),
                        valuationType: newValType,
                      });
                      setValAssetId(null);
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setValAssetId(null)}
                    className="px-2 py-1 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setValAssetId(a.id);
                    setNewVal(String(toNum(a.currentValue)));
                  }}
                  className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                >
                  Update Valuation
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Register Family Asset</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Asset name (e.g. Family Gold / Plot)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="RESIDENTIAL_PROPERTY">Residential Property</option>
            <option value="LAND">Land</option>
            <option value="COMMERCIAL_PROPERTY">Commercial Property</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="VEHICLES">Vehicles</option>
            <option value="BUSINESS_OWNERSHIP">Business Ownership</option>
            <option value="OTHER">Other Assets</option>
          </select>
          <input
            type="number"
            min="0"
            required
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="Current value (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            value={purchaseValue}
            onChange={(e) => setPurchaseValue(e.target.value)}
            placeholder="Purchase value (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="1"
            max="100"
            value={ownershipPercentage}
            onChange={(e) => setOwnershipPercentage(e.target.value)}
            placeholder="Ownership %"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <select
            value={valuationType}
            onChange={(e) => setValuationType(e.target.value as 'ESTIMATED' | 'VERIFIED')}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="ESTIMATED">Estimated Market Value</option>
            <option value="VERIFIED">Verified Valuation</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              value={locationOrDescription}
              onChange={(e) => setLocationOrDescription(e.target.value)}
              placeholder="Location or notes"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm w-64"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={excludeDuplicate}
                onChange={(e) => setExcludeDuplicate(e.target.checked)}
              />
              Exclude from Net Worth (already in Bank/Investments)
            </label>
          </div>
          <button
            type="submit"
            disabled={actions.isBusy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
          >
            Add Asset
          </button>
        </div>
      </form>
    </div>
  );
}

export function InvestmentsView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('SIP');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState('');
  const [units, setUnits] = useState('');

  const [txInvId, setTxInvId] = useState<number | null>(null);
  const [txType, setTxType] = useState('CONTRIBUTION');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');

  if (!snapshot.currentMember.canViewInvestments) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-8 text-center text-sm text-slate-600 dark:text-slate-300">
        Investment holdings are restricted under your current family member permissions.
      </div>
    );
  }

  const totalInvested = snapshot.investments.reduce((s, i) => s + toNum(i.investedAmount), 0);
  const totalCurrent = snapshot.investments.reduce((s, i) => s + toNum(i.currentValue), 0);
  const unrealized = totalCurrent - totalInvested;
  const realized = snapshot.investments.reduce((s, i) => s + toNum(i.realizedGain), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || investedAmount === '') return;
    await actions.onAddInvestment({
      name: name.trim(),
      category,
      investedAmount: Number(investedAmount),
      currentValue: Number(currentValue || investedAmount),
      sipMonthlyAmount: Number(sipMonthlyAmount || 0),
      units: Number(units || 0),
    });
    setName('');
    setInvestedAmount('');
    setCurrentValue('');
    setSipMonthlyAmount('');
    setUnits('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Total Invested Capital</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums">{formatINR(totalInvested)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Current Portfolio Value (Manual)</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#0F274A] dark:text-[#D4AF37]">
            {formatINR(totalCurrent)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Unrealized Gain / Loss</p>
          <p className={`mt-1 text-xl font-bold font-mono tabular-nums ${unrealized >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
            {formatINR(unrealized)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-4">
          <p className="text-xs text-slate-500">Realized Gains</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums">{formatINR(realized)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.investments.map((inv) => {
          const gain = toNum(inv.currentValue) - toNum(inv.investedAmount);
          return (
            <div
              key={inv.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{inv.name}</h4>
                  <p className="text-xs text-slate-500">
                    {inv.category.replace(/_/g, ' ')} {toNum(inv.sipMonthlyAmount) > 0 ? `· SIP ${formatINR(inv.sipMonthlyAmount)}/mo` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete investment ${inv.name}`}
                  onClick={() => actions.onDeleteInvestment(inv.id)}
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 block font-sans">Invested</span>
                  <span>{formatINR(inv.investedAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Current Value</span>
                  <span className="font-semibold">{formatINR(inv.currentValue)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Unrealized</span>
                  <span className={gain >= 0 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-600 font-semibold'}>
                    {formatINR(gain)}
                  </span>
                </div>
              </div>

              {txInvId === inv.id ? (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="CONTRIBUTION">Contribution (Buy / SIP)</option>
                    <option value="WITHDRAWAL">Withdrawal (Redeem)</option>
                    <option value="VALUATION_UPDATE">Update Manual Value</option>
                    <option value="DIVIDEND_OR_INTEREST">Dividend / Interest</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="Amount ₹"
                    className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                  />
                  {txType !== 'VALUATION_UPDATE' && (
                    <select
                      value={txAccountId}
                      onChange={(e) => setTxAccountId(e.target.value)}
                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                    >
                      <option value="">No bank link</option>
                      {snapshot.accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (Number(txAmount) <= 0) return;
                      await actions.onAddInvestmentTx(inv.id, {
                        txType,
                        amount: Number(txAmount),
                        accountId: txAccountId ? Number(txAccountId) : null,
                      });
                      setTxInvId(null);
                      setTxAmount('');
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
                  >
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxInvId(null)}
                    className="px-2 py-1 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTxInvId(inv.id)}
                  className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
                >
                  + Contribution / Redemption / Update Value
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Add Investment Holding (Manual Valuation)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Holding name (e.g. Nifty 50 Index / PPF)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="MUTUAL_FUNDS">Mutual Funds</option>
            <option value="SIP">SIP</option>
            <option value="INDIAN_STOCKS">Indian Stocks</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="FIXED_DEPOSITS">Fixed Deposits</option>
            <option value="RECURRING_DEPOSITS">Recurring Deposits</option>
            <option value="PPF">PPF</option>
            <option value="EPF">EPF</option>
            <option value="NPS">NPS</option>
            <option value="GOVERNMENT_SECURITIES">Government Securities</option>
            <option value="REAL_ESTATE">Real Estate</option>
            <option value="OTHER">Other Investments</option>
          </select>
          <input
            type="number"
            min="0"
            required
            value={investedAmount}
            onChange={(e) => setInvestedAmount(e.target.value)}
            placeholder="Invested amount (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="Current value (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            value={sipMonthlyAmount}
            onChange={(e) => setSipMonthlyAmount(e.target.value)}
            placeholder="Monthly SIP amount (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            step="0.0001"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="Units / Shares (optional)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
        </div>
        <button
          type="submit"
          disabled={actions.isBusy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
        >
          Add Investment
        </button>
      </form>
    </div>
  );
}

export function LoansView({
  snapshot,
  actions,
}: {
  snapshot: FamilyWorkspaceSnapshot;
  actions: WorkspaceActions;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HOME_LOAN');
  const [lender, setLender] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [outstandingPrincipal, setOutstandingPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('9.5');
  const [emiAmount, setEmiAmount] = useState('');

  // Debt planner state
  const [strategy, setStrategy] = useState<'AVALANCHE' | 'SNOWBALL' | 'CUSTOM'>('AVALANCHE');
  const [extraMonthly, setExtraMonthly] = useState('2000');

  // Repayment modal inline
  const [repayLoanId, setRepayLoanId] = useState<number | null>(null);
  const [principalComp, setPrincipalComp] = useState('');
  const [interestComp, setInterestComp] = useState('');
  const [repayAcc, setRepayAcc] = useState(snapshot.accounts[0] ? String(snapshot.accounts[0].id) : '');

  const payoffPlan = useMemo(
    () => simulateDebtPayoff(snapshot.loans, Number(extraMonthly || 0), strategy),
    [snapshot.loans, extraMonthly, strategy],
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lender.trim() || Number(principalAmount) <= 0 || Number(emiAmount) <= 0) return;
    await actions.onAddLoan({
      name: name.trim(),
      category,
      lender: lender.trim(),
      principalAmount: Number(principalAmount),
      outstandingPrincipal: Number(outstandingPrincipal || principalAmount),
      interestRate: Number(interestRate || 0),
      emiAmount: Number(emiAmount),
    });
    setName('');
    setLender('');
    setPrincipalAmount('');
    setOutstandingPrincipal('');
    setEmiAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.loans.map((loan) => (
          <div
            key={loan.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">{loan.name}</h4>
                <p className="text-xs text-slate-500">
                  {loan.lender} · {loan.category.replace(/_/g, ' ')} · {loan.interestRate}% p.a.
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete loan ${loan.name}`}
                onClick={() => actions.onDeleteLoan(loan.id)}
                className="p-1 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500 block font-sans">Outstanding</span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatINR(loan.outstandingPrincipal)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Monthly EMI</span>
                <span>{formatINR(loan.emiAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-sans">Next Due</span>
                <span>{formatDateDDMMYYYY(loan.nextPaymentDate)}</span>
              </div>
            </div>

            {repayLoanId === loan.id ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                <input
                  type="number"
                  min="0"
                  value={principalComp}
                  onChange={(e) => setPrincipalComp(e.target.value)}
                  placeholder="Principal ₹"
                  className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                />
                <input
                  type="number"
                  min="0"
                  value={interestComp}
                  onChange={(e) => setInterestComp(e.target.value)}
                  placeholder="Interest ₹"
                  className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                />
                <select
                  value={repayAcc}
                  onChange={(e) => setRepayAcc(e.target.value)}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="">No bank link</option>
                  {snapshot.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    await actions.onAddLoanRepayment(loan.id, {
                      principalComponent: Number(principalComp || 0),
                      interestComponent: Number(interestComp || 0),
                      accountId: repayAcc ? Number(repayAcc) : null,
                    });
                    setRepayLoanId(null);
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
                >
                  Record EMI
                </button>
                <button
                  type="button"
                  onClick={() => setRepayLoanId(null)}
                  className="px-2 py-1 text-xs text-slate-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRepayLoanId(loan.id);
                  const monthlyInt = Math.round((toNum(loan.outstandingPrincipal) * (toNum(loan.interestRate) / 100)) / 12);
                  const emi = toNum(loan.emiAmount);
                  setInterestComp(String(Math.min(emi, monthlyInt)));
                  setPrincipalComp(String(Math.max(0, emi - monthlyInt)));
                }}
                className="text-xs font-semibold text-[#0F274A] dark:text-[#D4AF37] hover:underline"
              >
                + Record Principal / Interest Repayment
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Debt Repayment Strategy Planner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Debt Repayment Strategy Planner
            </h3>
            <p className="text-xs text-slate-500">
              Assumes constant interest rates and rolling freed EMIs into the next priority loan. Estimates are illustrative.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['AVALANCHE', 'SNOWBALL', 'CUSTOM'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStrategy(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  strategy === s
                    ? 'bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                {s === 'AVALANCHE' ? 'Avalanche (Highest Rate)' : s === 'SNOWBALL' ? 'Snowball (Smallest Balance)' : 'Custom Order'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          <label className="block text-xs">
            <span className="text-slate-600 dark:text-slate-300">Extra Monthly Payment (₹)</span>
            <input
              type="number"
              min="0"
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </label>
          <div>
            <p className="text-xs text-slate-500">Estimated Debt-Free Timeline</p>
            <p className="text-lg font-bold font-mono tabular-nums">{payoffPlan.totalMonths} months</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Estimated Total Interest</p>
            <p className="text-lg font-bold font-mono tabular-nums">{formatINR(payoffPlan.totalInterestPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Interest Saved vs Minimums</p>
            <p className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatINR(payoffPlan.interestSaved)}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Loan or Liability</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Loan name (e.g. SBI Home Loan)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="HOME_LOAN">Home Loan</option>
            <option value="PERSONAL_LOAN">Personal Loan</option>
            <option value="VEHICLE_LOAN">Vehicle Loan</option>
            <option value="EDUCATION_LOAN">Education Loan</option>
            <option value="GOLD_LOAN">Gold Loan</option>
            <option value="BUSINESS_LOAN">Business Loan</option>
            <option value="CREDIT_CARD">Credit Card Outstanding</option>
            <option value="OTHER">Other Liability</option>
          </select>
          <input
            type="text"
            required
            value={lender}
            onChange={(e) => setLender(e.target.value)}
            placeholder="Lender (e.g. SBI / HDFC)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            required
            value={principalAmount}
            onChange={(e) => setPrincipalAmount(e.target.value)}
            placeholder="Original loan amount (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            value={outstandingPrincipal}
            onChange={(e) => setOutstandingPrincipal(e.target.value)}
            placeholder="Outstanding principal (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="Interest rate (% p.a.)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
          <input
            type="number"
            min="1"
            required
            value={emiAmount}
            onChange={(e) => setEmiAmount(e.target.value)}
            placeholder="Monthly EMI (₹)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
          />
        </div>
        <button
          type="submit"
          disabled={actions.isBusy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221]"
        >
          Save Loan
        </button>
      </form>
    </div>
  );
}
