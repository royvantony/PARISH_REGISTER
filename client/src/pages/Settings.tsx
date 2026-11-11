import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  MapPin,
  Plus,
  Search,
  Database,
  Server,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  Trash2,
  Edit2,
  X,
  Palette,
  Check,
  Church,
  Building2,
  Globe,
  Phone,
  Mail,
  FileText,
  Sliders,
  ShieldCheck,
  ArrowRight,
  Eye,
  UserCheck,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';
import { useTheme, type ThemeId } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { DeveloperControlsTab } from '../components/settings/DeveloperControlsTab';
import { EmailSmtpTab } from '../components/settings/EmailSmtpTab';
import { ActivityLogsTab } from '../components/settings/ActivityLogsTab';
import { ShieldAlert, Shield } from 'lucide-react';

interface SystemHealthResponse {

  status: 'healthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  database: {
    status: 'connected' | 'disconnected';
    engine: string;
    latencyMs: number | null;
    error: string | null;
  };
}

interface DioceseItem {
  id: number;
  dioceseName: string;
  stateInIndia: string;
  rite: string;
}

const COMMON_STATES = [
  'Kerala',
  'Tamil Nadu',
  'Karnataka',
  'Maharashtra',
  'Telangana',
  'Delhi / NCR',
  'Madhya Pradesh',
  'Gujarat',
  'Uttar Pradesh',
  'Uttarakhand',
  'Chhattisgarh',
  'Haryana / NCR',
  'West Bengal',
  'Other',
];

const COMMON_RITES = [
  'Syro-Malabar',
  'Syro-Malabar / Knanaya',
  'Syro-Malankara',
  'Latin Catholic',
  'Other Catholic Rite',
];

const AUSTRALIAN_STATES = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

interface GoverningDioceseForm {
  id?: number;
  dioceseName: string;
  rite: string;
  bishopName: string;
  chanceryAddress: string;
  city: string;
  state: string;
  postalCode: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  logoUrl: string;
}

