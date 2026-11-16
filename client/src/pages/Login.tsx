import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  Lock,
  User,
  ArrowRight,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  Clock,
  Church,
  ShieldCheck,
  RotateCcw,
  KeyRound,
  Loader2,
  Send,
  Mail,
} from 'lucide-react';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { api } from '../lib/api';
import {
  verifyTerminalAuthorization,
  sendBootstrapOtp,
  verifyBootstrapOtp,
  getHardwarePlatform,
  collectHardwareTelemetry,
  type DeviceVerifyResult,
} from '../lib/deviceAuth';

interface DevShortcutAccount {
  label: string;
  roleHint: string;
  email: string;
  badgeVariant: 'default' | 'subtle';
  dashed?: boolean;
}

// Fast access accounts (shown only if APP_ENV is Dev/Demo or ALLOW_DEV_LOGIN="true", triggered via Ctrl+Shift+D, and validated against the database)
const DEV_SHORTCUT_ACCOUNTS: DevShortcutAccount[] = [
  {
    label: '🏛️ Parish Administrator',
    roleHint: '(PARISH_PRIEST)',
    email: 'royvadakumpadan@gmail.com',
    badgeVariant: 'default',
  },
  {
    label: '🛡️ Parish Admin',
    roleHint: '(Trustee)',
    email: 'royantonyvadakumpadan@gmail.com',
    badgeVariant: 'subtle',
  },
  {
    label: '📋 Parish User',
    roleHint: '(Secretary)',
    email: 'royantonyvadamumpadan@gmail.com',
    badgeVariant: 'subtle',
  },
  {
    label: '🛠️ Platform Super Admin',
    roleHint: '(Developer)',
    email: 'royvantony@gmail.com',
    badgeVariant: 'subtle',
    dashed: true,
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, devLogin, logout, user, availableParishes, setActiveParishById } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isChoosingParish, setIsChoosingParish] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isDevRevealed, setIsDevRevealed] = useState(false);
  const [availableDevEmails, setAvailableDevEmails] = useState<string[] | null>(null);

  // Terminal Hardware Authorization State
  const [terminalStatus, setTerminalStatus] = useState<'IDLE' | 'APPROVED' | 'PENDING' | 'REVOKED'>('IDLE');
  const [terminalData, setTerminalData] = useState<DeviceVerifyResult | null>(null);
  const [pendingApprovalData, setPendingApprovalData] = useState<any>(null);

  // Smooth Authenticating & Redirecting Polish Transition (1.3s enterprise security perception)
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState({
    title: 'Authenticating & Verifying Terminal...',
    subtitle: 'Workstation trust confirmed. Encrypting session credentials...',
  });
  const [redirectProgress, setRedirectProgress] = useState(30);

  // Initial Bootstrap OTP State (for Day-1 First Workstation Setup)
  const [bootstrapOtpSent, setBootstrapOtpSent] = useState(false);
  const [bootstrapOtpLoading, setBootstrapOtpLoading] = useState(false);
  const [bootstrapOtpError, setBootstrapOtpError] = useState<string | null>(null);
  const [bootstrapOtpSuccess, setBootstrapOtpSuccess] = useState<string | null>(null);
  const [bootstrapOtpCode, setBootstrapOtpCode] = useState('');

  // Revoked Workstation Review State
  const [revokedTerminalInfo, setRevokedTerminalInfo] = useState<{
    deviceId: number;
    deviceName: string;
    reviewRequestedAt?: string | null;
    reviewStatus?: string | null;
  } | null>(null);
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Background check on load: If already approved, show green trust badge on form
  const runTerminalCheck = async () => {
    try {
      const res = await verifyTerminalAuthorization(1);
      setTerminalData(res);
      if (res.status === 'APPROVED') {
        setTerminalStatus('APPROVED');
      } else if (res.status === 'REVOKED') {
        setTerminalStatus('REVOKED');
      } else {
        setTerminalStatus('IDLE');
      }
    } catch {
      setTerminalStatus('IDLE');
    }
  };

  useEffect(() => {
    runTerminalCheck();
  }, []);

  // Live Real-Time SSE Stream (0ms instant approval) + fallback polling when terminal is PENDING
  useEffect(() => {
    if (terminalStatus !== 'PENDING') return;

    const deviceId = pendingApprovalData?.deviceId;
    let eventSource: EventSource | null = null;

    if (deviceId) {
      try {
        eventSource = new EventSource(`/api/realtime/terminal/${deviceId}`);
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.event === 'APPROVED') {
              eventSource?.close();
              setTerminalData((prev) => ({ ...prev, status: 'APPROVED', deviceName: data.deviceName } as any));
              setTerminalStatus('APPROVED');
              if (email && password) {
                login(email, password).then((loginRes) => {
                  if (loginRes.success) {
                    if (loginRes.needsParishSelection) setIsChoosingParish(true);
                    else navigate('/dashboard');
                  }
                });
              }
            } else if (data.event === 'REVOKED') {
              eventSource?.close();
              setTerminalStatus('REVOKED');
            }
          } catch (_) {}
        };
      } catch (_) {}
    }

    // Fallback polling in case of restrictive network proxies
    const interval = setInterval(async () => {
      try {
        const res = await verifyTerminalAuthorization(1);
        if (res.status === 'APPROVED') {
          if (eventSource) eventSource.close();
          setTerminalData(res);
          setTerminalStatus('APPROVED');
          if (email && password) {
            login(email, password).then((loginRes) => {
              if (loginRes.success) {
                if (loginRes.needsParishSelection) setIsChoosingParish(true);
                else navigate('/dashboard');
              }
            });
          }
        } else if (res.status === 'REVOKED') {
          if (eventSource) eventSource.close();
          setTerminalData(res);
          setTerminalStatus('REVOKED');
        }
      } catch (_) {}
    }, 5000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [terminalStatus, pendingApprovalData?.deviceId, email, password]);

  const handleSendBootstrapOtp = async () => {
    if (!pendingApprovalData?.deviceId) return;
    try {
      setBootstrapOtpLoading(true);
      setBootstrapOtpError(null);
      setBootstrapOtpSuccess(null);
      const res = await sendBootstrapOtp(
        pendingApprovalData.parishId || 1,
        pendingApprovalData.deviceId,
        email.trim()
      );
      setBootstrapOtpSent(true);
      setBootstrapOtpSuccess(res.message || 'Verification code sent to your email.');
    } catch (err: any) {
      setBootstrapOtpError(err.response?.data?.error || 'Failed to send verification code. Please try again.');
    } finally {
      setBootstrapOtpLoading(false);
    }
  };

  const handleVerifyBootstrapOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingApprovalData?.deviceId || !bootstrapOtpCode.trim()) {
      setBootstrapOtpError('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setBootstrapOtpLoading(true);
      setBootstrapOtpError(null);
      const res = await verifyBootstrapOtp(
        pendingApprovalData.parishId || 1,
        pendingApprovalData.deviceId,
        bootstrapOtpCode.trim()
      );

      setTerminalData({
        status: 'APPROVED',
        deviceName: res.deviceName,
      });
      setTerminalStatus('APPROVED');

      // Auto login with credentials
      if (email && password) {
        const loginRes = await login(email, password);
        if (loginRes.success) {
          if (loginRes.needsParishSelection) setIsChoosingParish(true);
          else navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setBootstrapOtpError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setBootstrapOtpLoading(false);
    }
  };

  useEffect(() => {
    const notice = sessionStorage.getItem('inactivity_logout_notice');
    if (notice) {
      setInactivityNotice(notice);
      sessionStorage.removeItem('inactivity_logout_notice');
    }
  }, []);

  // Stealth Shortcut Listener: Ctrl+Shift+D, Ctrl+Alt+D, or Alt+Shift+D toggles Developer Fast Access
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isD = e.key === 'd' || e.key === 'D';
      const isModifierCombo =
        ((e.ctrlKey || e.metaKey) && e.shiftKey && isD) ||
        ((e.ctrlKey || e.metaKey) && e.altKey && isD) ||
        (e.altKey && e.shiftKey && isD);

      if (isModifierCombo) {
        e.preventDefault();
        e.stopPropagation();
        setIsDevRevealed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check which dev shortcut emails actually exist (and are active) when shortcut is triggered
  useEffect(() => {
    if (!isDevRevealed || DEV_SHORTCUT_ACCOUNTS.length === 0) return;

    let cancelled = false;
    api
      .post('/auth/dev-available', {
        emails: DEV_SHORTCUT_ACCOUNTS.map((a) => a.email),
      })
      .then((res) => {
        if (cancelled) return;
        const emails: string[] = Array.isArray(res.data?.availableEmails)
          ? res.data.availableEmails.map((e: string) => e.toLowerCase())
          : [];
        setAvailableDevEmails(emails);
        if (emails.length === 0) {
          setIsDevRevealed(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableDevEmails([]);
        setIsDevRevealed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDevRevealed]);

  const visibleDevAccounts = availableDevEmails
    ? DEV_SHORTCUT_ACCOUNTS.filter((acct) =>
      availableDevEmails.includes(acct.email.toLowerCase())
    )
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const res = await login(email, password);
    setIsLoading(false);

    if (res.success) {
      setIsRedirecting(true);
      setRedirectProgress(40);
      setRedirectNotice({
        title: 'Authenticating & Verifying Workstation...',
        subtitle: 'Hardware authorization verified. Encrypting session token...',
      });

      setTimeout(() => {
        setRedirectProgress(85);
        setRedirectNotice({
          title: 'Entering Parish Portal...',
          subtitle: 'Redirecting to your church administration console...',
        });
      }, 600);

      setTimeout(() => {
        setRedirectProgress(100);
        if (res.needsParishSelection) {
          setIsChoosingParish(true);
          setIsRedirecting(false);
        } else {
          navigate('/dashboard');
        }
      }, 1250);
    } else if (res.needsDeviceApproval) {
      setPendingApprovalData(res.deviceApprovalData);
      setTerminalStatus('PENDING');
    } else if (res.isRevokedTerminal) {
      setRevokedTerminalInfo(res.revokedData);
      setErrorMessage(res.error || 'Workstation access revoked by parish administration.');
      if (res.revokedData?.reviewStatus === 'PENDING_REVIEW' || res.revokedData?.reviewRequestedAt) {
        setReviewSubmitted(true);
      }
    } else {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleRequestReview = async () => {
    if (!revokedTerminalInfo?.deviceId) return;
    setIsRequestingReview(true);
    try {
      const telemetry = collectHardwareTelemetry();
      await api.post('/devices/request-review', {
        deviceId: revokedTerminalInfo.deviceId,
        email,
        hardwareHash: telemetry.hardwareHash,
      });
      setReviewSubmitted(true);
      setRevokedTerminalInfo((prev: any) => ({
        ...prev,
        reviewRequestedAt: new Date().toISOString(),
        reviewStatus: 'PENDING_REVIEW',
      }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit review request.');
    } finally {
      setIsRequestingReview(false);
    }
  };

  // Developer Bypass Login: Logs in immediately without password
  const handleDevBypass = async (devEmail: string) => {
    setErrorMessage('');
    setIsLoading(true);

    const res = await devLogin(devEmail);
    setIsLoading(false);

    if (res.success) {
      setIsRedirecting(true);
      setRedirectProgress(45);
      setRedirectNotice({
        title: 'Developer Fast-Access Initializing...',
        subtitle: 'Authorizing bypass session credentials...',
      });

      setTimeout(() => {
        setRedirectProgress(100);
        if (res.needsParishSelection) {
          setIsChoosingParish(true);
          setIsRedirecting(false);
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } else {
      setErrorMessage(res.error || 'Developer login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-parish-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-parish-primary-light selection:text-parish-primary">
      {/* Background Decorative Gradient Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-200/20 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-3 text-center">
        {/* Neutral Diocesan Brand Icon & Heading */}
        <div
          className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-parish-border shadow-soft mx-auto text-parish-primary select-none"
          title="Parish Register"
        >
          <Church className="w-8 h-8 text-parish-primary" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
            PARISH REGISTER
          </h1>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {isChoosingParish ? (
          /* ================================================================= */
          /* INTERMEDIATE WINDOW: Select Working Parish Gateway                */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-parish-primary-light text-parish-primary border border-parish-primary/20 mx-auto">
                <MapPin className="w-6 h-6 text-parish-primary" />
              </div>
              <h2 className="text-xl font-extrabold text-parish-text">Select Working Parish</h2>
              <p className="text-xs text-parish-text-muted">
                Welcome, <strong>{user?.fullName}</strong>. Select the parish context to manage for this session:
              </p>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {availableParishes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActiveParishById(p.id);
                    navigate('/dashboard');
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-parish-border bg-white hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-parish-surface-subtle border border-parish-border flex items-center justify-center font-bold text-xs text-parish-primary group-hover:bg-parish-primary group-hover:text-white transition-colors">
                      {p.parishCode}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-parish-text group-hover:text-parish-primary transition-colors">
                        {p.parishName}
                      </div>
                      <div className="text-[11px] text-parish-text-muted flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{[p.city, p.state].filter(Boolean).join(', ') || 'Australia'}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-parish-text-muted group-hover:text-parish-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-parish-border/60 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsChoosingParish(false);
                }}
                className="text-parish-text-muted hover:text-red-600 transition-colors font-medium cursor-pointer"
              >
                ← Sign in as different user
              </button>
            </div>
          </div>
        ) : isRedirecting ? (
          /* ================================================================= */
          /* INTERMEDIATE VERIFICATION GATEWAY: Authenticating & Redirecting   */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-12 px-6 sm:px-10 shadow-soft rounded-3xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative inline-flex items-center justify-center mx-auto">
              <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 animate-ping opacity-60" />
              <div className="relative p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 text-emerald-600 shadow-sm">
                <ShieldCheck className="w-10 h-10 text-emerald-600 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-parish-text tracking-tight">
                {redirectNotice.title}
              </h3>
              <p className="text-xs text-parish-text-muted leading-relaxed max-w-xs mx-auto">
                {redirectNotice.subtitle}
              </p>
            </div>

            {/* Smooth animated progress line */}
            <div className="w-56 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto overflow-hidden relative border border-slate-200 dark:border-slate-700">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${redirectProgress}%` }}
              />
            </div>

            <div className="text-[11px] text-parish-text-muted flex items-center justify-center gap-1.5 font-mono pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Redirecting to Parish Portal...</span>
            </div>
          </div>
        ) : terminalStatus === 'PENDING' ? (
          /* ================================================================= */
          /* 1. WORKSTATION ADMINISTRATOR APPROVAL REQUIRED FOR USER           */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl text-center space-y-6 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto border border-amber-300/80">
              <Clock className="w-7 h-7 animate-pulse text-amber-600" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                <span>{pendingApprovalData?.isBootstrap ? 'Initial Setup Required' : 'Workstation Approval Pending'}</span>
              </div>
              <h2 className="text-xl font-extrabold text-parish-text">
                {pendingApprovalData?.isBootstrap ? 'Initial Workstation Setup' : 'Awaiting Administrator Authorization'}
              </h2>
              <p className="text-xs text-parish-text-muted max-w-sm mx-auto leading-relaxed">
                {pendingApprovalData?.isBootstrap ? (
                  <>No authorized workstations exist for this parish yet. To register this machine as the initial primary terminal, verify your administrator email.</>
                ) : (
                  <>Welcome, <strong className="text-parish-text">{pendingApprovalData?.userName || 'Parish Staff'}</strong>. Your credentials are valid. This computer is awaiting approval from an authorized administrator.</>
                )}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-parish-surface-subtle border border-parish-border text-left text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-parish-border/60">
                <span className="text-parish-text-muted font-medium">User:</span>
                <span className="font-bold text-parish-text flex items-center gap-1.5">
                  <span>{pendingApprovalData?.userName || email}</span>
                  {pendingApprovalData?.userRole && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                      {pendingApprovalData.userRole}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-parish-text-muted font-medium">Terminal Name:</span>
                <span className="font-bold text-parish-text">{pendingApprovalData?.deviceName || terminalData?.deviceName || 'Workstation'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-parish-text-muted font-medium">Network / Location:</span>
                <span className="font-medium text-parish-text text-[11px]">
                  {pendingApprovalData?.networkScope === 'REMOTE_WAN'
                    ? `Remote WAN • ${pendingApprovalData?.locationName || 'External'}`
                    : `Parish Local Network (Wi-Fi / LAN)`}
                </span>
              </div>
            </div>

            {/* If Initial Bootstrap Setup (0 workstations in parish): Show Email OTP Flow */}
            {pendingApprovalData?.isBootstrap ? (
              <div className="pt-3 border-t border-parish-border/60 space-y-3 text-left">
                {bootstrapOtpError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
                    {bootstrapOtpError}
                  </div>
                )}
                {bootstrapOtpSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700">
                    {bootstrapOtpSuccess}
                  </div>
                )}

                {!bootstrapOtpSent ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={bootstrapOtpLoading}
                    onClick={handleSendBootstrapOtp}
                    className="w-full justify-center text-xs font-bold"
                    icon={<Mail className="w-3.5 h-3.5" />}
                  >
                    Send Verification Code to {pendingApprovalData.maskedEmail || 'Administrator Email'}
                  </Button>
                ) : (
                  <form onSubmit={handleVerifyBootstrapOtp} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-parish-text mb-1">
                        Enter 6-Digit Verification Code
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={bootstrapOtpCode}
                        onChange={(e) => setBootstrapOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        className="text-center font-mono text-base tracking-widest"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={bootstrapOtpLoading}
                      className="w-full justify-center text-xs font-bold"
                      icon={<KeyRound className="w-3.5 h-3.5" />}
                    >
                      Verify & Authorize Workstation
                    </Button>
                    <button
                      type="button"
                      onClick={handleSendBootstrapOtp}
                      disabled={bootstrapOtpLoading}
                      className="w-full text-center text-[11px] text-parish-primary hover:underline cursor-pointer"
                    >
                      Resend code
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* Normal Pending: Clean auto-polling (Zero password bypasses, Zero settings navigation hints) */
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runTerminalCheck}
                  className="w-full justify-center text-xs"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Check Approval Status
                </Button>
                <p className="text-[10px] text-parish-text-muted">
                  Auto-checking status every 3.5 seconds. Please contact an authorized administrator to approve this workstation.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setTerminalStatus('IDLE');
                setPendingApprovalData(null);
                setBootstrapOtpSent(false);
                setBootstrapOtpCode('');
                setBootstrapOtpError(null);
                setBootstrapOtpSuccess(null);
              }}
              className="text-xs text-parish-text-muted hover:text-parish-primary transition-colors font-medium cursor-pointer pt-2 block mx-auto"
            >
              ← Sign in as a different user
            </button>

            {isDevRevealed && visibleDevAccounts.length > 0 && (
              <div className="pt-3 border-t border-parish-border space-y-2 text-left">
                <div className="text-[10px] uppercase font-bold text-parish-text-muted">
                  Developer Bypass
                </div>
                {visibleDevAccounts.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => handleDevBypass(acct.email)}
                    className="w-full text-left p-2 rounded-xl text-xs bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>{acct.label}</span>
                    <span className="text-[10px] text-parish-text-muted font-mono">{acct.roleHint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : terminalStatus === 'REVOKED' ? (
          /* ================================================================= */
          /* 2. TERMINAL ACCESS REVOKED                                        */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl text-center space-y-5 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-700 flex items-center justify-center mx-auto border border-rose-300">
              <ShieldAlert className="w-7 h-7 text-rose-600" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-parish-text">Terminal Access Revoked</h2>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                This workstation has been decommissioned or revoked by parish administration.
              </p>
              <p className="text-xs text-parish-text-muted mt-2">
                Access to the canonical registry is blocked on this machine.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem('parish_terminal_sec_1');
                setTerminalStatus('IDLE');
              }}
              className="w-full justify-center text-xs"
            >
              Back to Login
            </Button>
          </div>
        ) : (
          /* ================================================================= */
          /* 3. STANDARD USER-FIRST UNIVERSAL LOGIN FORM                       */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6">
            {/* Authorized Workstation Security Banner */}
            {terminalData?.status === 'APPROVED' && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 text-[11px] text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Authorized Workstation: {terminalData.deviceName}</span>
                </div>
                <span className="font-mono text-[10px] opacity-80">{getHardwarePlatform()}</span>
              </div>
            )}

            {/* Header Tag */}
            <div className="flex items-center justify-between pb-2 border-b border-parish-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Secure Access
              </span>
              <Badge variant="success" size="sm">
                Authorized Access
              </Badge>
            </div>

            {/* Inactivity Auto-Logout Alert Banner */}
            {inactivityNotice && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{inactivityNotice}</span>
              </div>
            )}

            {/* Success Notice Alert */}
            {successNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Error Message Alert with Review Request Action */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-2.5 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span className="leading-relaxed flex-1">{errorMessage}</span>
                </div>

                {revokedTerminalInfo && (
                  <div className="pt-2 border-t border-red-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    {reviewSubmitted || revokedTerminalInfo.reviewRequestedAt ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-semibold text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>Access Review Requested — Awaiting Administrator Re-Evaluation</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-[11px] text-red-800">
                          Need access restored? You can submit a review request to the Administrator.
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRequestReview}
                          isLoading={isRequestingReview}
                          className="text-xs bg-white hover:bg-rose-50 border-rose-300 text-rose-800 shrink-0 shadow-2xs"
                          icon={<Send className="w-3 h-3 text-rose-600" />}
                        >
                          Send Review Request
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email or Username"
                type="text"
                required
                placeholder="e.g. admin or user@parish.org.au"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSuccessNotice(null);
                }}
                icon={<User className="w-4 h-4" />}
              />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-parish-text">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSuccessNotice(null);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs font-semibold text-parish-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSuccessNotice(null);
                  }}
                  icon={<Lock className="w-4 h-4" />}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full justify-center text-sm shadow-soft"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In to Parish Register
                </Button>
              </div>
            </form>

            {/* Developer Fast Access (Ctrl/Cmd + Shift + D + Server Allowed check + DB existence check) */}
            {isDevRevealed && visibleDevAccounts.length > 0 && (
              <div className="pt-4 border-t border-parish-border animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 gap-2">
                  {visibleDevAccounts.map((acct) => (
                    <button
                      key={acct.email}
                      type="button"
                      onClick={() => handleDevBypass(acct.email)}
                      className={`w-full text-left p-2.5 rounded-xl border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group cursor-pointer ${acct.dashed
                          ? 'border-dashed border-amber-500/40 opacity-85 hover:opacity-100'
                          : 'border-amber-500/30'
                        }`}
                    >
                      <div>
                        <div className="font-bold text-parish-text flex items-center gap-1.5">
                          <span>{acct.label}</span>
                          <span className="text-[10px] text-parish-text-muted font-normal">{acct.roleHint}</span>
                        </div>
                        <div className="text-[11px] text-parish-text-muted">{acct.email}</div>
                      </div>
                      <Badge
                        variant={acct.badgeVariant}
                        size="sm"
                        className="group-hover:bg-parish-primary group-hover:text-white transition-colors"
                      >
                        Fast Login
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-parish-text-muted space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>🔒 Official Parish Register System • Protected with JWT & Bcrypt</span>
          </div>
        </div>
      </div>

      {/* Forgot Password 6-Digit OTP Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
        onPasswordResetSuccess={(resetEmail) => {
          setEmail(resetEmail);
          setPassword('');
          setSuccessNotice('Your password has been reset successfully! Please log in with your new password.');
        }}
      />
    </div>
  );
};
