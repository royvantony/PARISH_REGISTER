import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  Church,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  MapPin,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, availableParishes } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedParishId, setSelectedParishId] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  useEffect(() => {
    if (availableParishes.length > 0 && !availableParishes.some((p) => p.id === selectedParishId)) {
      setSelectedParishId(availableParishes[0].id);
    }
  }, [availableParishes, selectedParishId]);

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

    const res = await login(email, password, selectedParishId);
    setIsLoading(false);

    if (res.success) {
      navigate('/dashboard');
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
        {/* Brand Icon & Heading */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-parish-primary text-white shadow-soft mx-auto">
          <Church className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
            Parish Register
          </h1>
          <p className="text-xs text-parish-text-muted mt-1 font-medium">
            St. Alphonsa Syro-Malabar Catholic Parish Brisbane North
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-parish-surface border border-parish-border py-8 px-6 sm:px-10 shadow-soft rounded-3xl space-y-6">
          {/* Header Tag */}
          <div className="flex items-center justify-between pb-2 border-b border-parish-border/60">
            <span className="text-xs font-bold uppercase tracking-wider text-parish-text-muted">
              Secure Access
            </span>
            <Badge variant="success" size="sm">
              Diocese of Melbourne (AU)
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
              placeholder="e.g. royvantony@gmail.com"
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

            {/* Parish Selection on Login */}
            {availableParishes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Working Parish Context</span>
                  </div>
                  <Badge variant="subtle" size="sm" className="bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                    Select Parish
                  </Badge>
                </div>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  Choose the parish context for this session:
                </p>
                <select
                  value={selectedParishId}
                  onChange={(e) => setSelectedParishId(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-emerald-300 text-parish-text focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all cursor-pointer"
                >
                  {availableParishes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.parishName} ({p.parishCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group"
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
                className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group"
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
                className="w-full text-left p-2.5 rounded-xl border border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group"
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
                className="w-full text-left p-2.5 rounded-xl border border-dashed border-parish-border hover:border-parish-primary hover:bg-parish-surface-subtle transition-all flex items-center justify-between text-xs group opacity-75 hover:opacity-100"
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

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-parish-text-muted space-y-1">
          <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted with JWT & bcrypt • Local Database Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
