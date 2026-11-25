export interface WorkspaceActions {
  isPreviewMode: boolean;
  isBusy: boolean;
  onSeedSample: () => Promise<void>;
  onUpdateFamilySettings: (payload: Record<string, unknown>) => Promise<void>;
  onAddMember: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateMember: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteMember: (id: number) => Promise<void>;
  onAddAccount: (payload: Record<string, unknown>) => Promise<void>;
  onReconcileAccount: (id: number, actualBalance: number, notes: string) => Promise<void>;
  onAddTransaction: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onAddBudget: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteBudget: (id: number) => Promise<void>;
  onAddAsset: (payload: Record<string, unknown>) => Promise<void>;
  onAddAssetValuation: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteAsset: (id: number) => Promise<void>;
  onAddInvestment: (payload: Record<string, unknown>) => Promise<void>;
  onAddInvestmentTx: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteInvestment: (id: number) => Promise<void>;
  onAddLoan: (payload: Record<string, unknown>) => Promise<void>;
  onAddLoanRepayment: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteLoan: (id: number) => Promise<void>;
  onAddGoal: (payload: Record<string, unknown>) => Promise<void>;
  onAddGoalTx: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteGoal: (id: number) => Promise<void>;
  onAddBill: (payload: Record<string, unknown>) => Promise<void>;
  onPayBill: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeleteBill: (id: number) => Promise<void>;
  onUploadDocument: (formData: FormData) => Promise<void>;
  onDownloadDocument: (id: number, filename: string) => Promise<void>;
  onDeleteDocument: (id: number) => Promise<void>;
  onAskAssistant: (question: string) => Promise<{
    answer: string;
    factsUsed: string[];
    assumptionsOrDisclaimer: string;
  }>;
  onExportBackup: () => Promise<void>;
}
