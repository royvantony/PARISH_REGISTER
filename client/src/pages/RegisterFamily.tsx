import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { ConfirmDeleteButton } from '../components/ui/ConfirmDeleteButton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  ArrowLeft,
  Users,
  GraduationCap,
  User,
  MapPin,
  Home,
  Phone,
  Mail,
  Church,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Save,
} from 'lucide-react';

interface MemberFormData {
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

export const RegisterFamilyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Reference Data
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [dioceses, setDioceses] = useState<DioceseOption[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Form State
  const [registrationType, setRegistrationType] = useState<'FAMILY' | 'INDIVIDUAL_STUDENT' | 'INDIVIDUAL'>('FAMILY');
  const [houseName, setHouseName] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('UNASSIGNED');

  // Head of Family (Mandatory)
  const [headName, setHeadName] = useState('');
  const [headDob, setHeadDob] = useState('');
  const [headPob, setHeadPob] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [headEmail, setHeadEmail] = useState('');

  // Spouse (Optional, Family type only)
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseName, setSpouseName] = useState('');
  const [spouseDob, setSpouseDob] = useState('');
  const [spousePob, setSpousePob] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [spouseEmail, setSpouseEmail] = useState('');

  // Children / Dependents
  const [children, setChildren] = useState<MemberFormData[]>([]);

  // Address in Australia
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Brisbane');
  const [state, setState] = useState('QLD');
  const [postalCode, setPostalCode] = useState('');

  // Roots in India
  const [originParish, setOriginParish] = useState('');
  const [originDiocese, setOriginDiocese] = useState('');

  // General & Pastoral Notes
  const [generalNotes, setGeneralNotes] = useState('');

