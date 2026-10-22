import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ConfirmButton } from '../ui/ConfirmButton';
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { api } from '../../lib/api';
import {
  Home,
  User,
  Users,
  MapPin,
  Church,
  ShieldCheck,
  Save,
  AlertTriangle,
  AlertCircle,
  Plus,
  ExternalLink,
} from 'lucide-react';

export interface ChildItem {
  fullName: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
}

export interface PreviewRecordData {
  registrationType: 'FAMILY' | 'INDIVIDUAL_STUDENT' | 'INDIVIDUAL';
  houseName: string;
  unitId: number | null;
  unitName: string;
  headName: string;
  headDob: string;
  headPob: string;
  headPhone: string;
  headEmail: string;
  hasSpouse: boolean;
  spouseName: string;
  spouseDob: string;
  spousePob: string;
  spousePhone: string;
  spouseEmail: string;
  children: ChildItem[];
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  originParish: string;
  originDiocese: string;
  generalNotes: string;
}

export interface PreviewRecord {
  rowIndex: number;
  tempId: string;
  status: 'READY' | 'WARNING' | 'ERROR';
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateInfo?: {
    id: number;
    familyCode?: string | null;
    houseName: string;
    headFullName?: string | null;
    status: string;
  } | null;
  data: PreviewRecordData;
}

interface VerifyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: PreviewRecord | null;
  units: Array<{ id: number; unitName: string }>;
  canApprove: boolean;
  onSaveSuccess: (result: {
    tempId: string;
    mode: 'PENDING' | 'ACTIVE';
    id: number;
    familyCode?: string | null;
    houseName: string;
  }) => void;
}

