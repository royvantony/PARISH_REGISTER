import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AlertDialog } from '../components/ui/AlertDialog';
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  User,
  Home,
  RefreshCw,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  ArrowRight,
  MapPin,
  Baby,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface StagingDocItem {
  key: string;
  label: string;
  url: string | null;
  status: 'NONE' | 'PENDING' | 'CACHED' | 'FAILED';
  localTempPath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

interface StagingChild {
  fullName: string;
  dob: string;
  gender: string;
}

interface StagingRow {
  rowId: string;
  rowIndex: number;
  legacyCode: string;
  membershipStatus: 'ACTIVE' | 'INACTIVE';
  registrationType: 'FAMILY' | 'INDIVIDUAL';
  houseName: string;
  wardId: number | null;
  wardName: string;
  wardStatus: 'MATCHED' | 'UNMATCHED' | 'MISSING';
  addressStreet: string;
  city: string;
  state: string;
  postalCode: string;
  headName: string;
  headDob: string;
  headPob: string;
  headPhone: string;
  headEmail: string;
  headBaptismDate: string;
  headConfirmationDate: string;
  spouseName: string;
  spouseDob: string;
  spousePob: string;
  spousePhone: string;
  spouseEmail: string;
  marriageDate: string;
  marriagePlace: string;
  children: StagingChild[];
  originParish: string;
  originDiocese: string;
  notes: string;
  documents: Record<string, StagingDocItem>;
  validationStatus: 'READY' | 'WARNING' | 'ERROR';
  errors: string[];
  warnings: string[];
  isRectified?: boolean;
}

function isValidDateString(s: string): boolean {
  if (!s || !s.trim()) return false;
  const str = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map((v) => parseInt(v, 10));
    return y >= 1900 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  }
  const date = new Date(str);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2099;
}

interface StagingSession {
  id: number;
  parishId: number;
  status: string;
  fileName: string | null;
  hasExistingCodes: boolean;
  unmatchedWardAction: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  activePage?: number;
  rows: StagingRow[];
  createdAt: string;
  updatedAt: string;
}

