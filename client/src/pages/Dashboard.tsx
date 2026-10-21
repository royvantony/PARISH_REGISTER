import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import {
  Church,
  Users,
  MapPin,
  CreditCard,
  GraduationCap,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  RefreshCw,
  UserPlus,
  FolderPlus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  History,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardStats {
  activeFamilies: number;
  individualStudents: number;
  individuals?: number;
  singleYouth?: number;
  totalHouseholds: number;
  totalParishioners: number;
  activeUnitsCount: number;
  monthlyDirectDebit: number;
  directDebitCount?: number;
}

interface WardStat {
  name: string;
  category: string;
  count: number;
}

interface TypeStat {
  type: string;
  count: number;
}

interface DioceseStat {
  diocese: string;
  count: number;
}

interface ActivityItem {
  id: number;
  noteDate: string;
  content: string;
  recordedBy: string;
  houseName: string;
  headName?: string;
  familyCode: string;
  unitName: string;
}

// Vibrant, distinct color palettes for rich dashboard aesthetics
const WARD_BAR_COLORS = [
  '#059669', // Emerald
  '#2563eb', // Royal Blue
  '#d97706', // Warm Amber
  '#7c3aed', // Bright Purple
  '#e11d48', // Crimson Rose
  '#0891b2', // Electric Cyan
  '#ea580c', // Bright Coral / Orange
  '#4f46e5', // Deep Indigo
  '#16a34a', // Fresh Green
  '#c026d3', // Rich Magenta
  '#0284c7', // Sky Blue
  '#ca8a04', // Golden Sunflower
  '#9333ea', // Deep Violet
  '#db2777', // Vivid Pink
  '#0d9488', // Teal
  '#65a30d', // Lime
];

const DEMOGRAPHIC_PALETTE: Record<string, string> = {
  'Families': '#10b981',             // Vibrant Emerald Green
  'Family': '#10b981',
  'International Students': '#3b82f6', // Bright Sapphire Blue
  'International Student': '#3b82f6',
  'Individuals': '#f59e0b',           // Warm Golden Amber
  'Individual': '#f59e0b',
  'Youth': '#ec4899',                 // Bright Fuchsia Pink
  'Other': '#8b5cf6',                 // Purple
};

const DEMOGRAPHIC_FALLBACK_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Royal Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
];

const getDemographicColor = (type: string, index: number) => {
  return DEMOGRAPHIC_PALETTE[type] || DEMOGRAPHIC_FALLBACK_COLORS[index % DEMOGRAPHIC_FALLBACK_COLORS.length];
};

