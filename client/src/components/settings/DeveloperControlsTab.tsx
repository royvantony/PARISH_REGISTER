import React, { useState } from 'react';
import { useFeatures } from '../../context/FeatureContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  LayoutDashboard,
  Settings as SettingsIcon,
  Users as UsersIcon,
  BookOpen,
  Palette,
  RotateCcw,
  Ban,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

export const DeveloperControlsTab: React.FC = () => {
  const {
    features,
    getStoredFlag,
    toggleFeature,
    batchUpdateFeatures,
    isSimulatingClient,
    setIsSimulatingClient,
  } = useFeatures();
  const { activeParish } = useAuth();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmBatchAction, setConfirmBatchAction] = useState<'ENABLE_ALL' | 'DISABLE_ALL' | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  const handleToggle = async (key: string, currentVal: boolean, featName: string) => {
    try {
      setUpdatingKey(key);
      setFeedbackMsg(null);
      const res = await toggleFeature(key, !currentVal, activeParish?.id);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `"${featName}" is now ${!currentVal ? 'ENABLED' : 'HIDDEN/DISABLED'} for ${activeParish?.parishName || 'Parish'} (${activeParish?.parishCode || ''}).`,
        });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update feature.' });
      }
    } finally {
      setUpdatingKey(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleOpenEnableAll = () => {
    setConfirmBatchAction('ENABLE_ALL');
  };

  const handleOpenDisableAll = () => {
    setConfirmBatchAction('DISABLE_ALL');
  };

  const handleConfirmBatch = async () => {
    if (!confirmBatchAction) return;
    const isEnable = confirmBatchAction === 'ENABLE_ALL';
    try {
      setIsBatchUpdating(true);
      const updates = features.map((f) => ({ key: f.key, isEnabled: isEnable }));
      const res = await batchUpdateFeatures(updates, activeParish?.id);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: isEnable
            ? `All features have been set to ENABLED for ${activeParish?.parishName || 'Parish'} (${activeParish?.parishCode || ''}).`
            : `All features have been set to DISABLED for ${activeParish?.parishName || 'Parish'} (${activeParish?.parishCode || ''}). You can now selectively enable the few modules you need.`,
        });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to batch update features.' });
      }
    } finally {
      setIsBatchUpdating(false);
      setConfirmBatchAction(null);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const categories = [
    {
      id: 'PAGE',
      title: 'Main Screens & Pages',
      icon: <FileText className="w-4 h-4 text-parish-primary" />,
      description: 'Hiding a page removes it from navigation and automatically hides all buttons pointing to it. Typing its URL renders 404 Resource Not Found.',
    },
    {
      id: 'DASHBOARD',
      title: 'Dashboard Individual Sub-Items & Charts',
      icon: <LayoutDashboard className="w-4 h-4 text-emerald-600" />,
      description: 'The Dashboard home screen stays active, but you can turn off any individual charts, demographic cards, or pastoral feeds.',
    },
    {
      id: 'SETTINGS',
      title: 'Settings Screen Sections & Boxes',
      icon: <SettingsIcon className="w-4 h-4 text-blue-600" />,
      description: 'Hide specific boxes or master data tabs inside this Settings screen.',
    },
    {
      id: 'USERS',
      title: 'Users & Roles Tabs',
      icon: <UsersIcon className="w-4 h-4 text-purple-600" />,
      description: 'Enable or disable specific tabs in the Users management screen.',
    },
    {
      id: 'REGISTER',
      title: 'Parish Register Sub-Features',
      icon: <BookOpen className="w-4 h-4 text-amber-600" />,
      description: 'Control granular capabilities inside Parish Register dossiers, listings, and household screens.',
    },
    {
      id: 'GENERAL',
      title: 'Visual Theme Switcher',
      icon: <Palette className="w-4 h-4 text-rose-600" />,
      description: 'Control theme customization buttons. When disabled, Cathedral Burgundy is forced as system default.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Developer Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-parish-text">
                  Client & Demo Feature Configuration
                </h3>
                <span className="text-[10px] font-mono font-extrabold bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Developer Control
                </span>
                {activeParish && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                    Configuring: {activeParish.parishName} ({activeParish.parishCode})
                  </span>
                )}
              </div>
              <p className="text-xs text-parish-text-muted mt-1 leading-relaxed max-w-2xl">
                Toggles configure feature availability for <strong>client users</strong> (e.g. provision a limited demo or tiered feature package for this parish).
                As <strong>Platform Developer</strong>, you always have full unrestricted access to all features across the platform.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isSimulatingClient ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsSimulatingClient(!isSimulatingClient)}
              icon={isSimulatingClient ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              title={isSimulatingClient ? 'Click to restore full developer view' : 'Click to preview dashboard & pages as client users see them'}
            >
              {isSimulatingClient ? 'Exit Client Simulation' : 'Simulate Client View'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEnableAll}
              icon={<RotateCcw className="w-3.5 h-3.5 text-emerald-600" />}
              title="Enable all features and screens for this parish"
            >
              Enable All for Parish
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDisableAll}
              icon={<Ban className="w-3.5 h-3.5 text-rose-600" />}
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-300"
              title="Disable all features for this parish so you can selectively enable only a few"
            >
              Disable All for Parish
            </Button>
          </div>
        </div>
      </div>

      {/* Live Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold animate-in fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Feature Sections */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catFeatures = features.filter((f) => f.category === cat.id);
          if (catFeatures.length === 0) return null;

          return (
            <div
              key={cat.id}
              className="bg-parish-surface border border-parish-border rounded-2xl p-5 shadow-xs space-y-4"
            >
              <div className="border-b border-parish-border pb-3">
                <div className="flex items-center gap-2">
                  {cat.icon}
                  <h4 className="font-extrabold text-sm text-parish-text tracking-tight">
                    {cat.title}
                  </h4>
                  <Badge variant="subtle" size="sm">
                    {catFeatures.length} items
                  </Badge>
                </div>
                <p className="text-xs text-parish-text-muted mt-0.5">
                  {cat.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catFeatures.map((feat) => {
                  const enabledForUsers = getStoredFlag(feat.key);
                  const isBusy = updatingKey === feat.key;

                  return (
                    <div
                      key={feat.key}
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        enabledForUsers
                          ? 'bg-parish-surface-subtle border-parish-border'
                          : 'bg-slate-100/60 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-parish-text">
                            {feat.name}
                          </span>
                          {feat.route && (
                            <code className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-parish-bg border border-parish-border text-parish-text-muted">
                              {feat.route}
                            </code>
                          )}
                          <Badge variant={enabledForUsers ? 'success' : 'subtle'} size="sm">
                            {enabledForUsers ? 'Active for Users' : 'Hidden for Users'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-parish-text-muted leading-relaxed line-clamp-2">
                          {feat.description}
                        </p>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggle(feat.key, enabledForUsers, feat.name)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-parish-primary focus:ring-offset-2 ${
                          enabledForUsers ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                        } ${isBusy ? 'opacity-50 cursor-wait' : ''}`}
                        title={enabledForUsers ? `Click to Disable / Hide for ${activeParish?.parishName || 'Parish'}` : `Click to Enable for ${activeParish?.parishName || 'Parish'}`}
                        aria-pressed={enabledForUsers}
                      >
                        <span className="sr-only">Toggle {feat.name}</span>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            enabledForUsers ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Batch Enable/Disable Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmBatchAction !== null}
        onClose={() => setConfirmBatchAction(null)}
        onConfirm={handleConfirmBatch}
        isLoading={isBatchUpdating}
        title={
          confirmBatchAction === 'ENABLE_ALL'
            ? 'Enable All Features for Parish?'
            : 'Disable All Features for Parish?'
        }
        message={
          confirmBatchAction === 'ENABLE_ALL'
            ? `Are you sure you want to enable all ${features.length} features for ${activeParish?.parishName || 'this parish'} (${activeParish?.parishCode || ''})? Client users will have full access to all screens, dashboards, and register tools.`
            : `Are you sure you want to disable all configurable features for ${activeParish?.parishName || 'this parish'} (${activeParish?.parishCode || ''})? This will turn off all client modules, allowing you to selectively enable just the few features you want for this parish.`
        }
        variant={confirmBatchAction === 'ENABLE_ALL' ? 'primary' : 'danger'}
        confirmLabel={
          confirmBatchAction === 'ENABLE_ALL' ? 'Enable All Features' : 'Disable All Features'
        }
      />
    </div>
  );
};
