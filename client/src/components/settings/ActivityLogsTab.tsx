import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import {
  Shield,
  ShieldAlert,
  Search,
  Download,
  RotateCcw,
  Power,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Sliders,
  ChevronDown,
  ChevronUp,
  Trash2,
  Home,
  CreditCard,
  FileText,
  Eye,
} from 'lucide-react';

interface ActivityLogItem {
  id: number;
  parishId: number;
  userId: number | null;
  userName: string;
  userRole: string | null;
  actionType: string;
  category: string;
  description: string;
  details: string | null;
  path: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ActivityStats {
  total: number;
  todayCount: number;
  loginCount: number;
  settingsCount: number;
}

interface DistinctUser {
  userId: number;
  userName: string;
  userRole: string | null;
}

export const ActivityLogsTab: React.FC = () => {
  const { user } = useAuth();

  // State
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityStats>({ total: 0, todayCount: 0, loginCount: 0, settingsCount: 0 });
  const [usersList, setUsersList] = useState<DistinctUser[]>([]);
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('ALL');
  const [actionType, setActionType] = useState<string>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Developer Purge Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState<boolean>(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState<string>('');
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Check developer or admin rights for global on/off toggle
  const canToggleLogging =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'DIOCESAN_ADMIN' ||
    user?.role === 'PARISH_PRIEST' ||
    user?.role === 'PARISH_ADMIN';

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/activity/status');
      setLoggingEnabled(res.data.loggingEnabled ?? true);
    } catch (err) {
      console.error('Failed to fetch activity status:', err);
    }
  }, []);

  // Fetch logs with current filters
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {
        page,
        limit: 20,
      };

      if (category !== 'ALL') params.category = category;
      if (actionType !== 'ALL') params.actionType = actionType;
      if (selectedUserId !== 'ALL') params.userId = selectedUserId;
      if (search.trim()) params.search = search.trim();

      // Date range calculation
      if (dateRange === 'TODAY') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.startDate = today.toISOString();
      } else if (dateRange === '7DAYS') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.startDate = d.toISOString();
      } else if (dateRange === '30DAYS') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString();
      }

      const res = await api.get('/activity/logs', { params });
      setLogs(res.data.logs || []);
      setStats(res.data.stats || { total: 0, todayCount: 0, loginCount: 0, settingsCount: 0 });
      setUsersList(res.data.usersList || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err);
      setFeedback({ type: 'error', text: err?.response?.data?.error || 'Failed to load activity logs.' });
    } finally {
      setIsLoading(false);
    }
  }, [page, category, actionType, selectedUserId, search, dateRange]);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
  }, [fetchStatus, fetchLogs]);

  // Toggle Global Activity Logging On/Off
  const handleToggleLogging = async () => {
    if (!canToggleLogging) return;
    try {
      setIsTogglingStatus(true);
      const targetState = !loggingEnabled;
      const res = await api.put('/activity/toggle', { enabled: targetState });
      setLoggingEnabled(res.data.loggingEnabled);
      setFeedback({
        type: 'success',
        text: `Global activity logging engine is now ${res.data.loggingEnabled ? 'ENABLED' : 'DISABLED'}.`,
      });
      setTimeout(() => setFeedback(null), 4000);
      fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.error || 'Failed to toggle activity logging status.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const response = await api.get('/activity/export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parish_activity_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export activity logs.');
    }
  };

  // Developer Purge All Logs
  const handlePurgeAllLogs = async () => {
    if (purgeConfirmInput.trim() !== 'PURGE') return;
    try {
      setIsPurging(true);
      const res = await api.delete('/activity/purge');
      setIsPurgeModalOpen(false);
      setPurgeConfirmInput('');
      setFeedback({
        type: 'success',
        text: res.data.message || 'All activity logs purged successfully.',
      });
      setTimeout(() => setFeedback(null), 4000);
      fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.error || 'Failed to purge activity logs.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsPurging(false);
    }
  };

  // Badge formatter for action types
  const renderActionBadge = (type: string) => {
    switch (type) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <LogIn className="w-3 h-3" />
            LOGIN
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <LogOut className="w-3 h-3" />
            LOGOUT
          </span>
        );
      case 'LOGIN_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            FAILED
          </span>
        );
      case 'PAGE_VIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Globe className="w-3 h-3" />
            PAGE VIEW
          </span>
        );
      case 'SETTINGS_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Sliders className="w-3 h-3" />
            SETTINGS
          </span>
        );
      case 'FAMILY_VIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
            <Eye className="w-3 h-3 text-cyan-600" />
            FAMILY VIEWED
          </span>
        );
      case 'FAMILY_UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Home className="w-3 h-3 text-emerald-600" />
            FAMILY UPDATE
          </span>
        );
      case 'DIRECT_DEBIT_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <CreditCard className="w-3 h-3 text-teal-600" />
            DIRECT DEBIT
          </span>
        );
      case 'DOCUMENT_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <FileText className="w-3 h-3 text-purple-600" />
            DOC ATTACH/DEL
          </span>
        );
      case 'DOCUMENT_VIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Eye className="w-3 h-3 text-sky-600" />
            DOC VIEWED
          </span>
        );
      case 'DOCUMENT_DOWNLOAD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Download className="w-3 h-3 text-amber-600" />
            DOC DOWNLOADED
          </span>
        );
      case 'REPORT_VIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <FileText className="w-3 h-3 text-indigo-600" />
            REPORT VIEWED
          </span>
        );
      case 'REPORT_EXPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <Download className="w-3 h-3 text-rose-600" />
            REPORT EXPORTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3 h-3" />
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Global On/Off Toggle */}
      <div className="p-5 rounded-2xl bg-white border border-parish-border shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-parish-primary/10 text-parish-primary">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-parish-text">System & Security Activity Logs</h2>
                <Badge variant={loggingEnabled ? 'success' : 'danger'}>
                  {loggingEnabled ? 'Logging Engine Active' : 'Logging Engine Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-parish-text-muted mt-0.5">
                Enterprise audit trail tracking user authentication, page access history, and administrative settings modifications.
              </p>
            </div>
          </div>

          {/* Global On/Off Button */}
          {canToggleLogging && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleLogging}
                disabled={isTogglingStatus}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                  loggingEnabled
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                }`}
                title={loggingEnabled ? 'Click to disable activity logging' : 'Click to enable activity logging'}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{loggingEnabled ? 'Turn Off Activity Logging' : 'Turn On Activity Logging'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* 2. Top Summary Count Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-parish-border">
          <div className="p-3 rounded-xl bg-parish-surface border border-parish-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">Total Events</span>
            <p className="text-lg font-bold text-parish-text mt-0.5">{stats.total.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-parish-surface border border-parish-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">Events Today</span>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">{stats.todayCount.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-parish-surface border border-parish-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">Total Logins</span>
            <p className="text-lg font-bold text-sky-600 mt-0.5">{stats.loginCount.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-parish-surface border border-parish-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">Settings Updates</span>
            <p className="text-lg font-bold text-amber-600 mt-0.5">{stats.settingsCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-parish-border shadow-2xs space-y-3">
        {/* Tier 1: Search & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parish-text-muted" />
            <input
              type="text"
              placeholder="Search by user, action, IP, or change description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
            />
          </div>

          {/* Action Buttons Group */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={fetchLogs}
              className="p-2 rounded-xl border border-parish-border bg-parish-surface hover:bg-parish-surface-subtle text-parish-text transition-colors cursor-pointer"
              title="Refresh logs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-parish-primary text-white hover:bg-parish-primary/90 shadow-2xs transition-colors cursor-pointer"
              title="Download activity trail as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {user?.role === 'SUPER_ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setPurgeConfirmInput('');
                  setIsPurgeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 shadow-2xs transition-colors cursor-pointer"
                title="Developer Only: Purge all activity logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Logs (DEV)</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Filter Dropdowns Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-parish-border/60">
          <div className="flex items-center gap-1.5 text-xs text-parish-text-muted font-bold mr-1">
            <Sliders className="w-3.5 h-3.5 text-parish-primary" />
            <span className="uppercase text-[10px] tracking-wider font-bold">Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer shrink-0"
          >
            <option value="ALL">All Categories</option>
            <option value="REGISTER">Parish Register & Households</option>
            <option value="AUTH">Authentication (Logins/Logouts)</option>
            <option value="SETTINGS">Settings Changes</option>
            <option value="NAVIGATION">Navigation (Page Access)</option>
            <option value="GOVERNANCE">System Governance</option>
          </select>

          {/* Action Type Filter */}
          <select
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer shrink-0"
          >
            <option value="ALL">All Actions</option>
            <option value="FAMILY_VIEW">FAMILY / MEMBER VIEWED</option>
            <option value="FAMILY_UPDATE">FAMILY / MEMBER UPDATE</option>
            <option value="DIRECT_DEBIT_CHANGE">DIRECT DEBIT CHANGE</option>
            <option value="DOCUMENT_VIEW">DOCUMENT VIEWED</option>
            <option value="DOCUMENT_DOWNLOAD">DOCUMENT DOWNLOADED</option>
            <option value="DOCUMENT_CHANGE">DOCUMENT ATTACH / REMOVE</option>
            <option value="REPORT_VIEW">REPORT VIEWED</option>
            <option value="REPORT_EXPORT">REPORT / EXCEL EXPORTED</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="LOGIN_FAILED">LOGIN FAILED</option>
            <option value="PAGE_VIEW">PAGE VIEW</option>
            <option value="SETTINGS_CHANGE">SETTINGS CHANGE</option>
          </select>

          {/* User Filter */}
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer max-w-[160px]"
          >
            <option value="ALL">All Users</option>
            {usersList.map((u) => (
              <option key={u.userId} value={String(u.userId)}>
                {u.userName}
              </option>
            ))}
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today Only</option>
            <option value="7DAYS">Last 7 Days</option>
            <option value="30DAYS">Last 30 Days</option>
          </select>
        </div>

        {/* Active Filters Pill Bar */}
        {(category !== 'ALL' || actionType !== 'ALL' || selectedUserId !== 'ALL' || dateRange !== 'ALL' || search.trim()) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-parish-border/60 text-[11px]">
            <span className="font-semibold text-parish-text-muted">Active Filters:</span>
            {category !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text">
                Category: <strong>{category}</strong>
                <button
                  type="button"
                  onClick={() => { setCategory('ALL'); setPage(1); }}
                  className="ml-1 text-parish-text-muted hover:text-parish-text font-bold"
                >
                  ×
                </button>
              </span>
            )}
            {actionType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text">
                Action: <strong>{actionType}</strong>
                <button
                  type="button"
                  onClick={() => { setActionType('ALL'); setPage(1); }}
                  className="ml-1 text-parish-text-muted hover:text-parish-text font-bold"
                >
                  ×
                </button>
              </span>
            )}
            {selectedUserId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text">
                User: <strong>{usersList.find((u) => String(u.userId) === selectedUserId)?.userName || selectedUserId}</strong>
                <button
                  type="button"
                  onClick={() => { setSelectedUserId('ALL'); setPage(1); }}
                  className="ml-1 text-parish-text-muted hover:text-parish-text font-bold"
                >
                  ×
                </button>
              </span>
            )}
            {dateRange !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text">
                Date: <strong>{dateRange}</strong>
                <button
                  type="button"
                  onClick={() => { setDateRange('ALL'); setPage(1); }}
                  className="ml-1 text-parish-text-muted hover:text-parish-text font-bold"
                >
                  ×
                </button>
              </span>
            )}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text">
                Search: <strong>"{search.trim()}"</strong>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="ml-1 text-parish-text-muted hover:text-parish-text font-bold"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setCategory('ALL');
                setActionType('ALL');
                setSelectedUserId('ALL');
                setDateRange('ALL');
                setSearch('');
                setPage(1);
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline cursor-pointer ml-1"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-parish-border shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-parish-text-muted">
            <RotateCcw className="w-5 h-5 animate-spin mx-auto text-parish-primary mb-2" />
            <span>Loading system activity logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-parish-text-muted space-y-2">
            <Shield className="w-8 h-8 mx-auto text-parish-border" />
            <p className="font-semibold text-parish-text">No activity records found</p>
            <p>Try adjusting your search criteria, category filters, or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-parish-surface/80 border-b border-parish-border text-[11px] font-bold text-parish-text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User & Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Activity Description & Captions</th>
                  <th className="py-3 px-4 text-right">Context / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-parish-border">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.createdAt);

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-parish-surface/40 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap text-parish-text">
                          <div className="font-medium">
                            {dateObj.toLocaleDateString('en-AU', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[11px] text-parish-text-muted font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {dateObj.toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })}
                          </div>
                        </td>

                        {/* User & Role */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-parish-text flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-parish-primary/70 shrink-0" />
                            <span>{log.userName}</span>
                          </div>
                          {log.userRole && (
                            <span className="text-[10px] text-parish-text-muted font-medium uppercase tracking-wider mt-0.5 block">
                              {log.userRole.replace('_', ' ')}
                            </span>
                          )}
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderActionBadge(log.actionType)}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 text-parish-text max-w-lg">
                          <p className="leading-relaxed">{log.description}</p>
                          {(log.path || log.details) && (
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {log.path && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">
                                  {log.path}
                                </span>
                              )}
                              {log.details && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-parish-primary hover:bg-parish-surface border border-parish-border transition-colors cursor-pointer"
                                >
                                  <span>Diff Metadata</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Context & IP */}
                        <td className="py-3 px-4 text-right whitespace-nowrap text-parish-text-muted font-mono text-[11px]">
                          <div>{log.ipAddress || '127.0.0.1'}</div>
                          {log.userAgent && (
                            <div className="text-[10px] font-sans truncate max-w-[140px] ml-auto text-parish-text-muted/70" title={log.userAgent}>
                              {log.userAgent.split(' ')[0]}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON details row */}
                      {isExpanded && log.details && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-3 px-5">
                            <div className="text-[11px] font-mono p-3 rounded-xl bg-white border border-parish-border text-slate-700 overflow-x-auto space-y-1">
                              <span className="font-bold uppercase tracking-wider text-parish-text-muted text-[10px] block">
                                Technical Payload / Diff Metadata:
                              </span>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(log.details), null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 bg-parish-surface/40 border-t border-parish-border flex items-center justify-between gap-3 text-xs">
            <span className="text-parish-text-muted">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Developer Purge Confirmation Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-parish-text">Purge All Activity Logs</h3>
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                  DEVELOPER ONLY
                </span>
              </div>
            </div>

            <p className="text-xs text-parish-text-muted leading-relaxed">
              This action will <strong>permanently delete all system activity records</strong>, user logins, logouts, page visit trails, and settings change history for this parish. This action cannot be undone.
            </p>

            <div className="p-3.5 rounded-xl bg-parish-surface border border-parish-border space-y-2">
              <label className="block text-[11px] font-bold text-parish-text">
                Type <span className="text-rose-600 font-mono font-bold">PURGE</span> to confirm:
              </label>
              <input
                type="text"
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                placeholder="Type PURGE"
                className="w-full p-2.5 text-xs rounded-xl border border-parish-border bg-white dark:bg-slate-800 text-parish-text font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-parish-border">
              <button
                type="button"
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeConfirmInput('');
                }}
                disabled={isPurging}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-parish-border bg-parish-surface hover:bg-parish-surface-subtle text-parish-text cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeAllLogs}
                disabled={purgeConfirmInput.trim() !== 'PURGE' || isPurging}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? 'Purging...' : 'Confirm Purge All Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
