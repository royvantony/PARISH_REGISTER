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
  Monitor,
  ShieldCheck,
  Shield,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { api } from '../lib/api';
import {
  verifyTerminalAuthorization,
  registerTerminal,
  getBrowserMetadata,
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
    label: '⛪ Parish Priest',
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
  const [terminalStatus, setTerminalStatus] = useState<'CHECKING' | 'APPROVED' | 'PENDING' | 'UNREGISTERED' | 'REVOKED'>('CHECKING');
  const [terminalData, setTerminalData] = useState<DeviceVerifyResult | null>(null);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [isRegisteringTerminal, setIsRegisteringTerminal] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Check terminal authorization on load
  const runTerminalCheck = async () => {
    try {
      const res = await verifyTerminalAuthorization(1);
      setTerminalData(res);
      setTerminalStatus(res.status);
    } catch {
      setTerminalStatus('UNREGISTERED');
    }
  };

  useEffect(() => {
    setNewTerminalName(`${getBrowserMetadata()} Terminal`);
    runTerminalCheck();
  }, []);

  // Live auto-polling when terminal is PENDING approval
  useEffect(() => {
    if (terminalStatus !== 'PENDING') return;
    const interval = setInterval(async () => {
      try {
        const res = await verifyTerminalAuthorization(1);
        if (res.status === 'APPROVED') {
          setTerminalData(res);
          setTerminalStatus('APPROVED');
        } else if (res.status === 'REVOKED') {
          setTerminalData(res);
          setTerminalStatus('REVOKED');
        }
      } catch {
        // Ignore network glitches during poll
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [terminalStatus]);

  const handleRegisterTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const cleanName = newTerminalName.trim();
    if (!cleanName || cleanName.length < 2) {
      setRegisterError('Please enter a descriptive terminal name (e.g. Front Desk PC, Fr. Sebastian Laptop).');
      return;
    }

    try {
      setIsRegisteringTerminal(true);
      await registerTerminal(1, cleanName);
      setTerminalData({
        status: 'PENDING',
        deviceName: cleanName,
        requestedAt: new Date().toISOString(),
      });
      setTerminalStatus('PENDING');
    } catch (err: any) {
      setRegisterError(err.response?.data?.error || 'Failed to submit terminal registration.');
    } finally {
      setIsRegisteringTerminal(false);
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
      if (res.needsParishSelection) {
        setIsChoosingParish(true);
      } else {
        navigate('/dashboard');
      }
    } else {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  // Developer Bypass Login: Logs in immediately without password
  const handleDevBypass = async (devEmail: string) => {
    setErrorMessage('');
    setIsLoading(true);

    const res = await devLogin(devEmail);
    setIsLoading(false);

    if (res.success) {
      if (res.needsParishSelection) {
        setIsChoosingParish(true);
      } else {
        navigate('/dashboard');
      }
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
        ) : terminalStatus === 'CHECKING' && !isDevRevealed ? (
          /* ================================================================= */
          /* 1. AUTHENTICATING TERMINAL (Transitory 1-second screen)            */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-12 px-6 sm:px-10 shadow-soft rounded-3xl text-center space-y-4 animate-in fade-in">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200/60 mx-auto animate-pulse">
              <Shield className="w-8 h-8 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-parish-text">Authenticating Terminal...</h3>
              <p className="text-xs text-parish-text-muted">
                Verifying workstation hardware authorization for St. Alphonsa Parish
              </p>
            </div>
          </div>
        ) : terminalStatus === 'UNREGISTERED' && !isDevRevealed ? (
          /* ================================================================= */
          /* 2. TERMINAL REGISTRATION REQUIRED                                 */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200/60 mx-auto">
                <Monitor className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-xl font-extrabold text-parish-text">Terminal Authorization Required</h2>
              <p className="text-xs text-parish-text-muted leading-relaxed">
                This workstation is not yet registered for St. Alphonsa Parish. Please provide a descriptive name to submit an authorization request to the Parish Priest.
              </p>
            </div>

            <form onSubmit={handleRegisterTerminal} className="space-y-4">
              {registerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-parish-text mb-1">
                  Terminal / Machine Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={newTerminalName}
                  onChange={(e) => setNewTerminalName(e.target.value)}
                  placeholder="e.g. Office Front Desk PC, Fr. Sebastian Laptop"
                  required
                  className="text-xs"
                />
                <p className="text-[11px] text-parish-text-muted mt-1.5 flex items-center gap-1">
                  <span>Detected platform:</span>
                  <strong className="text-parish-text">{getBrowserMetadata()}</strong>
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isRegisteringTerminal}
                className="w-full justify-center text-xs font-bold"
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Request Terminal Authorization
              </Button>
            </form>
          </div>
        ) : terminalStatus === 'PENDING' && !isDevRevealed ? (
          /* ================================================================= */
          /* 3. TERMINAL APPROVAL PENDING                                      */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl text-center space-y-6 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto border border-amber-300/80">
              <Clock className="w-7 h-7 animate-pulse text-amber-600" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                <span>Authorization Pending</span>
              </div>
              <h2 className="text-xl font-extrabold text-parish-text">Awaiting Pastoral Approval</h2>
              <p className="text-xs text-parish-text-muted max-w-sm mx-auto leading-relaxed">
                Your request for <strong className="text-parish-text">{terminalData?.deviceName || 'this workstation'}</strong> has been submitted.
                Please ask the Parish Priest or Administrator to approve this machine in <strong>Parish Settings &rarr; Authorized Terminals</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-parish-surface-subtle border border-parish-border text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-parish-text-muted">Terminal Name:</span>
                <span className="font-bold text-parish-text">{terminalData?.deviceName || 'Workstation'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-parish-text-muted">Platform:</span>
                <span className="font-medium text-parish-text">{getBrowserMetadata()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runTerminalCheck}
                className="w-full justify-center text-xs"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Check Approval Status Now
              </Button>
              <p className="text-[10px] text-parish-text-muted">
                Auto-refreshing every few seconds...
              </p>
            </div>
          </div>
        ) : terminalStatus === 'REVOKED' && !isDevRevealed ? (
          /* ================================================================= */
          /* 4. TERMINAL ACCESS REVOKED                                        */
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
                setTerminalStatus('UNREGISTERED');
              }}
              className="w-full justify-center text-xs"
            >
              Request Re-Registration
            </Button>
          </div>
        ) : (
          /* ================================================================= */
          /* 5. STANDARD CLEAN UNIVERSAL LOGIN FORM (Terminal Approved)        */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6">
            {/* Authorized Workstation Security Banner */}
            {terminalData?.status === 'APPROVED' && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 text-[11px] text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Authorized Terminal: {terminalData.deviceName}</span>
                </div>
                <span className="font-mono text-[10px] opacity-80">{getBrowserMetadata()}</span>
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

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email or Username"
                type="text"
                required
                placeholder="e.g. fr.abraham or priest@stalphonsabrisbane.org.au"
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
