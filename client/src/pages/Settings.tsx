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
} from 'lucide-react';
import { useTheme, type ThemeId } from '../context/ThemeContext';

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

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, availableThemes } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'dioceses'>('dioceses');
  const [dioceses, setDioceses] = useState<DioceseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    fetchDioceses();
  }, [fetchDioceses]);

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

      {/* Settings Sub-Navigation Tabs */}
      <div className="flex border-b border-parish-border gap-2">
        <button
          onClick={() => setActiveSubTab('dioceses')}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${activeSubTab === 'dioceses'
            ? 'border-parish-primary text-parish-primary'
            : 'border-transparent text-parish-text-muted hover:text-parish-text'
            }`}
        >
          Origin Dioceses from India ({dioceses.length})
        </button>
        <button
          onClick={() => setActiveSubTab('general')}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${activeSubTab === 'general'
            ? 'border-parish-primary text-parish-primary'
            : 'border-transparent text-parish-text-muted hover:text-parish-text'
            }`}
        >
          General Configurations
        </button>
      </div>

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
    </div>
  );
};
