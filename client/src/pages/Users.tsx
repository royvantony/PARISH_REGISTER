import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth, type UserRole } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  ShieldCheck,
  Plus,
  Search,
  Mail,
  MapPin,
  Church,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Sliders,
  UserCog,
  Save,
  RotateCcw,
  Users as UsersIcon,
  CreditCard,
  Clock,
  Settings as SettingsIcon,
  UserPlus,
  Copy,
  Check,
  Pencil,
  Sparkles,
} from 'lucide-react';

interface ParishUserItem {
  id: number;
  fullName: string;
  username?: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  parishId: number | null;
  parishName: string;
  parishCode: string;
  assignedUnitId: number | null;
  unitName: string | null;
  createdAt: string;
}

interface UnitOption {
  id: number;
  unitName: string;
}

interface SystemModule {
  key: string;
  name: string;
  category: string;
}

const MODULE_TO_FEATURE_KEY: Record<string, string> = {
  REGISTER: 'PAGE_REGISTER',
  REGISTER_NEW: 'PAGE_REGISTER_NEW',
  IMPORT_REGISTRATIONS: 'PAGE_REGISTER_IMPORT',
  DIRECT_DEBIT: 'REGISTER_DIRECT_DEBIT',
  WARDS: 'PAGE_UNITS',
  USERS: 'PAGE_USERS',
  DASHBOARD_ACTIVITY: 'DASH_ACTIVITY_FEED',
  SETTINGS: 'PAGE_SETTINGS',
};

interface RolePermRecord {
  id?: number;
  role: string;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove?: boolean;
}

interface UserEffectivePerm {
  module: string;
  name: string;
  category: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove?: boolean;
  isOverridden: boolean;
  base: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canArchive: boolean;
    canDelete: boolean;
    canExport: boolean;
    canApprove?: boolean;
  };
}