interface ParishSettingsForm {
  id: number;
  parishCode: string;
  parishName: string;
  city: string;
  state: string;
  postalCode: string;
  contactEmail: string;
  contactPhone: string;
  idPrefix: string;
  nextFamilyNumber: number;
  isActive: boolean;
  priestName: string;
  priestEmail: string;
  priestPhone: string;
  logoUrl: string;
}

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, availableThemes } = useTheme();
  const {
    user,
    refreshDiocese,
    refreshParishes,
    activeParish,
    hasPermission,
  } = useAuth();
  const { isFeatureEnabled, isDeveloper, getStoredFlag, isSimulatingClient } = useFeatures();
  const isDev = (isDeveloper || user?.role === 'SUPER_ADMIN') && !isSimulatingClient;
  const [activeSubTab, setActiveSubTab] = useState<'governing' | 'dioceses' | 'email' | 'general' | 'logs' | 'developer'>('governing');

  // Sync tab from URL query params (e.g. /settings?tab=developer)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'developer' && (isDeveloper || user?.role === 'SUPER_ADMIN')) {
      setActiveSubTab('developer');
    } else if (tabParam === 'email') {
      setActiveSubTab('email');
    } else if (tabParam === 'logs') {
      setActiveSubTab('logs');
    } else if (tabParam === 'dioceses' && (isDev || isFeatureEnabled('SETTING_NATIVE_DIOCESES'))) {
      setActiveSubTab('dioceses');
    } else if (tabParam === 'general' && (isDev || isFeatureEnabled('SETTING_SYSTEM_HEALTH'))) {
      setActiveSubTab('general');
    }
  }, [isDev, isDeveloper, isFeatureEnabled, user?.role]);

  const [dioceses, setDioceses] = useState<DioceseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Permissions Matrix Access (Strictly matrix-based)
  const canEditDiocese =
    user?.role === 'SUPER_ADMIN' ||
    hasPermission('SETTINGS', 'canEdit');

  // Modals visibility state
  const [isDioceseModalOpen, setIsDioceseModalOpen] = useState(false);
  const [isParishModalOpen, setIsParishModalOpen] = useState(false);

  // Governing Diocese State
  const [governingData, setGoverningData] = useState<GoverningDioceseForm>({
    dioceseName: '',
    rite: 'Syro-Malabar',
    bishopName: '',
    chanceryAddress: '',
    city: '',
    state: 'VIC',
    postalCode: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    logoUrl: '/branding/logo.png',
  });
  const [initialGovData, setInitialGovData] = useState<GoverningDioceseForm | null>(null);
  const [isGovLoading, setIsGovLoading] = useState(false);
  const [isGovSaving, setIsGovSaving] = useState(false);
  const [govError, setGovError] = useState<string | null>(null);
  const [govSuccess, setGovSuccess] = useState<string | null>(null);

  // Parish Settings State - Locked to Active Parish chosen at login
  const selectedParishId = activeParish?.id || user?.parishId || 1;
  const [parishFormData, setParishFormData] = useState<ParishSettingsForm>({
    id: activeParish?.id || 1,
    parishCode: activeParish?.parishCode || 'SABN',
    parishName: activeParish?.parishName || 'St. Alphonsa Syro-Malabar Catholic Parish',
    city: activeParish?.city || 'Brisbane North',
    state: activeParish?.state || 'QLD',
    postalCode: activeParish?.postalCode || '4034',
    contactEmail: activeParish?.contactEmail || '',
    contactPhone: activeParish?.contactPhone || '',
    idPrefix: activeParish?.idPrefix || 'SABN',
    nextFamilyNumber: activeParish?.nextFamilyNumber || 100001,
    isActive: activeParish?.isActive ?? true,
    priestName: activeParish?.priestName || '',
    priestEmail: activeParish?.priestEmail || '',
    priestPhone: activeParish?.priestPhone || '',
    logoUrl: activeParish?.logoUrl || '',
  });
  const [initialParishData, setInitialParishData] = useState<ParishSettingsForm | null>(null);
  const [isParishLoading, setIsParishLoading] = useState(false);
  const [isParishSaving, setIsParishSaving] = useState(false);
  const [parishError, setParishError] = useState<string | null>(null);
  const [parishSuccess, setParishSuccess] = useState<string | null>(null);

  const canEditParish =
    user?.role === 'SUPER_ADMIN' ||
    hasPermission('SETTINGS', 'canEdit');

  // Search & Filter state for Dioceses
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiteFilter, setSelectedRiteFilter] = useState<string>('ALL');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');

  // Add/Edit Diocese Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiocese, setEditingDiocese] = useState<DioceseItem | null>(null);
  const [dioceseName, setDioceseName] = useState('');
  const [stateInIndia, setStateInIndia] = useState('Kerala');
  const [rite, setRite] = useState('Syro-Malabar');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete Diocese State
  const [dioceseToDelete, setDioceseToDelete] = useState<DioceseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // System Health Telemetry State
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const fetchDioceses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<DioceseItem[]>('/masters/dioceses');
      setDioceses(res.data);
    } catch (err) {
      console.error('Failed to load dioceses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    setHealthError(null);
    try {
      const res = await api.get<SystemHealthResponse>('/health');
      setHealthData(res.data);
      setLastCheckedAt(new Date());
    } catch (err: any) {
      console.error('Failed to fetch system health:', err);
      setHealthError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Unable to reach API server'
      );
      setLastCheckedAt(new Date());
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  const fetchGoverningDiocese = useCallback(async () => {
    setIsGovLoading(true);
    setGovError(null);
    try {
      const res = await api.get('/masters/governing-diocese');
      if (res.data) {
        const d: GoverningDioceseForm = {
          id: res.data.id,
          dioceseName: res.data.dioceseName || '',
          rite: res.data.rite || 'Syro-Malabar',
          bishopName: res.data.bishopName || '',
          chanceryAddress: res.data.chanceryAddress || '',
          city: res.data.city || '',
          state: res.data.state || 'VIC',
          postalCode: res.data.postalCode || '',
          contactPhone: res.data.contactPhone || '',
          contactEmail: res.data.contactEmail || '',
          website: res.data.website || '',
          logoUrl: res.data.logoUrl || '/branding/logo.png',
        };
        setGoverningData(d);
        setInitialGovData(d);
      }
    } catch (err: any) {
      console.error('Failed to fetch governing diocese:', err);
      setGovError('Failed to load governing diocese details.');
    } finally {
      setIsGovLoading(false);
    }
  }, []);

  const handleSaveGoverningDiocese = async () => {
    if (!governingData.dioceseName.trim()) {
      setGovError('Diocese legal title is required.');
      return;
    }
    setIsGovSaving(true);
    setGovError(null);
    setGovSuccess(null);
    try {
      const res = await api.put('/masters/governing-diocese', governingData);
      if (res.data) {
        const d: GoverningDioceseForm = {
          id: res.data.id,
          dioceseName: res.data.dioceseName || '',
          rite: res.data.rite || 'Syro-Malabar',
          bishopName: res.data.bishopName || '',
          chanceryAddress: res.data.chanceryAddress || '',
          city: res.data.city || '',
          state: res.data.state || 'VIC',
          postalCode: res.data.postalCode || '',
          contactPhone: res.data.contactPhone || '',
          contactEmail: res.data.contactEmail || '',
          website: res.data.website || '',
          logoUrl: res.data.logoUrl || '/branding/logo.png',
        };
        setGoverningData(d);
        setInitialGovData(d);
        await refreshDiocese();
        setGovSuccess('Official Governing Diocese details saved to database and synchronized across the application.');
        setTimeout(() => setGovSuccess(null), 6000);
      }
    } catch (err: any) {
      console.error('Failed to save governing diocese:', err);
      setGovError(err.response?.data?.error || 'Failed to update governing diocese.');
    } finally {
      setIsGovSaving(false);
    }
  };

  const handleResetGoverningDiocese = () => {
    if (initialGovData) {
      setGoverningData({ ...initialGovData });
      setGovError(null);
      setGovSuccess(null);
    }
  };

  const fetchParishDetails = useCallback(async (parishId: number) => {
    setIsParishLoading(true);
    setParishError(null);
    try {
      const res = await api.get<any>(`/masters/parishes/${parishId}`);
      if (res.data) {
        const p: ParishSettingsForm = {
          id: res.data.id,
          parishCode: res.data.parishCode || '',
          parishName: res.data.parishName || '',
          city: res.data.city || '',
          state: res.data.state || 'QLD',
          postalCode: res.data.postalCode || '',
          contactEmail: res.data.contactEmail || '',
          contactPhone: res.data.contactPhone || '',
          idPrefix: res.data.idPrefix || res.data.parishCode || 'SABN',
          nextFamilyNumber: res.data.nextFamilyNumber || 100001,
          isActive: res.data.isActive ?? true,
          priestName: res.data.priestName || '',
          priestEmail: res.data.priestEmail || '',
          priestPhone: res.data.priestPhone || '',
          logoUrl: res.data.logoUrl || '',
        };
        setParishFormData(p);
        setInitialParishData(p);
      }
    } catch (err: any) {
      console.error('Failed to load parish details:', err);
      setParishError(err.response?.data?.error || 'Failed to fetch parish details.');
    } finally {
      setIsParishLoading(false);
    }
  }, []);

  const handleSaveParish = async () => {
    if (!parishFormData.parishName.trim()) {
      setParishError('Parish name is required.');
      return;
    }
    if (!parishFormData.city.trim()) {
      setParishError('City is required.');
      return;
    }
    if (!parishFormData.state.trim()) {
      setParishError('State is required.');
      return;
    }

    setIsParishSaving(true);
    setParishError(null);
    setParishSuccess(null);
    try {
      const res = await api.put(`/masters/parishes/${selectedParishId}`, parishFormData);
      if (res.data) {
        const p: ParishSettingsForm = {
          id: res.data.id,
          parishCode: res.data.parishCode || '',
          parishName: res.data.parishName || '',
          city: res.data.city || '',
          state: res.data.state || 'QLD',
          postalCode: res.data.postalCode || '',
          contactEmail: res.data.contactEmail || '',
          contactPhone: res.data.contactPhone || '',
          idPrefix: res.data.idPrefix || res.data.parishCode || 'SABN',
          nextFamilyNumber: res.data.nextFamilyNumber || 100001,
          isActive: res.data.isActive ?? true,
          priestName: res.data.priestName || '',
          priestEmail: res.data.priestEmail || '',
          priestPhone: res.data.priestPhone || '',
          logoUrl: res.data.logoUrl || '',
        };
        setParishFormData(p);
        setInitialParishData(p);
        await refreshParishes();
        setParishSuccess(`Parish settings for "${res.data.parishName}" updated successfully.`);
        setTimeout(() => setParishSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to update parish settings:', err);
      setParishError(err.response?.data?.error || 'Failed to update parish settings.');
    } finally {
      setIsParishSaving(false);
    }
  };

  const handleResetParish = () => {
    if (initialParishData) {
      setParishFormData({ ...initialParishData });
      setParishError(null);
      setParishSuccess(null);
    }
  };

  useEffect(() => {
    fetchGoverningDiocese();
    fetchDioceses();
  }, [fetchGoverningDiocese, fetchDioceses]);

  useEffect(() => {
    if (selectedParishId) {
      fetchParishDetails(selectedParishId);
    }
  }, [selectedParishId, fetchParishDetails]);

  // Fetch health telemetry automatically when switching to General Configurations tab
  useEffect(() => {
    if (activeSubTab === 'general' && !healthData && !isCheckingHealth) {
      fetchHealth();
    }
  }, [activeSubTab, healthData, isCheckingHealth, fetchHealth]);

  // Open modal for Adding
  const handleOpenAddModal = () => {
    setEditingDiocese(null);
    setDioceseName('');
    setStateInIndia('Kerala');
    setRite('Syro-Malabar');
    setSaveError(null);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEditModal = (d: DioceseItem) => {
    setEditingDiocese(d);
    setDioceseName(d.dioceseName);
    setStateInIndia(d.stateInIndia || 'Kerala');
    setRite(d.rite || 'Syro-Malabar');
    setSaveError(null);
    setIsModalOpen(true);
  };

  // Handle Add/Edit Diocese submit with duplicate check
  const validateDiocese = (): boolean => {
    const trimmed = dioceseName.trim();
    if (!trimmed) {
      setSaveError('Please enter a diocese or eparchy name.');
      return false;
    }

    // Client-side duplicate check (case-insensitive, ignoring surrounding whitespace)
    const isDuplicate = dioceses.some(
      (d) =>
        d.dioceseName.trim().toLowerCase() === trimmed.toLowerCase() &&
        (!editingDiocese || d.id !== editingDiocese.id)
    );

    if (isDuplicate) {
      setSaveError(`A diocese named "${trimmed}" already exists in the master list.`);
      return false;
    }
    return true;
  };

  const handleSaveDiocese = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!validateDiocese()) return;

    const trimmed = dioceseName.trim();
    setIsSaving(true);
    setSaveError(null);
    try {
      if (editingDiocese) {
        await api.put(`/masters/dioceses/${editingDiocese.id}`, {
          dioceseName: trimmed,
          stateInIndia: stateInIndia.trim() || 'Kerala',
          rite: rite.trim() || 'Syro-Malabar',
        });
      } else {
        await api.post('/masters/dioceses', {
          dioceseName: trimmed,
          stateInIndia: stateInIndia.trim() || 'Kerala',
          rite: rite.trim() || 'Syro-Malabar',
        });
      }

      // Refresh list & close modal
      await fetchDioceses();
      setIsModalOpen(false);
      setEditingDiocese(null);
      setDioceseName('');
      setStateInIndia('Kerala');
      setRite('Syro-Malabar');
    } catch (err: any) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to save diocese.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Diocese
  const handleDeleteDiocese = async () => {
    if (!dioceseToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/masters/dioceses/${dioceseToDelete.id}`);
      await fetchDioceses();
      setDioceseToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete diocese:', err);
      alert(err.response?.data?.error || 'Failed to delete diocese.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamically gather all unique  rites with exact counts
  const availableRites = useMemo(() => {
    const riteSet = new Set<string>(COMMON_RITES);
    dioceses.forEach((d) => {
      if (d.rite && d.rite.trim()) {
        riteSet.add(d.rite.trim());
      }
    });

    return Array.from(riteSet)
      .map((rite) => ({
        name: rite,
        count: dioceses.filter((d) => d.rite === rite).length,
      }))
      .filter((r) => r.count > 0 || COMMON_RITES.includes(r.name));
  }, [dioceses]);

  // Dynamically gather all unique states in India with exact counts
  const availableStates = useMemo(() => {
    const stateMap = new Map<string, number>();
    dioceses.forEach((d) => {
      const stateName = d.stateInIndia || 'Unknown';
      stateMap.set(stateName, (stateMap.get(stateName) || 0) + 1);
    });

    return Array.from(stateMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [dioceses]);

  // Filtered dioceses list based on search, rite filter, and state filter
  const filteredDioceses = useMemo(() => {
    return dioceses.filter((d) => {
      const matchesSearch =
        searchQuery === '' ||
        d.dioceseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.stateInIndia.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.rite.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedRiteFilter !== 'ALL' && d.rite !== selectedRiteFilter) return false;
      if (selectedStateFilter !== 'ALL' && d.stateInIndia !== selectedStateFilter) return false;

      return true;
    });
  }, [dioceses, searchQuery, selectedRiteFilter, selectedStateFilter]);

  const getRiteBadgeVariant = (rite: string): 'info' | 'warning' | 'success' | 'subtle' => {
    if (rite.includes('Syro-Malabar')) return 'info';
    if (rite.includes('Syro-Malankara')) return 'warning';
    if (rite.includes('Latin')) return 'success';
    return 'subtle';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-parish-text">Settings & Master Data</h1>
        <p className="text-xs text-parish-text-muted mt-1">
          Parish configurations, system preferences, and reference tables.
        </p>
      </div>

      {/* Settings Sub-Navigation Tabs - Responsive Wrapping without Scrollbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-parish-surface border border-parish-border rounded-2xl shadow-2xs">
        <button
          onClick={() => setActiveSubTab('governing')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'governing'
            ? 'bg-white dark:bg-slate-800 text-parish-primary shadow-xs border border-parish-border/70'
            : 'text-parish-text-muted hover:text-parish-text hover:bg-white/60'
            }`}
        >
          <Church className="w-3.5 h-3.5" />
          <span>Diocese & Parish</span>
        </button>

        {(isDev || isFeatureEnabled('SETTING_NATIVE_DIOCESES')) && (
          <button
            onClick={() => setActiveSubTab('dioceses')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'dioceses'
              ? 'bg-white dark:bg-slate-800 text-parish-primary shadow-xs border border-parish-border/70'
              : 'text-parish-text-muted hover:text-parish-text hover:bg-white/60'
              }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Origin Dioceses</span>
            <span className="text-[10px] bg-parish-primary/10 text-parish-primary px-1.5 py-0.5 rounded-full font-mono font-semibold">
              {dioceses.length}
            </span>
            {isDev && !getStoredFlag('SETTING_NATIVE_DIOCESES') && (
              <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded font-mono">Hidden</span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('email')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'email'
            ? 'bg-white dark:bg-slate-800 text-parish-primary shadow-xs border border-parish-border/70'
            : 'text-parish-text-muted hover:text-parish-text hover:bg-white/60'
            }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email & SMTP</span>
        </button>

        {(isDev || isFeatureEnabled('SETTING_SYSTEM_HEALTH')) && (
          <button
            onClick={() => setActiveSubTab('general')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'general'
              ? 'bg-white dark:bg-slate-800 text-parish-primary shadow-xs border border-parish-border/70'
              : 'text-parish-text-muted hover:text-parish-text hover:bg-white/60'
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>System Health</span>
            {isDev && !getStoredFlag('SETTING_SYSTEM_HEALTH') && (
              <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded font-mono">Hidden</span>
            )}
          </button>
        )}

        {(isDev || (isFeatureEnabled('SETTING_ACTIVITY_LOGS') && hasPermission('AUDIT_LOGS', 'canView'))) && (
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'logs'
              ? 'bg-white dark:bg-slate-800 text-parish-primary shadow-xs border border-parish-border/70'
              : 'text-parish-text-muted hover:text-parish-text hover:bg-white/60'
              }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Activity Logs</span>
            {isDev && !getStoredFlag('SETTING_ACTIVITY_LOGS') && (
              <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded font-mono">Hidden</span>
            )}
          </button>
        )}

        {(isDeveloper || user?.role === 'SUPER_ADMIN') && (
          <button
            onClick={() => setActiveSubTab('developer')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'developer'
              ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs border border-amber-300/80 font-extrabold'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50/60'
              }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Developer</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">DEV</span>
          </button>
        )}
      </div>


      {activeSubTab === 'governing' && (
        <div className="space-y-6">
          {/* Notification Banners */}
          {govSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{govSuccess}</span>
            </div>
          )}

          {parishSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{parishSuccess}</span>
            </div>
          )}

          {/* Settings Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Diocesan Settings */}
            {(isDev || isFeatureEnabled('SETTING_DIOCESE_BOX')) && (
              <div
                onClick={() => setIsDioceseModalOpen(true)}
                className={`group relative bg-parish-surface border hover:border-parish-primary/50 rounded-2xl p-6 shadow-soft hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isDev && !getStoredFlag('SETTING_DIOCESE_BOX')
                    ? 'border-dashed border-amber-300 dark:border-amber-700/60'
                    : 'border-parish-border'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-parish-primary-light text-parish-primary flex items-center justify-center shrink-0 border border-parish-primary/20 shadow-xs group-hover:scale-105 transition-transform">
                        <Church className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-parish-text group-hover:text-parish-primary transition-colors">
                            Diocesan Settings
                          </h3>
                          {isDev && !getStoredFlag('SETTING_DIOCESE_BOX') && (
                            <Badge variant="warning" size="sm">Hidden from Users</Badge>
                          )}
                        </div>
                        <p className="text-xs text-parish-text-muted">
                          National Governing Eparchy
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="info" size="sm">{governingData.rite || 'Syro-Malabar'}</Badge>
                      {canEditDiocese ? (
                        <Badge variant="outline" size="sm">Admin</Badge>
                      ) : (
                        <Badge variant="subtle" size="sm">Read-only</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 bg-parish-surface-subtle p-3.5 rounded-xl border border-parish-border text-xs mb-4">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-parish-text-muted font-medium">Jurisdiction:</span>
                      <span className="font-semibold text-parish-text text-right truncate max-w-[220px]">
                        {governingData.dioceseName || 'National Diocese'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-parish-text-muted font-medium">Ruling Bishop:</span>
                      <span className="font-semibold text-parish-text">
                        {governingData.bishopName || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-parish-text-muted font-medium">Chancery:</span>
                      <span className="font-medium text-parish-text">
                        {governingData.city ? `${governingData.city}, ${governingData.state}` : 'Melbourne, VIC'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-parish-text-muted font-medium">Contact:</span>
                      <span className="font-medium text-parish-text truncate max-w-[200px]">
                        {governingData.contactEmail || governingData.contactPhone || 'No contact set'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-parish-border/60 flex items-center justify-between">
                  <span className="text-xs text-parish-text-muted">
                    {canEditDiocese ? 'Click to configure chancery details' : 'Click to view chancery details'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-parish-primary group-hover:translate-x-1 transition-transform">
                    {canEditDiocese ? (
                      <>
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Diocese</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Diocese</span>
                      </>
                    )}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            )}

            {/* Card 2: Parish Settings */}
            {(isDev || isFeatureEnabled('SETTING_PARISH_BOX')) && (
              <div
                onClick={() => setIsParishModalOpen(true)}
                className={`group relative bg-parish-surface border hover:border-parish-primary/50 rounded-2xl p-6 shadow-soft hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isDev && !getStoredFlag('SETTING_PARISH_BOX')
                    ? 'border-dashed border-amber-300 dark:border-amber-700/60'
                    : 'border-parish-border'
                }`}
              >

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60 shadow-xs group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-parish-text group-hover:text-parish-primary transition-colors">
                          Parish Settings
                        </h3>
                        {isDev && !getStoredFlag('SETTING_PARISH_BOX') && (
                          <Badge variant="warning" size="sm">Hidden from Users</Badge>
                        )}
                      </div>
                      <p className="text-xs text-parish-text-muted">
                        Active Parish Profile &amp; Numbering Rules
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="success" size="sm">{parishFormData.parishCode}</Badge>
                    {canEditParish ? (
                      <Badge variant="outline" size="sm">Admin</Badge>
                    ) : (
                      <Badge variant="subtle" size="sm">Read-only</Badge>
                    )}
                  </div>
                </div>

                {/* Session Parish Indicator (No Switcher - Locked to Login Choice) */}
                <div className="mb-3 px-3 py-2 bg-parish-surface-subtle border border-parish-border rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md border border-parish-border bg-white flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                      <img
                        src={parishFormData.logoUrl?.trim() || `/branding/parishes/${(parishFormData.parishCode || 'SABN').toUpperCase()}.png`}
                        alt="Parish Seal"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/branding/logo.png';
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-parish-text-muted">
                      <Lock className="w-3 h-3" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Active Parish:</span>
                    </div>
                  </div>
                  <span className="font-bold text-parish-primary truncate max-w-[200px]" title={parishFormData.parishName}>
                    {parishFormData.parishName} ({parishFormData.parishCode})
                  </span>
                </div>

                <div className="space-y-2 bg-parish-surface-subtle p-3.5 rounded-xl border border-parish-border text-xs mb-4">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-parish-text-muted font-medium">Parish Priest:</span>
                    <span className="font-semibold text-parish-text truncate max-w-[200px]">
                      {parishFormData.priestName || 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-parish-text-muted font-medium">Priest Contact:</span>
                    <span className="font-medium text-parish-text truncate max-w-[200px]">
                      {parishFormData.priestPhone || parishFormData.priestEmail || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-parish-text-muted font-medium">Location:</span>
                    <span className="font-medium text-parish-text">
                      {parishFormData.city}, {parishFormData.state} {parishFormData.postalCode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-parish-text-muted font-medium">ID Prefix &amp; Next #:</span>
                    <span className="font-mono font-bold text-parish-primary">
                      {parishFormData.idPrefix}-{parishFormData.nextFamilyNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-parish-text-muted font-medium">Office Email:</span>
                    <span className="font-medium text-parish-text truncate max-w-[200px]">
                      {parishFormData.contactEmail || 'No office email set'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-parish-border/60 flex items-center justify-between">
                <span className="text-xs text-parish-text-muted">
                  {canEditParish ? 'Click to configure parish settings' : 'Click to view parish profile'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-parish-primary group-hover:translate-x-1 transition-transform">
                  {canEditParish ? (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Parish</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Parish</span>
                    </>
                  )}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}
        </div>

        {!isDev && !isFeatureEnabled('SETTING_DIOCESE_BOX') && !isFeatureEnabled('SETTING_PARISH_BOX') && (
          <div className="p-8 rounded-2xl bg-parish-surface border border-parish-border text-center text-parish-text-muted text-xs space-y-1">
            <p className="font-semibold text-parish-text">No active configuration panels</p>
            <p>Diocese and Parish profile settings are currently managed centrally by the chancery administration.</p>
          </div>
        )}


          {/* Modal 1: Diocesan Settings Modal */}
          <Modal
            isOpen={isDioceseModalOpen}
            onClose={() => setIsDioceseModalOpen(false)}
            title="Governing Diocese / Eparchy Settings"
            description="Official chancery headquarters and episcopal governance for Australia"
            maxWidth="3xl"
          >
            <div className="space-y-5 py-2">
              {govSuccess && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{govSuccess}</span>
                </div>
              )}

              {govError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{govError}</span>
                </div>
              )}

              {isGovLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-parish-text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin text-parish-primary" />
                  <span className="text-xs font-semibold">Loading official diocese records...</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canEditDiocese) handleSaveGoverningDiocese();
                  }}
                  className="space-y-5"
                >
                  {/* Episcopal Governance */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Episcopal &amp; Jurisdictional Governance</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div className="md:col-span-2">
                        <Input
                          label="Diocese / Eparchy Legal Title"
                          value={governingData.dioceseName}
                          onChange={(e) => setGoverningData({ ...governingData, dioceseName: e.target.value })}
                          disabled={!canEditDiocese || isGovSaving}
                          required
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-parish-text tracking-wide uppercase mb-1.5">
                          Rite / Tradition
                        </label>
                        <select
                          value={governingData.rite}
                          onChange={(e) => setGoverningData({ ...governingData, rite: e.target.value })}
                          disabled={!canEditDiocese || isGovSaving}
                          className="w-full bg-parish-surface text-parish-text text-xs rounded-lg border border-parish-border px-3 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary"
                        >
                          {COMMON_RITES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <Input
                          label="Ruling Bishop / Eparch Name"
                          value={governingData.bishopName}
                          onChange={(e) => setGoverningData({ ...governingData, bishopName: e.target.value })}
                          disabled={!canEditDiocese || isGovSaving}
                          placeholder="e.g. Bishop John Panamthottathil"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chancery Headquarters */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Chancery Headquarters &amp; Physical Address</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                      <div className="md:col-span-2">
                        <Input
                          label="Chancery Street Address"
                          value={governingData.chanceryAddress}
                          onChange={(e) => setGoverningData({ ...governingData, chanceryAddress: e.target.value })}
                          disabled={!canEditDiocese || isGovSaving}
                          placeholder="e.g. 62 Moore Rd"
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <Input
                          label="City / Suburb"
                          value={governingData.city}
                          onChange={(e) => setGoverningData({ ...governingData, city: e.target.value })}
                          disabled={!canEditDiocese || isGovSaving}
                          placeholder="e.g. Mill Park / Melbourne"
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-parish-text tracking-wide uppercase mb-1.5">
                            State
                          </label>
                          <select
                            value={governingData.state}
                            onChange={(e) => setGoverningData({ ...governingData, state: e.target.value })}
                            disabled={!canEditDiocese || isGovSaving}
                            className="w-full bg-parish-surface text-parish-text text-xs rounded-lg border border-parish-border px-2 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary"
                          >
                            {AUSTRALIAN_STATES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Input
                            label="Postcode"
                            value={governingData.postalCode}
                            onChange={(e) => setGoverningData({ ...governingData, postalCode: e.target.value })}
                            disabled={!canEditDiocese || isGovSaving}
                            placeholder="3082"
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Communications */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Official Communications &amp; Crest</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <Input
                        label="Chancery Contact Phone"
                        icon={<Phone className="w-3.5 h-3.5" />}
                        value={governingData.contactPhone}
                        onChange={(e) => setGoverningData({ ...governingData, contactPhone: e.target.value })}
                        disabled={!canEditDiocese || isGovSaving}
                        placeholder="+61 3 9404 1533"
                        className="text-xs"
                      />

                      <Input
                        label="Official Chancery Email"
                        icon={<Mail className="w-3.5 h-3.5" />}
                        type="email"
                        value={governingData.contactEmail}
                        onChange={(e) => setGoverningData({ ...governingData, contactEmail: e.target.value })}
                        disabled={!canEditDiocese || isGovSaving}
                        placeholder="chancery@syromalabar.org.au"
                        className="text-xs"
                      />

                      <Input
                        label="Official Website URL"
                        icon={<Globe className="w-3.5 h-3.5" />}
                        value={governingData.website}
                        onChange={(e) => setGoverningData({ ...governingData, website: e.target.value })}
                        disabled={!canEditDiocese || isGovSaving}
                        placeholder="https://syromalabar.org.au"
                        className="text-xs"
                      />

                      <Input
                        label="Diocesan Crest / Logo URL"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        value={governingData.logoUrl}
                        onChange={(e) => setGoverningData({ ...governingData, logoUrl: e.target.value })}
                        disabled={!canEditDiocese || isGovSaving}
                        placeholder="/branding/logo.png"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-4 border-t border-parish-border flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-parish-text-muted">
                      {canEditDiocese ? (
                        <span>💡 Updates official database records and letterheads.</span>
                      ) : (
                        <span className="text-amber-600 font-medium">🔒 View-only mode. Diocesan Administrator privileges required.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDioceseModalOpen(false)}
                      >
                        Close
                      </Button>

                      {canEditDiocese && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResetGoverningDiocese}
                            disabled={isGovSaving}
                          >
                            Reset
                          </Button>

                          <ConfirmButton
                            variant="primary"
                            size="sm"
                            onConfirm={async () => {
                              await handleSaveGoverningDiocese();
                              setIsDioceseModalOpen(false);
                            }}
                            beforeConfirm={() => !!governingData.dioceseName.trim()}
                            isLoading={isGovSaving}
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            confirmLabel="Confirm Update Database?"
                          >
                            Save Diocese Details
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </Modal>

          {/* Modal 2: Parish Settings Modal */}
          <Modal
            isOpen={isParishModalOpen}
            onClose={() => setIsParishModalOpen(false)}
            title={`Parish Settings: ${parishFormData.parishName}`}
            description="Configure parish profile, pastoral leadership, registry prefixes, and contact details."
            maxWidth="3xl"
          >
            <div className="space-y-5 py-2">
              {/* Active Parish Locked Indicator */}
              <div className="bg-parish-surface-subtle p-3 rounded-xl border border-parish-border flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-parish-primary shrink-0" />
                  <span className="font-bold text-parish-text">Parish Session:</span>
                  <span className="font-semibold text-parish-primary">{parishFormData.parishName} ({parishFormData.parishCode})</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-parish-text-muted">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked to login selection</span>
                </div>
              </div>

              {parishSuccess && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{parishSuccess}</span>
                </div>
              )}

              {parishError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{parishError}</span>
                </div>
              )}

              {isParishLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-parish-text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin text-parish-primary" />
                  <span className="text-xs font-semibold">Loading parish settings...</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canEditParish) handleSaveParish();
                  }}
                  className="space-y-5"
                >
                  {/* Parish Identity */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Parish Identity &amp; System Codes</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div className="md:col-span-2">
                        <Input
                          label="Parish Official Name"
                          value={parishFormData.parishName}
                          onChange={(e) => setParishFormData({ ...parishFormData, parishName: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          required
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <Input
                          label="Diocesan Parish Code"
                          value={parishFormData.parishCode}
                          disabled={true}
                          readOnly
                          className="text-xs font-mono font-bold uppercase bg-parish-surface-subtle"
                        />
                        <span className="text-[10px] text-parish-text-muted mt-0.5 block">
                          Assigned systematically by diocese
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parish Priest & Clergy Leadership */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Parish Priest &amp; Clergy Leadership</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div>
                        <Input
                          label="Parish Priest / Vicar Full Name"
                          value={parishFormData.priestName}
                          onChange={(e) => setParishFormData({ ...parishFormData, priestName: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder="e.g. Fr. Abraham Mathew"
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <Input
                          label="Priest Contact Phone"
                          icon={<Phone className="w-3.5 h-3.5" />}
                          value={parishFormData.priestPhone}
                          onChange={(e) => setParishFormData({ ...parishFormData, priestPhone: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder="e.g. +61 488 752 642"
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <Input
                          label="Priest Official Email"
                          icon={<Mail className="w-3.5 h-3.5" />}
                          type="email"
                          value={parishFormData.priestEmail}
                          onChange={(e) => setParishFormData({ ...parishFormData, priestEmail: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder="e.g. priest@stalphonsabrisbane.org.au"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Registry Numbering & Family ID */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Member &amp; Family ID Numbering Series</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <Input
                          label="Family ID Prefix (e.g. SABN)"
                          value={parishFormData.idPrefix}
                          onChange={(e) => setParishFormData({ ...parishFormData, idPrefix: e.target.value.toUpperCase() })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder="e.g. SABN"
                          className="text-xs font-mono font-bold uppercase"
                          required
                        />
                        <span className="text-[10px] text-parish-text-muted mt-0.5 block">
                          Prefix for newly registered family codes
                        </span>
                      </div>

                      <div>
                        <Input
                          label="Next Family Number Sequence"
                          type="number"
                          value={parishFormData.nextFamilyNumber}
                          onChange={(e) => setParishFormData({ ...parishFormData, nextFamilyNumber: parseInt(e.target.value, 10) || 100001 })}
                          disabled={!canEditParish || isParishSaving}
                          className="text-xs font-mono font-bold"
                          required
                        />
                        <span className="text-[10px] text-parish-text-muted mt-0.5 block">
                          Current counter: Next code will be {parishFormData.idPrefix}-{parishFormData.nextFamilyNumber}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Location & Address */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Parish Location &amp; Region</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div>
                        <Input
                          label="City / Suburb"
                          value={parishFormData.city}
                          onChange={(e) => setParishFormData({ ...parishFormData, city: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          required
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-parish-text tracking-wide uppercase mb-1.5">
                          State / Territory
                        </label>
                        <select
                          value={parishFormData.state}
                          onChange={(e) => setParishFormData({ ...parishFormData, state: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          className="w-full bg-parish-surface text-parish-text text-xs rounded-lg border border-parish-border px-3 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary"
                        >
                          {AUSTRALIAN_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Input
                          label="Postcode"
                          value={parishFormData.postalCode}
                          onChange={(e) => setParishFormData({ ...parishFormData, postalCode: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder="e.g. 4034"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Parish Office Communications</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <Input
                        label="Parish Office Contact Phone"
                        icon={<Phone className="w-3.5 h-3.5" />}
                        value={parishFormData.contactPhone}
                        onChange={(e) => setParishFormData({ ...parishFormData, contactPhone: e.target.value })}
                        disabled={!canEditParish || isParishSaving}
                        placeholder="e.g. +61 7 3263 2145"
                        className="text-xs"
                      />

                      <Input
                        label="Parish Office Email"
                        icon={<Mail className="w-3.5 h-3.5" />}
                        type="email"
                        value={parishFormData.contactEmail}
                        onChange={(e) => setParishFormData({ ...parishFormData, contactEmail: e.target.value })}
                        disabled={!canEditParish || isParishSaving}
                        placeholder="e.g. office@alphonsabrisbane.org.au"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Parish Official Seal & Crest */}
                  <div className="space-y-3 pt-3 border-t border-parish-border/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-parish-text uppercase tracking-wider text-parish-primary">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Parish Official Seal &amp; Crest</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start gap-4 p-3.5 bg-parish-surface-subtle rounded-xl border border-parish-border">
                      <div className="w-16 h-16 rounded-xl border border-parish-border bg-white flex items-center justify-center p-1.5 shrink-0 shadow-sm overflow-hidden">
                        <img
                          src={
                            parishFormData.logoUrl?.trim() ||
                            `/branding/parishes/${(parishFormData.parishCode || 'SABN').toUpperCase()}.png`
                          }
                          alt="Parish Seal Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/branding/logo.png';
                          }}
                        />
                      </div>
                      <div className="flex-1 w-full space-y-1.5">
                        <Input
                          label="Custom Logo URL or Path"
                          icon={<Globe className="w-3.5 h-3.5" />}
                          value={parishFormData.logoUrl}
                          onChange={(e) => setParishFormData({ ...parishFormData, logoUrl: e.target.value })}
                          disabled={!canEditParish || isParishSaving}
                          placeholder={`/branding/parishes/${(parishFormData.parishCode || 'SABN').toUpperCase()}.png or https://...`}
                          className="text-xs"
                        />
                        <p className="text-[11px] text-parish-text-muted leading-relaxed">
                          Leave blank to use the standard convention <code className="font-mono text-parish-primary bg-parish-surface px-1 py-0.5 rounded border border-parish-border">/branding/parishes/{parishFormData.parishCode?.toUpperCase() || 'CODE'}.png</code>. If no parish logo file is uploaded, the system automatically falls back to the Diocesan chancery seal.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-4 border-t border-parish-border flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-parish-text-muted">
                      {canEditParish ? (
                        <span>💡 Updates parish master data across all administrative modules.</span>
                      ) : (
                        <span className="text-amber-600 font-medium">🔒 View-only mode. Parish Priest or Diocesan Administrator role required.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsParishModalOpen(false)}
                      >
                        Close
                      </Button>

                      {canEditParish && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResetParish}
                            disabled={isParishSaving}
                          >
                            Reset
                          </Button>

                          <ConfirmButton
                            variant="primary"
                            size="sm"
                            onConfirm={async () => {
                              await handleSaveParish();
                              setIsParishModalOpen(false);
                            }}
                            beforeConfirm={() => !!parishFormData.parishName.trim() && !!parishFormData.city.trim() && !!parishFormData.state.trim()}
                            isLoading={isParishSaving}
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            confirmLabel="Confirm Update Parish?"
                          >
                            Save Parish Settings
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </Modal>
        </div>
      )}

          {activeSubTab === 'dioceses' && (
            <div className="bg-parish-surface border border-parish-border rounded-2xl p-6 shadow-soft space-y-5">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-parish-border">
                <div>
                  <div className="text-sm font-bold text-parish-text flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-parish-primary" />
                    <span>Origin Dioceses in India</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenAddModal}
                >
                  Add Diocese
                </Button>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* Search Input */}
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Search diocese, state, or rite..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-4 h-4" />}
                    className="text-xs h-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns (Rite & State) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Ecclesiastical Rite Dropdown Filter */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedRiteFilter}
                      onChange={(e) => setSelectedRiteFilter(e.target.value)}
                      className="h-9 px-3 py-1 text-xs font-semibold rounded-xl bg-parish-surface-subtle border border-parish-border text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary transition-all cursor-pointer shadow-2xs hover:bg-[#eae3d5]"
                      aria-label="Filter by Ecclesiastical Rite"
                    >
                      <option value="ALL">All Ecclesiastical Rites ({dioceses.length})</option>
                      {availableRites.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} ({r.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* State in India Dropdown Filter */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedStateFilter}
                      onChange={(e) => setSelectedStateFilter(e.target.value)}
                      className="h-9 px-3 py-1 text-xs font-semibold rounded-xl bg-parish-surface-subtle border border-parish-border text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary transition-all cursor-pointer shadow-2xs hover:bg-[#eae3d5]"
                      aria-label="Filter by State in India"
                    >
                      <option value="ALL">All States ({dioceses.length})</option>
                      {availableStates.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} ({s.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reset button if any filter is active */}
                  {(selectedRiteFilter !== 'ALL' || selectedStateFilter !== 'ALL' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRiteFilter('ALL');
                        setSelectedStateFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="h-9 px-2 text-xs font-semibold text-parish-primary hover:text-parish-primary-hover hover:underline transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Dioceses Grid Cards */}
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-parish-surface-subtle animate-pulse border border-parish-border/60" />
                  ))}
                </div>
              ) : filteredDioceses.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-parish-border rounded-xl">
                  <MapPin className="w-8 h-8 text-parish-text-muted/40 mx-auto" />
                  <div className="text-sm font-semibold text-parish-text">No dioceses match your criteria</div>
                  <p className="text-xs text-parish-text-muted max-w-sm mx-auto">
                    {searchQuery
                      ? `No results found for "${searchQuery}". Try a different search term or clear the filter.`
                      : 'No dioceses currently registered for this selection.'}
                  </p>
                  {searchQuery && (
                    <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2">
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-parish-text-muted px-0.5">
                    <span>
                      Showing <strong className="text-parish-text">{filteredDioceses.length}</strong> of{' '}
                      <strong className="text-parish-text">{dioceses.length}</strong> registered dioceses
                    </span>
                    {searchQuery && (
                      <span className="italic">Filtered by &quot;{searchQuery}&quot;</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredDioceses.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleOpenEditModal(d)}
                        className="group relative p-3 rounded-xl border border-parish-border bg-parish-surface-subtle hover:bg-parish-surface hover:shadow-xs transition-all duration-150 flex flex-col justify-between space-y-2 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-parish-text leading-tight group-hover:text-parish-primary transition-colors">
                            {d.dioceseName}
                          </div>

                          {/* Edit and Delete action buttons */}
                          <div className="flex items-center gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 -mr-1 -mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(d);
                              }}
                              title={`Edit ${d.dioceseName}`}
                              className="p-1 text-parish-text-muted hover:text-parish-primary hover:bg-parish-border/40 rounded transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDioceseToDelete(d);
                              }}
                              title={`Remove ${d.dioceseName}`}
                              className="p-1 text-parish-text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-[10px] text-parish-text-muted flex items-center justify-between pt-1 border-t border-parish-border/40">
                          <span className="truncate max-w-[110px]" title={d.stateInIndia}>
                            {d.stateInIndia}
                          </span>
                          <Badge variant={getRiteBadgeVariant(d.rite)} size="sm" className="text-[9px] shrink-0">
                            {d.rite}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Add / Edit Diocese Modal Window */}
              <Modal
                isOpen={isModalOpen}
                onClose={() => {
                  if (!isSaving) {
                    setIsModalOpen(false);
                    setEditingDiocese(null);
                    setSaveError(null);
                  }
                }}
                title={editingDiocese ? 'Edit Indian Diocese / Eparchy' : 'Add Indian Diocese / Eparchy'}
                description={
                  editingDiocese
                    ? 'Update diocese name, Indian state, or ecclesiastical rite in the master reference table.'
                    : 'Register a canonical Catholic diocese to the master reference table for onboarding and verification.'
                }
                maxWidth="md"
              >
                <form onSubmit={handleSaveDiocese} className="space-y-4 pt-1">
                  {saveError && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  {/* Diocese Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-parish-text uppercase tracking-wide">
                      Diocese / Eparchy Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Mananthavady, Mandya, or Neyyattinkara"
                      value={dioceseName}
                      onChange={(e) => {
                        setDioceseName(e.target.value);
                        if (saveError) setSaveError(null);
                      }}
                      required
                      autoFocus
                    />
                  </div>

                  {/* State in India */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-parish-text uppercase tracking-wide">
                      State in India
                    </label>
                    <select
                      value={stateInIndia}
                      onChange={(e) => setStateInIndia(e.target.value)}
                      className="w-full bg-parish-surface text-parish-text text-sm rounded-lg border border-parish-border px-3 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary"
                    >
                      {COMMON_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ecclesiastical Rite */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-parish-text uppercase tracking-wide">
                      Ecclesiastical Rite
                    </label>
                    <select
                      value={rite}
                      onChange={(e) => setRite(e.target.value)}
                      className="w-full bg-parish-surface text-parish-text text-sm rounded-lg border border-parish-border px-3 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary"
                    >
                      {COMMON_RITES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-parish-border flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingDiocese(null);
                      }}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <ConfirmButton
                      variant="primary"
                      size="sm"
                      onConfirm={handleSaveDiocese}
                      beforeConfirm={validateDiocese}
                      isLoading={isSaving}
                      icon={editingDiocese ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      confirmLabel={editingDiocese ? 'Confirm Update?' : 'Confirm Save?'}
                    >
                      {editingDiocese ? 'Update Diocese' : 'Save Diocese'}
                    </ConfirmButton>
                  </div>
                </form>
              </Modal>

              {/* Delete Diocese Confirmation Dialog */}
              <ConfirmDialog
                isOpen={!!dioceseToDelete}
                onClose={() => setDioceseToDelete(null)}
                onConfirm={handleDeleteDiocese}
                title="Remove Diocese from Master Table"
                message={`Are you sure you want to remove '${dioceseToDelete?.dioceseName}' from the master dioceses list? Existing parishioner records will remain untouched.`}
                confirmLabel="Delete Diocese"
                variant="danger"
                isLoading={isDeleting}
              />
            </div>
          )}

          {activeSubTab === 'general' && (
            <div className="space-y-6">
              {/* Appearance & Colour Palette Themes Card */}
              <div className="bg-parish-surface border border-parish-border rounded-2xl p-6 shadow-soft space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-parish-border">
                  <div>
                    <div className="text-sm font-bold text-parish-text flex items-center gap-2">
                      <Palette className="w-4 h-4 text-parish-primary" />
                      <span>Appearance & Colour Themes</span>
                    </div>
                    <p className="text-xs text-parish-text-muted mt-0.5">
                      Select your preferred color scheme. The chosen theme applies instantly and persists across your browser sessions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {availableThemes.map((t) => {
                    const isSelected = t.id === theme;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id as ThemeId)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${isSelected
                          ? 'border-parish-primary bg-parish-primary-light/50 shadow-soft ring-2 ring-parish-primary/30'
                          : 'border-parish-border bg-parish-surface hover:border-parish-primary/50'
                          }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div
                              className="w-10 h-10 rounded-xl border border-black/10 p-1 flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: t.bgColor }}
                            >
                              <div className="flex items-center -space-x-1.5">
                                <span
                                  className="w-5 h-5 rounded-full border border-white/60 shadow-xs"
                                  style={{ backgroundColor: t.primaryColor }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-xs"
                                  style={{ backgroundColor: t.accentColor }}
                                />
                              </div>
                            </div>

                            {isSelected ? (
                              <Badge variant="default" size="sm" className="font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Active</span>
                              </Badge>
                            ) : (
                              <span className="text-[11px] font-semibold text-parish-text-muted hover:text-parish-primary">
                                Select
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-bold text-parish-text">{t.name}</div>
                            <div className="text-[11px] text-parish-text-muted mt-0.5">{t.tagline}</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-parish-border/60 flex items-center justify-between text-[11px]">
                          <span className="text-parish-text-muted">Palette:</span>
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                            <span>Primary</span>
                            <span className="inline-block w-2.5 h-2.5 rounded-full ml-1" style={{ backgroundColor: t.accentColor }} />
                            <span>Accent</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-parish-surface border border-parish-border rounded-2xl p-6 shadow-soft space-y-6">
                {/* Header & Refresh Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-parish-border">
                  <div>
                    <div className="text-sm font-bold text-parish-text flex items-center gap-2">
                      <Database className="w-4 h-4 text-parish-primary" />
                      <span>Parish System Environment & Health</span>
                    </div>
                    <p className="text-xs text-parish-text-muted mt-0.5">
                      Real-time operational status, service ping telemetry, and database connectivity.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {lastCheckedAt && (
                      <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last check: {lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchHealth}
                      isLoading={isCheckingHealth}
                      icon={<RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />}
                    >
                      Ping Telemetry
                    </Button>
                  </div>
                </div>

                {/* Overall Status Banner */}
                {healthError ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-50/80 border border-red-200/60 text-red-700">
                    <div className="flex items-center gap-2.5 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>API Service Unreachable: {healthError}</span>
                    </div>
                    <Badge variant="danger" size="sm">Offline</Badge>
                  </div>
                ) : healthData ? (
                  <div
                    className={`flex items-center justify-between p-3.5 rounded-xl border ${healthData.status === 'healthy'
                      ? 'bg-emerald-50/60 border-emerald-200/60 text-emerald-800'
                      : 'bg-amber-50/60 border-amber-200/60 text-amber-800'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${healthData.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${healthData.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                        />
                      </span>
                      <span>
                        {healthData.status === 'healthy'
                          ? 'All Services & Database Systems Operational'
                          : 'System Telemetry Warning / Degraded Mode'}
                      </span>
                    </div>
                    <Badge variant={healthData.status === 'healthy' ? 'success' : 'warning'} size="sm">
                      {healthData.status === 'healthy' ? 'Healthy' : 'Degraded'}
                    </Badge>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-parish-surface-subtle animate-pulse h-12" />
                )}

                {/* Service Environment Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Database Service Card */}
                  <div className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-parish-text">
                          <Database className="w-3.5 h-3.5 text-parish-primary" />
                          <span>PostgreSQL Database</span>
                        </div>
                        {healthData ? (
                          <Badge
                            variant={healthData.database.status === 'connected' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {healthData.database.status === 'connected' ? 'Connected' : 'Disconnected'}
                          </Badge>
                        ) : (
                          <Badge variant="subtle" size="sm">Checking...</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-parish-text-muted">
                        Engine: {healthData?.database.engine || 'PostgreSQL 16 (Local Docker)'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-parish-border/60 flex items-center justify-between text-[11px]">
                      <span className="text-parish-text-muted flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        Query Ping:
                      </span>
                      <span className="font-semibold text-parish-text">
                        {healthData?.database.latencyMs !== null && healthData?.database.latencyMs !== undefined
                          ? `${healthData.database.latencyMs} ms`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* API Backend Service Card */}
                  <div className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-parish-text">
                          <Server className="w-3.5 h-3.5 text-parish-primary" />
                          <span>Backend API Server</span>
                        </div>
                        {healthData ? (
                          <Badge variant="success" size="sm">
                            Online (v{healthData.version})
                          </Badge>
                        ) : healthError ? (
                          <Badge variant="danger" size="sm">Offline</Badge>
                        ) : (
                          <Badge variant="subtle" size="sm">Checking...</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-parish-text-muted">
                        Node.js (Express + TypeScript) on Port 5000
                      </div>
                    </div>

                    <div className="pt-2 border-t border-parish-border/60 flex items-center justify-between text-[11px]">
                      <span className="text-parish-text-muted">Endpoint:</span>
                      <code className="text-[10px] bg-parish-surface px-1.5 py-0.5 rounded border border-parish-border text-parish-primary font-mono">
                        /api/health
                      </code>
                    </div>
                  </div>

                  {/* Frontend Host Service Card */}
                  <div className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-parish-text">
                          <Activity className="w-3.5 h-3.5 text-parish-primary" />
                          <span>Web Client Host</span>
                        </div>
                        <Badge variant="info" size="sm">Active</Badge>
                      </div>
                      <div className="text-[11px] text-parish-text-muted">
                        Vite + React 19 Client on Port 5173
                      </div>
                    </div>

                    <div className="pt-2 border-t border-parish-border/60 flex items-center justify-between text-[11px]">
                      <span className="text-parish-text-muted">Mode:</span>
                      <span className="font-semibold text-emerald-600">Local Development</span>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Details Summary */}
                <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-2 text-xs">
                  <div className="font-bold text-parish-text text-[11px] uppercase tracking-wider mb-2">
                    Operational Telemetry Summary
                  </div>
                  <div className="flex justify-between">
                    <span className="text-parish-text-muted">Database Engine:</span>
                    <span className="font-semibold text-parish-text">
                      {healthData?.database.engine || 'PostgreSQL 16'} (Prisma ORM via Docker Container)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-parish-text-muted">Database Connectivity:</span>
                    <span className="font-semibold text-parish-text flex items-center gap-1.5">
                      {healthData?.database.status === 'connected' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                          <span className="text-emerald-700">
                            Live & Queryable (ping: {healthData.database.latencyMs} ms)
                          </span>
                        </>
                      ) : healthData?.database.error ? (
                        <span className="text-red-600">{healthData.database.error}</span>
                      ) : (
                        <span className="text-parish-text-muted">Checking connection...</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-parish-text-muted">Backend Service:</span>
                    <span className="font-semibold text-parish-text">Node.js LTS (Express + TypeScript) on port 5000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-parish-text-muted">Frontend Host:</span>
                    <span className="font-semibold text-parish-text">Vite + React 19 on port 5173</span>
                  </div>
                  {healthData?.timestamp && (
                    <div className="flex justify-between">
                      <span className="text-parish-text-muted">Backend Server Timestamp:</span>
                      <span className="font-mono text-[11px] text-parish-text">
                        {new Date(healthData.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'email' && (
            <EmailSmtpTab />
          )}

          {activeSubTab === 'logs' && (
            <ActivityLogsTab />
          )}

          {activeSubTab === 'developer' && (isDeveloper || user?.role === 'SUPER_ADMIN') && (
            <DeveloperControlsTab />
          )}
        </div>
      );
};

