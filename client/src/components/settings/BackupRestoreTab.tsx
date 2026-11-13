import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../context/FeatureContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
  Download,
  Upload,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Lock,
  Archive,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export const BackupRestoreTab: React.FC = () => {
  const { activeParish, user } = useAuth();
  const { isFeatureEnabled } = useFeatures();

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Import flow state: 'IDLE' | 'OTP_REQUESTED' | 'AUDITED' | 'IMPORTING' | 'DONE'
  const [importStep, setImportStep] = useState<'IDLE' | 'OTP_REQUESTED' | 'AUDITED' | 'IMPORTING' | 'DONE'>('IDLE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [importUsers, setImportUsers] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  const canExport = isFeatureEnabled('SETTING_BACKUP_EXPORT') || user?.role === 'SUPER_ADMIN';
  const canImport = isFeatureEnabled('SETTING_BACKUP_IMPORT') || user?.role === 'SUPER_ADMIN';

  // 1. Trigger Full Archive Export (.parishpack download)
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportFeedback(null);
      setErrorMessage(null);

      const res = await api.get('/backup/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeParish?.parishCode || 'PARISH'}_BACKUP_${new Date().toISOString().slice(0, 10)}.parishpack`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportFeedback('Encrypted .parishpack backup exported and downloaded successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to export parish backup.');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Request OTP Code to user email
  const handleRequestOtp = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a .parishpack file first.');
      return;
    }
    try {
      setIsOtpLoading(true);
      setErrorMessage(null);
      const res = await api.post('/backup/request-otp');
      if (res.data?.success) {
        setImportStep('OTP_REQUESTED');
        if (res.data?.devOtpHint) {
          setDevOtpHint(res.data.devOtpHint);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to dispatch authorization code.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // 3. Inspect & Audit package
  const handleAuditPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !otpCode.trim()) return;

    try {
      setIsAuditing(true);
      setErrorMessage(null);

      const formData = new FormData();
      formData.append('archive', selectedFile);
      formData.append('otp', otpCode.trim());

      const res = await api.post('/backup/audit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setAuditResult(res.data);
        setImportStep('AUDITED');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Integrity audit failed. Verify authorization code.');
    } finally {
      setIsAuditing(false);
    }
  };

  // 4. Commit Import to Database
  const handleCommitImport = async () => {
    if (!selectedFile || !otpCode.trim()) return;

    try {
      setIsCommitting(true);
      setErrorMessage(null);

      const formData = new FormData();
      formData.append('archive', selectedFile);
      formData.append('otp', otpCode.trim());
      formData.append('importUsers', String(importUsers));

      const res = await api.post('/backup/commit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setCommitResult(res.data);
        setImportStep('DONE');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Import transaction aborted.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleResetImport = () => {
    setImportStep('IDLE');
    setSelectedFile(null);
    setOtpCode('');
    setAuditResult(null);
    setCommitResult(null);
    setErrorMessage(null);
    setDevOtpHint(null);
  };

  return (
    <div className="space-y-6">
      {/* Overview & Security Banner */}
      <div className="p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-xs flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-parish-primary-light text-parish-primary shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-parish-text flex items-center gap-2">
              <span>Parish Data Backup, Migration & Disaster Recovery</span>
              <Badge variant="success" size="sm">AES-256 Encrypted</Badge>
            </h3>
            <p className="text-xs text-parish-text-muted mt-1 leading-relaxed max-w-2xl">
              Export and restore complete parish registries, households, members, uploaded documents, and staff access credentials.
              All archives are secured with proprietary authenticated encryption (<code>.parishpack</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isLoading={isExporting}
            disabled={!canExport}
            icon={<Download className="w-4 h-4 text-parish-primary" />}
            title="Export complete encrypted archive of active parish"
          >
            Export .parishpack
          </Button>
        </div>
      </div>

      {exportFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportFeedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: 2 Columns (Export Card & OTP Import Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: Export Package */}
        <div className="p-6 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-parish-text">
                <Download className="w-4 h-4 text-parish-primary" />
                <span>Export Parish Archive</span>
              </div>
              <Badge variant="default" size="sm">Active Parish</Badge>
            </div>
            <p className="text-xs text-parish-text-muted leading-relaxed">
              Generates an encrypted package containing:
            </p>
            <ul className="text-xs text-parish-text space-y-1.5 pl-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Family households, member census, and direct debits</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All physical uploaded certificates, IDs, and PDF documents</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Parish user accounts, roles, and security overrides</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Territorial wards, prayer units, and origin dioceses</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-parish-border flex items-center justify-between">
            <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>AES-256 proprietary envelope</span>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExport}
              isLoading={isExporting}
              disabled={!canExport}
              icon={<Download className="w-4 h-4" />}
            >
              Export Archive Now
            </Button>
          </div>
        </div>

        {/* CARD 2: Import & Integrity Audit */}
        <div className="p-6 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-parish-text">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Import Archive with OTP Verification</span>
            </div>
            <Badge variant="warning" size="sm">2FA Protected</Badge>
          </div>

          {importStep === 'IDLE' && (
            <div className="space-y-4">
              <p className="text-xs text-parish-text-muted leading-relaxed">
                Select a valid <code>.parishpack</code> archive to inspect and restore:
              </p>

              <label className="border-2 border-dashed border-parish-border hover:border-parish-primary rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-parish-bg/40">
                <FileCheck className="w-8 h-8 text-parish-primary mb-2 opacity-80" />
                <span className="text-xs font-bold text-parish-text">
                  {selectedFile ? selectedFile.name : 'Click to select .parishpack archive'}
                </span>
                <span className="text-[10px] text-parish-text-muted mt-1">
                  {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Proprietary encrypted format (up to 100MB)'}
                </span>
                <input
                  type="file"
                  accept=".parishpack"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
              </label>

              <div className="pt-2 flex items-center justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selectedFile || !canImport}
                  isLoading={isOtpLoading}
                  onClick={handleRequestOtp}
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  Request Authorization Code
                </Button>
              </div>
            </div>
          )}

          {importStep === 'OTP_REQUESTED' && (
            <form onSubmit={handleAuditPackage} className="space-y-4 animate-in fade-in">
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
                A 6-digit authorization code was sent to <strong>{user?.email}</strong>.
                {devOtpHint && (
                  <div className="mt-1 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Dev Test Code: {devOtpHint}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-parish-text mb-1">
                  Enter 6-Digit Authorization Code <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="font-mono text-center tracking-widest text-base font-bold"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={handleResetImport}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isAuditing}
                  disabled={otpCode.length < 6}
                  icon={<ShieldCheck className="w-4 h-4" />}
                >
                  Verify & Inspect Archive
                </Button>
              </div>
            </form>
          )}

          {importStep === 'AUDITED' && auditResult && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-parish-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-parish-text">
                  <span>Archive Integrity Check:</span>
                  <Badge variant={auditResult.audit?.isValid ? 'success' : 'danger'} size="sm">
                    {auditResult.audit?.isValid ? '100% Passed' : 'Issues Detected'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Families</div>
                    <div className="font-bold text-sm text-parish-text">{auditResult.summary?.totalFamilies}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Members</div>
                    <div className="font-bold text-sm text-parish-text">{auditResult.summary?.totalMembers}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Wards</div>
                    <div className="font-bold text-sm text-parish-text">{auditResult.summary?.totalWards}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Documents</div>
                    <div className="font-bold text-sm text-parish-text">{auditResult.summary?.totalDocumentsInArchive}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Active Families</div>
                    <div className="font-bold text-sm text-emerald-600">{auditResult.summary?.activeFamilies}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-parish-border">
                    <div className="text-parish-text-muted">Inactive</div>
                    <div className="font-bold text-sm text-slate-500">{auditResult.summary?.inactiveFamilies}</div>
                  </div>
                </div>
              </div>

              {auditResult.summary?.totalUsers > 0 && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-parish-border cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={importUsers}
                    onChange={(e) => setImportUsers(e.target.checked)}
                    className="rounded text-parish-primary focus:ring-parish-primary"
                  />
                  <span>Also import parish user staff accounts ({auditResult.summary.totalUsers} users)</span>
                </label>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-parish-border">
                <Button variant="ghost" size="sm" onClick={handleResetImport}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isCommitting}
                  onClick={handleCommitImport}
                  icon={<Upload className="w-4 h-4" />}
                >
                  Commit & Restore Database
                </Button>
              </div>
            </div>
          )}

          {importStep === 'DONE' && commitResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-3 animate-in fade-in">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                Parish Archive Restored Successfully!
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {commitResult.message}
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={handleResetImport}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
