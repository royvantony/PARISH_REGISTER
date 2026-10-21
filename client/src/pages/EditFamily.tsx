import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { ConfirmDeleteButton } from '../components/ui/ConfirmDeleteButton';
import { Input } from '../components/ui/Input';
import {
  ArrowLeft,
  Users,
  GraduationCap,
  User,
  Home,
  Church,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Save,
  X,
  FileText,
  UserX,
  RotateCcw,
  History,
  CreditCard,
} from 'lucide-react';
import { InactivateFamilyModal } from '../components/families/InactivateFamilyModal';
import { ApproveFamilyModal } from '../components/families/ApproveFamilyModal';
import { ReactivateFamilyModal } from '../components/families/ReactivateFamilyModal';
import { RejectFamilyModal } from '../components/families/RejectFamilyModal';
import { DirectDebitModal } from '../components/families/DirectDebitModal';

interface MemberFormData {
  id?: number;
  role: 'HEAD' | 'SPOUSE' | 'CHILD' | 'OTHER_DEPENDENT';
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  phone: string;
  email: string;
}

interface UnitOption {
  id: number;
  unitName: string;
}

interface DioceseOption {
  id: number;
  dioceseName: string;
}

export const EditFamilyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewAuditTrail = Boolean(
    user && ['SUPER_ADMIN', 'DIOCESAN_ADMIN', 'PARISH_SUPER_ADMIN', 'PARISH_ADMIN'].includes(user.role)
  );

  // Reference Data
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [dioceses, setDioceses] = useState<DioceseOption[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [status, setStatus] = useState<string>('ACTIVE');
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [registrationType, setRegistrationType] = useState<'FAMILY' | 'INDIVIDUAL_STUDENT' | 'INDIVIDUAL'>('FAMILY');
  const [houseName, setHouseName] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('UNASSIGNED');

  // Head of Family
  const [headMemberId, setHeadMemberId] = useState<number | undefined>(undefined);
  const [headName, setHeadName] = useState('');
  const [headDob, setHeadDob] = useState('');
  const [headPob, setHeadPob] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [headEmail, setHeadEmail] = useState('');

  // Spouse
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseMemberId, setSpouseMemberId] = useState<number | undefined>(undefined);
  const [spouseName, setSpouseName] = useState('');
  const [spouseDob, setSpouseDob] = useState('');
  const [spousePob, setSpousePob] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [spouseEmail, setSpouseEmail] = useState('');

  // Children / Dependents
  const [children, setChildren] = useState<MemberFormData[]>([]);

  // Australian Address
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('QLD');
  const [postalCode, setPostalCode] = useState('');

  // Roots in India
  const [originParish, setOriginParish] = useState('');
  const [originDiocese, setOriginDiocese] = useState('');

  // General & Pastoral Notes
  const [generalNotes, setGeneralNotes] = useState('');

  // Action status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [currentApprovePayload, setCurrentApprovePayload] = useState<any>(null);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDirectDebitModalOpen, setIsDirectDebitModalOpen] = useState(false);
  const [hasDirectDebit, setHasDirectDebit] = useState(false);
  const [directDebitData, setDirectDebitData] = useState<any>(null);
  const [directDebitPerms, setDirectDebitPerms] = useState<{ canView: boolean; canEdit: boolean }>({ canView: false, canEdit: false });
  const [auditNotes, setAuditNotes] = useState<Array<{ id: number; noteDate: string; noteContent: string; recordedBy: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load family data
  const loadFamilyData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [familyRes, unitsRes, diocesesRes, approveRes] = await Promise.all([
        api.get<any>(`/families/${id}`),
        api.get<UnitOption[]>('/masters/units'),
        api.get<DioceseOption[]>('/masters/dioceses').catch(() => ({ data: [] })),
        api.get<{ canApprove: boolean }>('/permissions/can-approve').catch(() => ({ data: { canApprove: false } })),
      ]);

      const f = familyRes.data;
      setUnits(unitsRes.data);
      setDioceses(diocesesRes.data);
      setCanApprove(approveRes.data.canApprove);
      setHasDirectDebit(Boolean(f.directDebit?.active));
      setDirectDebitData(f.directDebit || null);
      if (f.directDebitPermissions) {
        setDirectDebitPerms(f.directDebitPermissions);
      }
      setAuditNotes(f.notes || []);

      setStatus(f.status || 'ACTIVE');
      setFamilyCode(f.familyCode || null);
      setRegistrationType(f.registrationType || 'FAMILY');
      setHouseName(f.houseName || '');
      setSelectedUnitId(f.unitId ? String(f.unitId) : 'UNASSIGNED');

      setStreetAddress(f.streetAddress || '');
      setCity(f.city || 'Brisbane');
      setState(f.state || 'QLD');
      setPostalCode(f.postalCode || '');

      setOriginParish(f.originParish || '');
      setOriginDiocese(f.originDiocese || '');
      setGeneralNotes(f.generalNotes || '');

      // Parse members
      const members: any[] = f.members || [];
      const head = members.find((m) => m.role === 'HEAD') || members[0];
      if (head) {
        setHeadMemberId(head.id);
        setHeadName(head.fullName || '');
        setHeadDob(head.dateOfBirth ? head.dateOfBirth.substring(0, 10) : '');
        setHeadPob(head.placeOfBirth || '');
        setHeadPhone(head.phone || f.primaryPhone || '');
        setHeadEmail(head.email || f.primaryEmail || '');
      }

      const spouse = members.find((m) => m.role === 'SPOUSE');
      if (spouse) {
        setHasSpouse(true);
        setSpouseMemberId(spouse.id);
        setSpouseName(spouse.fullName || '');
        setSpouseDob(spouse.dateOfBirth ? spouse.dateOfBirth.substring(0, 10) : '');
        setSpousePob(spouse.placeOfBirth || '');
        setSpousePhone(spouse.phone || '');
        setSpouseEmail(spouse.email || '');
      } else {
        setHasSpouse(false);
        setSpouseMemberId(undefined);
        setSpouseName('');
        setSpouseDob('');
        setSpousePob('');
        setSpousePhone('');
        setSpouseEmail('');
      }

      const otherMembers = members.filter((m) => m.role !== 'HEAD' && m.role !== 'SPOUSE');
      setChildren(
        otherMembers.map((m) => ({
          id: m.id,
          role: m.role || 'CHILD',
          fullName: m.fullName || '',
          dateOfBirth: m.dateOfBirth ? m.dateOfBirth.substring(0, 10) : '',
          placeOfBirth: m.placeOfBirth || '',
          phone: m.phone || '',
          email: m.email || '',
        }))
      );
    } catch (err: any) {
      console.error('Failed to load family for editing:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load household details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFamilyData();
  }, [id]);

  // Add child row
  const handleAddChild = () => {
    setChildren([
      ...children,
      {
        role: 'CHILD',
        fullName: '',
        dateOfBirth: '',
        placeOfBirth: '',
        phone: '',
        email: '',
      },
    ]);
  };

  // Remove child row
  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  // Update child field
  const handleChildChange = (index: number, field: keyof MemberFormData, value: string) => {
    const updated = [...children];
    (updated[index] as any)[field] = value;
    setChildren(updated);
  };

  // Helper to build and validate payload for save or approve
  const buildPayload = (): { valid: boolean; error?: string; payload?: any } => {
    if (!houseName.trim()) {
      return { valid: false, error: 'House name / Family name is required.' };
    }

    if (!headName.trim()) {
      return { valid: false, error: 'Head of family full name is required.' };
    }

    // Build members payload
    const membersPayload: any[] = [
      {
        id: headMemberId,
        role: 'HEAD',
        fullName: headName.trim(),
        dateOfBirth: headDob || null,
        placeOfBirth: headPob.trim() || null,
        phone: headPhone.trim() || null,
        email: headEmail.trim() || null,
        isPrimaryContact: true,
      },
    ];

    if (registrationType === 'FAMILY' && hasSpouse && spouseName.trim()) {
      membersPayload.push({
        id: spouseMemberId,
        role: 'SPOUSE',
        fullName: spouseName.trim(),
        dateOfBirth: spouseDob || null,
        placeOfBirth: spousePob.trim() || null,
        phone: spousePhone.trim() || null,
        email: spouseEmail.trim() || null,
        isPrimaryContact: false,
      });
    }

    if (registrationType === 'FAMILY') {
      children.forEach((c) => {
        if (c.fullName.trim()) {
          membersPayload.push({
            id: c.id,
            role: c.role || 'CHILD',
            fullName: c.fullName.trim(),
            dateOfBirth: c.dateOfBirth || null,
            placeOfBirth: c.placeOfBirth.trim() || null,
            phone: c.phone.trim() || null,
            email: c.email.trim() || null,
            isPrimaryContact: false,
          });
        }
      });
    }

    const payload = {
      registrationType,
      houseName: houseName.trim(),
      unitId: selectedUnitId === 'UNASSIGNED' ? null : selectedUnitId,
      streetAddress: streetAddress.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      postalCode: postalCode.trim() || null,
      primaryPhone: headPhone.trim() || null,
      primaryEmail: headEmail.trim() || null,
      originParish: originParish.trim() || null,
      originDiocese: originDiocese.trim() || null,
      generalNotes: generalNotes.trim() || null,
      members: membersPayload,
    };

    return { valid: true, payload };
  };

  // Pre-save validation hook for ConfirmButton
  const validateBeforeSave = (): boolean => {
    setErrorMessage(null);
    const check = buildPayload();
    if (!check.valid) {
      setErrorMessage(check.error || 'Please fill in all required fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  };

  // Handle Save
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const check = buildPayload();
    if (!check.valid) {
      setErrorMessage(check.error || 'Please fill in all required fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setIsSubmitting(true);
      await api.put(`/families/${id}`, check.payload);
      setSuccessMessage('Household record and family members updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
      loadFamilyData();
    } catch (err: any) {
      console.error('Failed to update family:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to update record. Please verify the details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Approve - validates form and sets payload so approval saves current form edits atomically
  const handleApprove = () => {
    setErrorMessage(null);
    const check = buildPayload();
    if (!check.valid) {
      setErrorMessage(check.error || 'Please complete all required fields before approving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentApprovePayload(check.payload);
    setIsApproveModalOpen(true);
  };

  // Handle Reject - always requires confirmation window
  const handleReject = () => {
    setIsRejectModalOpen(true);
  };

  // Handle Reactivate - always requires confirmation window
  const handleReactivate = () => {
    setIsReactivateModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-8 animate-pulse space-y-4">
          <div className="h-6 bg-parish-surface-subtle rounded w-1/3" />
          <div className="h-32 bg-parish-surface-subtle rounded-xl" />
          <div className="h-48 bg-parish-surface-subtle rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-parish-text-muted hover:text-parish-primary transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Parish Register</span>
          </button>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
              Edit Household Details
            </h1>
            <Badge
              variant={
                status === 'ACTIVE'
                  ? 'success'
                  : status === 'PENDING'
                    ? 'warning'
                    : 'subtle'
              }
              size="sm"
            >
              {status}
            </Badge>
            {familyCode && (
              <span className="font-mono text-xs font-bold text-parish-primary bg-parish-primary-light px-2 py-0.5 rounded border border-parish-border">
                {familyCode}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-parish-text-muted mt-1">
            Update household profile, assign ward, manage family members, and process registration approvals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/register')}
          >
            Cancel
          </Button>

          {/* Inactivate Button for ACTIVE families */}
          {status === 'ACTIVE' && canApprove && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInactivateModalOpen(true)}
              icon={<UserX className="w-3.5 h-3.5 text-rose-600" />}
              className="text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              Inactivate Household
            </Button>
          )}

          {/* Reactivate Button for INACTIVE families */}
          {status === 'INACTIVE' && canApprove && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleReactivate}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reactivate Household
            </Button>
          )}

          {/* Approve Button for PENDING registrations */}
          {status === 'PENDING' && canApprove && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApprove}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Approve & Allocate Code
            </Button>
          )}

          {/* Direct Debit Action Button */}
          {directDebitPerms.canView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDirectDebitModalOpen(true)}
              icon={<CreditCard className="w-3.5 h-3.5 text-parish-primary" />}
              className="border-parish-border text-parish-primary hover:bg-parish-primary-light"
            >
              <span>Direct Debit</span>
              {hasDirectDebit && (
                <span className="w-1.5 h-1.5 rounded-full bg-parish-primary inline-block ml-1" title="Active Direct Debit" />
              )}
            </Button>
          )}

          <ConfirmButton
            variant="primary"
            size="sm"
            onConfirm={handleSubmit}
            beforeConfirm={validateBeforeSave}
            isLoading={isSubmitting}
            icon={<Save className="w-4 h-4" />}
            confirmLabel="Confirm Save"
          >
            Save Changes
          </ConfirmButton>
        </div>
      </div>

      {/* Inactive Household Banner */}
      {status === 'INACTIVE' && (
        <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-soft space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-950 dark:text-slate-100 flex items-center gap-2">
                <span>Household is Currently Inactive (Archived)</span>
                <Badge variant="subtle" size="sm">Archived</Badge>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                This record is hidden from active parish directories and census counts. All historical member details, sacramental notes, and past records remain securely retained.
              </p>
            </div>
          </div>

          {canApprove && (
            <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-slate-300 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleReactivate}
                icon={<RotateCcw className="w-4 h-4" />}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Reactivate Household to Active Status
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 2. Pending Approval Banner */}
      {status === 'PENDING' && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-soft space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>Pending Parish Verification & Approval</span>
                <Badge variant="warning" size="sm">Awaiting Review</Badge>
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                This record was registered and is currently pending verification. Parish family codes are allocated immediately upon official approval.
              </p>
            </div>
          </div>

          {canApprove ? (
            <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-amber-200/70">
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Approve & Allocate Family Code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                icon={<X className="w-4 h-4" />}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                Reject / Inactivate
              </Button>
              <span className="text-[11px] text-amber-800 font-medium ml-auto">
                Authorized as: <strong>{user?.role}</strong>
              </span>
            </div>
          ) : (
            <div className="pt-2 text-[11px] text-amber-800 font-medium border-t border-amber-200/70 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Only authorized parish roles can approve registrations.</span>
            </div>
          )}
        </div>
      )}

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Household Classification */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
            <Users className="w-5 h-5 text-parish-primary" />
            <div>
              <h2 className="text-base font-bold text-parish-text">1. Household Classification</h2>
              <p className="text-xs text-parish-text-muted">
                Specify registration category and assigned parish prayer ward.
              </p>
            </div>
          </div>

          {/* Type Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                type: 'FAMILY',
                title: 'Family',
                desc: 'Married couple with/without dependents',
                icon: Users,
              },
              {
                type: 'INDIVIDUAL_STUDENT',
                title: 'Student',
                desc: 'International student pursuing studies in QLD',
                icon: GraduationCap,
              },
              {
                type: 'INDIVIDUAL',
                title: 'Individual',
                desc: 'Single working professional or individual parishioner',
                icon: User,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = registrationType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setRegistrationType(item.type as any)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                    ? 'border-parish-primary bg-emerald-50/40 shadow-xs'
                    : 'border-parish-border bg-parish-surface hover:border-parish-text-muted'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-parish-primary text-white' : 'bg-parish-surface-subtle text-parish-text-muted'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {isSelected && <Badge variant="success" size="sm">Selected</Badge>}
                  </div>
                  <div className="text-sm font-bold text-parish-text">{item.title}</div>
                  <div className="text-[11px] text-parish-text-muted mt-0.5">{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                House Name / Family Name (Veettuperu) <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Vadakkedathu, Palathinkal, Cherian"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                required
              />
              <span className="text-[11px] text-parish-text-muted mt-1 block">
                Ancestral or household identifier
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Parish Ward (Prayer Unit)
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="UNASSIGNED">— None / Unassigned (No Ward) —</option>
                {units.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.unitName === 'Nil' ? 'Nil' : `${u.unitName} Ward`}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-parish-text-muted mt-1 block">
                Can be updated at any time as boundaries change
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Head of Family */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
            <User className="w-5 h-5 text-parish-primary" />
            <div>
              <h2 className="text-base font-bold text-parish-text">
                2. {registrationType === 'FAMILY' ? 'Head of Family' : 'Parishioner Details'}
              </h2>
              <p className="text-xs text-parish-text-muted">
                Primary contact person and household head.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-parish-text mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Thomas Mathew"
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">Date of Birth</label>
              <Input
                type="date"
                value={headDob}
                onChange={(e) => setHeadDob(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">Place of Birth</label>
              <Input
                placeholder="e.g. Kottayam, Kerala"
                value={headPob}
                onChange={(e) => setHeadPob(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">Mobile Phone</label>
              <Input
                placeholder="e.g. 0412 345 678"
                value={headPhone}
                onChange={(e) => setHeadPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">Email Address</label>
              <Input
                type="email"
                placeholder="e.g. thomas@example.com"
                value={headEmail}
                onChange={(e) => setHeadEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Spouse Details (Family only) */}
        {registrationType === 'FAMILY' && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-parish-border">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-700" />
                <div>
                  <h2 className="text-base font-bold text-parish-text">3. Spouse Details</h2>
                  <p className="text-xs text-parish-text-muted">Include spouse information if married.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSpouse}
                  onChange={(e) => setHasSpouse(e.target.checked)}
                  className="rounded border-parish-border text-parish-primary focus:ring-parish-primary w-4 h-4"
                />
                <span>Include Spouse</span>
              </label>
            </div>

            {hasSpouse ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Spouse Full Name
                  </label>
                  <Input
                    placeholder="e.g. Mary Thomas"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={spouseDob}
                    onChange={(e) => setSpouseDob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">Place of Birth</label>
                  <Input
                    placeholder="e.g. Pala, Kerala"
                    value={spousePob}
                    onChange={(e) => setSpousePob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">Mobile Phone</label>
                  <Input
                    placeholder="e.g. 0412 987 654"
                    value={spousePhone}
                    onChange={(e) => setSpousePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="e.g. mary@example.com"
                    value={spouseEmail}
                    onChange={(e) => setSpouseEmail(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-parish-text-muted italic py-1">
                No spouse listed for this household record.
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: Children & Other Dependents (Family only) */}
        {registrationType === 'FAMILY' && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-parish-border">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-sky-700" />
                <div>
                  <h2 className="text-base font-bold text-parish-text">
                    4. Children & Household Dependents ({children.length})
                  </h2>
                  <p className="text-xs text-parish-text-muted">
                    List all children or other family members residing with this household.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChild}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Member
              </Button>
            </div>

            {children.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-parish-border text-center text-xs text-parish-text-muted space-y-2">
                <div>No children or dependents currently listed.</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddChild}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add First Child / Dependent
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {children.map((child, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-parish-primary text-white text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <select
                          value={child.role}
                          onChange={(e) => handleChildChange(index, 'role', e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-parish-border bg-parish-surface font-semibold text-parish-text"
                        >
                          <option value="CHILD">Child / Son / Daughter</option>
                          <option value="OTHER_DEPENDENT">Other Dependent / Parent</option>
                        </select>
                      </div>

                      <ConfirmDeleteButton
                        onDelete={() => handleRemoveChild(index)}
                        hasContent={Boolean(child.fullName.trim() || child.dateOfBirth || child.placeOfBirth || child.phone || child.email)}
                        confirmLabel="Remove?"
                        title="Remove member"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Full Name
                        </label>
                        <Input
                          placeholder="e.g. Kevin Thomas"
                          value={child.fullName}
                          onChange={(e) => handleChildChange(index, 'fullName', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Date of Birth
                        </label>
                        <Input
                          type="date"
                          value={child.dateOfBirth}
                          onChange={(e) => handleChildChange(index, 'dateOfBirth', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Place of Birth
                        </label>
                        <Input
                          placeholder="e.g. Brisbane"
                          value={child.placeOfBirth}
                          onChange={(e) => handleChildChange(index, 'placeOfBirth', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Phone (Optional)
                        </label>
                        <Input
                          placeholder="Mobile"
                          value={child.phone}
                          onChange={(e) => handleChildChange(index, 'phone', e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Email (Optional)
                        </label>
                        <Input
                          type="email"
                          placeholder="Email"
                          value={child.email}
                          onChange={(e) => handleChildChange(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: Australian Residential Address */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
            <Home className="w-5 h-5 text-parish-primary" />
            <div>
              <h2 className="text-base font-bold text-parish-text">
                {registrationType === 'FAMILY' ? '5.' : '3.'} Residential Address (Queensland, Australia)
              </h2>
              <p className="text-xs text-parish-text-muted">
                Physical dwelling location in greater Brisbane or Queensland.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-parish-text mb-1">Street Address</label>
              <Input
                placeholder="e.g. 42 Parish Way, Sunnybank"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-parish-text mb-1">Suburb / City</label>
              <Input
                placeholder="e.g. Brisbane"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="QLD">QLD (Queensland)</option>
                <option value="NSW">NSW</option>
                <option value="VIC">VIC</option>
                <option value="WA">WA</option>
                <option value="SA">SA</option>
                <option value="TAS">TAS</option>
                <option value="ACT">ACT</option>
                <option value="NT">NT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">Postal Code</label>
              <Input
                placeholder="e.g. 4109"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: Roots in India */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
            <Church className="w-5 h-5 text-amber-700" />
            <div>
              <h2 className="text-base font-bold text-parish-text">
                {registrationType === 'FAMILY' ? '6.' : '4.'} Roots in India (Diocese & Native Parish)
              </h2>
              <p className="text-xs text-parish-text-muted">
                Syro-Malabar or native Catholic eparchy and mother church in India.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Native Diocese / Eparchy
              </label>
              <Input
                placeholder="e.g. Archeparchy of Changanacherry, Pala, Ernakulam"
                value={originDiocese}
                onChange={(e) => setOriginDiocese(e.target.value)}
                list="dioceses-list"
              />
              <datalist id="dioceses-list">
                {dioceses.map((d) => (
                  <option key={d.id} value={d.dioceseName} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Native Mother Parish
              </label>
              <Input
                placeholder="e.g. St. Thomas Cathedral, Pala"
                value={originParish}
                onChange={(e) => setOriginParish(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Direct Debit Summary Card (Option B Modal Trigger) */}
        {directDebitPerms.canView && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-parish-primary-light text-parish-primary flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-parish-primary" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-parish-text">
                    Direct Debit Details
                  </h3>
                  {hasDirectDebit ? (
                    <Badge variant="success" size="sm">Active</Badge>
                  ) : (
                    <Badge variant="subtle" size="sm">No Direct Debit</Badge>
                  )}
                </div>
                <p className="text-xs text-parish-text-muted">
                  {hasDirectDebit && directDebitData ? (
                    <span>
                      Contributing <strong>${directDebitData.amount} AUD</strong> ({directDebitData.frequency || 'Monthly'})
                      {directDebitData.comments ? ` • ${directDebitData.comments}` : ''}
                    </span>
                  ) : (
                    <span>No direct debit details recorded for this household.</span>
                  )}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDirectDebitModalOpen(true)}
              icon={<CreditCard className="w-3.5 h-3.5 text-parish-primary" />}
              className="shrink-0 font-semibold text-parish-primary border-parish-border hover:bg-parish-primary-light"
            >
              {directDebitPerms.canEdit ? 'Manage Direct Debit' : 'View Direct Debit'}
            </Button>
          </div>
        )}

        {/* SECTION 7: Notes */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
            <FileText className="w-5 h-5 text-parish-primary" />
            <div>
              <h2 className="text-base font-bold text-parish-text">
                {registrationType === 'FAMILY' ? '7.' : '5.'} Pastoral & Household Notes
              </h2>
              <p className="text-xs text-parish-text-muted">
                Confidential pastoral care notes, family circumstances, arrival dates, or special accommodations.
              </p>
            </div>
          </div>

          <div>
            <textarea
              rows={3}
              placeholder="Any additional pastoral details or notes..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
            />
          </div>
        </div>

        {/* Record History & Audit Trail (Only visible to admin roles) */}
        {canViewAuditTrail && auditNotes.length > 0 && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-parish-border">
              <History className="w-5 h-5 text-parish-primary" />
              <div>
                <h2 className="text-base font-bold text-parish-text">Record History & Audit Trail</h2>
                <p className="text-xs text-parish-text-muted">
                  Chronological system audit trail of registrations, status transitions, and administrative updates.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {auditNotes.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-parish-surface-subtle border border-parish-border text-xs space-y-1.5">
                  <p className="text-parish-text font-medium leading-relaxed">{n.noteContent}</p>
                  <div className="text-[11px] text-parish-text-muted flex items-center justify-between pt-1.5 border-t border-parish-border/60">
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

        {/* Form Bottom Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/register')}
          >
            Back to Directory
          </Button>

          <ConfirmButton
            variant="primary"
            size="lg"
            onConfirm={handleSubmit}
            beforeConfirm={validateBeforeSave}
            isLoading={isSubmitting}
            icon={<Save className="w-4 h-4" />}
            confirmLabel="Confirm Save"
          >
            Save All Changes
          </ConfirmButton>
        </div>
      </form>

      {/* Inactivate Household Modal */}
      {id && (
        <InactivateFamilyModal
          isOpen={isInactivateModalOpen}
          onClose={() => setIsInactivateModalOpen(false)}
          familyId={Number(id)}
          houseName={houseName}
          familyCode={familyCode}
          hasActiveDirectDebit={hasDirectDebit}
          onSuccess={(newStatus) => {
            setStatus(newStatus);
            setSuccessMessage('Household has been successfully marked as Inactive.');
            loadFamilyData();
          }}
        />
      )}

      {/* Approve Household Modal - Always confirms before code allocation */}
      {id && (
        <ApproveFamilyModal
          isOpen={isApproveModalOpen}
          onClose={() => {
            setIsApproveModalOpen(false);
            setCurrentApprovePayload(null);
          }}
          familyId={Number(id)}
          houseName={houseName}
          headName={headName}
          unitName={
            selectedUnitId === 'UNASSIGNED'
              ? null
              : units.find((u) => String(u.id) === selectedUnitId)?.unitName || null
          }
          registrationType={registrationType}
          membersCount={1 + (hasSpouse ? 1 : 0) + children.length}
          updatePayload={currentApprovePayload}
          onSuccess={(allocatedCode) => {
            setStatus('ACTIVE');
            setFamilyCode(allocatedCode);
            setCurrentApprovePayload(null);
            setSuccessMessage(`Registration officially updated and approved! Family code allocated: ${allocatedCode}`);
            loadFamilyData();
          }}
        />
      )}

      {/* Reactivate Household Modal - Confirmation window */}
      {id && (
        <ReactivateFamilyModal
          isOpen={isReactivateModalOpen}
          onClose={() => setIsReactivateModalOpen(false)}
          familyId={Number(id)}
          houseName={houseName}
          familyCode={familyCode}
          headName={headName}
          unitName={
            selectedUnitId === 'UNASSIGNED'
              ? null
              : units.find((u) => String(u.id) === selectedUnitId)?.unitName || null
          }
          onSuccess={(newStatus) => {
            setStatus(newStatus);
            setSuccessMessage(`Household "${houseName}" has been successfully restored to ACTIVE status.`);
            loadFamilyData();
          }}
        />
      )}

      {/* Reject Registration Modal - Confirmation window */}
      {id && (
        <RejectFamilyModal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          familyId={Number(id)}
          houseName={houseName}
          headName={headName}
          onSuccess={() => {
            setStatus('INACTIVE');
            setSuccessMessage(`Registration for "${houseName}" marked as declined / inactive.`);
            loadFamilyData();
          }}
        />
      )}
      {/* Direct Debit Modal (Option B: Dedicated window with auditing) */}
      {id && directDebitPerms.canView && (
        <DirectDebitModal
          isOpen={isDirectDebitModalOpen}
          onClose={() => setIsDirectDebitModalOpen(false)}
          familyId={Number(id)}
          houseName={houseName}
          familyCode={familyCode}
          currentDirectDebit={directDebitData}
          canEdit={directDebitPerms.canEdit}
          onSuccess={(updated) => {
            setDirectDebitData(updated);
            setHasDirectDebit(Boolean(updated?.active));
            setSuccessMessage('Direct Debit details updated and logged in the Record History.');
            loadFamilyData();
          }}
        />
      )}
    </div>
  );
};
