import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  FolderLock,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Moon,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { UI_STRINGS, type SupportedLanguage } from '../lib/i18n';
import type { NavSectionId } from '../lib/types';

interface NavItem {
  id: NavSectionId;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'family', icon: Users },
  { id: 'income', icon: TrendingUp },
  { id: 'expenses', icon: TrendingDown },
  { id: 'transactions', icon: ArrowLeftRight },
  { id: 'accounts', icon: Landmark },
  { id: 'budgets', icon: FileText },
  { id: 'savings', icon: PiggyBank },
  { id: 'emergency', icon: ShieldAlert },
  { id: 'assets', icon: Building2 },
  { id: 'investments', icon: Briefcase },
  { id: 'loans', icon: CreditCard },
  { id: 'goals', icon: Target },
  { id: 'calculators', icon: Calculator },
  { id: 'reports', icon: BarChart3 },
  { id: 'intelligence', icon: Lightbulb },
  { id: 'bills', icon: Bell },
  { id: 'documents', icon: FolderLock },
  { id: 'assistant', icon: Bot },
  { id: 'settings', icon: ShieldCheck },
];

export function WorkspaceShell({
  activeTab,
  onSelectTab,
  familyName,
  memberRole,
  isPreviewMode,
  theme,
  onToggleTheme,
  language,
  onSignOut,
  onRequestSignIn,
  children,
}: {
  activeTab: NavSectionId;
  onSelectTab: (id: NavSectionId) => void;
  familyName: string;
  memberRole: string;
  isPreviewMode: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: SupportedLanguage;
  onSignOut: () => void;
  onRequestSignIn: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const strings = UI_STRINGS[language];

  const activeLabel = strings[activeTab] || activeTab;

  const renderNavList = (onPick?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="Primary Navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectTab(item.id);
              onPick?.();
            }}
            title={collapsed ? strings[item.id] : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{strings[item.id]}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B1221] text-slate-900 dark:text-slate-100">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] shrink-0 transition-all ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          {!collapsed && (
            <span className="font-display font-bold text-sm tracking-tight text-[#0F274A] dark:text-[#D4AF37] whitespace-nowrap">
              FAMILY WEALTH OS
            </span>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {renderNavList()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white dark:bg-[#0F172A] h-full flex flex-col border-r border-slate-200 dark:border-slate-800">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-sm text-[#0F274A] dark:text-[#D4AF37]">
                FAMILY WEALTH OS
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNavList(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {activeLabel}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {familyName} · {memberRole.replace(/_/g, ' ')}
                {isPreviewMode ? ' · Sample Preview' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              aria-label="Toggle Light or Dark mode"
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {isPreviewMode ? (
              <button
                type="button"
                onClick={onRequestSignIn}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0F274A] text-white dark:bg-[#D4AF37] dark:text-[#0B1221] whitespace-nowrap shrink-0"
              >
                Sign in with Google
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