export const VerifyRegistrationModal: React.FC<VerifyRegistrationModalProps> = ({
  isOpen,
  onClose,
  record,
  units,
  canApprove,
  onSaveSuccess,
}) => {
  if (!record) return null;

  // Form State initialized from record
  const [registrationType, setRegistrationType] = useState<string>(record.data.registrationType || 'FAMILY');
  const [houseName, setHouseName] = useState<string>(record.data.houseName || '');
  const [unitId, setUnitId] = useState<string>(record.data.unitId ? String(record.data.unitId) : 'UNASSIGNED');

  // Head
  const [headName, setHeadName] = useState<string>(record.data.headName || '');
  const [headDob, setHeadDob] = useState<string>(record.data.headDob || '');
  const [headPob, setHeadPob] = useState<string>(record.data.headPob || '');
  const [headPhone, setHeadPhone] = useState<string>(record.data.headPhone || '');
  const [headEmail, setHeadEmail] = useState<string>(record.data.headEmail || '');

  // Spouse
  const [hasSpouse, setHasSpouse] = useState<boolean>(record.data.hasSpouse || Boolean(record.data.spouseName));
  const [spouseName, setSpouseName] = useState<string>(record.data.spouseName || '');
  const [spouseDob, setSpouseDob] = useState<string>(record.data.spouseDob || '');
  const [spousePob, setSpousePob] = useState<string>(record.data.spousePob || '');
  const [spousePhone, setSpousePhone] = useState<string>(record.data.spousePhone || '');
  const [spouseEmail, setSpouseEmail] = useState<string>(record.data.spouseEmail || '');

  // Children
  const [children, setChildren] = useState<ChildItem[]>(record.data.children || []);

  // Address
  const [streetAddress, setStreetAddress] = useState<string>(record.data.streetAddress || '');
  const [city, setCity] = useState<string>(record.data.city || '');
  const [state, setState] = useState<string>(record.data.state || '');
  const [postalCode, setPostalCode] = useState<string>(record.data.postalCode || '');

  // Roots
  const [originParish, setOriginParish] = useState<string>(record.data.originParish || '');
  const [originDiocese, setOriginDiocese] = useState<string>(record.data.originDiocese || '');

  // Notes
  const [generalNotes, setGeneralNotes] = useState<string>(record.data.generalNotes || '');

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever record prop changes
  useEffect(() => {
    if (record) {
      setRegistrationType(record.data.registrationType || 'FAMILY');
      setHouseName(record.data.houseName || '');
      setUnitId(record.data.unitId ? String(record.data.unitId) : 'UNASSIGNED');
      setHeadName(record.data.headName || '');
      setHeadDob(record.data.headDob || '');
      setHeadPob(record.data.headPob || '');
      setHeadPhone(record.data.headPhone || '');
      setHeadEmail(record.data.headEmail || '');
      setHasSpouse(record.data.hasSpouse || Boolean(record.data.spouseName));
      setSpouseName(record.data.spouseName || '');
      setSpouseDob(record.data.spouseDob || '');
      setSpousePob(record.data.spousePob || '');
      setSpousePhone(record.data.spousePhone || '');
      setSpouseEmail(record.data.spouseEmail || '');
      setChildren(record.data.children || []);
      setStreetAddress(record.data.streetAddress || '');
      setCity(record.data.city || '');
      setState(record.data.state || '');
      setPostalCode(record.data.postalCode || '');
      setOriginParish(record.data.originParish || '');
      setOriginDiocese(record.data.originDiocese || '');
      setGeneralNotes(record.data.generalNotes || '');
      setErrorMessage(null);
    }
  }, [record]);

  // Child helpers
  const handleAddChild = () => {
    setChildren([...children, { fullName: '', dateOfBirth: '', placeOfBirth: '' }]);
  };

  const handleUpdateChild = (index: number, field: keyof ChildItem, value: string) => {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value };
    setChildren(updated);
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const validateInputs = (): boolean => {
    if (!houseName.trim()) {
      setErrorMessage('House Name (Veettuperu) is required.');
      return false;
    }
    if (!headName.trim()) {
      setErrorMessage('Head of Family full name is required.');
      return false;
    }
    return true;
  };

  // Submit Handler
  const handleSave = async (approveImmediately: boolean) => {
    if (!validateInputs()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = {
        registrationType,
        houseName: houseName.trim(),
        unitId: unitId === 'UNASSIGNED' ? null : parseInt(unitId, 10),
        headName: headName.trim(),
        headDob: headDob || null,
        headPob: headPob || null,
        headPhone: headPhone || null,
        headEmail: headEmail || null,
        hasSpouse: registrationType === 'FAMILY' ? hasSpouse : false,
        spouseName: registrationType === 'FAMILY' && hasSpouse ? spouseName.trim() : null,
        spouseDob: registrationType === 'FAMILY' && hasSpouse ? spouseDob || null : null,
        spousePob: registrationType === 'FAMILY' && hasSpouse ? spousePob || null : null,
        spousePhone: registrationType === 'FAMILY' && hasSpouse ? spousePhone || null : null,
        spouseEmail: registrationType === 'FAMILY' && hasSpouse ? spouseEmail || null : null,
        children: registrationType === 'FAMILY' ? children.filter((c) => c.fullName.trim() !== '') : [],
        streetAddress: streetAddress || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        originParish: originParish || null,
        originDiocese: originDiocese || null,
        generalNotes: generalNotes || null,
        approveImmediately,
      };

      const res = await api.post('/import/save-single', payload);

      onSaveSuccess({
        tempId: record.tempId,
        mode: approveImmediately ? 'ACTIVE' : 'PENDING',
        id: res.data.family.id,
        familyCode: res.data.family.familyCode,
        houseName: res.data.family.houseName,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to save imported registration:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save registration. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Verify Registration — Row #${record.rowIndex}`}
      description="Inspect extracted details from this CSV row. You can make adjustments and choose to save as pending or approve immediately."
      maxWidth="2xl"
      closeOnEsc={!isSubmitting}
    >
      <div className="space-y-5">
        {/* Error / Warning Banners */}
        {record.isDuplicate && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Duplicate Warning: </span>
                <span>
                  This household matches an existing entry in the parish directory (
                  <span className="font-mono font-bold text-amber-950">
                    {record.duplicateInfo?.familyCode || `#${record.duplicateInfo?.id}`}
                  </span>
                  {' — '}
                  <span className="font-semibold">{record.duplicateInfo?.houseName}</span>
                  {record.duplicateInfo?.status && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${record.duplicateInfo.status === 'PENDING'
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                      {record.duplicateInfo.status}
                    </span>
                  )}
                  ). Please verify to avoid double-entry.
                </span>
              </div>
            </div>

            {record.duplicateInfo?.id && (
              <a
                href={`/register?search=${encodeURIComponent(record.duplicateInfo.familyCode || `#${record.duplicateInfo.id}`)}&status=`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shrink-0 shadow-2xs self-start sm:self-center cursor-pointer"
                title="View existing record in Parish Register"
              >
                <span>View {record.duplicateInfo.familyCode || `#${record.duplicateInfo.id}`}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Head of Family */}
        <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-parish-primary" />
              1. Head of Family (Mandatory)
            </h4>
            <Badge variant="subtle" size="sm">
              Row #{record.rowIndex}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. Thomas Joseph"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Date of Birth (YYYY-MM-DD)
              </label>
              <Input
                type="date"
                value={headDob}
                onChange={(e) => setHeadDob(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Place of Birth
              </label>
              <Input
                value={headPob}
                onChange={(e) => setHeadPob(e.target.value)}
                placeholder="e.g. Pala"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Primary Phone
              </label>
              <Input
                type="tel"
                value={headPhone}
                onChange={(e) => setHeadPhone(e.target.value)}
                placeholder="04xx xxx xxx"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Primary Email
              </label>
              <Input
                type="email"
                value={headEmail}
                onChange={(e) => setHeadEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Household & Ward */}
        <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-parish-primary" />
            2. Household & Ward Allocation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Registration Type <span className="text-red-500">*</span>
              </label>
              <select
                value={registrationType}
                onChange={(e) => setRegistrationType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-white text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="FAMILY">Family Household</option>
                <option value="INDIVIDUAL_STUDENT">International Student</option>
                <option value="INDIVIDUAL">Single Individual</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                House Name (Veettuperu) <span className="text-red-500">*</span>
              </label>
              <Input
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                placeholder="e.g. Vadakumpadan"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">
                Family Unit / Ward
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-white text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="UNASSIGNED">Unassigned (Review on Approval)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Spouse (Family only) */}
        {registrationType === 'FAMILY' && (
          <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-parish-primary" />
                3. Spouse Details (Optional)
              </h4>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-parish-text">
                <input
                  type="checkbox"
                  checked={hasSpouse}
                  onChange={(e) => setHasSpouse(e.target.checked)}
                  className="rounded border-parish-border text-parish-primary focus:ring-parish-primary"
                />
                Include Spouse
              </label>
            </div>

            {hasSpouse && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-parish-text mb-1">
                    Spouse Full Name
                  </label>
                  <Input
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="e.g. Mary Thomas"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-parish-text mb-1">
                    Date of Birth
                  </label>
                  <Input
                    type="date"
                    value={spouseDob}
                    onChange={(e) => setSpouseDob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-parish-text mb-1">
                    Place of Birth
                  </label>
                  <Input
                    value={spousePob}
                    onChange={(e) => setSpousePob(e.target.value)}
                    placeholder="e.g. Kanjirapally"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-parish-text mb-1">
                    Spouse Phone
                  </label>
                  <Input
                    type="tel"
                    value={spousePhone}
                    onChange={(e) => setSpousePhone(e.target.value)}
                    placeholder="04xx xxx xxx"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-parish-text mb-1">
                    Spouse Email
                  </label>
                  <Input
                    type="email"
                    value={spouseEmail}
                    onChange={(e) => setSpouseEmail(e.target.value)}
                    placeholder="spouse@example.com"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Children / Dependents (Family only) */}
        {registrationType === 'FAMILY' && (
          <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-parish-primary" />
                4. Children & Dependents ({children.length})
              </h4>
              <button
                type="button"
                onClick={handleAddChild}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-parish-primary-light text-parish-primary hover:bg-parish-primary-light/80 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Child
              </button>
            </div>

            {children.length === 0 ? (
              <p className="text-xs text-parish-text-muted italic py-1">No children found in this CSV row.</p>
            ) : (
              <div className="space-y-2.5">
                {children.map((child, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-parish-border flex items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-parish-surface-subtle text-parish-text-muted text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                      <Input
                        value={child.fullName}
                        onChange={(e) => handleUpdateChild(idx, 'fullName', e.target.value)}
                        placeholder="Child Full Name"
                      />
                      <Input
                        type="date"
                        value={child.dateOfBirth || ''}
                        onChange={(e) => handleUpdateChild(idx, 'dateOfBirth', e.target.value)}
                      />
                      <Input
                        value={child.placeOfBirth || ''}
                        onChange={(e) => handleUpdateChild(idx, 'placeOfBirth', e.target.value)}
                        placeholder="Place of Birth"
                      />
                    </div>

                    <ConfirmDeleteButton
                      onDelete={() => handleRemoveChild(idx)}
                      hasContent={Boolean(child.fullName?.trim() || child.dateOfBirth || child.placeOfBirth)}
                      confirmLabel="Remove?"
                      title="Remove Child"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 5: Australian Address & Roots in India */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Address */}
          <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-parish-primary" />
              5. Australian Address
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">Street Address</label>
              <Input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. 12 Sunshine Parade"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-parish-text mb-1">City / Suburb</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-parish-text mb-1">State</label>
                <Input value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-parish-text mb-1">Postcode</label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Roots */}
          <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-parish-text flex items-center gap-1.5">
              <Church className="w-3.5 h-3.5 text-parish-primary" />
              6. Roots in India
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">Origin Parish in India</label>
              <Input
                value={originParish}
                onChange={(e) => setOriginParish(e.target.value)}
                placeholder="e.g. St. Thomas Cathedral"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">Origin Diocese in India</label>
              <Input
                value={originDiocese}
                onChange={(e) => setOriginDiocese(e.target.value)}
                placeholder="e.g. Pala, Ernakulam-Angamaly"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-parish-text mb-1">General Notes</label>
              <Input
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Comments or notes..."
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-parish-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Action 1: Save as Pending */}
            <ConfirmButton
              variant="outline"
              confirmVariant="primary"
              onConfirm={() => handleSave(false)}
              beforeConfirm={validateInputs}
              isLoading={isSubmitting}
              icon={<Save className="w-4 h-4 text-parish-primary" />}
              confirmLabel="Confirm Save"
              className="w-full sm:w-auto border-parish-border hover:bg-parish-surface-subtle"
            >
              Save as Pending
            </ConfirmButton>

            {/* Action 2: Save & Approve Immediately (Authorized users only) */}
            {canApprove && (
              <ConfirmButton
                variant="primary"
                confirmVariant="primary"
                size="md"
                onConfirm={() => handleSave(true)}
                beforeConfirm={validateInputs}
                isLoading={isSubmitting}
                icon={<ShieldCheck className="w-4 h-4 text-white" />}
                confirmLabel="Confirm & Approve?"
                className="w-full sm:w-auto shadow-soft font-bold"
              >
                Save & Approve Immediately
              </ConfirmButton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
