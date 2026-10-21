import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Users,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UnitItem {
  id: number;
  unitName: string;
  category: 'GEOGRAPHIC' | 'DEMOGRAPHIC';
  isActive: boolean;
  familiesCount: number;
}

export const UnitsPage: React.FC = () => {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'GEOGRAPHIC' | 'DEMOGRAPHIC'>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'GEOGRAPHIC' | 'DEMOGRAPHIC'>('GEOGRAPHIC');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUnits = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<UnitItem[]>('/masters/units');
      setUnits(res.data);
    } catch (err: any) {
      console.error('Failed to fetch units:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleOpenAdd = () => {
    setFormName('');
    setFormCategory('GEOGRAPHIC');
    setFormIsActive(true);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (unit: UnitItem) => {
    setSelectedUnit(unit);
    setFormName(unit.unitName);
    setFormCategory(unit.category);
    setFormIsActive(unit.isActive);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const validateCreateUnit = (): boolean => {
    if (!formName.trim()) {
      setFormError('Unit name is required.');
      return false;
    }
    return true;
  };

  const handleCreateUnit = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!validateCreateUnit()) return;

    try {
      setFormSubmitting(true);
      setFormError(null);
      await api.post('/masters/units', {
        unitName: formName.trim(),
        category: formCategory,
      });
      setIsAddModalOpen(false);
      fetchUnits();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create unit. It may already exist.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const validateUpdateUnit = (): boolean => {
    if (!selectedUnit) return false;
    if (!formName.trim()) {
      setFormError('Unit name is required.');
      return false;
    }
    return true;
  };

  const handleUpdateUnit = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!selectedUnit || !validateUpdateUnit()) return;

    try {
      setFormSubmitting(true);
      setFormError(null);
      await api.patch(`/masters/units/${selectedUnit.id}`, {
        unitName: formName.trim(),
        category: formCategory,
        isActive: formIsActive,
      });
      setIsEditModalOpen(false);
      fetchUnits();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to update unit.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filtered units
  const filteredUnits = units.filter((u) => {
    const matchesSearch = u.unitName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || u.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const totalFamiliesCount = units.reduce((acc, u) => acc + (u.familiesCount || 0), 0);
  const geographicCount = units.filter((u) => u.category === 'GEOGRAPHIC').length;
  const demographicCount = units.filter((u) => u.category === 'DEMOGRAPHIC').length;

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
              Family Units / Wards
            </h1>
            <Badge variant="success" size="sm">
              {units.length} Total Units
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-parish-text-muted mt-1 max-w-2xl">
            Ward divisions and demographic groupings for parish administration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUnits}
            isLoading={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="hidden sm:inline-flex"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Add New Ward
          </Button>
        </div>
      </div>

      {/* 2. Responsive Summary Stat Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
            Total Units
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-parish-text mt-1">
            {units.length}
          </div>
          <div className="text-[11px] text-parish-text-muted mt-0.5">Parish Wards</div>
        </div>

        <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
            Geographic Wards
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-parish-primary mt-1">
            {geographicCount}
          </div>
          <div className="text-[11px] text-parish-text-muted mt-0.5">Suburb boundaries</div>
        </div>

        <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
            Demographic Units
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-700 mt-1">
            {demographicCount}
          </div>
          <div className="text-[11px] text-parish-text-muted mt-0.5">Students & Youth</div>
        </div>

        <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
            Assigned Families
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-parish-text mt-1">
            {totalFamiliesCount}
          </div>
          <div className="text-[11px] text-parish-text-muted mt-0.5">Registered Households</div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="bg-parish-surface border border-parish-border rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search ward or unit name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            className="w-full"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${filterCategory === 'ALL'
                ? 'bg-parish-primary text-white shadow-xs'
                : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text'
              }`}
          >
            All Categories ({units.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('GEOGRAPHIC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${filterCategory === 'GEOGRAPHIC'
                ? 'bg-parish-primary text-white shadow-xs'
                : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text'
              }`}
          >
            Geographic ({geographicCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('DEMOGRAPHIC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${filterCategory === 'DEMOGRAPHIC'
                ? 'bg-parish-primary text-white shadow-xs'
                : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text'
              }`}
          >
            Demographic ({demographicCount})
          </button>
        </div>
      </div>

      {/* 4. Units Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-parish-surface border border-parish-border rounded-2xl p-5 shadow-xs space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-parish-surface-subtle" />
                <div className="w-16 h-5 rounded-full bg-parish-surface-subtle" />
              </div>
              <div className="space-y-1.5">
                <div className="w-3/4 h-5 rounded bg-parish-surface-subtle" />
                <div className="w-1/2 h-3 rounded bg-parish-surface-subtle" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-parish-surface-subtle mx-auto flex items-center justify-center text-parish-text-muted">
            <Layers className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-parish-text">No Family Units Found</div>
          <p className="text-xs text-parish-text-muted max-w-sm mx-auto">
            {searchQuery
              ? `No unit matched "${searchQuery}". Try clearing your search keyword.`
              : 'No family units registered yet for this active parish.'}
          </p>
          {searchQuery && (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map((ward) => (
            <div
              key={ward.id}
              className={`bg-parish-surface border rounded-2xl p-5 shadow-xs hover:shadow-soft transition-all duration-200 flex flex-col justify-between group ${ward.isActive ? 'border-parish-border' : 'border-dashed border-parish-border opacity-70'
                }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${ward.category === 'DEMOGRAPHIC'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-parish-primary-light text-parish-primary'
                      }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={ward.category === 'DEMOGRAPHIC' ? 'info' : 'default'}
                      size="sm"
                    >
                      {ward.category}
                    </Badge>
                    {!ward.isActive && (
                      <Badge variant="subtle" size="sm">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-parish-text group-hover:text-parish-primary transition-colors">
                    {ward.unitName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-parish-text-muted mt-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      <strong className="text-parish-text">{ward.familiesCount}</strong> registered families
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 mt-4 border-t border-parish-border flex items-center justify-between">
                <span className="text-[11px] text-parish-text-muted font-mono">
                  ID #{ward.id}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(ward)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-parish-primary hover:text-parish-primary-hover p-1.5 rounded-lg hover:bg-parish-surface-subtle transition-colors min-h-[36px] min-w-[36px] justify-center"
                  title="Edit Ward"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Modal: Add New Ward */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Parish Unit / Ward"
        description="Create a new geographical ward or demographic division."
      >
        <form onSubmit={handleCreateUnit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Unit / Ward Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. St-Jude, Mother-Teresa, Holy-Cross"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Category Division
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormCategory('GEOGRAPHIC')}
                className={`p-3 rounded-xl border text-left transition-all ${formCategory === 'GEOGRAPHIC'
                    ? 'border-parish-primary bg-parish-primary-light/40 text-parish-primary font-bold'
                    : 'border-parish-border bg-parish-surface text-parish-text-muted'
                  }`}
              >
                <div className="text-xs font-bold">Geographic</div>
                <div className="text-[10px] text-parish-text-muted mt-0.5">
                  Suburb wards
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormCategory('DEMOGRAPHIC')}
                className={`p-3 rounded-xl border text-left transition-all ${formCategory === 'DEMOGRAPHIC'
                    ? 'border-parish-primary bg-parish-primary-light/40 text-parish-primary font-bold'
                    : 'border-parish-border bg-parish-surface text-parish-text-muted'
                  }`}
              >
                <div className="text-xs font-bold">Demographic</div>
                <div className="text-[10px] text-parish-text-muted mt-0.5">
                  Students, Nurses, Individuals
                </div>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-parish-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <ConfirmButton
              variant="primary"
              size="sm"
              onConfirm={handleCreateUnit}
              beforeConfirm={validateCreateUnit}
              isLoading={formSubmitting}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              confirmLabel="Confirm Create?"
            >
              Create Ward
            </ConfirmButton>
          </div>
        </form>
      </Modal>

      {/* 6. Modal: Edit Ward */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Family Unit"
        description={`Modify settings for ${selectedUnit?.unitName || 'Ward'}.`}
      >
        <form onSubmit={handleUpdateUnit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Unit / Ward Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Category Division
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormCategory('GEOGRAPHIC')}
                className={`p-3 rounded-xl border text-left transition-all ${formCategory === 'GEOGRAPHIC'
                    ? 'border-parish-primary bg-parish-primary-light/40 text-parish-primary font-bold'
                    : 'border-parish-border bg-parish-surface text-parish-text-muted'
                  }`}
              >
                <div className="text-xs font-bold">Geographic</div>
              </button>

              <button
                type="button"
                onClick={() => setFormCategory('DEMOGRAPHIC')}
                className={`p-3 rounded-xl border text-left transition-all ${formCategory === 'DEMOGRAPHIC'
                    ? 'border-parish-primary bg-parish-primary-light/40 text-parish-primary font-bold'
                    : 'border-parish-border bg-parish-surface text-parish-text-muted'
                  }`}
              >
                <div className="text-xs font-bold">Demographic</div>
              </button>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-parish-primary border-parish-border focus:ring-parish-primary"
              />
              <span className="text-xs font-semibold text-parish-text">
                Active Ward (Accepts family assignments)
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-parish-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <ConfirmButton
              variant="primary"
              size="sm"
              onConfirm={handleUpdateUnit}
              beforeConfirm={validateUpdateUnit}
              isLoading={formSubmitting}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              confirmLabel="Confirm Save"
            >
              Save Changes
            </ConfirmButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
