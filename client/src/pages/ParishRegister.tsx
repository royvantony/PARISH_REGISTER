import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import {
  Users,
  Search,
  Plus,
  MapPin,
  Phone,
  Mail,
  Home,
  CreditCard,
  Church,
  RefreshCw,
  FileText,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Edit2,
  Filter,
  RotateCcw,
  UserX,
  History,
} from 'lucide-react';

interface FamilyListItem {
  id: number;
  familyCode: string;
  registrationType: 'FAMILY' | 'INDIVIDUAL_STUDENT' | 'INDIVIDUAL';
  houseName: string;
  unit: { id: number; unitName: string; category: string } | null;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  primaryPhone: string;
  primaryEmail: string;
  originParish: string | null;
  originDiocese: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MERGED' | 'PENDING';
  headOfFamily: {
    id: number;
    role: string;
    fullName: string;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  membersCount: number;
  documentsCount: number;
  registrationDate: string;
  hasDirectDebit?: boolean;
}

interface FamilyDetailMember {
  id: number;
  role: 'HEAD' | 'SPOUSE' | 'CHILD' | 'OTHER_DEPENDENT';
  fullName: string;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  phone: string | null;
  email: string | null;
  isPrimaryContact: boolean;
  history: Array<{
    id: number;
    role: string;
    unitName: string;
    changeReason: string;
    startDate: string;
  }>;
}

interface FamilyDetail {
  id: number;
  familyCode: string;
  houseName: string;
  registrationType: 'FAMILY' | 'INDIVIDUAL_STUDENT' | 'INDIVIDUAL';
  unitId?: number | null;
  unit: { id: number; unitName: string; category: string } | null;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  primaryPhone: string;
  primaryEmail: string;
  originParish: string | null;
  originDiocese: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MERGED' | 'PENDING';
  generalNotes: string | null;
  members: FamilyDetailMember[];
  directDebit: {
    id: number;
    amount: number | string;
    frequency: string;
    comments?: string | null;
    active: boolean;
  } | null;
  directDebitPermissions?: {
    canView: boolean;
    canEdit: boolean;
  };
  notes: Array<{
    id: number;
    noteDate: string;
    noteContent: string;
    recordedBy: string;
  }>;
  mergedIntoFamily: {
    id: number;
    familyCode: string;
    houseName: string;
  } | null;
}

export const ParishRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const canViewAuditTrail = Boolean(
    user && ['SUPER_ADMIN', 'DIOCESAN_ADMIN', 'PARISH_SUPER_ADMIN', 'PARISH_ADMIN'].includes(user.role)
  );

  // Search & Filter State
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [selectedUnit, setSelectedUnit] = useState<string>(searchParams.get('unitId') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(
    searchParams.get('status') !== null ? (searchParams.get('status') as string) : 'ACTIVE'
  );
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || '');
  const [selectedDirectDebit, setSelectedDirectDebit] = useState<string>(searchParams.get('directDebit') || '');
  const [page, setPage] = useState(1);