  // Approval option (for users with approval permission)
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Status & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ id: number; status: string; familyCode: string | null } | null>(null);

  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        setIsInitializing(true);
        const [unitsRes, diocesesRes, approveRes] = await Promise.all([
          api.get<UnitOption[]>('/masters/units'),
          api.get<DioceseOption[]>('/masters/dioceses').catch(() => ({ data: [] })),
          api.get<{ canApprove: boolean }>('/permissions/can-approve').catch(() => ({ data: { canApprove: false } })),
        ]);
        setUnits(unitsRes.data);
        setDioceses(diocesesRes.data);
        setCanApprove(approveRes.data.canApprove);
        if (!approveRes.data.canApprove) {
          setActivateImmediately(false);
        }
      } catch (err: any) {
        console.error('Failed to load form prerequisites:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    loadPrerequisites();
  }, []);

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

  const validateForm = (): boolean => {
    setErrorMessage(null);

    if (!houseName.trim()) {
      setErrorMessage('House name / Family name is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    if (!headName.trim()) {
      setErrorMessage('Head of family full name is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Require explicit confirmation window whenever immediately approving & allocating family code
    if (canApprove && activateImmediately) {
      setIsConfirmModalOpen(true);
      return;
    }

    executeSubmit();
  };

  const executeSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Build members payload
      const membersPayload: any[] = [
        {
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
        status: canApprove && activateImmediately ? 'ACTIVE' : 'PENDING',
        members: membersPayload,
      };

      const res = await api.post('/families', payload);
      setIsConfirmModalOpen(false);
      setSuccessData({
        id: res.data.id,
        status: res.data.status,
        familyCode: res.data.familyCode,
      });
    } catch (err: any) {
      console.error('Failed to register family:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to submit registration. Please verify the details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitializing) {
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

  if (successData) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-8 shadow-soft text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-parish-text">
              {successData.status === 'ACTIVE' ? 'Registration Approved & Active!' : 'Registration Submitted for Approval'}
            </h2>
            <p className="text-xs text-parish-text-muted">
              {successData.status === 'ACTIVE'
                ? `Official family code allocated: ${successData.familyCode || '#' + successData.id}`
                : 'Your submission has been placed in the pending approval queue for review by parish authorities.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant={successData.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
              Status: {successData.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING APPROVAL'}
            </Badge>
          </div>

          <div className="pt-4 border-t border-parish-border flex items-center justify-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/register')}>
              Go to Parish Register
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setSuccessData(null);
                setHouseName('');
                setHeadName('');
                setHeadDob('');
                setHeadPob('');
                setHeadPhone('');
                setHeadEmail('');
                setSpouseName('');
                setChildren([]);
                setGeneralNotes('');
              }}
            >
              Register Another Parishioner
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => navigate('/register')}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-parish-text">
                Register Parishioner
              </h1>
              <Badge variant="default" size="sm">
                New Household
              </Badge>
            </div>
            <p className="text-xs text-parish-text-muted">
              Register a family household, independent student, or single parishioner.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Registration Type & Household */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
            <Home className="w-4 h-4 text-parish-primary" />
            1. Registration Type & Ward
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'FAMILY', label: 'Family Household', desc: 'Married couple & children', icon: <Users className="w-4 h-4" /> },
              { type: 'INDIVIDUAL_STUDENT', label: 'International Student', desc: 'Student studying in Brisbane', icon: <GraduationCap className="w-4 h-4" /> },
              { type: 'INDIVIDUAL', label: 'Single Individual', desc: 'Single adult parishioner', icon: <User className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => setRegistrationType(t.type as any)}
                className={`p-3.5 rounded-xl border text-left transition-all ${registrationType === t.type
                    ? 'border-parish-primary bg-parish-primary-light/50 ring-1 ring-parish-primary text-parish-text'
                    : 'border-parish-border bg-white text-parish-text-muted hover:border-parish-text-muted/60'
                  }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-parish-text">
                  <span className={registrationType === t.type ? 'text-parish-primary' : 'text-parish-text-muted'}>
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                </div>
                <div className="text-[11px] text-parish-text-muted mt-1">{t.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                House Name / Family Name (Veettuperu) <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Valiyaveettil, Thoppil, Pulickal"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                required
              />
              <span className="text-[11px] text-parish-text-muted mt-0.5 block">
                Ancestral or household name used for parish directory.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Family Unit / Ward Allocation
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-white text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="UNASSIGNED">⚠️ Unassigned (No Ward / To be allocated)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitName === 'Nil' ? 'Nil' : `${u.unitName} Ward`}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-parish-text-muted mt-0.5 block">
                Can be kept unassigned and allocated to a ward coordinator later.
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Head of Family */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
            <User className="w-4 h-4 text-parish-primary" />
            2. Parishioner / Head of Household
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-parish-text mb-1">
                Full Legal Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Thomas Mathew"
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Date of Birth
              </label>
              <Input
                type="date"
                value={headDob}
                onChange={(e) => setHeadDob(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Place of Birth (India / Overseas)
              </label>
              <Input
                placeholder="e.g. Pala, Kottayam"
                value={headPob}
                onChange={(e) => setHeadPob(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Mobile Phone
              </label>
              <Input
                placeholder="e.g. 0412 345 678"
                value={headPhone}
                onChange={(e) => setHeadPhone(e.target.value)}
                icon={<Phone className="w-3.5 h-3.5" />}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="e.g. thomas@example.com"
                value={headEmail}
                onChange={(e) => setHeadEmail(e.target.value)}
                icon={<Mail className="w-3.5 h-3.5" />}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Spouse (Only for FAMILY) */}
        {registrationType === 'FAMILY' && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
                <Users className="w-4 h-4 text-parish-primary" />
                3. Spouse Details
              </h2>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSpouse}
                  onChange={(e) => setHasSpouse(e.target.checked)}
                  className="rounded border-parish-border text-parish-primary focus:ring-parish-primary"
                />
                <span>Include Spouse</span>
              </label>
            </div>

            {hasSpouse ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Spouse Date of Birth
                  </label>
                  <Input
                    type="date"
                    value={spouseDob}
                    onChange={(e) => setSpouseDob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Spouse Place of Birth
                  </label>
                  <Input
                    placeholder="e.g. Ernakulam"
                    value={spousePob}
                    onChange={(e) => setSpousePob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Spouse Mobile Phone
                  </label>
                  <Input
                    placeholder="e.g. 0423 456 789"
                    value={spousePhone}
                    onChange={(e) => setSpousePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Spouse Email
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. mary@example.com"
                    value={spouseEmail}
                    onChange={(e) => setSpouseEmail(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-parish-text-muted">
                Check "Include Spouse" if registering as a married couple.
              </p>
            )}
          </div>
        )}

        {/* SECTION 4: Children / Dependents (Only for FAMILY) */}
        {registrationType === 'FAMILY' && (
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
                  <Users className="w-4 h-4 text-parish-primary" />
                  4. Children & Dependents ({children.length})
                </h2>
                <p className="text-xs text-parish-text-muted">
                  Add children or other family members living in this household.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddChild}
              >
                Add Child / Dependent
              </Button>
            </div>

            {children.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-parish-border rounded-xl text-xs text-parish-text-muted">
                No children added yet. Click "+ Add Child / Dependent" to add members.
              </div>
            ) : (
              <div className="space-y-3">
                {children.map((child, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-parish-border bg-parish-surface-subtle/60 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-parish-text">
                        Member #{idx + 1}
                      </span>
                      <ConfirmDeleteButton
                        onDelete={() => handleRemoveChild(idx)}
                        hasContent={Boolean(child.fullName.trim() || child.dateOfBirth || child.placeOfBirth || child.phone || child.email)}
                        confirmLabel="Remove?"
                        title="Remove member"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">Role</label>
                        <select
                          value={child.role}
                          onChange={(e) => handleChildChange(idx, 'role', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-parish-border bg-white"
                        >
                          <option value="CHILD">Child</option>
                          <option value="OTHER_DEPENDENT">Other Dependent / Parent</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-parish-text mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Austin Thomas"
                          value={child.fullName}
                          onChange={(e) => handleChildChange(idx, 'fullName', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">Date of Birth</label>
                        <Input
                          type="date"
                          value={child.dateOfBirth}
                          onChange={(e) => handleChildChange(idx, 'dateOfBirth', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">Phone (Optional)</label>
                        <Input
                          placeholder="Mobile"
                          value={child.phone}
                          onChange={(e) => handleChildChange(idx, 'phone', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-parish-text mb-1">Email (Optional)</label>
                        <Input
                          type="email"
                          placeholder="Email"
                          value={child.email}
                          onChange={(e) => handleChildChange(idx, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: Address in Australia */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
            <MapPin className="w-4 h-4 text-parish-primary" />
            {registrationType === 'FAMILY' ? '5. Australian Residential Address' : '3. Australian Residential Address'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-parish-text mb-1">
                Street Address
              </label>
              <Input
                placeholder="e.g. 124 Church Street"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Suburb / City
              </label>
              <Input
                placeholder="Brisbane"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-parish-text mb-1">State</label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-parish-text mb-1">Postcode</label>
                <Input
                  placeholder="e.g. 4000"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6: Roots in India */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text flex items-center gap-2">
            <Church className="w-4 h-4 text-parish-primary" />
            {registrationType === 'FAMILY' ? '6. Roots in India' : '4. Roots in India'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Home Parish in India
              </label>
              <Input
                placeholder="e.g. St. Mary's Forane Church, Kuravilangad"
                value={originParish}
                onChange={(e) => setOriginParish(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-parish-text mb-1">
                Native Diocese in India
              </label>
              {dioceses.length > 0 ? (
                <select
                  value={originDiocese}
                  onChange={(e) => setOriginDiocese(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-white text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
                >
                  <option value="">Select Native Diocese...</option>
                  {dioceses.map((d) => (
                    <option key={d.id} value={d.dioceseName}>
                      {d.dioceseName}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="e.g. Palai, Ernakulam, Thrissur"
                  value={originDiocese}
                  onChange={(e) => setOriginDiocese(e.target.value)}
                />
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-parish-text mb-1">
                Pastoral & Household Notes
              </label>
              <textarea
                rows={3}
                placeholder="Enter any additional registration remarks, visa status notes, or pastoral background..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-white text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              />
            </div>
          </div>
        </div>

        {/* SECTION 7: Submission & Approval Workflow */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-parish-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-parish-text">
              Approval Status
            </h2>
          </div>

          {canApprove ? (
            <div className="p-4 rounded-xl bg-parish-primary-light/60 border border-parish-border space-y-2">
              <div className="text-xs font-bold text-parish-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-parish-primary" />
                <span>You hold approval authority ({user?.role}).</span>
              </div>
              <p className="text-[11px] text-parish-text-muted">
                You can activate this registration immediately with an official family code, or queue it in Pending status for trustee/council review.
              </p>

              <div className="flex items-center gap-4 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-parish-text">
                  <input
                    type="radio"
                    name="approvalMode"
                    checked={activateImmediately}
                    onChange={() => setActivateImmediately(true)}
                    className="text-parish-primary focus:ring-parish-primary"
                  />
                  <span>Activate & Approve Immediately</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-parish-text-muted">
                  <input
                    type="radio"
                    name="approvalMode"
                    checked={!activateImmediately}
                    onChange={() => setActivateImmediately(false)}
                    className="text-parish-primary focus:ring-parish-primary"
                  />
                  <span>Submit as Pending Approval</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Approval Cycle Active</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                As a general user ({user?.role || 'Parish Staff'}), new registrations are submitted in <strong>PENDING</strong> status. An authorized Parish Priest or Trustee will verify and approve the registration before canonical family codes are issued.
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate('/register')}
            >
              Cancel
            </Button>

            {canApprove && activateImmediately ? (
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                icon={<Save className="w-4 h-4" />}
              >
                Create & Activate Household
              </Button>
            ) : (
              <ConfirmButton
                variant="primary"
                size="md"
                onConfirm={executeSubmit}
                beforeConfirm={validateForm}
                isLoading={isSubmitting}
                icon={<Save className="w-4 h-4" />}
                confirmLabel="Confirm Submit?"
              >
                Submit for Approval
              </ConfirmButton>
            )}
          </div>
        </div>
      </form>
      {/* Immediate Approval & Code Allocation Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Approval & Allocate Code"
        maxWidth="md"
        closeOnEsc={!isSubmitting}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-parish-primary-light/60 border border-parish-border text-parish-text flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-parish-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-parish-text text-sm">
                Immediate Registration Approval
              </p>
              <p className="text-parish-text-muted leading-relaxed">
                You are about to register and immediately activate this household. A permanent sequential parish family code will be generated and allocated right away.
              </p>
            </div>
          </div>

          {/* Household Summary Card */}
          <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-parish-border/70">
              <span className="font-bold uppercase tracking-wider text-parish-text-muted text-[11px]">
                Household Summary
              </span>
              <span className="font-semibold text-parish-primary bg-parish-primary-light px-2 py-0.5 rounded text-[11px] border border-parish-border">
                {registrationType === 'FAMILY'
                  ? 'Family Household'
                  : registrationType === 'INDIVIDUAL_STUDENT'
                    ? 'International Student'
                    : 'Individual Member'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Home className="w-3 h-3 text-parish-primary" /> House Name
                </span>
                <p className="font-bold text-sm text-parish-text">{houseName}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Users className="w-3 h-3 text-parish-primary" /> Head of Household
                </span>
                <p className="font-bold text-sm text-parish-text">{headName}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-600" /> Ward Assignment
                </span>
                <p className="font-semibold text-parish-text">
                  {selectedUnitId === 'UNASSIGNED'
                    ? <span className="text-amber-800 font-medium">⚠️ Unassigned (No Ward)</span>
                    : `${units.find((u) => String(u.id) === selectedUnitId)?.unitName} Ward`}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Users className="w-3 h-3 text-sky-600" /> Members Count
                </span>
                <p className="font-semibold text-parish-text">
                  {1 + (hasSpouse ? 1 : 0) + children.length} {1 + (hasSpouse ? 1 : 0) + children.length === 1 ? 'member' : 'members'} registered
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Sequence Notice:</strong> This action consumes the next sequential parish code and immediately marks this household as ACTIVE in all parish records and census reports.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-parish-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={executeSubmit}
              isLoading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Approval & Allocate Code
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