export const UsersPage: React.FC = () => {
  const { user: currentUser, activeParish, hasPermission } = useAuth();
  const { isFeatureEnabled, getStoredFlag } = useFeatures();

  const canCreateUser = hasPermission('USERS', 'canCreate');
  const canEditUsers = hasPermission('USERS', 'canEdit');
  const canArchiveUsers = hasPermission('USERS', 'canArchive');

  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'overrides'>('users');

  useEffect(() => {
    if (activeTab === 'matrix' && !isFeatureEnabled('USERS_TAB_MATRIX')) {
      setActiveTab('users');
    } else if (activeTab === 'overrides' && !isFeatureEnabled('USERS_TAB_OVERRIDES')) {
      setActiveTab('users');
    }
  }, [activeTab, isFeatureEnabled]);

  // Evaluates whether a functional module is permitted for the active parish by Developer Controls
  const isModuleAllowedByDeveloper = useCallback(
    (moduleKey: string): boolean => {
      const featKey = MODULE_TO_FEATURE_KEY[moduleKey];
      if (!featKey) return true;
      return getStoredFlag(featKey);
    },
    [getStoredFlag]
  );

  // Users List State
  const [users, setUsers] = useState<ParishUserItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Role Permissions Matrix State
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('PARISH_ADMIN');
  const [roleMatrix, setRoleMatrix] = useState<Record<string, Record<string, RolePermRecord>>>({});
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [matrixSuccessMsg, setMatrixSuccessMsg] = useState<string | null>(null);
  const [isMatrixInitialized, setIsMatrixInitialized] = useState<boolean>(true);

  // User Overrides State
  const [selectedOverrideUserId, setSelectedOverrideUserId] = useState<number | null>(null);
  const [overrideUserData, setOverrideUserData] = useState<{
    user: ParishUserItem;
    effective: UserEffectivePerm[];
  } | null>(null);
  const [userOverrides, setUserOverrides] = useState<Record<string, Partial<UserEffectivePerm>>>({});
  const [isOverrideLoading, setIsOverrideLoading] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);

  // Active modules filtered strictly by Developer Controls for this parish
  const allowedModules = useMemo(
    () => modules.filter((mod) => isModuleAllowedByDeveloper(mod.key)),
    [modules, isModuleAllowedByDeveloper]
  );

  const allowedOverrides = useMemo(
    () => overrideUserData?.effective.filter((item) => isModuleAllowedByDeveloper(item.module)) || [],
    [overrideUserData, isModuleAllowedByDeveloper]
  );

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('Parish2026!');
  const [inviteRole, setInviteRole] = useState<UserRole>('PARISH_USER');
  const [inviteUnitId, setInviteUnitId] = useState<string>('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdSuccessData, setCreatedSuccessData] = useState<{
    fullName: string;
    username?: string;
    email: string;
    role: string;
    password: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Edit User Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ParishUserItem | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('PARISH_USER');
  const [editUnitId, setEditUnitId] = useState<string>('');
  const [editPassword, setEditPassword] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Toggle Confirm Dialog
  const [confirmUser, setConfirmUser] = useState<ParishUserItem | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Initial Data Fetch
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, unitsRes] = await Promise.all([
        api.get<ParishUserItem[]>('/masters/users'),
        api.get<UnitOption[]>('/masters/units'),
      ]);
      setUsers(usersRes.data);
      setUnits(unitsRes.data);

      if (usersRes.data.length > 0 && !selectedOverrideUserId) {
        setSelectedOverrideUserId(usersRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch users or units:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Matrix
  const fetchMatrix = async () => {
    try {
      setIsMatrixLoading(true);
      const res = await api.get<{
        modules: SystemModule[];
        matrix: RolePermRecord[];
        isInitialized?: boolean;
      }>('/permissions/matrix');

      setModules(res.data.modules);
      setIsMatrixInitialized(Boolean(res.data.isInitialized));

      // Organize into Record<role, Record<module, record>>
      const structured: Record<string, Record<string, RolePermRecord>> = {};
      res.data.matrix.forEach((item) => {
        if (!structured[item.role]) structured[item.role] = {};
        structured[item.role][item.module] = item;
      });
      setRoleMatrix(structured);
    } catch (err: any) {
      console.error('Failed to fetch permission matrix:', err);
    } finally {
      setIsMatrixLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchMatrix();
    }
  }, [activeTab, activeParish?.id]);

  // Fetch User Effective Permissions & Overrides
  const fetchUserPermissions = async (userId: number) => {
    try {
      setIsOverrideLoading(true);
      setOverrideSuccessMsg(null);
      const res = await api.get<{
        user: ParishUserItem;
        effective: UserEffectivePerm[];
      }>(`/permissions/users/${userId}`);

      setOverrideUserData({
        user: res.data.user,
        effective: res.data.effective,
      });

      // Initialize state for overrides
      const initialOverrides: Record<string, Partial<UserEffectivePerm>> = {};
      res.data.effective.forEach((item) => {
        initialOverrides[item.module] = {
          canView: item.canView,
          canCreate: item.canCreate,
          canEdit: item.canEdit,
          canArchive: item.canArchive,
          canDelete: item.canDelete,
          canExport: item.canExport,
          canApprove: item.canApprove ?? false,
        };
      });
      setUserOverrides(initialOverrides);
    } catch (err: any) {
      console.error('Failed to fetch user permissions:', err);
    } finally {
      setIsOverrideLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overrides' && selectedOverrideUserId) {
      fetchUserPermissions(selectedOverrideUserId);
    }
  }, [activeTab, selectedOverrideUserId, activeParish?.id]);

  const handleOpenInvite = () => {
    setInviteFullName('');
    setInviteUsername('');
    setInviteEmail('');
    setInvitePassword('Parish2026!');
    setInviteRole('PARISH_USER');
    setInviteUnitId('');
    setInviteError(null);
    setCreatedSuccessData(null);
    setCopiedInvite(false);
    setIsInviteOpen(true);
  };

  const handleLinkParishPriest = () => {
    if (activeParish?.priestName) {
      setInviteFullName(activeParish.priestName);
    }
    if (activeParish?.priestEmail) {
      setInviteEmail(activeParish.priestEmail);
    }
    setInviteRole('PARISH_PRIEST');
    if (!inviteUsername) {
      const clean = (activeParish?.priestName || activeParish?.priestEmail || 'priest')
        .toLowerCase()
        .replace(/^fr\.?\s*/, '')
        .replace(/[^a-z0-9]/g, '.')
        .replace(/\.+/g, '.')
        .replace(/^\.|\.$/g, '');
      setInviteUsername(clean || 'priest');
    }
  };

  const handleLinkParishPriestInEdit = () => {
    if (activeParish?.priestName) {
      setEditFullName(activeParish.priestName);
      setEditRole('PARISH_PRIEST');
      if (!editUsername) {
        const clean = (activeParish.priestName || activeParish.priestEmail || 'priest')
          .toLowerCase()
          .replace(/^fr\.?\s*/, '')
          .replace(/[^a-z0-9]/g, '.')
          .replace(/\.+/g, '.')
          .replace(/^\.|\.$/g, '');
        setEditUsername(clean || 'priest');
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName.trim() || !inviteEmail.trim() || !invitePassword.trim()) {
      setInviteError('Please fill in all required fields.');
      return;
    }

    try {
      setInviteSubmitting(true);
      setInviteError(null);
      await api.post('/masters/users', {
        fullName: inviteFullName.trim(),
        username: inviteUsername.trim() || undefined,
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        role: inviteRole,
        assignedUnitId: inviteRole === 'WARD_USER' && inviteUnitId ? parseInt(inviteUnitId, 10) : null,
      });

      setCreatedSuccessData({
        fullName: inviteFullName.trim(),
        username: inviteUsername.trim() || undefined,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        password: invitePassword,
      });
      fetchData();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to create user account.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdSuccessData) return;
    const text = `⛪ St. Alphonsa Parish Register - Official Login
Hello ${createdSuccessData.fullName}, your account has been provisioned:
• Role: ${formatRoleLabel(createdSuccessData.role)}
• Username: ${createdSuccessData.username || createdSuccessData.email}
• Login Email: ${createdSuccessData.email}
• Temporary Password: ${createdSuccessData.password}
• Portal Link: ${window.location.origin}/login

Upon logging in, you will be prompted to set your own permanent password.`;

    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  const handleToggleStatus = async () => {
    if (!confirmUser) return;
    try {
      setIsToggling(true);
      await api.patch(`/masters/users/${confirmUser.id}/toggle-status`);
      setIsConfirmOpen(false);
      setConfirmUser(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change user status.');
    } finally {
      setIsToggling(false);
    }
  };

  // Hierarchy Helpers for Editing
  const canEditUser = (targetUser: ParishUserItem) => {
    if (!currentUser || !canEditUsers) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (targetUser.role === 'SUPER_ADMIN') return false;
    if (currentUser.role === 'PARISH_PRIEST') return true;
    if (currentUser.role === 'PARISH_ADMIN') {
      return targetUser.role === 'PARISH_USER' || targetUser.role === 'WARD_USER' || targetUser.id === currentUser.id;
    }
    return targetUser.id === currentUser.id;
  };

  const canChangeRole = (targetUser: ParishUserItem) => {
    if (!currentUser || !canEditUsers) return false;
    if (targetUser.id === currentUser.id) return false; // Cannot change own role
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.role === 'PARISH_PRIEST' && targetUser.role !== 'PARISH_PRIEST') return true;
    if (currentUser.role === 'PARISH_ADMIN' && (targetUser.role === 'PARISH_USER' || targetUser.role === 'WARD_USER')) return true;
    return false;
  };

  const handleOpenEdit = (user: ParishUserItem) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditUsername(user.username || '');
    setEditRole(user.role);
    setEditUnitId(user.assignedUnitId ? String(user.assignedUnitId) : '');
    setEditPassword('');
    setEditError(null);
    setIsEditOpen(true);
  };

  const validateEditUser = (): boolean => {
    if (!editingUser) return false;
    if (!editFullName.trim()) {
      setEditError('Full name is required.');
      return false;
    }
    if (editRole === 'WARD_USER' && !editUnitId) {
      setEditError('Please select an assigned ward for the Ward User.');
      return false;
    }
    return true;
  };

  const handleSaveEditUser = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!editingUser || !validateEditUser()) return;

    try {
      setEditSubmitting(true);
      setEditError(null);

      const payload: any = {
        fullName: editFullName.trim(),
        username: editUsername.trim() || null,
        role: editRole,
        assignedUnitId: editRole === 'WARD_USER' ? parseInt(editUnitId, 10) : null,
      };

      if (editPassword.trim()) {
        payload.newPassword = editPassword.trim();
      }

      const res = await api.patch(`/masters/users/${editingUser.id}`, payload);

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...res.data } : u))
      );
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update user.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Toggle Matrix Cell
  const handleToggleMatrixCell = (
    moduleKey: string,
    action: 'canView' | 'canCreate' | 'canEdit' | 'canArchive' | 'canDelete' | 'canExport' | 'canApprove'
  ) => {
    if (!canEditUsers) return;
    setRoleMatrix((prev) => {
      const currentRoleObj = { ...(prev[selectedRole] || {}) };
      const currentModuleRecord = currentRoleObj[moduleKey] || {
        role: selectedRole,
        module: moduleKey,
        canView: false,
        canCreate: false,
        canEdit: false,
        canArchive: false,
        canDelete: false,
        canExport: false,
        canApprove: false,
      };

      const nextVal = !currentModuleRecord[action];
      let updatedRecord: RolePermRecord;

      if (action === 'canView' && !nextVal) {
        // Toggling view OFF must turn off all other actions
        updatedRecord = {
          ...currentModuleRecord,
          canView: false,
          canCreate: false,
          canEdit: false,
          canArchive: false,
          canDelete: false,
          canExport: false,
          canApprove: false,
        };
      } else if (action !== 'canView' && nextVal && !currentModuleRecord.canView) {
        // Turning an action ON requires turning canView ON
        updatedRecord = {
          ...currentModuleRecord,
          [action]: true,
          canView: true,
        };
      } else {
        updatedRecord = {
          ...currentModuleRecord,
          [action]: nextVal,
        };
      }

      currentRoleObj[moduleKey] = updatedRecord;

      return {
        ...prev,
        [selectedRole]: currentRoleObj,
      };
    });
  };

  // Save Role Matrix
  const handleSaveRoleMatrix = async () => {
    try {
      setIsSavingMatrix(true);
      setMatrixSuccessMsg(null);
      const permissionsArray = Object.values(roleMatrix[selectedRole] || {});
      await api.put(`/permissions/roles/${selectedRole}`, {
        permissions: permissionsArray,
      });
      setMatrixSuccessMsg(`Permissions updated for ${selectedRole}`);
      setTimeout(() => setMatrixSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role permissions.');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Toggle User Override Cell
  const handleToggleUserOverrideCell = (
    moduleKey: string,
    action: 'canView' | 'canCreate' | 'canEdit' | 'canArchive' | 'canDelete' | 'canExport' | 'canApprove'
  ) => {
    if (!canEditUsers) return;
    setUserOverrides((prev) => {
      const current = prev[moduleKey] || {};
      const nextVal = !current[action];

      if (action === 'canView' && !nextVal) {
        // Toggling view OFF must turn off all other actions
        return {
          ...prev,
          [moduleKey]: {
            ...current,
            canView: false,
            canCreate: false,
            canEdit: false,
            canArchive: false,
            canDelete: false,
            canExport: false,
            canApprove: false,
          },
        };
      } else if (action !== 'canView' && nextVal && !current.canView) {
        // Turning an action ON requires turning canView ON
        return {
          ...prev,
          [moduleKey]: {
            ...current,
            [action]: true,
            canView: true,
          },
        };
      }

      return {
        ...prev,
        [moduleKey]: {
          ...current,
          [action]: nextVal,
        },
      };
    });
  };

  // Save User Overrides
  const handleSaveUserOverrides = async () => {
    if (!selectedOverrideUserId) return;
    try {
      setIsSavingOverride(true);
      setOverrideSuccessMsg(null);
      const overridesArray = Object.entries(userOverrides).map(([module, perms]) => ({
        module,
        ...perms,
      }));

      await api.put(`/permissions/users/${selectedOverrideUserId}/overrides`, {
        overrides: overridesArray,
      });

      setOverrideSuccessMsg('User overrides saved successfully!');
      fetchUserPermissions(selectedOverrideUserId);
      setTimeout(() => setOverrideSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save user overrides.');
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Clear User Overrides (Reset to Role)
  const handleClearUserOverrides = async () => {
    if (!selectedOverrideUserId) return;
    if (!confirm('Are you sure you want to clear all custom overrides for this user? They will inherit role defaults.')) {
      return;
    }

    try {
      setIsSavingOverride(true);
      await api.delete(`/permissions/users/${selectedOverrideUserId}/overrides`);
      fetchUserPermissions(selectedOverrideUserId);
    } catch (err: any) {
      alert('Failed to reset user overrides.');
    } finally {
      setIsSavingOverride(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'default';
      case 'DIOCESAN_ADMIN':
        return 'default';
      case 'DIOCESAN_USER':
        return 'subtle';
      case 'PARISH_PRIEST':
        return 'default';
      case 'PARISH_ADMIN':
        return 'success';
      case 'PARISH_USER':
        return 'info';
      case 'WARD_USER':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'DIOCESAN_ADMIN':
        return 'Diocesan Admin';
      case 'DIOCESAN_USER':
        return 'Diocesan User';
      case 'PARISH_PRIEST':
        return 'Parish Priest';
      case 'PARISH_ADMIN':
        return 'Parish Admin';
      case 'PARISH_USER':
        return 'Parish User';
      case 'WARD_USER':
        return 'Ward User';
      default:
        return role;
    }
  };

  const getModuleIcon = (key: string) => {
    switch (key) {
      case 'REGISTER':
        return <UsersIcon className="w-4 h-4 text-parish-primary" />;
      case 'REGISTER_NEW':
        return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case 'DIRECT_DEBIT':
        return <CreditCard className="w-4 h-4 text-sky-600" />;
      case 'WARDS':
        return <MapPin className="w-4 h-4 text-amber-600" />;
      case 'USERS':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'DASHBOARD_ACTIVITY':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'SETTINGS':
        return <SettingsIcon className="w-4 h-4 text-slate-600" />;
      default:
        return <ShieldCheck className="w-4 h-4" />;
    }
  };

  const parishUsers = users.filter(
    (u) =>
      u.role === 'PARISH_PRIEST' ||
      u.role === 'PARISH_ADMIN' ||
      u.role === 'PARISH_USER' ||
      u.role === 'WARD_USER'
  );

  const filteredUsers = parishUsers.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.unitName && u.unitName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Main Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
              Users & Access Control
            </h1>
            <Badge variant="default" size="sm">
              Role-Based Access Control & Overrides
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-parish-text-muted mt-1 max-w-2xl">
            Configure system accounts, role permission templates, screen visibility, and granular user overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' && canCreateUser && (
            <Button
              variant="primary"
              onClick={handleOpenInvite}
              icon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Create User
            </Button>
          )}
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex border-b border-parish-border gap-2 overflow-x-auto">
        {isFeatureEnabled('USERS_TAB_LIST') && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[42px] ${activeTab === 'users'
              ? 'border-parish-primary text-parish-primary'
              : 'border-transparent text-parish-text-muted hover:text-parish-text'
              }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Authorized Users ({parishUsers.length})</span>
          </button>
        )}

        {isFeatureEnabled('USERS_TAB_MATRIX') && (
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[42px] ${activeTab === 'matrix'
              ? 'border-parish-primary text-parish-primary'
              : 'border-transparent text-parish-text-muted hover:text-parish-text'
              }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Role Permissions Matrix</span>
          </button>
        )}

        {isFeatureEnabled('USERS_TAB_OVERRIDES') && (
          <button
            onClick={() => setActiveTab('overrides')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[42px] ${activeTab === 'overrides'
              ? 'border-parish-primary text-parish-primary'
              : 'border-transparent text-parish-text-muted hover:text-parish-text'
              }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Custom User Overrides</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTHORIZED USERS LIST                                              */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Summary Stat Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Total Accounts
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-parish-text mt-1">{parishUsers.length}</div>
              <div className="text-[11px] text-parish-text-muted mt-0.5">Authorized logins</div>
            </div>

            <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Parish Priests
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-parish-primary mt-1">
                {parishUsers.filter((u) => u.role === 'PARISH_PRIEST').length}
              </div>
              <div className="text-[11px] text-parish-text-muted mt-0.5">Parish Priest</div>
            </div>

            <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Admins
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
                {parishUsers.filter((u) => u.role === 'PARISH_ADMIN').length}
              </div>
              <div className="text-[11px] text-parish-text-muted mt-0.5">Parish Admin</div>
            </div>

            <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Users
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-sky-700 mt-1">
                {parishUsers.filter((u) => u.role === 'PARISH_USER').length}
              </div>
              <div className="text-[11px] text-parish-text-muted mt-0.5">Parish User</div>
            </div>

            <div className="bg-parish-surface border border-parish-border rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-parish-text-muted">
                Ward Users
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-amber-700 mt-1">
                {parishUsers.filter((u) => u.role === 'WARD_USER').length}
              </div>
              <div className="text-[11px] text-parish-text-muted mt-0.5">Ward Leaders</div>
            </div>
          </div>

          {/* Search and Role Filter Bar */}
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by name, email, or ward..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { key: 'ALL', label: 'All Roles' },
                { key: 'PARISH_PRIEST', label: 'Priests' },
                { key: 'PARISH_ADMIN', label: 'Admins' },
                { key: 'PARISH_USER', label: 'Users' },
                { key: 'WARD_USER', label: 'Ward Leaders' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRoleFilter(item.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${roleFilter === item.key
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Card Layout (< md screens) */}
          <div className="block md:hidden space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-parish-surface border border-parish-border rounded-2xl p-4 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-parish-surface-subtle" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 bg-parish-surface-subtle rounded w-1/2" />
                        <div className="h-3 bg-parish-surface-subtle rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-parish-surface border border-dashed border-parish-border rounded-2xl p-8 text-center text-parish-text-muted text-sm">
                No users found matching the selected criteria.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`bg-parish-surface border rounded-2xl p-4 shadow-xs space-y-3 transition-colors ${u.isActive ? 'border-parish-border' : 'border-dashed border-parish-border opacity-70'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-parish-primary-light text-parish-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {u.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-parish-text flex items-center gap-1.5 flex-wrap">
                            <span>{u.fullName}</span>
                            {u.username && (
                              <span className="text-[10px] font-mono text-parish-primary bg-parish-primary-light/60 px-1.5 py-0.2 rounded">
                                @{u.username}
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-parish-text-muted flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <Badge variant={u.isActive ? 'success' : 'subtle'} size="sm">
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-parish-border flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                          {formatRoleLabel(u.role)}
                        </Badge>

                        {u.unitName ? (
                          <div className="text-[11px] text-parish-text-muted flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-600" />
                            <span>{u.unitName} Ward</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-parish-text-muted flex items-center gap-1">
                            <Church className="w-3 h-3 text-parish-primary" />
                            <span>{u.parishName}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canEditUser(u) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface-subtle transition-colors shadow-2xs"
                          >
                            <Pencil className="w-3 h-3 text-parish-text-muted" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isFeatureEnabled('USERS_TAB_OVERRIDES') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOverrideUserId(u.id);
                              setActiveTab('overrides');
                            }}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface-subtle transition-colors shadow-2xs"
                          >
                            <ShieldCheck className="w-3 h-3 text-parish-text-muted" />
                            <span>Permissions</span>
                          </button>
                        )}

                        {!isSelf && canArchiveUsers && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmUser(u);
                              setIsConfirmOpen(true);
                            }}
                            className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${u.isActive
                              ? 'border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300'
                              : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                              }`}
                          >
                            <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block bg-parish-surface border border-parish-border rounded-2xl overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-parish-surface-subtle border-b border-parish-border text-parish-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Jurisdiction & Ward</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parish-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-parish-text-muted">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-parish-primary border-t-transparent rounded-full animate-spin" />
                          <span>Loading authorized users...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-parish-text-muted">
                        No users found matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-parish-surface-subtle/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-parish-primary-light text-parish-primary font-bold text-xs flex items-center justify-center shrink-0">
                                {u.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-parish-text flex items-center gap-1.5 flex-wrap">
                                  <span>{u.fullName}</span>
                                  {u.username && (
                                    <span className="text-[10px] font-mono text-parish-primary bg-parish-primary-light/60 px-1.5 py-0.2 rounded">
                                      @{u.username}
                                    </span>
                                  )}
                                  {isSelf && (
                                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-parish-text-muted font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                              {formatRoleLabel(u.role)}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4">
                            {u.unitName ? (
                              <div className="flex items-center gap-1.5 font-semibold text-amber-700">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{u.unitName} Ward</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-parish-text">
                                <Church className="w-3.5 h-3.5 text-parish-primary" />
                                <span>{u.parishName}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge variant={u.isActive ? 'success' : 'subtle'} size="sm">
                              {u.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right align-middle">
                            <div className="inline-flex flex-col items-stretch gap-1.5 w-28">
                              {canEditUser(u) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(u)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface-subtle hover:border-parish-primary/40 transition-colors shadow-2xs"
                                >
                                  <Pencil className="w-3 h-3 text-parish-text-muted" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {isFeatureEnabled('USERS_TAB_OVERRIDES') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOverrideUserId(u.id);
                                    setActiveTab('overrides');
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-parish-border bg-white text-parish-text hover:bg-parish-surface-subtle hover:border-parish-primary/40 transition-colors shadow-2xs"
                                >
                                  <ShieldCheck className="w-3 h-3 text-parish-text-muted" />
                                  <span>Permissions</span>
                                </button>
                              )}

                              {isSelf ? (
                                <span className="w-full text-center py-1 text-[11px] text-parish-text-muted italic bg-parish-surface-subtle rounded-lg border border-parish-border/60">
                                  Current session
                                </span>
                              ) : canArchiveUsers ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmUser(u);
                                    setIsConfirmOpen(true);
                                  }}
                                  className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${u.isActive
                                    ? 'border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300'
                                    : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                                    }`}
                                >
                                  <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLE PERMISSIONS MATRIX                                            */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Role Selector Header Card */}
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-parish-primary" />
                  Role Permission Template Matrix
                </h2>
                <p className="text-xs text-parish-text-muted">
                  Choose a system role to view and customize its default screen rights. All users with this role will inherit these settings.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {matrixSuccessMsg && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {matrixSuccessMsg}
                  </span>
                )}
                {canEditUsers && (
                  <ConfirmButton
                    variant="primary"
                    size="sm"
                    onConfirm={handleSaveRoleMatrix}
                    isLoading={isSavingMatrix}
                    icon={<Save className="w-3.5 h-3.5" />}
                    confirmLabel="Confirm Save"
                  >
                    Save Matrix
                  </ConfirmButton>
                )}
              </div>
            </div>

            {/* Role Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1">
              {[
                { role: 'PARISH_PRIEST', label: 'Parish Priest' },
                { role: 'PARISH_ADMIN', label: 'Parish Admin' },
                { role: 'PARISH_USER', label: 'Parish User' },
                { role: 'WARD_USER', label: 'Ward User' },
              ].map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setSelectedRole(r.role as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${selectedRole === r.role
                    ? 'bg-parish-primary text-white shadow-xs'
                    : 'bg-parish-surface-subtle text-parish-text-muted hover:text-parish-text'
                    }`}
                >
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            {/* Parish Priest Policy Callout */}
            {selectedRole === 'PARISH_PRIEST' && (
              <div className="p-3.5 rounded-xl bg-parish-primary-light/60 border border-parish-border text-parish-text text-xs flex items-start gap-2.5">
                <Church className="w-4 h-4 shrink-0 text-parish-primary mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Supreme Parish Authority (Parish Priest):</strong> The Parish Priest holds ultimate executive authority in the parish. Has full rights to approve new family registrations, block or deactivate parish admins (trustees), manage user access, and oversee confidential Direct Debit details.
                </div>
              </div>
            )}

            {/* Ward Isolation Policy Callout */}
            {selectedRole === 'WARD_USER' && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <MapPin className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Ward Isolation Policy Active:</strong> Ward Users are strictly locked to their assigned ward (<code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-amber-300">assignedUnitId</code>). They cannot view, search, or access any families outside their ward boundary.
                </div>
              </div>
            )}
            {/* Uninitialized Parish Notice */}
            {!isMatrixInitialized && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Uninitialized Parish:</strong> Role permissions have not yet been established for this parish in the database. Configure the toggles below and click <strong>Save Matrix</strong> to save this parish's permission rules.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Matrix Grid Table */}
          {isMatrixLoading ? (
            <div className="p-8 text-center bg-parish-surface border border-parish-border rounded-2xl animate-pulse">
              Loading role permissions matrix...
            </div>
          ) : (
            <div className="bg-parish-surface border border-parish-border rounded-2xl overflow-hidden shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-parish-surface-subtle border-b border-parish-border text-parish-text-muted font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[200px]">Screen / Module</th>
                      <th className="py-3.5 px-4 text-center">View / Access</th>
                      <th className="py-3.5 px-4 text-center">Create / Save</th>
                      <th className="py-3.5 px-4 text-center">Edit / Update</th>
                      <th className="py-3.5 px-4 text-center">Deactivate</th>
                      <th className="py-3.5 px-4 text-center">Hard Delete</th>
                      <th className="py-3.5 px-4 text-center">Export</th>
                      <th className="py-3.5 px-4 text-center text-emerald-800">Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parish-border">
                    {allowedModules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-parish-text-muted">
                          No functional modules are currently enabled by Developer Controls for this parish.
                        </td>
                      </tr>
                    ) : (
                      allowedModules.map((mod) => {
                      const rec = roleMatrix[selectedRole]?.[mod.key] || {
                        role: selectedRole,
                        module: mod.key,
                        canView: false,
                        canCreate: false,
                        canEdit: false,
                        canArchive: false,
                        canDelete: false,
                        canExport: false,
                      };

                      const isLockedRole = selectedRole === 'SUPER_ADMIN';

                      return (
                        <tr key={mod.key} className="hover:bg-parish-surface-subtle/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {getModuleIcon(mod.key)}
                              <div>
                                <div className="font-bold text-parish-text text-sm">{mod.name}</div>
                                <div className="text-[10px] text-parish-text-muted font-mono">{mod.category}</div>
                              </div>
                            </div>
                          </td>

                          {/* View Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canView')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canView
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {rec.canView ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Create Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canCreate')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canCreate
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canCreate ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Edit Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canEdit')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canEdit
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canEdit ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Deactivate Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canArchive')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canArchive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canArchive ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Hard Delete Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canDelete')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canDelete
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canDelete ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Export Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canExport')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canExport
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canExport ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Approve Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLockedRole || !canEditUsers || !rec.canView}
                              onClick={() => handleToggleMatrixCell(mod.key, 'canApprove')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${rec.canApprove
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border hover:border-parish-text-muted'
                                } ${isLockedRole || !canEditUsers || !rec.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {rec.canApprove ? 'ON' : 'OFF'}
                            </button>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CUSTOM USER OVERRIDES                                              */}
      {/* ========================================================================= */}
      {activeTab === 'overrides' && (
        <div className="space-y-6">
          {/* User Selection & Actions Card */}
          <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-parish-primary" />
                  Individual User Permission Overrides
                </h2>
                <p className="text-xs text-parish-text-muted">
                  Assign special permissions to a specific user beyond their default role baseline.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {overrideSuccessMsg && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {overrideSuccessMsg}
                  </span>
                )}
                {canEditUsers && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearUserOverrides}
                    disabled={!allowedOverrides.some((e) => e.isOverridden)}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Reset to Role Defaults
                  </Button>
                )}
                {canEditUsers && (
                  <ConfirmButton
                    variant="primary"
                    size="sm"
                    onConfirm={handleSaveUserOverrides}
                    isLoading={isSavingOverride}
                    icon={<Save className="w-3.5 h-3.5" />}
                    confirmLabel="Confirm Save"
                  >
                    Save Overrides
                  </ConfirmButton>
                )}
              </div>
            </div>

            {/* User Selector Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-parish-text mb-1">Select Target User:</label>
                <select
                  value={selectedOverrideUserId || ''}
                  onChange={(e) => setSelectedOverrideUserId(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({formatRoleLabel(u.role)})
                    </option>
                  ))}
                </select>
              </div>

              {overrideUserData && (
                <div className="p-3 rounded-xl bg-parish-surface-subtle border border-parish-border flex items-center justify-between text-xs col-span-1 sm:col-span-1 lg:col-span-2">
                  <div>
                    <div className="font-bold text-parish-text">{overrideUserData.user.fullName}</div>
                    <div className="text-[11px] text-parish-text-muted">{overrideUserData.user.email}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={getRoleBadgeVariant(overrideUserData.user.role)} size="sm">
                      Base: {formatRoleLabel(overrideUserData.user.role)}
                    </Badge>
                    {overrideUserData.user.unitName && (
                      <div className="text-[11px] text-amber-700 font-semibold">
                        Locked to {overrideUserData.user.unitName} Ward
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Override Matrix */}
          {isOverrideLoading || !overrideUserData ? (
            <div className="p-8 text-center bg-parish-surface border border-parish-border rounded-2xl animate-pulse">
              Loading user permissions...
            </div>
          ) : (
            <div className="bg-parish-surface border border-parish-border rounded-2xl overflow-hidden shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-parish-surface-subtle border-b border-parish-border text-parish-text-muted font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[200px]">Screen / Module</th>
                      <th className="py-3.5 px-4 text-center">View</th>
                      <th className="py-3.5 px-4 text-center">Create</th>
                      <th className="py-3.5 px-4 text-center">Edit</th>
                      <th className="py-3.5 px-4 text-center">Deactivate</th>
                      <th className="py-3.5 px-4 text-center">Delete</th>
                      <th className="py-3.5 px-4 text-center">Export</th>
                      <th className="py-3.5 px-4 text-center text-emerald-800">Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parish-border">
                    {allowedOverrides.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-parish-text-muted">
                          No functional modules are currently enabled by Developer Controls for this parish.
                        </td>
                      </tr>
                    ) : (
                      allowedOverrides.map((item) => {
                      const current = userOverrides[item.module] || {};
                      const isOverridden =
                        current.canView !== item.base.canView ||
                        current.canCreate !== item.base.canCreate ||
                        current.canEdit !== item.base.canEdit ||
                        current.canArchive !== item.base.canArchive ||
                        current.canDelete !== item.base.canDelete ||
                        current.canExport !== item.base.canExport ||
                        current.canApprove !== item.base.canApprove;

                      return (
                        <tr
                          key={item.module}
                          className={`hover:bg-parish-surface-subtle/40 transition-colors ${isOverridden ? 'bg-amber-50/40' : ''
                            }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {getModuleIcon(item.module)}
                              <div>
                                <div className="font-bold text-parish-text text-sm flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {isOverridden && (
                                    <Badge variant="warning" size="sm" className="text-[9px]">
                                      Override
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-parish-text-muted">{item.category}</div>
                              </div>
                            </div>
                          </td>

                          {/* View Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canView')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canView
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {current.canView ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Create Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canCreate')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canCreate
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canCreate ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Edit Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canEdit')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canEdit
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canEdit ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Deactivate Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canArchive')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canArchive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canArchive ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Hard Delete Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canDelete')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canDelete
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canDelete ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Export Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canExport')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canExport
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canExport ? 'ON' : 'OFF'}
                            </button>
                          </td>

                          {/* Approve Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canEditUsers || !current.canView}
                              onClick={() => handleToggleUserOverrideCell(item.module, 'canApprove')}
                              className={`w-14 py-1.5 rounded-lg font-bold text-xs transition-all ${current.canApprove
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                                } ${!canEditUsers || !current.canView ? 'opacity-35 cursor-not-allowed' : ''}`}
                            >
                              {current.canApprove ? 'ON' : 'OFF'}
                            </button>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create User */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title={createdSuccessData ? 'User Created Successfully!' : 'Create New Parish User'}
        description={
          createdSuccessData
            ? 'Account credentials have been created. Copy and share these details with the user.'
            : 'Create credentials and assign access permissions for parish clergy or staff.'
        }
        maxWidth="lg"
      >
        {createdSuccessData ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Account Ready & Active</span>
              </div>

              <div className="bg-white rounded-xl p-3 border border-emerald-200/60 font-mono text-xs space-y-1.5 text-parish-text">
                {createdSuccessData.username && (
                  <div className="flex justify-between">
                    <span className="text-parish-text-muted">Username:</span>
                    <span className="font-bold text-parish-primary font-mono">@{createdSuccessData.username}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-parish-text-muted">Full Name:</span>
                  <span className="font-bold">{createdSuccessData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-parish-text-muted">Email:</span>
                  <span className="font-bold">{createdSuccessData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-parish-text-muted">Role:</span>
                  <span className="font-bold text-emerald-800">{formatRoleLabel(createdSuccessData.role)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-parish-text-muted">Temp Password:</span>
                  <span className="font-bold text-amber-700">{createdSuccessData.password}</span>
                </div>
              </div>

              <p className="text-[11px] text-emerald-800 leading-relaxed">
                🔒 The user can log in using either their <strong>Username</strong> or <strong>Email address</strong>, and will set a permanent password upon first login.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2.5">
              <Button
                type="button"
                variant={copiedInvite ? 'primary' : 'secondary'}
                size="sm"
                onClick={handleCopyCredentials}
                icon={copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                className="flex-1 justify-center"
              >
                {copiedInvite ? 'Copied to Clipboard!' : 'Copy Details (WhatsApp / SMS)'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="space-y-4">
            {inviteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {/* 1. Role & Responsibility (At the top of the form) */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Role & Responsibility <span className="text-red-500">*</span>
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
              >
                <option value="PARISH_USER">Parish User (Secretary / Office)</option>
                <option value="PARISH_ADMIN">Parish Admin (Trustee / Executive)</option>
                <option value="PARISH_PRIEST">Parish Priest</option>
                <option value="WARD_USER">Ward User (Ward Coordinator)</option>
              </select>
            </div>

            {/* 2. Link Parish Priest Profile ONLY when Role is Parish Priest */}
            {inviteRole === 'PARISH_PRIEST' && (
              activeParish?.priestName ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300/60 flex items-center justify-center shrink-0">
                        <Church className="w-4 h-4 text-amber-800" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-amber-950">Link Parish Priest Profile</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 font-semibold text-amber-900">
                            Settings
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-amber-900 truncate">
                          {activeParish.priestName}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleLinkParishPriest}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      className="shrink-0 bg-amber-700 hover:bg-amber-800 text-white border-none shadow-2xs text-xs font-semibold"
                    >
                      Sync Priest Details
                    </Button>
                  </div>
                  {activeParish.priestEmail && (
                    <div className="text-[11px] text-amber-800 flex items-center gap-1.5 pt-1.5 border-t border-amber-200/60 font-mono">
                      <Mail className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>{activeParish.priestEmail}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                    <Church className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Priest profile not yet set in Parish Settings.</span>
                  </div>
                  <a
                    href="/settings"
                    className="text-[11px] font-semibold text-parish-primary hover:underline shrink-0"
                  >
                    Configure in Settings →
                  </a>
                </div>
              )
            )}

            {/* 3. Assigned Ward (if WARD_USER) */}
            {inviteRole === 'WARD_USER' && (
              <div>
                <label className="block text-xs font-semibold text-parish-text mb-1">
                  Assigned Ward <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteUnitId}
                  onChange={(e) => setInviteUnitId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
                >
                  <option value="">Select a ward...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitName} Ward
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Username */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                User Name <span className="text-xs text-parish-text-muted font-normal">(Login identifier)</span>
              </label>
              <Input
                placeholder="e.g. fr.abraham, maria.jose"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                className="w-full font-mono text-xs"
              />
              <p className="text-[10px] text-parish-text-muted mt-1">
                Unique username for quick sign-in. Can contain lowercase letters, numbers, dots, and hyphens.
              </p>
            </div>

            {/* 5. Full Name */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Fr. Abraham Mathew, Maria Jose"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                required
                className="w-full"
              />
              <p className="text-[10px] text-parish-text-muted mt-1">
                Official ecclesiastical or full legal name used in reports, certificates, and registry records.
              </p>
            </div>

            {/* 6. Email */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Official Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="e.g. priest@stalphonsabrisbane.org.au"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Temporary Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                required
                icon={<KeyRound className="w-4 h-4" />}
                className="w-full"
              />
              <p className="text-[11px] text-parish-text-muted mt-1">
                The user can use this password to log in immediately and will be prompted to set their private password.
              </p>
            </div>

            <div className="pt-3 border-t border-parish-border flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={inviteSubmitting}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Create Account
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Edit User */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit User Profile & Role"
        description="Update user credentials, roles, and access parameters."
        maxWidth="lg"
      >
        {editingUser && (
          <form onSubmit={handleSaveEditUser} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* 1. Role & Responsibility (At the top of the form) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-parish-text">
                  Role & Responsibility <span className="text-red-500">*</span>
                </label>
                {!canChangeRole(editingUser) && (
                  <span className="text-[10px] text-parish-text-muted italic">
                    (Role locked for this account)
                  </span>
                )}
              </div>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                disabled={!canChangeRole(editingUser)}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary ${!canChangeRole(editingUser) ? 'opacity-60 bg-gray-100 cursor-not-allowed' : ''
                  }`}
              >
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <option value="PARISH_PRIEST">Parish Priest</option>
                )}
                {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PARISH_PRIEST') && (
                  <option value="PARISH_ADMIN">Parish Admin (Trustee / Executive)</option>
                )}
                <option value="PARISH_USER">Parish User (Secretary / Office)</option>
                <option value="WARD_USER">Ward User (Ward Coordinator)</option>
              </select>
            </div>

            {/* 2. Link Priest Details Option ONLY when Role is Parish Priest */}
            {editRole === 'PARISH_PRIEST' && (
              activeParish?.priestName ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300/60 flex items-center justify-center shrink-0">
                        <Church className="w-4 h-4 text-amber-800" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-amber-950">Link Parish Priest Profile</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 font-semibold text-amber-900">
                            Settings
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-amber-900 truncate">
                          {activeParish.priestName}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleLinkParishPriestInEdit}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      className="shrink-0 bg-amber-700 hover:bg-amber-800 text-white border-none shadow-2xs text-xs font-semibold"
                    >
                      Sync Priest Details
                    </Button>
                  </div>
                  {activeParish.priestEmail && (
                    <div className="text-[11px] text-amber-800 flex items-center gap-1.5 pt-1.5 border-t border-amber-200/60 font-mono">
                      <Mail className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>{activeParish.priestEmail}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                    <Church className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Priest profile not yet set in Parish Settings.</span>
                  </div>
                  <a
                    href="/settings"
                    className="text-[11px] font-semibold text-parish-primary hover:underline shrink-0"
                  >
                    Configure in Settings →
                  </a>
                </div>
              )
            )}

            {/* 3. Assigned Ward (if WARD_USER) */}
            {editRole === 'WARD_USER' && (
              <div>
                <label className="block text-xs font-semibold text-parish-text mb-1">
                  Assigned Ward Jurisdiction <span className="text-red-500">*</span>
                </label>
                <select
                  value={editUnitId}
                  onChange={(e) => setEditUnitId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-parish-primary"
                >
                  <option value="">Select a ward...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitName} Ward
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-parish-text-muted mt-1">
                  Ward Coordinators only have query access to family records inside their assigned prayer ward.
                </p>
              </div>
            )}

            {/* 4. Username */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                User Name <span className="text-xs text-parish-text-muted font-normal">(Login identifier)</span>
              </label>
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                placeholder="e.g. fr.abraham, maria.jose"
                className="w-full font-mono text-xs"
              />
              <p className="text-[10px] text-parish-text-muted mt-1">
                Optional unique username identifier for sign-in.
              </p>
            </div>

            {/* 5. Full Name */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
                className="w-full"
                placeholder="e.g. Fr. Abraham Mathew, Thomas Trustee"
              />
              <p className="text-[10px] text-parish-text-muted mt-1">
                Official name displayed on certificates and register records.
              </p>
            </div>

            {/* 6. Official Login Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-parish-text">
                  Official Login Email
                </label>
                <Badge variant={editingUser.isActive ? 'success' : 'subtle'} size="sm">
                  {editingUser.isActive ? 'Active User' : 'Inactive'}
                </Badge>
              </div>
              <Input
                value={editingUser.email}
                disabled={true}
                readOnly
                icon={<Mail className="w-4 h-4 text-parish-text-muted" />}
                className="w-full bg-slate-50 text-slate-700 font-mono text-xs cursor-not-allowed"
              />
              <p className="text-[10px] text-parish-text-muted mt-1">
                Primary system identifier for {editingUser.parishName}.
              </p>
            </div>

            {/* Optional Field: Reset Password */}
            <div className="pt-2 border-t border-parish-border">
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Reset Password (Optional)
              </label>
              <Input
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                icon={<KeyRound className="w-4 h-4 text-parish-text-muted" />}
                className="w-full"
              />
              <p className="text-[11px] text-parish-text-muted mt-1">
                Leave empty to keep existing password. If entered, user must change password upon next login.
              </p>
            </div>

            <div className="pt-3 border-t border-parish-border flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <ConfirmButton
                variant="primary"
                size="sm"
                onConfirm={handleSaveEditUser}
                beforeConfirm={validateEditUser}
                isLoading={editSubmitting}
                icon={<Save className="w-3.5 h-3.5" />}
                confirmLabel="Confirm Save"
              >
                Save Changes
              </ConfirmButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Dialog for Status Toggle */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={confirmUser?.isActive ? 'Deactivate User Account?' : 'Activate User Account?'}
        message={
          confirmUser?.isActive
            ? `Are you sure you want to deactivate ${confirmUser.fullName}? They will no longer be able to log in to the Parish Register portal.`
            : `Are you sure you want to re-activate ${confirmUser?.fullName}? They will regain access based on their assigned role.`
        }
        variant={confirmUser?.isActive ? 'danger' : 'primary'}
        confirmLabel={confirmUser?.isActive ? 'Deactivate Account' : 'Re-Activate Account'}
        isLoading={isToggling}
      />
    </div>
  );
};