export const DashboardPage: React.FC = () => {
  const { user, activeParish } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wardDistribution, setWardDistribution] = useState<WardStat[]>([]);
  const [registrationTypes, setRegistrationTypes] = useState<TypeStat[]>([]);
  const [diocesesDistribution, setDiocesesDistribution] = useState<DioceseStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Expanded Dioceses View & Search
  const [showAllDioceses, setShowAllDioceses] = useState(false);
  const [dioceseSearch, setDioceseSearch] = useState('');

  const filteredDioceses = useMemo(() => {
    let list = diocesesDistribution;
    if (dioceseSearch.trim()) {
      const q = dioceseSearch.toLowerCase().trim();
      list = list.filter((d) => d.diocese.toLowerCase().includes(q));
    }
    if (!showAllDioceses && !dioceseSearch.trim()) {
      return list.slice(0, 10);
    }
    return list;
  }, [diocesesDistribution, dioceseSearch, showAllDioceses]);

  const totalFamiliesWithDiocese = useMemo(() => {
    return diocesesDistribution.reduce((acc, curr) => acc + curr.count, 0);
  }, [diocesesDistribution]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, chartsRes] = await Promise.all([
        api.get<{ stats: DashboardStats }>('/dashboard/stats'),
        api.get<{
          wardDistribution: WardStat[];
          registrationTypes: TypeStat[];
          diocesesDistribution: DioceseStat[];
          recentActivity: ActivityItem[];
        }>('/dashboard/charts'),
      ]);

      setStats(statsRes.data.stats);
      setWardDistribution(chartsRes.data.wardDistribution || []);
      setRegistrationTypes(chartsRes.data.registrationTypes || []);
      setDiocesesDistribution(chartsRes.data.diocesesDistribution || []);
      setRecentActivity(chartsRes.data.recentActivity || []);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeParish?.id]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Top Executive Banner */}
      <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" size="sm">
              Live Pulse
            </Badge>
            <Badge variant="success" size="sm">
              {activeParish?.parishName || 'St. Alphonsa Syro-Malabar Parish Brisbane'}
            </Badge>
            <span className="text-[11px] text-parish-text-muted hidden sm:inline">
              Parish Code: <strong className="text-parish-text">{activeParish?.parishCode || 'SABN'}</strong>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-parish-text">
            Welcome back, {user?.fullName || 'Parish Administrator'}!
          </h1>
          <p className="text-xs sm:text-sm text-parish-text-muted leading-relaxed">
            Parish Register executive overview for {activeParish?.city || 'Brisbane'}. All records and demographic figures are automatically synchronized with the PostgreSQL parish register database.
          </p>

          {/* Quick Action Buttons (Touch Friendly) */}
          <div className="flex items-center gap-2.5 pt-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/register/new')}
            >
              New Family
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              onClick={() => navigate('/register')}
            >
              Parish Directory
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={fetchDashboardData}
            >
              Sync Live
            </Button>
          </div>
        </div>

        {/* Decorative subtle gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-emerald-100/30 to-transparent pointer-events-none hidden md:block" />
      </div>

      {/* 2. Top Metric Cards (Mobile Grid: 1 col on xs, 2 col on sm, 3 col on md, 5 col on lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Registered Families */}
        <div
          onClick={() => navigate('/register?type=FAMILY')}
          className="bg-parish-surface border border-parish-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 hover:border-parish-primary/40 transition-all cursor-pointer group"
          title="Click to view Families in Parish Register"
        >
          <div className="flex items-center justify-between text-parish-text-muted text-xs font-bold uppercase tracking-wider">
            <span>Registered Families</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-parish-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Church className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-parish-text">
            {isLoading ? '...' : stats?.activeFamilies ?? 0}
          </div>
          <div className="text-xs text-parish-text-muted flex items-center gap-1">
            <span>Families</span>
            <span className="text-emerald-700 font-bold ml-auto">Active</span>
          </div>
        </div>

        {/* Metric 2: Students & Individuals */}
        <div
          onClick={() => navigate('/register?type=INDIVIDUAL_STUDENT')}
          className="bg-parish-surface border border-parish-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 hover:border-violet-300 transition-all cursor-pointer group"
          title="Click to view Students & Individuals in Parish Register"
        >
          <div className="flex items-center justify-between text-parish-text-muted text-xs font-bold uppercase tracking-wider">
            <span>Students & Indiv.</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-parish-text">
            {isLoading ? '...' : ((stats?.individualStudents ?? 0) + (stats?.individuals ?? 0))}
          </div>
          <div className="text-xs text-parish-text-muted flex items-center gap-1">
            <span>{stats?.individualStudents ?? 0} Students · {stats?.individuals ?? 0} Indiv.</span>
            <span className="text-violet-700 font-bold ml-auto">Active</span>
          </div>
        </div>

        {/* Metric 3: Total Members */}
        <div
          onClick={() => navigate('/register')}
          className="bg-parish-surface border border-parish-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 hover:border-parish-primary/40 transition-all cursor-pointer group"
          title="Click to view all Parish Members in Register"
        >
          <div className="flex items-center justify-between text-parish-text-muted text-xs font-bold uppercase tracking-wider">
            <span>Parish Members</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-parish-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-parish-primary">
            {isLoading ? '...' : stats?.totalParishioners ?? 0}
          </div>
          <div className="text-xs text-parish-text-muted flex items-center gap-1">
            <span>Across all households</span>
            <span className="text-emerald-700 font-bold ml-auto">100%</span>
          </div>
        </div>

        {/* Metric 4: Family Units / Wards */}
        <div
          onClick={() => navigate('/units')}
          className="bg-parish-surface border border-parish-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 hover:border-amber-300 transition-all cursor-pointer group"
          title="Click to view Wards & Units"
        >
          <div className="flex items-center justify-between text-parish-text-muted text-xs font-bold uppercase tracking-wider">
            <span>Family Units / Wards</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-parish-text">
            {isLoading ? '...' : stats?.activeUnitsCount ?? 0}
          </div>
          <div className="text-xs text-parish-text-muted flex items-center gap-1">
            <span>Brisbane Wards</span>
            <span className="text-amber-700 font-bold ml-auto">Active</span>
          </div>
        </div>

        {/* Metric 5: Direct Debit */}
        <div
          onClick={() => navigate('/register?directDebit=YES')}
          className="bg-parish-surface border border-parish-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-1 hover:border-sky-300 transition-all cursor-pointer group"
          title="Click to view Direct Debit in Parish Register"
        >
          <div className="flex items-center justify-between text-parish-text-muted text-xs font-bold uppercase tracking-wider">
            <span>Direct Debit</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-parish-text">
            {isLoading ? '...' : (stats?.directDebitCount ?? 0)}
          </div>
          <div className="text-xs text-parish-text-muted flex items-center gap-1">
            <span>Monthly: <strong>${stats?.monthlyDirectDebit ?? 0}</strong></span>
            <span className="text-sky-700 font-bold ml-auto">Active</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Charts Grid (Mobile-First 1 Col, Tablet/Desktop 2 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Ward Distribution */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-parish-primary" />
                Families by Ward
              </h2>
              <p className="text-xs text-parish-text-muted">
                Distribution of registered families across active wards.
              </p>
            </div>
            <Badge variant="subtle" size="sm">
              {wardDistribution.length} Wards
            </Badge>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            {isLoading ? (
              <div className="w-full h-full bg-parish-surface-subtle animate-pulse rounded-xl" />
            ) : wardDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-parish-text-muted">
                No ward distribution data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wardDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e2d9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e2d9',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${value} families`,
                      item?.payload?.name ? `${item.payload.name} Ward` : 'Registered',
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {wardDistribution.map((_, index) => (
                      <Cell
                        key={`ward-cell-${index}`}
                        fill={WARD_BAR_COLORS[index % WARD_BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart B: Household Registration Types Breakdown */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-parish-primary" />
                Household Registration Demographics
              </h2>
              <p className="text-xs text-parish-text-muted">
                Breakdown between families, students, and youth.
              </p>
            </div>
            <Badge variant="default" size="sm">
              Categorized
            </Badge>
          </div>

          <div className="h-64 sm:h-72 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
            {isLoading ? (
              <div className="w-full h-full bg-parish-surface-subtle animate-pulse rounded-xl" />
            ) : registrationTypes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-parish-text-muted">
                No demographic breakdown data available.
              </div>
            ) : (
              <>
                <div className="w-full sm:w-1/2 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={registrationTypes}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {registrationTypes.map((entry, index) => (
                          <Cell
                            key={`demographic-cell-${index}`}
                            fill={getDemographicColor(entry.type, index)}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e5e2d9',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [`${value} households`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full sm:w-1/2 space-y-2.5">
                  {registrationTypes.map((t, idx) => {
                    const color = getDemographicColor(t.type, idx);
                    const totalReg = registrationTypes.reduce((acc, curr) => acc + curr.count, 0);
                    const pct = totalReg > 0 ? ((t.count / totalReg) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={t.type}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-parish-surface-subtle/70 border border-parish-border/50 transition-all hover:bg-parish-surface-subtle"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-semibold text-parish-text">{t.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-parish-text">{t.count}</span>
                          <span className="text-[10px] text-parish-text-muted font-mono font-semibold">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Grid: Top Indian Dioceses & Recent Parish Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dioceses of Origin in India (1 col on lg) */}
        <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                  <Church className="w-4 h-4 text-parish-primary" />
                  Dioceses of Origin
                </h2>
                <p className="text-xs text-parish-text-muted">
                  Parishioners native roots in Kerala / India ({diocesesDistribution.length} dioceses).
                </p>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="text-xs font-semibold text-parish-primary hover:underline"
              >
                Settings
              </button>
            </div>

            {/* Quick Search if more than 5 dioceses */}
            {diocesesDistribution.length > 5 && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find diocese (e.g. Mananthavady)..."
                  value={dioceseSearch}
                  onChange={(e) => setDioceseSearch(e.target.value)}
                  className="w-full bg-parish-surface-subtle text-xs text-parish-text placeholder:text-parish-text-muted/60 px-2.5 py-1.5 pl-7 pr-7 rounded-lg border border-parish-border focus:outline-none focus:ring-1 focus:ring-parish-primary"
                />
                <Search className="w-3.5 h-3.5 text-parish-text-muted absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                {dioceseSearch && (
                  <button
                    type="button"
                    onClick={() => setDioceseSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-1 ${showAllDioceses || dioceseSearch ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-8 bg-parish-surface-subtle animate-pulse rounded" />
                ))}
              </div>
            ) : filteredDioceses.length === 0 ? (
              <div className="text-xs text-parish-text-muted py-6 text-center">
                {dioceseSearch ? `No diocese matching "${dioceseSearch}"` : 'No origin diocese data logged yet.'}
              </div>
            ) : (
              filteredDioceses.map((d, idx) => {
                const rawPct = totalFamiliesWithDiocese > 0 ? (d.count / totalFamiliesWithDiocese) * 100 : 0;
                const pctDisplay = rawPct === 0 ? '0%' : rawPct < 1 ? '<1%' : `${Math.round(rawPct)}%`;
                return (
                  <div
                    key={d.diocese}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-parish-surface-subtle transition-colors border-b border-parish-border/40 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : idx === 1
                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                            : idx === 2
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border/50'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-parish-text">{d.diocese}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="subtle" size="sm" title={`${d.count} families`}>
                        {d.count}
                      </Badge>
                      <span
                        className="text-[10px] text-parish-text-muted/70 w-8 text-right font-mono"
                        title={`${rawPct.toFixed(2)}% of families`}
                      >
                        {pctDisplay}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Show More / Show Less Toggle Button */}
          {!dioceseSearch && diocesesDistribution.length > 10 && (
            <div className="pt-2 border-t border-parish-border/60 mt-auto">
              <button
                type="button"
                onClick={() => setShowAllDioceses(!showAllDioceses)}
                className="w-full py-1.5 text-xs font-semibold text-parish-primary hover:bg-parish-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {showAllDioceses ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show Top 10 Only</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Show All {diocesesDistribution.length} Dioceses</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity / Notes Feed (2 cols on lg) */}
        <div className="lg:col-span-2 bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-parish-text flex items-center gap-2">
                <History className="w-4 h-4 text-parish-primary" />
                Record History & Audit Trail
              </h2>
              <p className="text-xs text-parish-text-muted">
                Recent administrative updates, and record approvals.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => navigate('/register')}
            >
              Directory
            </Button>
          </div>

          <div className="divide-y divide-parish-border">
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-parish-surface-subtle animate-pulse rounded-xl" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-parish-text-muted">
                No record history or audit logs recorded yet.
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-parish-text">
                        {activity.headName || activity.houseName}
                      </span>
                      <span className="text-[11px] text-parish-primary font-medium">
                        {activity.houseName}
                      </span>
                      <span className="text-[11px] font-mono text-parish-text-muted">
                        ({activity.familyCode})
                      </span>
                      <Badge variant="default" size="sm">
                        {activity.unitName}
                      </Badge>
                    </div>
                    <p className="text-xs text-parish-text-muted leading-relaxed">
                      {activity.content}
                    </p>
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-parish-text-muted">
                    <div>{activity.recordedBy}</div>
                    <div className="flex items-center gap-1 justify-end font-medium">
                      <Clock className="w-3 h-3 text-parish-text-muted/70" />
                      {new Date(activity.noteDate).toLocaleString([], {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Mobile & Desktop Quick Navigation Card Grid */}
      <div className="bg-parish-surface border border-parish-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
        <h3 className="text-sm font-bold text-parish-text">Quick Navigation & Master Tools</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/register/new')}
            className="p-3.5 rounded-xl border border-parish-border hover:border-parish-primary bg-parish-surface-subtle/50 hover:bg-white text-left transition-all flex items-center justify-between group min-h-[48px]"
          >
            <div className="flex items-center gap-2.5">
              <FolderPlus className="w-4 h-4 text-parish-primary" />
              <span className="text-xs font-bold text-parish-text">Register New Family</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-parish-text-muted group-hover:text-parish-primary group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => navigate('/register')}
            className="p-3.5 rounded-xl border border-parish-border hover:border-parish-primary bg-parish-surface-subtle/50 hover:bg-white text-left transition-all flex items-center justify-between group min-h-[48px]"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-parish-primary" />
              <span className="text-xs font-bold text-parish-text">Search Parish Register</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-parish-text-muted group-hover:text-parish-primary group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => navigate('/units')}
            className="p-3.5 rounded-xl border border-parish-border hover:border-parish-primary bg-parish-surface-subtle/50 hover:bg-white text-left transition-all flex items-center justify-between group min-h-[48px]"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-parish-text">Manage Wards (8)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-parish-text-muted group-hover:text-parish-primary group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => navigate('/users')}
            className="p-3.5 rounded-xl border border-parish-border hover:border-parish-primary bg-parish-surface-subtle/50 hover:bg-white text-left transition-all flex items-center justify-between group min-h-[48px]"
          >
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-bold text-parish-text">Access & User Roles</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-parish-text-muted group-hover:text-parish-primary group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
};
