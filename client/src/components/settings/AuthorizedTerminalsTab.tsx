import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Monitor,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Trash2,
  Info,
  Cpu,
  Globe,
  Wifi,
} from 'lucide-react';

interface TerminalDevice {
  id: number;
  deviceName: string;
  deviceFingerprint: string | null;
  status: 'PENDING' | 'APPROVED' | 'REVOKED';
  registeredUserId?: number | null;
  registeredByName?: string | null;
  registeredByEmail?: string | null;
  registeredByRole?: string | null;
  hardwareHash?: string | null;
  screenResolution?: string | null;
  gpuRenderer?: string | null;
  cpuCores?: number | null;
  deviceMemory?: string | null;
  timezone?: string | null;
  networkScope?: string | null;
  locationName?: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  lastUsedBrowser: string | null;
  lastUsedUser: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdAt: string;
}

export const AuthorizedTerminalsTab: React.FC = () => {
  const [devices, setDevices] = useState<TerminalDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modern in-app Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    action: async () => {},
  });

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/devices/list');
      setDevices(res.data?.devices || []);
    } catch (err: any) {
      console.error('Failed to load terminals:', err);
      setFeedback({
        message: err.response?.data?.error || 'Failed to load authorized terminals.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleApprove = async (deviceId: number, name: string) => {
    setActionInProgressId(deviceId);
    setFeedback(null);
    try {
      const res = await api.post(`/devices/${deviceId}/approve`);
      setFeedback({ message: res.data.message || `Terminal "${name}" approved.`, type: 'success' });
      await fetchDevices();
    } catch (err: any) {
      setFeedback({
        message: err.response?.data?.error || 'Failed to approve terminal.',
        type: 'error',
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  const requestRevoke = (deviceId: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Workstation Access',
      message: `Are you sure you want to revoke "${name}"? This physical machine will immediately be blocked from accessing parish records across all accounts.`,
      confirmLabel: 'Revoke Access',
      variant: 'danger',
      action: () => executeRevoke(deviceId, name),
    });
  };

  const executeRevoke = async (deviceId: number, name: string) => {
    setActionInProgressId(deviceId);
    setFeedback(null);
    try {
      const res = await api.post(`/devices/${deviceId}/revoke`);
      setFeedback({ message: res.data.message || `Terminal "${name}" revoked.`, type: 'success' });
      await fetchDevices();
    } catch (err: any) {
      setFeedback({
        message: err.response?.data?.error || 'Failed to revoke terminal.',
        type: 'error',
      });
    } finally {
      setActionInProgressId(null);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const requestReject = (deviceId: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Access Request',
      message: `Reject authorization request for "${name}"? The user will not be allowed to access the parish portal from this device.`,
      confirmLabel: 'Reject Request',
      variant: 'danger',
      action: () => executeDelete(deviceId, name),
    });
  };

  const requestDelete = (deviceId: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Remove Workstation',
      message: `Permanently delete registration records for "${name}"? If this machine reconnects in the future, it will be treated as an unknown device requiring re-authorization.`,
      confirmLabel: 'Remove Terminal',
      variant: 'danger',
      action: () => executeDelete(deviceId, name),
    });
  };

  const executeDelete = async (deviceId: number, name: string) => {
    setActionInProgressId(deviceId);
    setFeedback(null);
    try {
      const res = await api.delete(`/devices/${deviceId}`);
      setFeedback({ message: res.data.message || `Terminal "${name}" removed.`, type: 'success' });
      await fetchDevices();
    } catch (err: any) {
      setFeedback({
        message: err.response?.data?.error || 'Failed to remove terminal.',
        type: 'error',
      });
    } finally {
      setActionInProgressId(null);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const pendingDevices = devices.filter((d) => d.status === 'PENDING');
  const approvedDevices = devices.filter((d) => d.status === 'APPROVED');
  const revokedDevices = devices.filter((d) => d.status === 'REVOKED');

  const getDeviceIcon = (fingerprint?: string | null) => {
    const fp = (fingerprint || '').toLowerCase();
    if (fp.includes('iphone') || fp.includes('android') || fp.includes('ios')) {
      return <Smartphone className="w-4 h-4 text-indigo-600" />;
    }
    if (fp.includes('mac') || fp.includes('laptop')) {
      return <Laptop className="w-4 h-4 text-emerald-600" />;
    }
    return <Monitor className="w-4 h-4 text-sky-600" />;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-xs flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-parish-text flex items-center gap-2">
              <span>Authorized Terminals & Workstations</span>
              <Badge variant="success" size="sm">Core Hardware Security</Badge>
            </h3>
            <p className="text-xs text-parish-text-muted mt-1 leading-relaxed max-w-2xl">
              Only physical computers and mobile devices authorized by the Parish Priest can load this parish’s software.
              Every login and sensitive action is automatically tagged with the physical terminal name.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchDevices}
          isLoading={isLoading}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Refresh List
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-800 dark:text-rose-300'
            }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-parish-surface border border-parish-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-parish-text-muted">Active Workstations</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-parish-text mt-2">{approvedDevices.length}</div>
          <p className="text-[11px] text-parish-text-muted mt-0.5">Approved for registry access</p>
        </div>

        <div className="p-4 rounded-xl bg-parish-surface border border-parish-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-parish-text-muted">Pending Approvals</span>
            <Clock className={`w-4 h-4 ${pendingDevices.length > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${pendingDevices.length > 0 ? 'text-amber-600' : 'text-parish-text'}`}>
            {pendingDevices.length}
          </div>
          <p className="text-[11px] text-parish-text-muted mt-0.5">Awaiting pastoral review</p>
        </div>

        <div className="p-4 rounded-xl bg-parish-surface border border-parish-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-parish-text-muted">Revoked / Inactive</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-parish-text mt-2">{revokedDevices.length}</div>
          <p className="text-[11px] text-parish-text-muted mt-0.5">Decommissioned terminals</p>
        </div>
      </div>

      {/* Section 1: Pending Approvals (High Priority) */}
      {pendingDevices.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <h4 className="font-extrabold text-sm text-parish-text">
                Pending Terminal Approvals ({pendingDevices.length})
              </h4>
            </div>
            <span className="text-[11px] text-amber-900 dark:text-amber-200 font-medium">
              Action Required to Grant Access
            </span>
          </div>

          <div className="space-y-3">
            {pendingDevices.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-900/40 text-amber-700 shrink-0 mt-0.5">
                    {getDeviceIcon(d.deviceFingerprint)}
                  </div>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-parish-text">{d.deviceName}</span>
                      <Badge variant="warning" size="sm">Pending Pastoral Approval</Badge>

                      {/* Network & Location Badge */}
                      {d.networkScope === 'REMOTE_WAN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-300">
                          <Globe className="w-3 h-3 text-sky-600" />
                          <span>Remote WAN: {d.locationName || 'Remote Location'} ({d.ipAddress})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                          <Wifi className="w-3 h-3 text-emerald-600" />
                          <span>Parish Local Network (LAN / Wi-Fi) {d.ipAddress ? `• ${d.ipAddress}` : ''}</span>
                        </span>
                      )}
                    </div>

                    {/* Prominent User Identity Request Banner */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/80 text-xs flex-wrap">
                      <span className="font-bold text-amber-900 dark:text-amber-200">User Requesting Access:</span>
                      <strong className="text-sm text-parish-text">{d.registeredByName || d.lastUsedUser || 'Verified Parish User'}</strong>
                      {d.registeredByRole && (
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-200 dark:border-slate-700">
                          {d.registeredByRole}
                        </span>
                      )}
                      {d.registeredByEmail && (
                        <span className="text-slate-500 text-[11px]">({d.registeredByEmail})</span>
                      )}
                    </div>

                    {/* Rich Hardware & Telemetry Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs bg-parish-surface-subtle p-2.5 rounded-lg border border-parish-border/60">
                      <div>
                        <span className="text-parish-text-muted text-[10px] uppercase font-bold block">Platform & Browser</span>
                        <span className="font-semibold text-parish-text">{d.deviceFingerprint || 'Web Browser'}</span>
                      </div>
                      {d.gpuRenderer && (
                        <div>
                          <span className="text-parish-text-muted text-[10px] uppercase font-bold block">Graphics Hardware (GPU)</span>
                          <span className="font-semibold text-parish-text truncate block" title={d.gpuRenderer}>
                            {d.gpuRenderer}
                          </span>
                        </div>
                      )}
                      {d.screenResolution && (
                        <div>
                          <span className="text-parish-text-muted text-[10px] uppercase font-bold block">Display Spec</span>
                          <span className="font-semibold text-parish-text">{d.screenResolution}</span>
                        </div>
                      )}
                      {(d.cpuCores || d.deviceMemory) && (
                        <div>
                          <span className="text-parish-text-muted text-[10px] uppercase font-bold block">Processor & Memory</span>
                          <span className="font-semibold text-parish-text flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-slate-400" />
                            <span>{[d.cpuCores ? `${d.cpuCores} CPU Cores` : null, d.deviceMemory].filter(Boolean).join(' • ')}</span>
                          </span>
                        </div>
                      )}
                      {d.timezone && (
                        <div>
                          <span className="text-parish-text-muted text-[10px] uppercase font-bold block">System Timezone</span>
                          <span className="font-semibold text-parish-text">{d.timezone}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-parish-text-muted text-[10px] uppercase font-bold block">Enrolled Date & Time</span>
                        <span className="font-semibold text-parish-text flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(d.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center mt-2 md:mt-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(d.id, d.deviceName)}
                    isLoading={actionInProgressId === d.id}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve Terminal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestReject(d.id, d.deviceName)}
                    disabled={actionInProgressId === d.id}
                    className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Active Authorized Terminals */}
      <div className="p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-parish-text">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Active Authorized Terminals ({approvedDevices.length})</span>
          </div>
          <span className="text-[11px] text-parish-text-muted">
            Computers with full portal access
          </span>
        </div>

        {approvedDevices.length === 0 ? (
          <div className="py-8 text-center text-xs text-parish-text-muted border border-dashed border-parish-border rounded-xl">
            No active workstations currently authorized. When an office computer or pastoral device enrolls, it will appear here.
          </div>
        ) : (
          <div className="divide-y divide-parish-border">
            {approvedDevices.map((d) => (
              <div
                key={d.id}
                className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 shrink-0 mt-0.5">
                    {getDeviceIcon(d.deviceFingerprint)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-parish-text">{d.deviceName}</span>
                      <Badge variant="success" size="sm">Active</Badge>

                      {d.networkScope === 'REMOTE_WAN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-300">
                          <Globe className="w-3 h-3 text-sky-600" />
                          <span>Remote WAN: {d.locationName || 'Remote'} ({d.ipAddress})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                          <Wifi className="w-3 h-3 text-emerald-600" />
                          <span>Parish Local Network {d.ipAddress ? `(${d.ipAddress})` : ''}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-parish-text-muted">
                      Platform: <span className="font-medium text-parish-text">{d.deviceFingerprint || 'Web Browser'}</span>
                      {d.gpuRenderer && <span className="text-[11px] ml-1.5 font-medium text-slate-500">• {d.gpuRenderer}</span>}
                      {d.screenResolution && <span className="text-[11px] ml-1.5 font-medium text-slate-400">({d.screenResolution})</span>}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-parish-text-muted mt-1 flex-wrap">
                      <span>Last active: <strong>{formatDate(d.lastUsedAt)}</strong></span>
                      {d.lastUsedUser && (
                        <span>User: <strong className="text-parish-text">{d.lastUsedUser}</strong></span>
                      )}
                      {d.approvedBy && (
                        <span>Approved by: <strong>{d.approvedBy}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestRevoke(d.id, d.deviceName)}
                    isLoading={actionInProgressId === d.id}
                    icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                    className="text-xs hover:border-rose-300 hover:text-rose-600"
                  >
                    Revoke Access
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Revoked / Decommissioned Terminals */}
      {revokedDevices.length > 0 && (
        <div className="p-5 rounded-2xl bg-parish-surface border border-parish-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-parish-text">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Revoked / Blocked Terminals ({revokedDevices.length})</span>
            </div>
            <span className="text-[11px] text-parish-text-muted">
              Access permanently severed
            </span>
          </div>

          <div className="divide-y divide-parish-border">
            {revokedDevices.map((d) => (
              <div
                key={d.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 opacity-85"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 shrink-0 mt-0.5">
                    {getDeviceIcon(d.deviceFingerprint)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-parish-text line-through">{d.deviceName}</span>
                      <Badge variant="subtle" size="sm" className="text-rose-700 bg-rose-100/60">Revoked</Badge>
                    </div>
                    <p className="text-xs text-parish-text-muted mt-0.5">
                      Platform: {d.deviceFingerprint || 'Web Browser'} • Revoked by: {d.revokedBy || 'Parish Priest'} on {formatDate(d.revokedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApprove(d.id, d.deviceName)}
                    isLoading={actionInProgressId === d.id}
                    icon={<RotateCcw className="w-3.5 h-3.5 text-emerald-600" />}
                  >
                    Re-Authorize
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestDelete(d.id, d.deviceName)}
                    disabled={actionInProgressId === d.id}
                    icon={<Trash2 className="w-3.5 h-3.5 text-slate-400" />}
                    title="Delete permanently"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Info Card */}
      <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border text-xs text-parish-text-muted flex items-start gap-3">
        <Info className="w-4 h-4 text-parish-primary shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>How Terminal Security Works:</strong> When an office desktop, pastoral laptop, or tablet accesses this portal for the first time, it registers a cryptographic hardware token with the parish. Once approved by the Parish Priest, the machine is authorized for all staff members who have valid user accounts. Revoking a terminal blocks all access from that physical machine across Google Chrome, Microsoft Edge, and all other browsers immediately.
        </div>
      </div>

      {/* In-App Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        isLoading={actionInProgressId !== null}
      />
    </div>
  );
};

