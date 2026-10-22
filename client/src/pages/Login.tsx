import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  MapPin,
  CheckCircle2,
  Clock,
  Church,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, logout, user, availableParishes, setActiveParishById } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isChoosingParish, setIsChoosingParish] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  useEffect(() => {
    const notice = sessionStorage.getItem('inactivity_logout_notice');
    if (notice) {
      setInactivityNotice(notice);
      sessionStorage.removeItem('inactivity_logout_notice');
    }
  }, []);

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

  // Quick autofill helper for easy testing
  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
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
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-parish-border shadow-soft mx-auto text-parish-primary">
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
        ) : (
          /* ================================================================= */
          /* STANDARD CLEAN UNIVERSAL LOGIN FORM                              */
          /* ================================================================= */
          <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6">
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
                label="Email Address"
                type="email"
                required
                placeholder="e.g. priest@stalphonsabrisbane.org.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
              />

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

            {/* Quick Preset Accounts (Click to test instantly) */}
            <div className="pt-4 border-t border-parish-border/60 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-parish-text-muted">
                <Sparkles className="w-3.5 h-3.5 text-parish-accent" />
                <span>One-Click Demo Credentials</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('priest@stalphonsabrisbane.org.au', 'parishAdmin2026!')}
                  className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-parish-text flex items-center gap-1.5">
                      <span>⛪ Parish Super Admin</span>
                      <span className="text-[10px] text-parish-text-muted font-normal">(Parish Priest)</span>
                    </div>
                    <div className="text-[11px] text-parish-text-muted">priest@stalphonsabrisbane.org.au</div>
                  </div>
                  <Badge variant="default" size="sm" className="group-hover:bg-parish-primary group-hover:text-white transition-colors">
                    Fill
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('trustee@parish.org', 'parishAdmin2026!')}
                  className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-parish-text flex items-center gap-1.5">
                      <span>🛡️ Parish Admin</span>
                      <span className="text-[10px] text-parish-text-muted font-normal">(Trustee)</span>
                    </div>
                    <div className="text-[11px] text-parish-text-muted">trustee@parish.org</div>
                  </div>
                  <Badge variant="subtle" size="sm" className="group-hover:bg-parish-primary group-hover:text-white transition-colors">
                    Fill
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('secretary@stalphonsabrisbane.org.au', 'parishAdmin2026!')}
                  className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-parish-text flex items-center gap-1.5">
                      <span>📋 Parish User</span>
                      <span className="text-[10px] text-parish-text-muted font-normal">(Secretary)</span>
                    </div>
                    <div className="text-[11px] text-parish-text-muted">secretary@stalphonsabrisbane.org.au</div>
                  </div>
                  <Badge variant="subtle" size="sm" className="group-hover:bg-parish-primary group-hover:text-white transition-colors">
                    Fill
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('royvantony@gmail.com', 'DevSuperAdmin2026!')}
                  className="w-full text-left p-2.5 rounded-xl border border-dashed border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group opacity-75 hover:opacity-100 cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-parish-text flex items-center gap-1.5">
                      <span>🛠️ Platform Super Admin</span>
                      <span className="text-[10px] text-parish-text-muted font-normal">(Developer)</span>
                    </div>
                    <div className="text-[11px] text-parish-text-muted">royvantony@gmail.com</div>
                  </div>
                  <Badge variant="subtle" size="sm" className="group-hover:bg-parish-primary group-hover:text-white transition-colors">
                    Fill
                  </Badge>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-parish-text-muted space-y-1">
          <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted with JWT & bcrypt • Multi-Tenant Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