export const OnboardingPage: React.FC = () => {
  const { activeParish } = useAuth();

  // Reference master data
  const [wards, setWards] = useState<Array<{ id: number; unitName: string }>>([]);

  // Session state
  const [session, setSession] = useState<StagingSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  // Upload step state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasExistingCodes, setHasExistingCodes] = useState<boolean>(true);
  const [unmatchedWardAction, setUnmatchedWardAction] = useState<'MANUAL' | 'AUTO_CREATE'>('MANUAL');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Staging Mediator Grid state & filters
  const [filterTab, setFilterTab] = useState<'ALL' | 'ERRORS' | 'WARNINGS' | 'RECTIFIED' | 'READY' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [customFilter, setCustomFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isCachingDocs, setIsCachingDocs] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitSuccessData, setCommitSuccessData] = useState<any | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState<boolean>(false);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'warning' | 'danger' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
  });

  const showAlert = (
    message: string,
    title = 'Notice',
    variant: 'warning' | 'danger' | 'info' | 'success' = 'warning'
  ) => {
    setAlertDialog({ isOpen: true, title, message, variant });
  };

  // Load existing session and wards
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoadingSession(true);
        const [wardsRes, sessionRes] = await Promise.all([
          api.get('/masters/units').catch(() => ({ data: [] })),
          api.get('/onboarding/active-session').catch(() => ({ data: { session: null } })),
        ]);
        setWards(wardsRes.data || []);
        if (sessionRes.data?.session) {
          const s = sessionRes.data.session;
          setSession(s);

          // Restore saved page position (URL query -> session DB -> localStorage)
          const urlParams = new URLSearchParams(window.location.search);
          const qPage = urlParams.get('page');
          const savedLocal = localStorage.getItem(`onboarding_page_${s.id}`);
          const targetPage = qPage && !isNaN(Number(qPage))
            ? Number(qPage)
            : s.activePage || (savedLocal ? parseInt(savedLocal, 10) : 1);

          if (targetPage > 1) {
            setCurrentPage(targetPage);
          }
        }
      } catch (err: any) {
        console.error('Failed to init onboarding:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    init();
  }, [activeParish?.id]);

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/onboarding/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeParish?.parishCode || 'PARISH'}_Onboarding_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      showAlert('Failed to download template. Please check your network connection and try again.', 'Download Error', 'danger');
    }
  };

  // Upload file to start session
  const handleStartOnboarding = async () => {
    if (!selectedFile) {
      setUploadError('Please select an Excel (.xlsx) file first.');
      return;
    }
    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('hasExistingCodes', String(hasExistingCodes));
      formData.append('unmatchedWardAction', unmatchedWardAction);

      const res = await api.post('/onboarding/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data?.session) {
        setSession(res.data.session);
        setSelectedFile(null);
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.error || err.message || 'Failed to upload spreadsheet.');
    } finally {
      setIsUploading(false);
    }
  };

  // Inline row update with dynamic validation and auto-rectification
  const handleUpdateRowField = (rowId: string, field: string, value: any) => {
    if (!session) return;
    const rows = [...session.rows];
    const index = rows.findIndex((r) => r.rowId === rowId);
    if (index === -1) return;

    const row = { ...rows[index], [field]: value };

    // Ward specific recalculation
    if (field === 'wardId') {
      const selectedUnit = wards.find((w) => w.id === Number(value));
      if (selectedUnit) {
        row.wardId = selectedUnit.id;
        row.wardName = selectedUnit.unitName;
        row.wardStatus = 'MATCHED';
        row.warnings = row.warnings.filter((w) => !w.toLowerCase().includes('ward'));
      }
    }

    // Dynamic error re-evaluation
    const updatedErrors = [...row.errors];

    // House name check
    if (field === 'houseName') {
      if (String(value).trim()) {
        const i = updatedErrors.findIndex((e) => e.toLowerCase().includes('house name'));
        if (i !== -1) updatedErrors.splice(i, 1);
      } else {
        if (!updatedErrors.some((e) => e.toLowerCase().includes('house name'))) {
          updatedErrors.push('House Name is required');
        }
      }
    }

    // Head name check
    if (field === 'headName') {
      if (String(value).trim()) {
        const i = updatedErrors.findIndex((e) => e.toLowerCase().includes('head full name') || e.toLowerCase().includes('head name'));
        if (i !== -1) updatedErrors.splice(i, 1);
      } else {
        if (!updatedErrors.some((e) => e.toLowerCase().includes('head name'))) {
          updatedErrors.push('Head Full Name is required');
        }
      }
    }

    // Head DOB check
    if (field === 'headDob') {
      if (String(value).trim() && isValidDateString(String(value))) {
        const i = updatedErrors.findIndex((e) => e.toLowerCase().includes('date of birth') || e.toLowerCase().includes('dob'));
        if (i !== -1) updatedErrors.splice(i, 1);
      } else {
        if (!updatedErrors.some((e) => e.toLowerCase().includes('date of birth'))) {
          updatedErrors.push('Head Date of Birth is required (YYYY-MM-DD)');
        }
      }
    }

    const hasMissingCore = !row.houseName.trim() || !row.headName.trim() || !row.headDob.trim();
    const hasRemainingErrors = updatedErrors.length > 0 || hasMissingCore;
    const hasRemainingWarnings = row.warnings.length > 0 || row.wardStatus === 'UNMATCHED';

    row.errors = updatedErrors;

    if (!hasRemainingErrors) {
      if (hasRemainingWarnings && !row.isRectified) {
        row.validationStatus = 'WARNING';
      } else {
        // If the row originally had errors or was marked rectified, mark as rectified
        if (rows[index].validationStatus === 'ERROR' || rows[index].validationStatus === 'WARNING' || row.isRectified) {
          row.isRectified = true;
          row.warnings = [];
        }
        row.validationStatus = 'READY';
      }
    } else {
      row.isRectified = false;
      row.validationStatus = 'ERROR';
    }

    rows[index] = row;

    setSession({
      ...session,
      rows,
      validRows: rows.filter((r) => r.validationStatus === 'READY').length,
      warningRows: rows.filter((r) => r.validationStatus === 'WARNING').length,
      errorRows: rows.filter((r) => r.validationStatus === 'ERROR').length,
    });
  };

  // Toggle or mark a household card as rectified
  const handleToggleRectified = (rowId: string) => {
    if (!session) return;
    const rows = [...session.rows];
    const index = rows.findIndex((r) => r.rowId === rowId);
    if (index === -1) return;

    const row = { ...rows[index] };
    const nextRectified = !row.isRectified;

    if (nextRectified) {
      if (!row.houseName.trim() || !row.headName.trim() || !row.headDob.trim()) {
        showAlert(
          'Please provide House Name, Head Full Name, and Date of Birth before marking this household as rectified.',
          'Missing Mandatory Information',
          'warning'
        );
        return;
      }
      row.isRectified = true;
      row.errors = [];
      row.warnings = [];
      row.validationStatus = 'READY';
    } else {
      row.isRectified = false;
      const errs: string[] = [];
      if (!row.houseName.trim()) errs.push('House Name is required');
      if (!row.headName.trim()) errs.push('Head Full Name is required');
      if (!row.headDob.trim() || !isValidDateString(row.headDob)) errs.push('Head Date of Birth is required (YYYY-MM-DD)');
      row.errors = errs;

      const warns: string[] = [];
      if (row.wardStatus === 'UNMATCHED' || !row.wardId) warns.push('Ward not assigned or unmatched');
      row.warnings = warns;

      row.validationStatus = errs.length > 0 ? 'ERROR' : warns.length > 0 ? 'WARNING' : 'READY';
    }

    rows[index] = row;

    setSession({
      ...session,
      rows,
      validRows: rows.filter((r) => r.validationStatus === 'READY').length,
      warningRows: rows.filter((r) => r.validationStatus === 'WARNING').length,
      errorRows: rows.filter((r) => r.validationStatus === 'ERROR').length,
    });
  };

  // Save draft with page position preservation
  const handleSaveDraft = async () => {
    if (!session) return;
    try {
      setIsSavingDraft(true);
      setSaveFeedback(null);
      localStorage.setItem(`onboarding_page_${session.id}`, String(currentPage));

      const res = await api.post(`/onboarding/session/${session.id}/save-draft`, {
        rows: session.rows,
        activePage: currentPage,
      });
      if (res.data?.success) {
        setSaveFeedback(`Draft saved successfully at Page ${currentPage}! You can close your browser and resume anytime.`);
        setTimeout(() => setSaveFeedback(null), 5000);
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to save draft.', 'Save Draft Failed', 'danger');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Cache document URLs in background
  const handleCacheDocs = async () => {
    if (!session) return;
    try {
      setIsCachingDocs(true);
      const res = await api.post(`/onboarding/session/${session.id}/cache-docs`);
      if (res.data?.success && res.data?.session) {
        setSession(res.data.session);
        setSaveFeedback(`Document cache complete: ${res.data.cachedCount} cached, ${res.data.failedCount} skipped.`);
        setTimeout(() => setSaveFeedback(null), 5000);
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to cache documents.', 'Document Download Error', 'danger');
    } finally {
      setIsCachingDocs(false);
    }
  };

  // Discard draft session
  const handleDiscardDraft = async () => {
    if (!session) return;
    try {
      localStorage.removeItem(`onboarding_page_${session.id}`);
      await api.delete(`/onboarding/session/${session.id}`);
      setSession(null);
      setConfirmDiscardOpen(false);
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to discard draft.', 'Discard Failed', 'danger');
    }
  };

  // Commit onboarding to Parish Register
  const handleCommit = async () => {
    if (!session) return;
    if (session.errorRows > 0) {
      showAlert(
        `Cannot commit onboarding while there are ${session.errorRows} rows with errors. Please resolve all red errors first.`,
        'Validation Errors Detected',
        'danger'
      );
      return;
    }
    try {
      setIsCommitting(true);
      const res = await api.post(`/onboarding/session/${session.id}/commit`);
      if (res.data?.success) {
        localStorage.removeItem(`onboarding_page_${session.id}`);
        setCommitSuccessData(res.data);
        setSession(null);
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to commit onboarding.', 'Commit Failed', 'danger');
    } finally {
      setIsCommitting(false);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  // Sync page changes to localStorage & URL search params
  useEffect(() => {
    if (session?.id && currentPage >= 1) {
      localStorage.setItem(`onboarding_page_${session.id}`, String(currentPage));
      const url = new URL(window.location.href);
      if (currentPage > 1) {
        url.searchParams.set('page', String(currentPage));
      } else {
        url.searchParams.delete('page');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [currentPage, session?.id]);

  // Reset page when any filter actually changes (guarded against initial mount clobbering)
  const isFilterMounted = React.useRef(false);
  useEffect(() => {
    if (!isFilterMounted.current) {
      isFilterMounted.current = true;
      return;
    }
    setCurrentPage(1);
  }, [filterTab, wardFilter, customFilter, searchQuery, pageSize]);

  // Filter and search
  const filteredRows = (session?.rows || []).filter((r) => {
    // 1. Status Tab filter
    if (filterTab === 'ERRORS' && r.validationStatus !== 'ERROR') return false;
    if (filterTab === 'WARNINGS' && (r.validationStatus !== 'WARNING' || r.isRectified)) return false;
    if (filterTab === 'RECTIFIED' && !r.isRectified) return false;
    if (filterTab === 'READY' && r.validationStatus !== 'READY') return false;
    if (filterTab === 'ACTIVE' && r.membershipStatus !== 'ACTIVE') return false;
    if (filterTab === 'INACTIVE' && r.membershipStatus !== 'INACTIVE') return false;

    // 2. Ward dropdown filter
    if (wardFilter === 'UNMATCHED') {
      if (r.wardStatus === 'MATCHED') return false;
    } else if (wardFilter !== 'ALL') {
      if (String(r.wardId) !== wardFilter) return false;
    }

    // 3. Custom Issue filter
    if (customFilter === 'RECTIFIED' && !r.isRectified) return false;
    if (customFilter === 'ERRORS' && r.validationStatus !== 'ERROR') return false;
    if (customFilter === 'WARNINGS' && r.validationStatus !== 'WARNING') return false;
    if (customFilter === 'READY' && r.validationStatus !== 'READY') return false;
    if (customFilter === 'MISSING_HEAD' && r.headName.trim()) return false;
    if (customFilter === 'MISSING_DOB' && (r.headDob.trim() && !r.errors.some((e) => e.includes('Date of Birth')))) return false;
    if (customFilter === 'MISSING_HOUSE' && r.houseName.trim()) return false;
    if (customFilter === 'UNMAPPED_WARD' && r.wardStatus === 'MATCHED') return false;
    if (customFilter === 'HAS_DOCS') {
      const hasAny = Object.values(r.documents).some((d) => Boolean(d.url) || d.status === 'CACHED');
      if (!hasAny) return false;
    }
    if (customFilter === 'NO_DOCS') {
      const hasAny = Object.values(r.documents).some((d) => Boolean(d.url) || d.status === 'CACHED');
      if (hasAny) return false;
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.houseName.toLowerCase().includes(q) ||
        r.headName.toLowerCase().includes(q) ||
        r.legacyCode.toLowerCase().includes(q) ||
        r.wardName.toLowerCase().includes(q) ||
        r.addressStreet.toLowerCase().includes(q) ||
        r.headPhone.toLowerCase().includes(q) ||
        r.headEmail.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Pagination computations
  const totalItems = filteredRows.length;
  const isShowAll = pageSize === -1;
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);
  const startIndex = isShowAll ? 0 : (effectivePage - 1) * pageSize;
  const endIndex = isShowAll ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedRows = isShowAll ? filteredRows : filteredRows.slice(startIndex, endIndex);

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center p-12 text-parish-text-muted">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading onboarding session...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 3: SUCCESSFUL COMMITMENT
  // ---------------------------------------------------------------------------
  if (commitSuccessData) {
    return (
      <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-parish-surface border border-parish-border shadow-soft text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-parish-text">Parish Onboarding Completed!</h2>
          <p className="text-sm text-parish-text-muted">
            All families, members, and documents have been successfully committed to the Parish Register.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto py-4">
          <div className="p-4 rounded-2xl bg-parish-bg border border-parish-border text-center">
            <span className="text-2xl font-black text-parish-primary">{commitSuccessData.counts?.families || 0}</span>
            <p className="text-xs text-parish-text-muted mt-1 font-semibold">Families</p>
          </div>
          <div className="p-4 rounded-2xl bg-parish-bg border border-parish-border text-center">
            <span className="text-2xl font-black text-emerald-600">{commitSuccessData.counts?.members || 0}</span>
            <p className="text-xs text-parish-text-muted mt-1 font-semibold">Members</p>
          </div>
          <div className="p-4 rounded-2xl bg-parish-bg border border-parish-border text-center">
            <span className="text-2xl font-black text-indigo-600">{commitSuccessData.counts?.documents || 0}</span>
            <p className="text-xs text-parish-text-muted mt-1 font-semibold">Documents</p>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => (window.location.href = '/register')} icon={<ArrowRight className="w-4 h-4" />}>
            Open Parish Register
          </Button>
          <Button variant="outline" onClick={() => setCommitSuccessData(null)}>
            Start Another Onboarding
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 1: WIZARD SETUP & UPLOAD (When no draft exists)
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-parish-primary/10 via-parish-surface to-parish-surface border border-parish-border shadow-soft flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-parish-primary" />
              <h2 className="text-xl font-extrabold text-parish-text">Parish Onboarding Wizard</h2>
              <Badge variant="default" size="sm">Active Parish: {activeParish?.parishName}</Badge>
            </div>
            <p className="text-xs text-parish-text-muted max-w-2xl leading-relaxed">
              Seamlessly migrate your existing parish directory spreadsheet. Supports active & historical parishioners,
              automatic ward mapping, in-place corrections, and document links from web URLs.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            icon={<Download className="w-4 h-4 text-emerald-600" />}
          >
            Download Onboarding Template (.xlsx)
          </Button>
        </div>

        {uploadError && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Configuration Card */}
        <div className="p-6 rounded-3xl bg-parish-surface border border-parish-border shadow-soft space-y-6">
          <h3 className="text-sm font-extrabold text-parish-text uppercase tracking-wider">
            1. Pre-Import Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Setting 1: Existing Codes */}
            <div className="p-4 rounded-2xl bg-parish-bg/60 border border-parish-border space-y-3">
              <label className="text-xs font-bold text-parish-text flex items-center gap-2">
                <Home className="w-4 h-4 text-parish-primary" />
                <span>Do you have existing Family Registration Numbers?</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasExistingCodes(true)}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                    hasExistingCodes
                      ? 'border-parish-primary bg-parish-primary/10 text-parish-primary shadow-xs'
                      : 'border-parish-border bg-parish-surface text-parish-text-muted hover:border-parish-border-hover'
                  }`}
                >
                  <span className="block font-black">YES, Keep Existing</span>
                  <span className="text-[10px] font-normal opacity-80">Preserves legacy codes from Excel column</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasExistingCodes(false)}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                    !hasExistingCodes
                      ? 'border-parish-primary bg-parish-primary/10 text-parish-primary shadow-xs'
                      : 'border-parish-border bg-parish-surface text-parish-text-muted hover:border-parish-border-hover'
                  }`}
                >
                  <span className="block font-black">NO, Auto-Generate</span>
                  <span className="text-[10px] font-normal opacity-80">Assigns clean sequential numbering</span>
                </button>
              </div>
            </div>

            {/* Setting 2: Unmatched Wards */}
            <div className="p-4 rounded-2xl bg-parish-bg/60 border border-parish-border space-y-3">
              <label className="text-xs font-bold text-parish-text flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>Action when a Ward in Excel does not match:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUnmatchedWardAction('MANUAL')}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                    unmatchedWardAction === 'MANUAL'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-parish-border bg-parish-surface text-parish-text-muted hover:border-parish-border-hover'
                  }`}
                >
                  <span className="block font-black">Highlight for Selection</span>
                  <span className="text-[10px] font-normal opacity-80">Select existing ward from dropdown in grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnmatchedWardAction('AUTO_CREATE')}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                    unmatchedWardAction === 'AUTO_CREATE'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-parish-border bg-parish-surface text-parish-text-muted hover:border-parish-border-hover'
                  }`}
                >
                  <span className="block font-black">Auto-Create Ward</span>
                  <span className="text-[10px] font-normal opacity-80">Adds new ward to parish master data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-extrabold text-parish-text uppercase tracking-wider">
              2. Upload Onboarding File
            </h3>

            <label className="border-2 border-dashed border-parish-border hover:border-parish-primary rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-parish-bg/40">
              <FileSpreadsheet className="w-10 h-10 text-parish-primary mb-3 opacity-80" />
              <span className="text-sm font-bold text-parish-text">
                {selectedFile ? selectedFile.name : 'Click to select Excel spreadsheet (.xlsx, .csv)'}
              </span>
              <span className="text-xs text-parish-text-muted mt-1">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB - Ready to Parse`
                  : 'Based on Parish Register Onboarding Template (up to 50MB)'}
              </span>
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <div className="pt-4 border-t border-parish-border flex items-center justify-between">
            <span className="text-xs text-parish-text-muted">
              Uploaded data will be placed in Staging where you can edit, verify, and save your progress.
            </span>
            <Button
              variant="primary"
              onClick={handleStartOnboarding}
              isLoading={isUploading}
              disabled={!selectedFile}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Parse Spreadsheet & Open Staging
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 2: STAGING MEDIATOR GRID (Active draft session in progress)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top Action & Summary Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-soft flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-black text-parish-text">Parish Onboarding Staging</h2>
            <Badge variant="warning" size="sm">DRAFT IN PROGRESS</Badge>
            <span className="text-xs text-parish-text-muted font-mono">
              File: {session.fileName || 'Spreadsheet'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-parish-text-muted flex-wrap">
            <span>Total: <strong>{session.totalRows}</strong></span>
            <span className="text-emerald-600 font-bold">Ready: {session.validRows}</span>
            {(session.rows || []).filter((r) => Boolean(r.isRectified)).length > 0 && (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rectified: {(session.rows || []).filter((r) => Boolean(r.isRectified)).length}</span>
              </span>
            )}
            <span className="text-amber-600 font-bold">Warnings: {session.warningRows}</span>
            <span className="text-rose-600 font-bold">Errors: {session.errorRows}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCacheDocs}
            isLoading={isCachingDocs}
            icon={<Download className="w-3.5 h-3.5 text-indigo-600" />}
            title="Download document URLs to temporary cache"
          >
            Download Documents
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            isLoading={isSavingDraft}
            icon={<Save className="w-3.5 h-3.5 text-parish-primary" />}
            title="Save your work to database draft to resume anytime"
          >
            Save Draft
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDiscardOpen(true)}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            title="Discard current onboarding session"
          >
            Discard
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleCommit}
            isLoading={isCommitting}
            disabled={session.errorRows > 0}
            icon={<Check className="w-4 h-4" />}
            title={session.errorRows > 0 ? 'Resolve red errors before committing' : 'Commit families to Parish Register'}
          >
            Commit to Parish Register ({session.validRows + session.warningRows})
          </Button>
        </div>
      </div>

      {saveFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Filter Toolbar: Status Tabs + Ward Dropdown + Custom Issues Dropdown + Search */}
      <div className="p-3 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-3">
        {/* Row 1: Status Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-parish-bg border border-parish-border text-xs font-bold overflow-x-auto max-w-full">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'ALL' ? 'bg-parish-surface text-parish-text shadow-xs' : 'text-parish-text-muted hover:text-parish-text'
              }`}
            >
              All ({session.totalRows})
            </button>
            <button
              onClick={() => setFilterTab('ERRORS')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'ERRORS' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-50/50'
              }`}
            >
              Needs Fix ({session.errorRows})
            </button>
            <button
              onClick={() => setFilterTab('WARNINGS')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'WARNINGS' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-600 hover:bg-amber-50/50'
              }`}
            >
              Warnings ({session.warningRows})
            </button>
            {(session.rows || []).filter((r) => Boolean(r.isRectified)).length > 0 && (
              <button
                onClick={() => setFilterTab('RECTIFIED')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  filterTab === 'RECTIFIED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50/50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Rectified ({(session.rows || []).filter((r) => Boolean(r.isRectified)).length})</span>
              </button>
            )}
            <button
              onClick={() => setFilterTab('READY')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'READY' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-600 hover:bg-emerald-50/50'
              }`}
            >
              Ready ({session.validRows})
            </button>
            <button
              onClick={() => setFilterTab('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'ACTIVE' ? 'bg-parish-surface text-parish-primary shadow-xs' : 'text-parish-text-muted hover:text-parish-text'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterTab('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterTab === 'INACTIVE' ? 'bg-parish-surface text-parish-text-muted shadow-xs' : 'text-parish-text-muted hover:text-parish-text'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-parish-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search house, head, code, phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-parish-border bg-parish-bg/50 focus:bg-parish-surface focus:outline-none focus:ring-1 focus:ring-parish-primary"
            />
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters (Ward + Custom Issues) */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-parish-border/60 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold text-parish-text-muted">Ward:</span>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-parish-border bg-parish-bg/50 font-semibold cursor-pointer"
            >
              <option value="ALL">All Wards</option>
              <option value="UNMATCHED">Unmapped / Missing Wards Only</option>
              {wards.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.unitName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-parish-primary shrink-0" />
            <span className="font-bold text-parish-text-muted">Specific Issues:</span>
            <select
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-parish-border bg-parish-bg/50 font-semibold cursor-pointer"
            >
              <option value="ALL">All Families</option>
              {(session.rows || []).filter((r) => Boolean(r.isRectified)).length > 0 && (
                <option value="RECTIFIED">✓ Rectified Households ({(session.rows || []).filter((r) => Boolean(r.isRectified)).length})</option>
              )}
              <option value="ERRORS">Only Rows with Critical Errors</option>
              <option value="WARNINGS">Only Rows with Warnings</option>
              <option value="READY">Only Ready / Valid Rows</option>
              <option value="MISSING_HEAD">Missing Head Full Name</option>
              <option value="MISSING_DOB">Missing / Invalid Head Date of Birth</option>
              <option value="MISSING_HOUSE">Missing House Name (Veettuperu)</option>
              <option value="UNMAPPED_WARD">Unmapped Ward</option>
              <option value="HAS_DOCS">Has Document URLs</option>
              <option value="NO_DOCS">No Documents</option>
            </select>
          </div>

          {/* Reset Filters Shortcut */}
          {(wardFilter !== 'ALL' || customFilter !== 'ALL' || searchQuery || filterTab !== 'ALL') && (
            <button
              onClick={() => {
                setFilterTab('ALL');
                setWardFilter('ALL');
                setCustomFilter('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] text-parish-primary hover:underline font-bold cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Pagination Bar (Top) */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1 text-xs text-parish-text-muted">
        <div>
          Showing <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
          <strong>{endIndex}</strong> of <strong>{totalItems}</strong> families
          {totalItems !== session.totalRows && (
            <span className="opacity-75"> (filtered from {session.totalRows})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px]">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-0.5 text-xs rounded border border-parish-border bg-parish-surface font-semibold cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>Show All</option>
          </select>

          {!isShowAll && totalPages > 1 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                disabled={effectivePage <= 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 rounded border border-parish-border hover:bg-parish-surface disabled:opacity-30 cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={effectivePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-parish-border hover:bg-parish-surface disabled:opacity-30 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-bold font-mono">
                {effectivePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={effectivePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-parish-border hover:bg-parish-surface disabled:opacity-30 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={effectivePage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 rounded border border-parish-border hover:bg-parish-surface disabled:opacity-30 cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2-Row Household Card Grid (Zebra Alternating Colors & Paged) */}
      <div className="space-y-3">
        {paginatedRows.map((row, index) => {
          const isExpanded = Boolean(expandedRows[row.rowId]);
          const docEntries = Object.entries(row.documents);
          const activeDocs = docEntries.filter(([_, d]) => Boolean(d.url) || d.status === 'CACHED');
          const cachedDocsCount = activeDocs.filter(([_, d]) => d.status === 'CACHED').length;
          const totalDocsCount = activeDocs.length;

          // Alternating zebra styling
          const isEven = index % 2 === 0;
          let cardBgClass = isEven
            ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
            : 'bg-slate-50/90 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60';

          if (row.isRectified) {
            // Keep default normal zebra color with a clean, reassuring green border
            cardBgClass = isEven
              ? 'bg-white dark:bg-slate-900 border-emerald-400 dark:border-emerald-700 shadow-xs'
              : 'bg-slate-50/90 dark:bg-slate-800/40 border-emerald-400 dark:border-emerald-700 shadow-xs';
          } else if (row.validationStatus === 'ERROR') {
            cardBgClass = isEven
              ? 'border-rose-300 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/20'
              : 'border-rose-300 dark:border-rose-900/70 bg-rose-50/20 dark:bg-rose-950/10';
          } else if (row.validationStatus === 'WARNING') {
            cardBgClass = isEven
              ? 'border-amber-300 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/20'
              : 'border-amber-300 dark:border-amber-900/70 bg-amber-50/20 dark:bg-amber-950/10';
          }

          return (
            <div
              key={row.rowId}
              className={`p-4 rounded-2xl border transition-all shadow-xs ${cardBgClass}`}
            >
              {/* ROW 1: HOUSEHOLD, STATUS & WARD MAPPING */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Status Badge + Row Number */}
                <div className="md:col-span-2 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-parish-text-muted font-bold">
                    #{row.rowIndex}
                  </span>
                  {row.isRectified ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 shadow-xs"
                      title="All issues rectified and verified"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-200 dark:fill-emerald-800 shrink-0" />
                      <span>Rectified</span>
                    </span>
                  ) : (
                    <Badge
                      variant={row.validationStatus === 'ERROR' ? 'danger' : row.validationStatus === 'WARNING' ? 'warning' : 'success'}
                      size="sm"
                    >
                      {row.validationStatus === 'ERROR' ? 'Needs Fix' : row.validationStatus === 'WARNING' ? 'Warning' : 'Ready'}
                    </Badge>
                  )}
                </div>

                {/* Legacy Family Code */}
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={row.legacyCode}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'legacyCode', e.target.value)}
                    placeholder="Auto Code"
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-parish-border bg-parish-bg/40 focus:bg-white dark:focus:bg-slate-900"
                    title="Family Registration Code"
                  />
                </div>

                {/* House Name (Veettuperu) */}
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={row.houseName}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'houseName', e.target.value)}
                    placeholder="House Name *"
                    className={`w-full px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      !row.houseName.trim()
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-parish-border bg-parish-bg/40 focus:bg-white dark:focus:bg-slate-900'
                    }`}
                    title="House Name / Veettuperu"
                  />
                </div>

                {/* Membership Status Dropdown */}
                <div className="md:col-span-2">
                  <select
                    value={row.membershipStatus}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'membershipStatus', e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-bold rounded-lg border border-parish-border bg-parish-bg/40 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                {/* Ward Mapping Dropdown */}
                <div className="md:col-span-3">
                  <select
                    value={row.wardId || ''}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'wardId', e.target.value)}
                    className={`w-full px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${
                      row.wardStatus === 'UNMATCHED'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                        : 'border-parish-border bg-parish-bg/40 focus:bg-white dark:focus:bg-slate-900'
                    }`}
                  >
                    <option value="">
                      {row.wardName ? `Select Ward (Excel: "${row.wardName}")` : 'Select Ward...'}
                    </option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.unitName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ROW 2: HEAD, SPOUSE, CHILDREN & DOCUMENTS */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2.5 mt-2.5 border-t border-parish-border/60 text-xs">
                {/* Head Full Name & DOB */}
                <div className="md:col-span-4 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-parish-primary shrink-0" />
                  <input
                    type="text"
                    value={row.headName}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'headName', e.target.value)}
                    placeholder="Head Full Name *"
                    className={`w-2/3 px-2 py-0.5 text-xs font-semibold rounded border ${
                      !row.headName.trim()
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-parish-border/60 bg-transparent'
                    }`}
                  />
                  <input
                    type="date"
                    value={row.headDob}
                    onChange={(e) => handleUpdateRowField(row.rowId, 'headDob', e.target.value)}
                    className={`w-1/3 px-1.5 py-0.5 text-[11px] font-mono rounded border ${
                      !row.headDob.trim()
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-parish-border/60 bg-transparent'
                    }`}
                    title="Head Date of Birth"
                  />
                </div>

                {/* Spouse Name */}
                <div className="md:col-span-3 text-parish-text-muted truncate">
                  {row.spouseName ? (
                    <span>Spouse: <strong>{row.spouseName}</strong></span>
                  ) : (
                    <span className="italic text-[11px]">No Spouse recorded</span>
                  )}
                </div>

                {/* Children count pill */}
                <div className="md:col-span-2 flex items-center gap-1.5 text-parish-text-muted">
                  <Baby className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {row.children.length > 0 ? (
                      <strong>{row.children.length} {row.children.length === 1 ? 'Child' : 'Children'}</strong>
                    ) : (
                      '0 Children'
                    )}
                  </span>
                </div>

                {/* Documents Cached summary + Rectify Toggle Option + Toggle Details Button */}
                <div className="md:col-span-3 flex items-center justify-end gap-2">
                  {totalDocsCount > 0 ? (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        cachedDocsCount === totalDocsCount
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                      }`}
                    >
                      {cachedDocsCount}/{totalDocsCount} Docs Cached
                    </span>
                  ) : (
                    <span className="text-[10px] text-parish-text-muted italic">0 Docs</span>
                  )}

                  {/* Rectify Action Option Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleRectified(row.rowId)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                      row.isRectified
                        ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-400 hover:bg-emerald-200/80 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300'
                        : row.validationStatus === 'ERROR' || row.validationStatus === 'WARNING'
                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50'
                        : 'hidden'
                    }`}
                    title={
                      row.isRectified
                        ? 'Household marked as rectified (Click to undo)'
                        : 'Click to mark this household as verified & rectified'
                    }
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        row.isRectified
                          ? 'text-emerald-600 fill-emerald-200 dark:fill-emerald-800'
                          : 'text-slate-400 group-hover:text-emerald-600'
                      }`}
                    />
                    <span>{row.isRectified ? 'Rectified' : 'Rectify'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleRowExpansion(row.rowId)}
                    className="p-1 rounded-lg hover:bg-parish-bg text-parish-text-muted hover:text-parish-text transition-colors cursor-pointer"
                    title={isExpanded ? 'Collapse family details' : 'Expand family details & documents'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Validation Errors & Warnings or Rectified Confirmation */}
              {row.isRectified ? (
                <div className="mt-2 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 fill-emerald-100 dark:fill-emerald-900" />
                    <span>All issues rectified & verified. Ready for Parish Register.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRectified(row.rowId)}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 underline font-normal hover:text-emerald-900 cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
              ) : (row.errors.length > 0 || row.warnings.length > 0) ? (
                <div className="mt-2 pt-2 border-t border-parish-border/40 space-y-1">
                  {row.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{err}</span>
                    </p>
                  ))}
                  {row.warnings.map((warn, i) => (
                    <p key={i} className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{warn}</span>
                    </p>
                  ))}
                </div>
              ) : null}

              {/* EXPANDABLE DRAWER: ADDRESS, CONTACTS, CHILDREN & DOCUMENT LINKS */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-parish-border space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contacts & Address */}
                    <div className="p-3 rounded-xl bg-parish-bg/40 border border-parish-border/60 space-y-2">
                      <h4 className="text-[11px] font-bold text-parish-text uppercase tracking-wider">
                        Address & Contacts
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-parish-text-muted block">Street Address</label>
                          <input
                            type="text"
                            value={row.addressStreet}
                            onChange={(e) => handleUpdateRowField(row.rowId, 'addressStreet', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs rounded border border-parish-border bg-parish-surface"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-parish-text-muted block">City / Suburb</label>
                          <input
                            type="text"
                            value={row.city}
                            onChange={(e) => handleUpdateRowField(row.rowId, 'city', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs rounded border border-parish-border bg-parish-surface"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-parish-text-muted block">Phone</label>
                          <input
                            type="text"
                            value={row.headPhone}
                            onChange={(e) => handleUpdateRowField(row.rowId, 'headPhone', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs rounded border border-parish-border bg-parish-surface"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-parish-text-muted block">Email</label>
                          <input
                            type="text"
                            value={row.headEmail}
                            onChange={(e) => handleUpdateRowField(row.rowId, 'headEmail', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs rounded border border-parish-border bg-parish-surface"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Children List */}
                    <div className="p-3 rounded-xl bg-parish-bg/40 border border-parish-border/60 space-y-2">
                      <h4 className="text-[11px] font-bold text-parish-text uppercase tracking-wider">
                        Children Census
                      </h4>
                      {row.children.length === 0 ? (
                        <p className="text-xs text-parish-text-muted italic">No children listed in spreadsheet.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {row.children.map((c, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-parish-surface border border-parish-border/40">
                              <span className="font-semibold">{c.fullName}</span>
                              <span className="text-[10px] text-parish-text-muted font-mono">{c.dob || 'No DOB'} ({c.gender})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document URLs & Caching Status (ONLY renders if documents are present) */}
                  {activeDocs.length > 0 && (
                    <div className="p-3 rounded-xl bg-parish-bg/40 border border-parish-border/60 space-y-2">
                      <h4 className="text-[11px] font-bold text-parish-text uppercase tracking-wider">
                        Attached Scanned Documents ({activeDocs.length})
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {activeDocs.map(([k, d]) => (
                          <div key={k} className="p-2 rounded-lg bg-parish-surface border border-parish-border/60 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-parish-text">{d.label.replace(' URL', '')}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                  d.status === 'CACHED'
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    : d.status === 'FAILED'
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                    : d.status === 'PENDING'
                                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                    : 'text-parish-text-muted'
                                }`}
                              >
                                {d.status}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-parish-text-muted truncate" title={d.url || ''}>
                              {d.url}
                            </p>
                            {d.error && (
                              <p className="text-[10px] text-amber-600 font-medium truncate">{d.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredRows.length === 0 && (
          <div className="p-8 rounded-2xl bg-parish-surface border border-dashed border-parish-border text-center space-y-2">
            <Search className="w-6 h-6 text-parish-text-muted mx-auto opacity-60" />
            <p className="text-xs text-parish-text-muted">No families matched the current filter.</p>
          </div>
        )}
      </div>

      {/* Pagination Bar (Bottom) */}
      {!isShowAll && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl bg-parish-surface border border-parish-border shadow-xs text-xs text-parish-text-muted">
          <div>
            Showing <strong>{startIndex + 1}</strong> to <strong>{endIndex}</strong> of{' '}
            <strong>{totalItems}</strong> families
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={effectivePage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-parish-border hover:bg-parish-bg disabled:opacity-30 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={effectivePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-parish-border hover:bg-parish-bg disabled:opacity-30 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold font-mono">
              Page {effectivePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={effectivePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-parish-border hover:bg-parish-bg disabled:opacity-30 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={effectivePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-parish-border hover:bg-parish-bg disabled:opacity-30 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Discard Modal */}
      <ConfirmDialog
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={handleDiscardDraft}
        title="Discard Onboarding Draft?"
        message="Are you sure you want to discard this onboarding session? All staged edits and downloaded temp files will be permanently deleted."
        confirmLabel="Yes, Discard Draft"
        variant="danger"
      />

      {/* Application Styled Alert Modal */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
        confirmLabel="Understood"
      />
    </div>
  );
};
