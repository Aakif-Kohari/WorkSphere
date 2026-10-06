"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PieChart,
  Edit3,
  Download,
  Plus,
  CheckCircle2,
  Calendar,
  X,
  Building,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { BudgetSummary, DepartmentAllocation } from "@/lib/billing/budgetService";

export function MonthlyBudgetTracker() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newLimit, setNewLimit] = useState<number>(500);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/budget");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          setNewLimit(data.summary.monthlyLimit);
        }
      }
    } catch (err) {
      console.error("Failed to load workspace budget:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await fetch("/api/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit: Number(newLimit) }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          setIsEditModalOpen(false);
          showToast("Monthly workspace budget updated!");
        }
      }
    } catch (err) {
      console.error("Failed to update budget limit:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!summary?.recentExpenses?.length) return;
    const headers = ["Date", "Venue", "Category", "Department", "Cost Center", "Amount (USD)"];
    const rows = summary.recentExpenses.map((e) => [
      e.date,
      `"${e.venueName}"`,
      `"${e.category}"`,
      `"${e.department}"`,
      `"${e.costCenter || "N/A"}"`,
      e.amount,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workspace_expenses_${summary.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported expense report to CSV!");
  };

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-zinc-500">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-xs">Loading workspace budget & allocations...</span>
      </div>
    );
  }

  if (!summary) return null;

  const isWarning = summary.utilizationPercentage >= 80;
  const isDanger = summary.utilizationPercentage >= 100;

  return (
    <div className="rounded-3xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Monthly Workspace Budget & Team Allocations
              </h3>
              <p className="text-xs text-zinc-500">
                Track coworking spend across departments, burn rate, and expense limits.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-colors shadow-xs"
            title="Download expense report as CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Set Budget Cap</span>
          </button>
        </div>
      </div>

      {/* Warning banner if approaching budget cap */}
      {isWarning && (
        <div
          className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
            isDanger
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isDanger
              ? `Budget Cap Exceeded: You have spent $${summary.totalSpent} of your $${summary.monthlyLimit} monthly limit.`
              : `Budget Warning: You have utilized ${summary.utilizationPercentage}% ($${summary.totalSpent}) of your $${summary.monthlyLimit} monthly budget.`}
          </span>
        </div>
      )}

      {/* Main Budget Progress Card */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Total Monthly Utilization
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5 flex items-baseline gap-2">
              <span>${summary.totalSpent}</span>
              <span className="text-sm font-normal text-zinc-500">/ ${summary.monthlyLimit}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Remaining Budget
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              ${summary.remainingBudget}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 rounded-full ${
              isDanger
                ? "bg-rose-500"
                : isWarning
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600"
            }`}
            style={{ width: `${Math.min(100, summary.utilizationPercentage)}%` }}
          />
        </div>

        {/* Forecast Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-zinc-200/60 dark:border-zinc-800/60">
          <div>
            <span className="text-zinc-500">Daily Burn Rate:</span>
            <span className="ml-1.5 font-bold text-zinc-800 dark:text-zinc-200">
              ${summary.burnRatePerDay}/day
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Projected Month-End:</span>
            <span className="ml-1.5 font-bold text-zinc-800 dark:text-zinc-200">
              ${summary.projectedMonthEndSpend}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-zinc-500">Cycle:</span>
            <span className="ml-1.5 font-bold text-zinc-800 dark:text-zinc-200">
              {summary.month}
            </span>
          </div>
        </div>
      </div>

      {/* Team / Department Expense Allocation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-500" />
            Department &amp; Team Allocations
          </h4>
          <span className="text-[11px] text-zinc-500">Allocated breakdown</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summary.departments.map((dept) => {
            const deptPct = Math.round((dept.spentAmount / (dept.allocatedAmount || 1)) * 100);
            return (
              <div
                key={dept.id}
                className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-850/40 border border-zinc-200/70 dark:border-zinc-800 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {dept.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-zinc-700 dark:text-zinc-300">
                    ${dept.spentAmount} / ${dept.allocatedAmount}
                  </span>
                </div>

                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: dept.color,
                      width: `${Math.min(100, deptPct)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Expense Log */}
      {summary.recentExpenses?.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Recent Workspace Expenses ({summary.recentExpenses.length})
            </h4>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/40">
            {summary.recentExpenses.map((expense) => (
              <div
                key={expense.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">
                      {expense.venueName}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{expense.category}</span>
                      <span>•</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {expense.department}
                      </span>
                      {expense.costCenter && <span>({expense.costCenter})</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black font-mono text-zinc-900 dark:text-zinc-100 text-sm">
                    ${expense.amount}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{expense.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Set Monthly Workspace Budget
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLimit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Monthly Budget Cap (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    step="25"
                    value={newLimit}
                    onChange={(e) => setNewLimit(Number(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  You will receive alert warnings at 80% utilization.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/30 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
