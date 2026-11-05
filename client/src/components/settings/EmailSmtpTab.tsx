import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Server,
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface SmtpSettingResponse {
  id?: number;
  parishId: number;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  isEnabled: boolean;
  updatedAt?: string;
}

export const EmailSmtpTab: React.FC = () => {
  const { user, activeParish } = useAuth();

  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('St. Alphonsa Parish Register');
  const [isEnabled, setIsEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(true);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test recipient
  const [testRecipient, setTestRecipient] = useState('');

  // Fetch current settings
  const fetchSettings = async () => {
    setIsLoading(true);
    setSaveFeedback(null);
    try {
      const res = await api.get<SmtpSettingResponse>('/settings/smtp');
      if (res.data) {
        setHost(res.data.host || 'smtp.gmail.com');
        setPort(res.data.port || 587);
        setSecure(Boolean(res.data.secure));
        setSmtpUser(res.data.user || '');
        setHasPassword(Boolean(res.data.hasPassword));
        setFromEmail(res.data.fromEmail || res.data.user || '');
        setFromName(res.data.fromName || activeParish?.parishName || 'Parish Register');
        setIsEnabled(Boolean(res.data.isEnabled));
        if (res.data.hasPassword) {
          setSmtpPass(''); // Leave empty to keep existing password unless edited
        }
      }
    } catch (err: any) {
      console.error('Failed to load SMTP settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (user?.email) {
      setTestRecipient(user.email);
    }
  }, [activeParish?.id, user?.email]);

  const handleApplyGmailPreset = () => {
    setHost('smtp.gmail.com');
    setPort(587);
    setSecure(false);
    if (!smtpUser && user?.email) {
      setSmtpUser(user.email);
    }
    if (!fromEmail && smtpUser) {
      setFromEmail(smtpUser);
    }
    if (!fromName && activeParish?.parishName) {
      setFromName(`${activeParish.parishName} Register`);
    }
    setSaveFeedback({
      type: 'success',
      text: 'Applied standard Google Gmail SMTP presets (smtp.gmail.com : 587 STARTTLS).',
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveFeedback(null);
    setIsSaving(true);

    try {
      const payload: any = {
        host: host.trim(),
        port: Number(port),
        secure,
        user: smtpUser.trim(),
        fromEmail: (fromEmail || smtpUser).trim(),
        fromName: fromName.trim(),
        isEnabled,
      };

      // Only send password if updated
      if (smtpPass) {
        payload.pass = smtpPass.trim();
      }

      const res = await api.post('/settings/smtp', payload);
      setHasPassword(Boolean(res.data.setting.hasPassword));
      setSmtpPass('');
      setSaveFeedback({
        type: 'success',
        text: 'SMTP settings saved successfully.',
      });
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to save SMTP settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    const target = testRecipient.trim() || user?.email || smtpUser;
    if (!target) {
      setTestFeedback({
        type: 'error',
        text: 'Please specify a recipient email address to send the test message to.',
      });
      return;
    }

    setIsTesting(true);
    setTestFeedback(null);

    try {
      const res = await api.post('/settings/smtp/test', {
        host: host.trim(),
        port: Number(port),
        secure,
        user: smtpUser.trim(),
        pass: smtpPass.trim() || (hasPassword ? undefined : ''),
        fromEmail: (fromEmail || smtpUser).trim(),
        fromName: fromName.trim(),
        recipientEmail: target,
      });

      setTestFeedback({
        type: 'success',
        text: res.data.message || `Test email sent successfully to ${target}! Check your inbox.`,
      });
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to dispatch test email. Please verify SMTP host, port, and App Password.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Card */}
      <div className="p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-extrabold text-base text-parish-text flex items-center gap-2">
              <Mail className="w-5 h-5 text-parish-primary" />
              <span>Email & SMTP Gateway</span>
            </h3>
            <Badge variant={isEnabled ? 'success' : 'subtle'} size="sm">
              {isEnabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-xs text-parish-text-muted mt-1">
            Configure outgoing mail server for automated password resets, system alerts, and notifications for{' '}
            <strong className="text-parish-text">{activeParish?.parishName || 'Parish'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleApplyGmailPreset}
            className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border-transparent"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Load Gmail Preset</span>
          </Button>
        </div>
      </div>

      {/* Gmail App Password Setup Instruction Guide */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowHelpGuide(!showHelpGuide)}>
          <div className="flex items-center gap-2 font-bold text-xs">
            <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>How to use Gmail with Parish Register (Google App Password)</span>
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline"
          >
            {showHelpGuide ? 'Hide Guide' : 'Show Instructions'}
          </button>
        </div>

        {showHelpGuide && (
          <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs space-y-2 leading-relaxed text-amber-900 dark:text-amber-100">
            <p>
              Google requires a <strong>16-character App Password</strong> when third-party applications send email via Gmail SMTP. Follow these quick steps:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium">
              <li>
                Sign in to your Google Account at{' '}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300"
                >
                  myaccount.google.com/security <ExternalLink className="w-3 h-3 inline" />
                </a>.
              </li>
              <li>Confirm that <strong>2-Step Verification</strong> is enabled on your Google account.</li>
              <li>
                In the Google search bar, type <strong>&quot;App Passwords&quot;</strong> (or visit{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300"
                >
                  myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3 inline" />
                </a>).
              </li>
              <li>Create a new App Password named <strong>&quot;Parish Register&quot;</strong>.</li>
              <li>Copy the generated 16-character password (e.g. <code className="bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded font-mono">abcd efgh ijkl mnop</code>) and paste it into the <em>Password / Google App Password</em> field below.</li>
            </ol>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 italic pt-1">
              Note: Never use your regular Google account sign-in password; Google blocks basic password authentication for automated SMTP servers.
            </p>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-6">
        {saveFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              saveFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {saveFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{saveFeedback.text}</span>
          </div>
        )}

        {/* Enable / Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-parish-surface-subtle border border-parish-border">
          <div>
            <div className="text-xs font-bold text-parish-text">Enable Automated Outgoing Email</div>
            <div className="text-[11px] text-parish-text-muted mt-0.5">
              Allow this parish to send outgoing notifications and password resets.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Server & Port Config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-parish-text mb-1">
              SMTP Host Server <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
                className="font-mono text-xs"
              />
            </div>
            <span className="text-[10px] text-parish-text-muted">For Gmail, use <code className="font-mono">smtp.gmail.com</code></span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Port <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="587"
              required
              className="font-mono text-xs"
            />
            <span className="text-[10px] text-parish-text-muted">Usually 587 (TLS) or 465 (SSL)</span>
          </div>
        </div>

        {/* Security / SSL Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="secure-toggle"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
            className="w-4 h-4 rounded text-parish-primary border-parish-border focus:ring-parish-primary"
          />
          <label htmlFor="secure-toggle" className="text-xs font-semibold text-parish-text cursor-pointer select-none">
            Use Direct SSL/TLS encryption (Required if Port is 465; leave unchecked for 587 STARTTLS)
          </label>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-parish-border">
          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              SMTP Username / Gmail Address <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={smtpUser}
              onChange={(e) => {
                setSmtpUser(e.target.value);
                if (!fromEmail) setFromEmail(e.target.value);
              }}
              placeholder="parish.office@gmail.com"
              required
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-parish-text-muted">The Google email account authorized to send emails</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-parish-text">
                Password / Google App Password {hasPassword && <span className="text-emerald-600 font-semibold">(Saved in database)</span>}
              </label>
              {smtpPass && !smtpPass.includes('@') && (
                <span className="text-[10px] font-mono text-parish-primary font-bold">
                  {smtpPass.replace(/\s+/g, '').length} / 16 chars
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={hasPassword ? 'Enter new App Password to update (or leave blank to keep existing)' : 'e.g. abcd efgh ijkl mnop'}
                className={`pr-10 text-xs font-mono ${smtpPass.includes('@') ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password to check what was pasted'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {smtpPass.includes('@') ? (
              <span className="text-[11px] font-bold text-red-600 block mt-1 animate-pulse">
                ⚠️ Warning: You pasted an email address into this field! Please paste your 16-character Google App Password (not your email address).
              </span>
            ) : (
              <span className="text-[10px] text-parish-text-muted">
                16-letter App Password generated at Google Security (spaces will be automatically cleaned). Click the eye icon to verify.
              </span>
            )}
          </div>
        </div>

        {/* Sender Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-parish-border">
          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Sender Display Name
            </label>
            <Input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="St. Alphonsa Parish Brisbane"
              className="text-xs"
            />
            <span className="text-[10px] text-parish-text-muted">Name displayed as the sender in parishioners&apos; inboxes</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Sender From Email
            </label>
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="parish.office@gmail.com"
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-parish-text-muted">Must match or be an authorized alias of the SMTP user</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSaving}
            className="gap-2 text-xs font-bold"
          >
            <Server className="w-4 h-4" />
            <span>Save SMTP Settings</span>
          </Button>
        </div>
      </form>

      {/* Test Email Section */}
      <div className="p-6 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-parish-text flex items-center gap-2">
            <Send className="w-4 h-4 text-parish-primary" />
            <span>Send Diagnostic Test Email</span>
          </h4>
          <p className="text-xs text-parish-text-muted mt-0.5">
            Send an immediate test email to verify credentials and SMTP connectivity.
          </p>
        </div>

        {testFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              testFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {testFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="leading-relaxed">{testFeedback.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="recipient@example.com"
              className="text-xs font-mono"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleSendTestEmail}
            isLoading={isTesting}
            disabled={!smtpUser && !hasPassword}
            className="gap-2 text-xs font-bold shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Email</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