  // Sync state if URL query params change
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const unitParam = searchParams.get('unitId');
    const ddParam = searchParams.get('directDebit');
    const searchParam = searchParams.get('search');
    const statusParam = searchParams.get('status');
    if (typeParam !== null) setSelectedType(typeParam);
    if (unitParam !== null) setSelectedUnit(unitParam);
    if (ddParam !== null) setSelectedDirectDebit(ddParam);
    if (searchParam !== null) setSearch(searchParam);
    if (statusParam !== null) setSelectedStatus(statusParam);
  }, [searchParams]);

  // Filter reset helper
  const isAnyFilterActive = Boolean(
    search.trim() ||
    selectedUnit ||
    selectedType ||
    selectedDirectDebit ||
    selectedStatus !== 'ACTIVE'
  );

  const handleResetFilters = () => {
    setSearch('');
    setSelectedUnit('');
    setSelectedType('');
    setSelectedDirectDebit('');
    setSelectedStatus('ACTIVE');
    setPage(1);
  };

  // Data State
  const [families, setFamilies] = useState<FamilyListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [units, setUnits] = useState<Array<{ id: number; unitName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Slide-over Drawer State
  // Slide-over Drawer State (Pure Profile Viewer)
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
  const [familyDetail, setFamilyDetail] = useState<FamilyDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Pending Approvals Meta State
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending count
  const fetchMeta = async () => {
    try {
      const countRes = await api.get<{ count: number }>('/families/meta/pending-count').catch(() => ({ data: { count: 0 } }));
      setPendingCount(countRes.data.count);
    } catch (err: any) {
      console.error('Failed to load pending meta:', err);
    }
  };

  // Load units for the filter dropdown & meta
  useEffect(() => {
    api.get<Array<{ id: number; unitName: string }>>('/masters/units')
      .then((res) => setUnits(res.data))
      .catch((err) => console.error('Failed to fetch units:', err));
    fetchMeta();
  }, []);

  // Fetch families when search, filters, or page change
  const fetchFamilies = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '15',
        sortBy: 'headOfFamily',
        sortOrder: 'asc',
      };
      if (search.trim()) params.search = search.trim();
      if (selectedUnit) params.unitId = selectedUnit;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedType) params.type = selectedType;
      if (selectedDirectDebit) params.directDebit = selectedDirectDebit;

      const res = await api.get<{
        data: FamilyListItem[];
        pagination: { total: number; totalPages: number; page: number };
      }>('/families', { params });

      setFamilies(res.data.data);
      setTotalCount(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to fetch parish register directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, [search, selectedUnit, selectedStatus, selectedType, selectedDirectDebit, page]);

  // Open Family Drawer (Pure Profile Viewer)
  const handleOpenFamily = async (familyId: number) => {
    setSelectedFamilyId(familyId);
    setIsDrawerOpen(true);
    setIsDetailLoading(true);
    try {
      const res = await api.get<FamilyDetail>(`/families/${familyId}`);
      setFamilyDetail(res.data);
    } catch (err: any) {
      console.error('Failed to fetch family profile details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'MERGED':
        return 'info';
      case 'INACTIVE':
        return 'subtle';
      case 'PENDING':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
              Parish Register
            </h1>
            <Badge variant="success" size="sm">
              {totalCount} Total Households
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-parish-text-muted mt-1 max-w-2xl">
            Official household directory and member demographics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFamilies}
            isLoading={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="hidden sm:inline-flex"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/register/new')}
            className="w-full sm:w-auto"
          >
            Register Parishioner
          </Button>
        </div>
      </div>

      {/* 2. Search and Multi-Filter Bar */}
      <div className="bg-parish-surface border border-parish-border rounded-2xl p-4 shadow-soft space-y-3">
        {/* Row 1: Search & Categorical Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-parish-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, house, phone, or code / #ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text placeholder:text-parish-text-muted/60 focus:outline-none focus:ring-2 focus:ring-parish-primary transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text p-1 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ward / Unit Selector */}
          <div className="lg:col-span-3">
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer transition-all"
            >
              <option value="">All Wards ({units.length})</option>
              <option value="UNASSIGNED">⚠️ Unassigned (No Ward / Null)</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitName === 'Nil' ? 'Nil' : `${u.unitName} Ward`}
                </option>
              ))}
            </select>
          </div>

          {/* Registration Type Selector */}
          <div className="lg:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer transition-all"
            >
              <option value="">All Registration Types</option>
              <option value="FAMILY">Families</option>
              <option value="INDIVIDUAL_STUDENT">International Students</option>
              <option value="INDIVIDUAL">Individuals</option>
            </select>
          </div>

          {/* Direct Debit Selector */}
          <div className="lg:col-span-2">
            <select
              value={selectedDirectDebit}
              onChange={(e) => {
                setSelectedDirectDebit(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary cursor-pointer transition-all"
            >
              <option value="">Filter Direct Debit</option>
              <option value="YES">💳 Direct Debit: Active</option>
              <option value="NO">⚪ Direct Debit: None</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Pills (Left) & Results Summary / Reset (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-parish-border/60 text-xs">
          {/* Status Pills Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-parish-text-muted mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-parish-primary" />
              Status:
            </span>
            {[
              { key: '', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              {
                key: 'PENDING',
                label: `Pending Approval${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
                isPending: true,
              },
              { key: 'MERGED', label: 'Merged (Marriage)' },
              { key: 'INACTIVE', label: 'Inactive' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(st.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors min-h-[34px] flex items-center gap-1.5 ${selectedStatus === st.key
                  ? st.isPending
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-parish-primary text-white shadow-xs'
                  : st.isPending && pendingCount > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle/80'
                  }`}
              >
                {st.isPending && <Clock className="w-3.5 h-3.5" />}
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {/* Right: Results Count & Reset Button */}
          <div className="flex items-center gap-3 sm:justify-end shrink-0">
            <span className="text-xs text-parish-text-muted">
              Showing <strong className="text-parish-text font-bold">{families.length}</strong> of{' '}
              <strong className="text-parish-text font-bold">{totalCount}</strong> records
            </span>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors shadow-xs"
                title="Reset all search queries and filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Directory Content: Adaptive Mobile Cards (< md) + Desktop Table (>= md) */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-parish-surface border border-parish-border rounded-2xl p-4 animate-pulse flex items-center justify-between"
            >
              <div className="space-y-2">
                <div className="w-48 h-4 bg-parish-surface-subtle rounded" />
                <div className="w-32 h-3 bg-parish-surface-subtle rounded" />
              </div>
              <div className="w-20 h-6 bg-parish-surface-subtle rounded-full" />
            </div>
          ))}
        </div>
      ) : families.length === 0 ? (
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-10 text-center space-y-3 shadow-soft">
          <div className="w-12 h-12 rounded-full bg-parish-surface-subtle mx-auto flex items-center justify-center text-parish-text-muted">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-parish-text">No Families Found</div>
          <p className="text-xs text-parish-text-muted max-w-sm mx-auto">
            {search
              ? `No parish records matched "${search}". Try resetting your filters.`
              : 'No family records registered yet under the selected filter criteria.'}
          </p>
          {(search || selectedUnit || selectedType || selectedDirectDebit || selectedStatus !== 'ACTIVE') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedUnit('');
                setSelectedType('');
                setSelectedDirectDebit('');
                setSelectedStatus('ACTIVE');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card List (< md screens) */}
          <div className="block md:hidden space-y-3">
            {families.map((f) => (
              <div
                key={f.id}
                onClick={() => handleOpenFamily(f.id)}
                className="bg-parish-surface border border-parish-border rounded-2xl p-4 shadow-xs hover:border-parish-primary/40 active:bg-parish-surface-subtle transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-parish-text">
                      {f.headOfFamily?.fullName || f.houseName}
                    </h3>
                    <div className="text-xs font-semibold text-parish-primary">
                      {f.houseName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-parish-primary font-bold">
                        {f.familyCode || `ID #${f.id}`}
                      </span>
                      {f.hasDirectDebit && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          <CreditCard className="w-2.5 h-2.5" /> DD
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={getStatusBadgeVariant(f.status)} size="sm">
                      {f.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-parish-text-muted">
                  {f.unit ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>{f.unit.unitName === 'Nil' ? 'Nil' : `${f.unit.unitName} Ward`}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                        Unassigned (No Ward)
                      </span>
                    </div>
                  )}

                  {f.streetAddress && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Home className="w-3.5 h-3.5 text-parish-text-muted shrink-0" />
                      <span className="truncate">{f.streetAddress}, {f.city} {f.postalCode}</span>
                    </div>
                  )}

                  {(f.primaryPhone || f.headOfFamily?.phone) && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-parish-text-muted" />
                      <span>{f.primaryPhone || f.headOfFamily?.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-parish-border flex items-center justify-between text-xs">
                  <span className="font-semibold text-parish-text">
                    {f.membersCount} {f.membersCount === 1 ? 'Member' : 'Members'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/register/${f.id}/edit`);
                      }}
                      className="px-2 py-1 rounded-lg text-parish-text-muted hover:text-parish-primary hover:bg-parish-surface-subtle transition-colors flex items-center gap-1 text-[11px] font-bold border border-parish-border"
                      title="Edit Household"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    <span className="text-parish-primary font-bold flex items-center gap-1">
                      <span>Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block bg-parish-surface border border-parish-border rounded-2xl overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-parish-surface-subtle border-b border-parish-border text-parish-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span>Parishioner</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Ward</th>
                    <th className="py-3.5 px-4 text-center">Members</th>
                    <th className="py-3.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parish-border">
                  {families.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => handleOpenFamily(f.id)}
                      className="hover:bg-parish-surface-subtle/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-parish-text text-sm group-hover:text-parish-primary transition-colors">
                          {f.headOfFamily?.fullName || f.houseName}
                        </div>
                        <div className="text-xs font-semibold text-parish-primary">
                          {f.houseName}
                        </div>
                        <div className="text-[11px] text-parish-text-muted truncate max-w-[220px]">
                          {f.streetAddress ? `${f.streetAddress}, ${f.city}` : 'No address recorded'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-parish-primary bg-parish-surface-subtle px-2 py-0.5 rounded border border-parish-border">
                            {f.familyCode || `#${f.id}`}
                          </span>
                          {f.hasDirectDebit && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200" title="Active Direct Debit">
                              <CreditCard className="w-2.5 h-2.5" /> DD
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-parish-text flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-parish-text-muted" />
                          <span>{f.primaryPhone || f.headOfFamily?.phone || 'No phone'}</span>
                        </div>
                        {f.primaryEmail && (
                          <div className="text-[11px] text-parish-text-muted truncate max-w-[180px] flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-parish-text-muted" />
                            <span>{f.primaryEmail}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {f.unit ? (
                          <div className="font-semibold text-amber-700 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{f.unit.unitName === 'Nil' ? 'Nil' : `${f.unit.unitName} Ward`}</span>
                          </div>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="default" size="sm">
                          {f.membersCount}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={getStatusBadgeVariant(f.status)} size="sm">
                            {f.status}
                          </Badge>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/register/${f.id}/edit`);
                            }}
                            className="p-1.5 rounded-lg text-parish-text-muted hover:text-parish-primary hover:bg-parish-surface-subtle border border-transparent hover:border-parish-border transition-colors cursor-pointer"
                            title="Edit Household Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-parish-text-muted">
                Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} households)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span className="flex items-center gap-1">
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. Slide-Over Family Profile Drawer with Dedicated Direct Debit Area */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        closeOnEsc={true}
        closeOnBackdropClick={true}
        title={
          familyDetail?.members.find((m) => m.role === 'HEAD')?.fullName ||
          familyDetail?.members[0]?.fullName ||
          familyDetail?.houseName ||
          'Household Details'
        }
        headerBadge={
          familyDetail ? (
            <div className="flex items-center gap-1.5">
              <Badge variant={getStatusBadgeVariant(familyDetail.status)} size="sm">
                {familyDetail.status}
              </Badge>
              <Badge variant="subtle" size="sm">
                {familyDetail.registrationType === 'FAMILY'
                  ? 'Family'
                  : familyDetail.registrationType === 'INDIVIDUAL_STUDENT'
                    ? 'International Student'
                    : 'Individual'}
              </Badge>
            </div>
          ) : undefined
        }
        description={
          familyDetail ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-parish-primary">{familyDetail.houseName}</span>
              <span>•</span>
              <span>Code: <strong className="font-mono text-parish-text">{familyDetail.familyCode || `#${selectedFamilyId}`}</strong></span>
              {familyDetail.unit ? (
                <>
                  <span>•</span>
                  <span>Ward: <strong className={familyDetail.unit.unitName === 'Nil' ? 'text-amber-700' : 'text-parish-primary'}>
                    {familyDetail.unit.unitName === 'Nil' ? 'Nil' : `${familyDetail.unit.unitName} Ward`}
                  </strong></span>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span className="text-amber-700 font-semibold">⚠️ Unassigned Ward</span>
                </>
              )}
            </div>
          ) : ''
        }
        width="lg"
      >
        {isDetailLoading || !familyDetail ? (
          <div className="space-y-4 py-8">
            <div className="h-6 bg-parish-surface-subtle animate-pulse rounded w-1/3" />
            <div className="h-24 bg-parish-surface-subtle animate-pulse rounded-xl" />
            <div className="h-32 bg-parish-surface-subtle animate-pulse rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Drawer Top Action Bar */}
            {/* Drawer Top Action Bar */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-parish-border flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate(`/register/${familyDetail.id}/edit`);
                }}
                icon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit Household Details
              </Button>

              {familyDetail.familyCode ? (
                <span className="font-mono text-xs font-bold text-parish-primary bg-parish-primary-light px-2.5 py-1 rounded border border-parish-border">
                  {familyDetail.familyCode}
                </span>
              ) : (
                <Badge variant="warning" size="sm">Pending Code</Badge>
              )}
            </div>

            {/* Inactive Household Banner */}
            {familyDetail.status === 'INACTIVE' && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-soft flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5">
                  <UserX className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-950 dark:text-slate-100">Household is Inactive (Archived)</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      This household is archived and hidden from the active directory. Open the Edit window to reactivate or modify this household.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate(`/register/${familyDetail.id}/edit`);
                  }}
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  className="shrink-0"
                >
                  Manage in Edit
                </Button>
              </div>
            )}

            {/* Pending Parish Approval Notice */}
            {familyDetail.status === 'PENDING' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-soft flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-950">Pending Parish Verification & Approval</h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      This registration is pending approval and code allocation. Open the Edit window to review and approve.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate(`/register/${familyDetail.id}/edit`);
                  }}
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  className="bg-amber-700 hover:bg-amber-800 text-white shrink-0"
                >
                  Review in Edit Window
                </Button>
              </div>
            )}

            {familyDetail.mergedIntoFamily && (
              <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                Merged into <strong>{familyDetail.mergedIntoFamily.houseName}</strong> ({familyDetail.mergedIntoFamily.familyCode})
              </div>
            )}

            {/* Dwelling & Contact Card */}
            <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center justify-between">
                <span>Address & Contact details</span>
                <Home className="w-4 h-4 text-parish-primary" />
              </div>
              <div className="text-sm font-semibold text-parish-text">
                {familyDetail.streetAddress || 'Address not registered'}
                {familyDetail.city && `, ${familyDetail.city} ${familyDetail.state} ${familyDetail.postalCode}`}
              </div>
              <div className="text-xs text-parish-text-muted flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {familyDetail.primaryPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <strong>{familyDetail.primaryPhone}</strong>
                  </span>
                )}
                {familyDetail.primaryEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{familyDetail.primaryEmail}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Parish Ward Allocation Card (Pure Read-Only Display) */}
            <div className="p-4 rounded-xl border border-parish-border bg-parish-surface shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-parish-primary" />
                  <span>Parish Ward Allocation</span>
                </div>
                {familyDetail.unit ? (
                  familyDetail.unit.unitName === 'Nil' ? (
                    <Badge variant="warning" size="sm">Nil</Badge>
                  ) : (
                    <Badge variant="success" size="sm">{familyDetail.unit.unitName} Ward</Badge>
                  )
                ) : (
                  <Badge variant="danger" size="sm">Unassigned (No Ward)</Badge>
                )}
              </div>

              <div className="text-xs text-parish-text">
                {familyDetail.unit ? (
                  <span>
                    Assigned to <strong className="font-semibold text-parish-primary">{familyDetail.unit.unitName === 'Nil' ? 'Nil' : `${familyDetail.unit.unitName} Ward`}</strong> ({familyDetail.unit.category})
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium">
                    ⚠️ This household is not assigned to any geographic ward yet.
                  </span>
                )}
              </div>
            </div>

            {/* Roots in India Card */}
            <div className="p-4 rounded-xl border border-parish-border bg-parish-surface space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center gap-1.5">
                <Church className="w-4 h-4 text-parish-primary" />
                <span>Roots in India (Native Dioceses & Parishes)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-parish-text-muted">Origin Diocese:</span>{' '}
                  <strong className="text-parish-text">{familyDetail.originDiocese || 'Not recorded'}</strong>
                </div>
                <div>
                  <span className="text-parish-text-muted">Origin Parish:</span>{' '}
                  <strong className="text-parish-text">{familyDetail.originParish || 'Not recorded'}</strong>
                </div>
              </div>
            </div>

            {/* Family Members Breakdown */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center justify-between">
                <span>Family Members ({familyDetail.members.length})</span>
                <span className="text-[11px] font-normal lowercase">ordered by household role</span>
              </div>

              <div className="space-y-2.5">
                {familyDetail.members.map((member) => {
                  const age = calculateAge(member.dateOfBirth);
                  return (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-xl border border-parish-border bg-parish-surface shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${member.role === 'HEAD'
                              ? 'bg-parish-primary-light text-parish-primary'
                              : member.role === 'SPOUSE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                              }`}
                          >
                            {member.fullName.substring(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="text-sm font-bold text-parish-text flex items-center gap-1.5">
                              <span>{member.fullName}</span>
                              {member.isPrimaryContact && (
                                <Badge variant="success" size="sm">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-parish-text-muted flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {member.dateOfBirth && (
                                <span>
                                  DOB: {new Date(member.dateOfBirth).toLocaleDateString()}
                                  {age !== null && ` (${age} yrs)`}
                                </span>
                              )}
                              {member.phone && <span>Ph: {member.phone}</span>}
                              {member.placeOfBirth && <span>POB: {member.placeOfBirth}</span>}
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={
                            member.role === 'HEAD'
                              ? 'default'
                              : member.role === 'SPOUSE'
                                ? 'subtle'
                                : 'outline'
                          }
                          size="sm"
                        >
                          {member.role}
                        </Badge>
                      </div>

                      {/* Member History Trail if married or transferred */}
                      {member.history && member.history.length > 0 && (
                        <div className="pt-2 border-t border-parish-border/60 text-[11px] text-parish-text-muted space-y-1">
                          <div className="font-semibold text-parish-text flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Historical Genealogy Trail:</span>
                          </div>
                          {member.history.map((h) => (
                            <div key={h.id} className="pl-4 border-l border-amber-300 ml-1">
                              {h.changeReason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DEDICATED DIRECT DEBIT AREA - Only visible to users with view permission */}
            {familyDetail.directDebitPermissions?.canView && (
              <div className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-parish-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-parish-text">
                      Direct Debit
                    </span>
                  </div>

                  {familyDetail.directDebit && familyDetail.directDebit.active ? (
                    <Badge variant="success" size="sm">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="subtle" size="sm">
                      No Active Debit
                    </Badge>
                  )}
                </div>

                {familyDetail.directDebit && familyDetail.directDebit.active ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-parish-border">
                        <div className="text-[10px] font-bold uppercase text-parish-text-muted">
                          Amount
                        </div>
                        <div className="text-base font-extrabold text-parish-primary">
                          ${familyDetail.directDebit.amount} AUD
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-parish-border">
                        <div className="text-[10px] font-bold uppercase text-parish-text-muted">
                          Frequency
                        </div>
                        <div className="text-sm font-bold text-parish-text">
                          {familyDetail.directDebit.frequency || 'Monthly'}
                          {familyDetail.directDebit.comments && (
                            <span className="text-xs text-parish-text-muted block font-sans">
                              {familyDetail.directDebit.comments}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-parish-text-muted">
                      Direct debit processed automatically for the parish.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-parish-text-muted leading-relaxed">
                    This household does not currently have active direct debit registered. Direct debit contributions can be set up via the parish administration office.
                  </div>
                )}
              </div>
            )}

            {/* 1. Pastoral & Household Notes (Manual remarks by Priest/Staff) */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-parish-primary" />
                <span>Pastoral & Household Notes</span>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-parish-text leading-relaxed">
                {familyDetail.generalNotes && familyDetail.generalNotes.trim() ? (
                  <p className="whitespace-pre-wrap">{familyDetail.generalNotes.trim()}</p>
                ) : (
                  <span className="text-parish-text-muted italic">
                    No pastoral or general notes recorded for this household.
                  </span>
                )}
              </div>
            </div>

            {/* 2. Record History & Audit Trail (Only visible to admin roles) */}
            {canViewAuditTrail && familyDetail.notes && familyDetail.notes.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-parish-text-muted flex items-center gap-1.5">
                  <History className="w-4 h-4 text-parish-primary" />
                  <span>Record History & Audit Trail</span>
                </div>
                <div className="space-y-2">
                  {familyDetail.notes.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl bg-white border border-parish-border text-xs space-y-1">
                      <p className="text-parish-text">{n.noteContent}</p>
                      <div className="text-[11px] text-parish-text-muted flex items-center justify-between pt-1 border-t border-parish-border">
                        <span>Recorded by: <strong>{n.recordedBy || 'System'}</strong></span>
                        <span className="flex items-center gap-1 font-medium text-parish-text-muted">
                          <Clock className="w-3 h-3 text-parish-text-muted/70" />
                          {new Date(n.noteDate).toLocaleString([], {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-parish-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsDrawerOpen(false)}
                  className="font-bold text-xs bg-parish-surface-subtle hover:bg-[#ebe4d7] text-parish-text border border-parish-border shadow-sm px-4 py-2 flex items-center gap-2 transition-all hover:border-parish-text-muted cursor-pointer"
                  icon={<X className="w-4 h-4 text-parish-text" />}
                >
                  <span>Close Details</span>
                  <kbd className="text-[10px] uppercase font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-parish-border text-parish-text-muted shadow-xs ml-1">
                    Esc
                  </kbd>
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate(`/register/${familyDetail.id}/edit`);
                  }}
                  icon={<Edit2 className="w-4 h-4" />}
                >
                  Edit Household
                </Button>
              </div>

              <span className="text-[11px] text-parish-text-muted hidden sm:inline">
                Press <kbd className="font-mono bg-parish-surface-subtle px-1 rounded border border-parish-border text-[10px]">Esc</kbd> anytime to dismiss
              </span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
