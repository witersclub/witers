import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Link2Off,
  LogOut,
  Megaphone,
  Palette,
  Plus,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WitersLogo, WMark } from "../components/witers/brand";
import {
  CompactRequestCard,
  FilePreview,
  PendingCompactCard,
  StaffRequestCard,
} from "../components/witers/staff-request-card";
import { isPlanId, MEMBERSHIP_PLANS, type PlanId } from "../lib/membership-plans";

// Same query key /api/admin/overview's useQuery uses — the shared staff
// request card invalidates whatever key it's given after claim/deliver/
// reject/etc, so every card in this panel needs to point at this one.
const ADMIN_OVERVIEW_QUERY_KEY = ["admin-overview"] as const;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administración. WITERS" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
});

type AdminUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  membership_status: string | null;
  membership_plan: string | null;
  requests_quota: number | null;
  requests_used: number | null;
  bonus_requests_quota: number | null;
  total_paid_mxn: number;
  // One membership, one business — set once a member submits their first
  // request, then locked (see /api/requests). Null means no request yet.
  brand_company_name: string | null;
  brand_colors: string | null;
  brand_business_type: string | null;
  brand_logo_key: string | null;
  // Facebook Page this client pautas from — null blocks "Quiero pautar"
  // for them (see panel.tsx's PautarButton), no shared/default fallback.
  brand_meta_page_id: string | null;
  // The client's own Meta ad account id — null means the Campañas admin tab
  // can't pull their live campaigns yet (see /api/admin/meta-campaigns).
  brand_meta_ad_account_id: string | null;
};

type AdminRequest = {
  id: string;
  title: string;
  company_name: string | null;
  product_name: string | null;
  brief: string;
  piece_brief: string | null;
  style: string | null;
  aspect_ratio: string;
  audience: string | null;
  age_range: string | null;
  required_text: string | null;
  brand_colors: string | null;
  promo_price: string | null;
  reference_key: string | null;
  logo_key: string | null;
  logo_public: number;
  product_photo_key: string | null;
  status: string;
  admin_note: string | null;
  revisions_used: number;
  revision_note_1: string | null;
  revision_note_2: string | null;
  change_request_note: string | null;
  satisfaction_rating: number | null;
  created_at: string;
  user_email: string;
  user_name: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_by_name: string | null;
  results_json: string | null;
  // ChatGPT-polished version of the prompt below — spelling/wording
  // cleaned up. Null until that background call finishes (or if it never
  // ran/failed), in which case copyInfo() falls back to building it locally.
  ai_prompt: string | null;
};

type ResultItem = {
  id: string;
  kind: string;
  image_url: string | null;
  r2_key: string | null;
  created_at?: string;
};

type AdminPayment = {
  id: string;
  user_email: string;
  amount_mxn: number;
  provider: string;
  status: string;
  created_at: string;
};

type AdminDesigner = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  claimed_count: number;
  completed_count: number;
};

type AdminDiscountCode = {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  uses_count: number;
  active: number;
  expires_at: string | null;
  created_at: string;
};

type Overview = {
  ok: boolean;
  users: AdminUser[];
  requests: AdminRequest[];
  payments: AdminPayment[];
  designers: AdminDesigner[];
  discountCodes: AdminDiscountCode[];
};

/* ---------- dashboard data helpers ---------- */

// created_at is stored as a naive UTC timestamp with no "Z" suffix — every
// other place in this file appends it before parsing (see the request/
// payment cards below), so the same convention applies here.
function monthKey(iso: string): string {
  const d = new Date(`${iso}Z`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-MX", { month: "short" }),
    };
  });
}

function buildRevenueSeries(payments: AdminPayment[]) {
  const months = lastNMonths(6);
  const sums = new Map(months.map((m) => [m.key, 0]));
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const k = monthKey(p.created_at);
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + p.amount_mxn);
  }
  return months.map((m) => ({ name: m.label, ingresos: sums.get(m.key) ?? 0 }));
}

function buildRequestsSeries(requests: AdminRequest[]) {
  const months = lastNMonths(6);
  const counts = new Map(months.map((m) => [m.key, 0]));
  for (const r of requests) {
    const k = monthKey(r.created_at);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((m) => ({ name: m.label, solicitudes: counts.get(m.key) ?? 0 }));
}

const STATUS_CHART_META: Record<string, { label: string; color: string }> = {
  en_proceso: { label: "En proceso", color: "#f59e0b" },
  completada: { label: "Completada", color: "#10b981" },
  cerrada: { label: "Finalizada", color: "#0047ff" },
  rechazada: { label: "Rechazada", color: "#ef4444" },
  cambio_solicitado: { label: "Cambio solicitado", color: "#f97316" },
};

function buildStatusBreakdown(requests: AdminRequest[]) {
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([status, value]) => ({
      name: STATUS_CHART_META[status]?.label ?? status,
      value,
      color: STATUS_CHART_META[status]?.color ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
}

const PLAN_CHART_COLORS: Record<string, string> = {
  essential: "#0047ff",
  grow: "#8b93a3",
  scale: "#0a1230",
};

function buildPlanBreakdown(users: AdminUser[]) {
  const counts = new Map<string, number>();
  for (const u of users) {
    if (u.membership_status !== "active" || !u.membership_plan) continue;
    counts.set(u.membership_plan, (counts.get(u.membership_plan) ?? 0) + 1);
  }
  return [...counts.entries()].map(([plan, value]) => ({
    name: MEMBERSHIP_PLANS.find((p) => p.id === plan)?.nombre ?? plan,
    value,
    color: PLAN_CHART_COLORS[plan] ?? "#94a3b8",
  }));
}

function usePlatformUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      // Only an account with role 'admin' may see the console.
      if (!body.ok || body.user?.role !== "admin") return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

/* ---------- dashboard ---------- */

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof Wallet;
  accent: "blue" | "emerald" | "amber" | "violet";
  onClick?: () => void;
}) {
  const accents: Record<typeof accent, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-wit-blue/10", text: "text-wit-blue", ring: "ring-wit-blue/15" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200/60" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200/60" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200/60" },
  };
  const a = accents[accent];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`wit-glass rounded-2xl p-5 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)] ring-1 ${a.ring} ${
        onClick
          ? "transition-transform hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(5,13,40,0.1)]"
          : ""
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.bg} ${a.text}`}>
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-wit-gray">
        {label}
      </p>
      <p className="mt-1 font-wit-mono text-2xl font-semibold text-wit-ink">{value}</p>
      {subtext ? <p className="mt-1 text-xs font-medium text-wit-gray">{subtext}</p> : null}
      {onClick ? (
        <p className={`mt-2 flex items-center gap-1 text-xs font-bold ${a.text}`}>
          Ver solicitudes
          <ArrowRight size={13} strokeWidth={2.5} />
        </p>
      ) : null}
    </Tag>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <p className="text-sm font-bold text-wit-ink">{title}</p>
      <p className="mt-0.5 text-xs text-wit-gray">{subtitle}</p>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; payload?: { color?: string } }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-wit-ink/10 bg-white px-3 py-2 text-xs shadow-[0_10px_30px_rgba(5,13,40,0.12)]">
      {label ? <p className="mb-1 font-bold text-wit-ink">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-wit-gray">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.color ?? "#0047ff" }}
          />
          <span className="font-semibold text-wit-ink">
            {formatter ? formatter(p.value) : p.value}
          </span>
          {payload.length > 1 ? <span>{p.name}</span> : null}
        </p>
      ))}
    </div>
  );
}

function DashboardView({
  data,
  onNavigateToAttention,
}: {
  data: Overview;
  onNavigateToAttention: () => void;
}) {
  const totalRevenue = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount_mxn, 0);
  const activeMemberships = data.users.filter((u) => u.membership_status === "active").length;
  const unclaimedCount = data.requests.filter(
    (r) => r.status === "en_proceso" && !r.claimed_by_name,
  ).length;
  const changeRequestedCount = data.requests.filter((r) => r.status === "cambio_solicitado").length;
  const needsAttention = unclaimedCount + changeRequestedCount;
  const attentionSubtext =
    needsAttention === 0
      ? undefined
      : [
          unclaimedCount > 0
            ? unclaimedCount === 1
              ? "1 solicitud sin diseñador asignado"
              : `${unclaimedCount} solicitudes sin diseñador asignado`
            : null,
          changeRequestedCount > 0
            ? changeRequestedCount === 1
              ? "1 cambio reportado por un cliente"
              : `${changeRequestedCount} cambios reportados por clientes`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
  const rated = data.requests.filter((r) => r.satisfaction_rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, r) => s + (r.satisfaction_rating ?? 0), 0) / rated.length
    : null;

  const revenueSeries = buildRevenueSeries(data.payments);
  const requestsSeries = buildRequestsSeries(data.requests);
  const statusBreakdown = buildStatusBreakdown(data.requests);
  const planBreakdown = buildPlanBreakdown(data.users);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Ingresos totales"
          value={`$${totalRevenue.toLocaleString("es-MX")}`}
          icon={Wallet}
          accent="emerald"
        />
        <KpiCard
          label="Membresías activas"
          value={String(activeMemberships)}
          icon={Users}
          accent="blue"
        />
        <KpiCard
          label="Necesitan tu atención"
          value={String(needsAttention)}
          subtext={attentionSubtext}
          icon={AlertCircle}
          accent="amber"
          onClick={needsAttention > 0 ? onNavigateToAttention : undefined}
        />
        <KpiCard
          label="Calificación promedio"
          value={avgRating ? `${avgRating.toFixed(1)} / 5` : "Sin datos"}
          icon={Star}
          accent="violet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Ingresos por mes" subtitle="Últimos 6 meses, MXN">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ left: -20, top: 5, right: 10 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0047ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0047ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef0f5" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#5a6478" }}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5a6478" }} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => `$${v.toLocaleString("es-MX")} MXN`} />}
              />
              <Area
                type="monotone"
                dataKey="ingresos"
                stroke="#0047ff"
                strokeWidth={2.5}
                fill="url(#revenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Solicitudes creadas" subtitle="Últimos 6 meses">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={requestsSeries} margin={{ left: -20, top: 5, right: 10 }}>
              <CartesianGrid vertical={false} stroke="#eef0f5" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#5a6478" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#5a6478" }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,71,255,0.06)" }} />
              <Bar dataKey="solicitudes" fill="#0047ff" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Solicitudes por estado" subtitle="Todo el historial">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusBreakdown}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {statusBreakdown.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="-mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {statusBreakdown.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-wit-gray">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Membresías por plan" subtitle="Activas ahora">
          {planBreakdown.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-wit-gray">
              Aún no hay membresías activas.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  >
                    {planBreakdown.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {planBreakdown.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs text-wit-gray">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

type AdminTab = "dashboard" | "solicitudes" | "diseñadores" | "usuarios" | "campanas" | "pagos";

const NAV_ITEMS: { key: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "solicitudes", label: "Solicitudes", icon: ClipboardList },
  { key: "diseñadores", label: "Diseñadores", icon: Palette },
  { key: "usuarios", label: "Usuarios", icon: Users },
  { key: "campanas", label: "Campañas", icon: Megaphone },
  { key: "pagos", label: "Pagos", icon: CreditCard },
];

function Admin() {
  const platform = usePlatformUser();
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as Overview;
    },
    enabled: Boolean(platform.data),
    refetchInterval: 30_000,
  });
  const [tab, setTab] = useState<AdminTab>("dashboard");
  // Same lifted-toast pattern as witer.tsx's DesignerPanel — a card that
  // just moved out of its bucket (deliver/reject) would unmount before the
  // admin ever saw a toast rendered inside it, so this lives at the panel
  // level instead.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  if (platform.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!platform.data) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          El panel de administración requiere una cuenta con rol de administrador. Inicia sesión y
          vuelve a esta página.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/ingresar";
          }}
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión de administrador
        </button>
      </div>
    );
  }

  const data = overview.data;
  const needsAttentionCount =
    data?.requests.filter(
      (r) => (r.status === "en_proceso" && !r.claimed_by_name) || r.status === "cambio_solicitado",
    ).length ?? 0;

  function logout() {
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      window.location.href = "/";
    });
  }

  const TAB_TITLES: Record<AdminTab, string> = {
    dashboard: "Dashboard",
    solicitudes: "Solicitudes",
    diseñadores: "Diseñadores",
    usuarios: "Usuarios",
    campanas: "Campañas",
    pagos: "Pagos",
  };

  return (
    <div className="wit-page min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-wit-ink/10 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-wit-ink/10 px-5">
          <Link to="/" className="shrink-0">
            <WMark size={26} />
          </Link>
          <span className="truncate font-wit text-sm font-extrabold tracking-[0.16em] text-wit-ink">
            WITERS
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-wit-mist/60 px-2.5 py-1 text-[10px] font-bold text-wit-blue">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.key;
            const badge = item.key === "solicitudes" ? needsAttentionCount : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-wit-blue text-white shadow-[0_10px_25px_rgba(0,71,255,0.28)]"
                    : "text-wit-gray hover:bg-wit-mist/50 hover:text-wit-ink"
                }`}
              >
                <item.icon size={18} strokeWidth={2.1} />
                {item.label}
                {badge > 0 ? (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-wit-ink/10 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-wit-gray hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} strokeWidth={2.1} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="wit-glass border-b border-wit-ink/10 lg:hidden">
          <div className="flex h-16 items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <Link to="/">
                <WitersLogo compact />
              </Link>
              <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
                ADMIN
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="wit-navlink text-sm font-medium text-wit-ink"
            >
              Cerrar sesión
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-5 pb-3">
            {NAV_ITEMS.map((item) => {
              const active = tab === item.key;
              const badge = item.key === "solicitudes" ? needsAttentionCount : 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    active ? "bg-wit-blue text-white" : "bg-wit-mist/50 text-wit-gray"
                  }`}
                >
                  {item.label}
                  {badge > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-10">
          <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink">
            {TAB_TITLES[tab]}
          </h1>

          {overview.isLoading ? (
            <div className="mt-6 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          ) : !data?.ok ? (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              No pudimos cargar los datos de administración.
            </p>
          ) : tab === "dashboard" ? (
            <DashboardView data={data} onNavigateToAttention={() => setTab("solicitudes")} />
          ) : tab === "solicitudes" ? (
            <RequestsAdmin rows={data.requests} me={String(platform.data.id)} onSent={showToast} />
          ) : tab === "diseñadores" ? (
            <DesignersPanel rows={data.designers} requests={data.requests} />
          ) : tab === "usuarios" ? (
            <UsersTable rows={data.users} />
          ) : tab === "campanas" ? (
            <CampaignsAdmin users={data.users} />
          ) : (
            <PagosPanel payments={data.payments} discountCodes={data.discountCodes} />
          )}
        </main>
      </div>

      {toast ? (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
          <span className="rounded-full bg-wit-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            ✓ {toast}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- requests management ---------- */

type RequestsTab = "atencion" | "en_proceso" | "completadas" | "finalizadas" | "rechazadas";

const REQUESTS_TAB_META: Record<RequestsTab, { label: string; empty: string }> = {
  atencion: { label: "Necesitan atención", empty: "No hay nada esperando tu atención." },
  en_proceso: { label: "En proceso", empty: "No hay solicitudes en proceso." },
  completadas: { label: "Completadas", empty: "No hay solicitudes completadas por confirmar." },
  finalizadas: { label: "Finalizadas", empty: "Aún no hay solicitudes finalizadas." },
  rechazadas: { label: "Rechazadas", empty: "No hay solicitudes rechazadas." },
};

function RequestsAdmin({
  rows,
  me,
  onSent,
}: {
  rows: AdminRequest[];
  me: string;
  onSent: (text: string) => void;
}) {
  const [tab, setTab] = useState<RequestsTab>("atencion");

  if (rows.length === 0) {
    return (
      <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
        <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
      </div>
    );
  }

  // "Necesitan atención" groups the two states that require an admin to act
  // before the design team can move: nobody has claimed it yet, or a client
  // reported an error on an already-closed piece (see /api/admin/activate-change).
  const buckets: Record<RequestsTab, AdminRequest[]> = {
    atencion: rows.filter(
      (r) => (r.status === "en_proceso" && !r.claimed_by_name) || r.status === "cambio_solicitado",
    ),
    en_proceso: rows.filter((r) => r.status === "en_proceso" && Boolean(r.claimed_by_name)),
    completadas: rows.filter((r) => r.status === "completada"),
    finalizadas: rows.filter((r) => r.status === "cerrada"),
    rechazadas: rows.filter((r) => r.status === "rechazada"),
  };
  const shown = buckets[tab];

  return (
    <div>
      <div className="mt-6 flex gap-5 overflow-x-auto border-b border-wit-ink/10">
        {(Object.keys(REQUESTS_TAB_META) as RequestsTab[]).map((t) => (
          <AdminSubTab
            key={t}
            active={tab === t}
            onClick={() => setTab(t)}
            label={REQUESTS_TAB_META[t].label}
            count={buckets[t].length}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
          <p className="text-base font-semibold text-wit-ink">{REQUESTS_TAB_META[tab].empty}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {shown.map((r) => {
            if (tab === "finalizadas") {
              return <FinishedRequestCard key={r.id} row={r} me={me} onSent={onSent} />;
            }
            if (tab === "completadas" || tab === "rechazadas") {
              // Nothing to act on — same "just monitor" collapsed thumbnail
              // treatment witer.tsx uses for completada/rechazada rows.
              return (
                <CompactRequestCard
                  key={r.id}
                  row={r}
                  me={me}
                  onSent={onSent}
                  queryKey={ADMIN_OVERVIEW_QUERY_KEY}
                  isAdmin
                />
              );
            }
            if (r.status === "cambio_solicitado") {
              return (
                <StaffRequestCard
                  key={r.id}
                  row={r}
                  me={me}
                  onSent={onSent}
                  queryKey={ADMIN_OVERVIEW_QUERY_KEY}
                  isAdmin
                />
              );
            }
            if (!r.claimed_by) {
              // Exact same collapsed row + claim button + "Tomada por ti"
              // the designer panel shows for an unclaimed request.
              return (
                <PendingCompactCard
                  key={r.id}
                  row={r}
                  me={me}
                  queryKey={ADMIN_OVERVIEW_QUERY_KEY}
                />
              );
            }
            return <ExpandableAdminRequestCard key={r.id} row={r} me={me} onSent={onSent} />;
          })}
        </div>
      )}
    </div>
  );
}

function AdminSubTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-bold transition-colors ${
        active
          ? "border-wit-blue text-wit-blue"
          : "border-transparent text-wit-gray hover:text-wit-ink"
      }`}
    >
      {label}
      {count > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            active ? "bg-wit-blue/10 text-wit-blue" : "bg-wit-mist/60 text-wit-gray"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

// Collapsed row for a claimed, in-progress request an admin isn't
// currently acting on — title, format, date, and who has it. Clicking it
// expands into the full shared StaffRequestCard for oversight/detail,
// same as before, but that expanded view is now the identical card a
// designer sees (claim state, copy-prompt feedback, deliver/reject) rather
// than a separately-maintained one.
function ExpandableAdminRequestCard({
  row,
  me,
  onSent,
}: {
  row: AdminRequest;
  me: string;
  onSent: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-2 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          ← Ocultar detalle
        </button>
        <StaffRequestCard
          row={row}
          me={me}
          onSent={onSent}
          queryKey={ADMIN_OVERVIEW_QUERY_KEY}
          isAdmin
        />
      </div>
    );
  }

  const statusCls =
    row.status === "completada"
      ? "bg-emerald-50 text-emerald-700"
      : row.status === "rechazada"
        ? "bg-red-50 text-red-600"
        : "bg-amber-50 text-amber-700";

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="wit-glass flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
        <p className="mt-0.5 text-xs text-wit-gray">
          {row.aspect_ratio}
          {row.style ? ` · ${row.style}` : ""} ·{" "}
          {new Date(row.created_at + "Z").toLocaleString("es-MX")}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusCls}`}>
        {row.status.replace("_", " ")}
      </span>
      <span className="shrink-0 text-xs font-semibold text-wit-gray">
        {row.claimed_by === me ? "Tomada por ti" : row.claimed_by_name}
      </span>
    </button>
  );
}

// Collapsed row for an already-finalized request: title, date, and the
// delivered thumbnail only — clicking it expands into the full shared
// StaffRequestCard instead of always showing every field, plus two
// genuinely admin-only actions (toggle logo visibility, delete) appended
// below it that a designer should never see.
function FinishedRequestCard({
  row,
  me,
  onSent,
}: {
  row: AdminRequest;
  me: string;
  onSent: (text: string) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingLogo, setTogglingLogo] = useState(false);

  async function toggleLogoVisibility() {
    const nextVisible = row.logo_public !== 1;
    setTogglingLogo(true);
    try {
      const res = await fetch("/api/admin/toggle-logo-visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id, visible: nextVisible }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        await qc.invalidateQueries({ queryKey: ["admin-overview"] });
      } else {
        window.alert("No pudimos actualizar el logo. Intenta de nuevo.");
      }
    } catch {
      window.alert("No pudimos actualizar el logo. Intenta de nuevo.");
    } finally {
      setTogglingLogo(false);
    }
  }

  async function deleteRequest() {
    if (
      !window.confirm(
        `¿Eliminar la solicitud "${row.title}"? Esto borra el registro y los archivos entregados de forma permanente — no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        await qc.invalidateQueries({ queryKey: ["admin-overview"] });
      } else {
        window.alert("No pudimos eliminar la solicitud. Intenta de nuevo.");
      }
    } catch {
      window.alert("No pudimos eliminar la solicitud. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  const thumb = (() => {
    if (!row.results_json) return null;
    try {
      const arr = (JSON.parse(row.results_json) as ResultItem[]).filter(
        (x) => x && x.kind !== "draft" && (x.image_url || x.r2_key),
      );
      return arr.at(-1) ?? null;
    } catch {
      return null;
    }
  })();
  const thumbHref = thumb
    ? (thumb.image_url ?? `/api/file?key=${encodeURIComponent(thumb.r2_key ?? "")}`)
    : null;

  if (expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-2 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          ← Ocultar detalle
        </button>
        <StaffRequestCard
          row={row}
          me={me}
          onSent={onSent}
          queryKey={ADMIN_OVERVIEW_QUERY_KEY}
          isAdmin
        />
        {row.logo_key ? (
          <button
            type="button"
            disabled={togglingLogo}
            onClick={toggleLogoVisibility}
            className="mt-3 w-full rounded-2xl border border-wit-ink/15 py-3 text-sm font-bold text-wit-ink hover:bg-wit-mist/50 disabled:opacity-50"
          >
            {togglingLogo
              ? "Actualizando..."
              : row.logo_public === 1
                ? "Ocultar logo de “Marcas que confían”"
                : "Mostrar logo en “Marcas que confían”"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={deleting}
          onClick={deleteRequest}
          className="mt-3 w-full rounded-2xl border border-red-200 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="wit-glass flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
    >
      {thumbHref ? (
        <img
          src={thumbHref}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-wit-mist/40" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
        <p className="mt-0.5 text-xs text-wit-gray">
          {new Date(row.created_at + "Z").toLocaleString("es-MX")}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-wit-blue/10 px-3 py-1 text-xs font-bold text-wit-blue">
        ✓ Finalizada
      </span>
    </button>
  );
}

/* ---------- designers ---------- */

// A piece counts as "delivered" once it's gone through the design team at
// least once — completada (still open for the client), cerrada (closed) or
// cambio_solicitado (a closed piece flagged for a post-close fix) all mean
// the designer did the work. Only en_proceso means it's still pending.
const DELIVERED_STATUSES = new Set(["completada", "cerrada", "cambio_solicitado"]);

type DesignerMetrics = {
  claimedCount: number;
  completionRate: number | null; // 0-100
  avgRating: number | null; // 0-5
  noRevisionRate: number | null; // 0-100
  avgDeliveryHours: number | null;
};

function computeDesignerMetrics(designerId: string, requests: AdminRequest[]): DesignerMetrics {
  const claimed = requests.filter((r) => r.claimed_by === designerId);
  const delivered = claimed.filter((r) => DELIVERED_STATUSES.has(r.status));

  const ratings = delivered
    .map((r) => r.satisfaction_rating)
    .filter((n): n is number => typeof n === "number");
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const noRevisionRate = delivered.length
    ? (delivered.filter((r) => r.revisions_used === 0).length / delivered.length) * 100
    : null;

  // Real delivery time, not just design_requests.updated_at — that column
  // gets overwritten again when a piece is later closed or reopened for a
  // post-close change, which would silently corrupt this into "time to
  // close" instead of "time to deliver". The first non-draft result's
  // created_at is the actual moment the designer delivered.
  const deliveryHours: number[] = [];
  for (const r of delivered) {
    if (!r.claimed_at || !r.results_json) continue;
    let items: ResultItem[];
    try {
      items = JSON.parse(r.results_json) as ResultItem[];
    } catch {
      continue;
    }
    const firstDelivery = items
      .filter((it) => it.kind !== "draft" && it.created_at)
      .map((it) => new Date(it.created_at + "Z").getTime())
      .sort((a, b) => a - b)[0];
    if (!firstDelivery) continue;
    const claimedAt = new Date(r.claimed_at + "Z").getTime();
    const hours = (firstDelivery - claimedAt) / 3_600_000;
    if (hours >= 0) deliveryHours.push(hours);
  }
  const avgDeliveryHours = deliveryHours.length
    ? deliveryHours.reduce((a, b) => a + b, 0) / deliveryHours.length
    : null;

  return {
    claimedCount: claimed.length,
    completionRate: claimed.length ? (delivered.length / claimed.length) * 100 : null,
    avgRating,
    noRevisionRate,
    avgDeliveryHours,
  };
}

function MiniBar({
  label,
  valueLabel,
  percent,
  colorClass,
}: {
  label: string;
  valueLabel: string;
  percent: number | null;
  colorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-wit-gray">
        <span>{label}</span>
        <span className="font-wit-mono text-wit-ink">{percent === null ? "—" : valueLabel}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-28 overflow-hidden rounded-full bg-wit-mist/60">
        {percent !== null ? (
          <div
            className={`h-full rounded-full ${colorClass}`}
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DesignerPerformanceCell({
  designerId,
  requests,
  fastestAvgHours,
}: {
  designerId: string;
  requests: AdminRequest[];
  fastestAvgHours: number | null;
}) {
  const m = computeDesignerMetrics(designerId, requests);
  if (m.claimedCount === 0) {
    return <p className="text-xs text-wit-gray">Sin piezas tomadas aún</p>;
  }
  const speedPercent =
    m.avgDeliveryHours !== null && fastestAvgHours !== null
      ? (fastestAvgHours / m.avgDeliveryHours) * 100
      : null;
  return (
    <div className="flex flex-col gap-1.5">
      <MiniBar
        label="Finalización"
        valueLabel={`${Math.round(m.completionRate ?? 0)}%`}
        percent={m.completionRate}
        colorClass="bg-wit-blue"
      />
      <MiniBar
        label="Calificación"
        valueLabel={`${(m.avgRating ?? 0).toFixed(1)}/5`}
        percent={m.avgRating !== null ? (m.avgRating / 5) * 100 : null}
        colorClass="bg-violet-500"
      />
      <MiniBar
        label="Sin revisión"
        valueLabel={`${Math.round(m.noRevisionRate ?? 0)}%`}
        percent={m.noRevisionRate}
        colorClass="bg-emerald-500"
      />
      <MiniBar
        label="Velocidad"
        valueLabel={`${Math.round(m.avgDeliveryHours ?? 0)}h prom.`}
        percent={speedPercent}
        colorClass="bg-amber-500"
      />
    </div>
  );
}

function DesignersPanel({ rows, requests }: { rows: AdminDesigner[]; requests: AdminRequest[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminDesigner | null>(null);

  // The "Velocidad" bar compares each designer against the fastest one on
  // the team right now, not an arbitrary fixed target — there's no single
  // "correct" delivery time across every kind of piece, but knowing who's
  // fastest relative to their own teammates is directly actionable.
  const fastestAvgHours = useMemo(() => {
    const averages = rows
      .map((d) => computeDesignerMetrics(d.id, requests).avgDeliveryHours)
      .filter((h): h is number => h !== null && h > 0);
    return averages.length ? Math.min(...averages) : null;
  }, [rows, requests]);

  async function createDesigner(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/create-designer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setMsg(
          data.error === "correo_registrado"
            ? "Ese correo ya está registrado."
            : "Revisa los campos (nombre, correo válido, contraseña de al menos 8 caracteres).",
        );
        return;
      }
      setMsg(`Cuenta creada. Comparte estas credenciales con ${name}: ${email} / ${password}`);
      setName("");
      setEmail("");
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      setMsg("No pudimos crear la cuenta. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <h2 className="text-base font-bold text-wit-ink">Crear cuenta de diseñador</h2>
        <p className="mt-1 text-sm text-wit-gray">
          Tú eliges la contraseña y se la compartes directamente — el diseñador no se registra solo.
        </p>
        <form onSubmit={createDesigner} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña temporal"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50 sm:col-span-3 sm:w-fit"
          >
            {busy ? "Creando..." : "Crear diseñador"}
          </button>
        </form>
        {msg ? (
          <p className="mt-3 rounded-lg bg-wit-mist/40 px-3 py-2 text-sm text-wit-ink">{msg}</p>
        ) : null}
      </section>

      <div className="wit-glass overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
              <th className="px-5 py-3.5">Diseñador</th>
              <th className="px-5 py-3.5">Tomadas</th>
              <th className="px-5 py-3.5">Entregadas</th>
              <th className="px-5 py-3.5">Desempeño</th>
              <th className="px-5 py-3.5">Alta</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-wit-ink/5 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-wit-ink">{d.name}</p>
                  <p className="text-xs text-wit-gray">{d.email}</p>
                </td>
                <td className="px-5 py-3.5 font-wit-mono">{d.claimed_count}</td>
                <td className="px-5 py-3.5 font-wit-mono">{d.completed_count}</td>
                <td className="px-5 py-3.5">
                  <DesignerPerformanceCell
                    designerId={d.id}
                    requests={requests}
                    fastestAvgHours={fastestAvgHours}
                  />
                </td>
                <td className="px-5 py-3.5 text-xs text-wit-gray">
                  {new Date(d.created_at + "Z").toLocaleDateString("es-MX")}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(d)}
                    aria-label={`Editar a ${d.name}`}
                    title="Editar"
                    className="rounded-lg p-2 text-wit-gray transition-colors hover:bg-wit-blue/10 hover:text-wit-blue"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wit-gray">Aún no tienes diseñadores.</p>
        ) : null}
      </div>

      {editing
        ? createPortal(
            <EditDesignerModal
              designer={editing}
              onClose={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await qc.invalidateQueries({ queryKey: ["admin-overview"] });
              }}
              onDeactivated={async () => {
                setEditing(null);
                await qc.invalidateQueries({ queryKey: ["admin-overview"] });
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function EditDesignerModal({
  designer,
  onClose,
  onSaved,
  onDeactivated,
}: {
  designer: AdminDesigner;
  onClose: () => void;
  onSaved: () => void;
  onDeactivated: () => void;
}) {
  const [name, setName] = useState(designer.name);
  const [email, setEmail] = useState(designer.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"designer" | "admin">("designer");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/update-designer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: designer.id, name, email, password, role }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setMsg(
          data.error === "correo_registrado"
            ? "Ese correo ya está registrado por otra cuenta."
            : "Revisa los campos e intenta de nuevo.",
        );
        return;
      }
      onSaved();
    } catch {
      setMsg("No pudimos guardar los cambios. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (
      !window.confirm(`¿Dar de baja a ${designer.name}? Ya no podrá iniciar sesión como diseñador.`)
    ) {
      return;
    }
    setRemoving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/deactivate-designer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: designer.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setMsg("No pudimos dar de baja a este diseñador. Intenta de nuevo.");
        return;
      }
      onDeactivated();
    } catch {
      setMsg("No pudimos dar de baja a este diseñador. Intenta de nuevo.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/90 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-wit-ink">Editar diseñador</h2>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">Nombre</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              Nueva contraseña (opcional)
            </label>
            <input
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar en blanco para no cambiarla"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "designer" | "admin")}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            >
              <option value="designer">Diseñador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {msg ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-wit-ink/15 px-5 py-2.5 text-sm font-semibold text-wit-ink hover:border-wit-ink/30"
            >
              Cancelar
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-wit-ink/10 pt-4">
          <button
            type="button"
            disabled={removing}
            onClick={deactivate}
            className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {removing ? "Dando de baja..." : "Dar de baja a este diseñador"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- users & payments ---------- */

function UsersTable({ rows }: { rows: AdminUser[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pinTarget, setPinTarget] = useState<AdminUser | null>(null);

  return (
    <div className="wit-glass mt-6 overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Marca</th>
            <th className="px-5 py-3.5">Membresía</th>
            <th className="px-5 py-3.5">Solicitudes</th>
            <th className="px-5 py-3.5">Pagado</th>
            <th className="px-5 py-3.5">Alta</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-wit-ink/5 last:border-0">
              <td className="px-5 py-3.5">
                <p className="font-semibold text-wit-ink">{u.name}</p>
                <p className="text-xs text-wit-gray">{u.email}</p>
              </td>
              <td className="px-5 py-3.5">
                {u.brand_company_name ? (
                  <p className="text-sm text-wit-ink">{u.brand_company_name}</p>
                ) : (
                  <p className="text-xs text-wit-gray">Sin solicitud aún</p>
                )}
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    u.membership_status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {u.membership_status === "active" ? "Activa" : "Sin activar"}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <p className="font-wit-mono">
                  {u.requests_used ?? 0}/{(u.requests_quota ?? 0) + (u.bonus_requests_quota ?? 0)}
                </p>
                {u.bonus_requests_quota ? (
                  <p className="text-[11px] font-semibold text-wit-blue">
                    +{u.bonus_requests_quota} regaladas
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-3.5 font-wit-mono">
                ${u.total_paid_mxn.toLocaleString("es-MX")}
              </td>
              <td className="px-5 py-3.5 text-xs text-wit-gray">
                {new Date(u.created_at + "Z").toLocaleDateString("es-MX")}
              </td>
              <td className="px-5 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => setPinTarget(u)}
                  aria-label={`Editar a ${u.name}`}
                  title="Editar"
                  className="rounded-lg p-2 text-wit-gray transition-colors hover:bg-wit-blue/10 hover:text-wit-blue"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-wit-gray">Sin usuarios registrados aún.</p>
      ) : null}

      {pinTarget
        ? createPortal(
            <PinGateModal
              onClose={() => setPinTarget(null)}
              onConfirmed={() => {
                setEditing(pinTarget);
                setPinTarget(null);
              }}
            />,
            document.body,
          )
        : null}

      {editing
        ? createPortal(
            <EditUserModal
              user={editing}
              onClose={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await qc.invalidateQueries({ queryKey: ["admin-overview"] });
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function PinGateModal({
  onClose,
  onConfirmed,
  description = "Ingresa el código para editar los datos de este usuario.",
}: {
  onClose: () => void;
  onConfirmed: () => void;
  description?: string;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  // "wrong" = bad code, try again. "unset" = ADMIN_EDIT_PIN isn't
  // configured server-side yet — a different problem than a typo, so it
  // gets its own message instead of just "Código incorrecto."
  const [error, setError] = useState<"wrong" | "unset" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      // Verified server-side (see /api/admin/verify-pin) precisely so the
      // real code never ships in this file's JS bundle — only "correct or
      // not" crosses the network, never the value itself.
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        onConfirmed();
        return;
      }
      setError(data.error === "sin_configurar" ? "unset" : "wrong");
      setCode("");
    } catch {
      setError("wrong");
      setCode("");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/90 p-5"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-base font-bold text-wit-ink">Código de administrador</h2>
        <p className="mt-1 text-xs text-wit-gray">{description}</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
          value={code}
          onChange={(e) => {
            setError(null);
            setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
          }}
          className={`mt-4 w-full rounded-xl border px-4 py-3 text-center font-wit-mono text-lg tracking-[0.5em] outline-none ${
            error === "wrong"
              ? "border-red-400 focus:border-red-500"
              : "border-wit-ink/15 focus:border-wit-blue"
          }`}
          placeholder="····"
        />
        {error === "wrong" ? <p className="mt-2 text-xs text-red-600">Código incorrecto.</p> : null}
        {error === "unset" ? (
          <p className="mt-2 text-xs text-amber-600">
            Todavía no se configuró el código (ADMIN_EDIT_PIN) en el servidor.
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm font-semibold text-wit-ink hover:border-wit-blue"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={code.length !== 4 || checking}
            className="flex-1 rounded-xl bg-wit-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
          >
            {checking ? "Verificando..." : "Continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Quick manual top-up for a client who ran out of solicitudes — same
// bonus_requests_quota mechanism as a purchased image pack (see
// /api/admin/grant-requests), just free and one click. Deliberately a
// single fixed amount, not a picker: this is the "start simple" version —
// a designer selling image packs from the panel already exists for anyone
// who wants a specific amount. Lives inside EditUserModal, next to the
// membership status it affects, not in the table row — same place every
// other per-user admin action (activar membresía, editar marca) already is.
function GrantRequestsButton({ userId, onGranted }: { userId: string; onGranted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function grant() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/grant-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amount: 10 }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError(true);
        return;
      }
      onGranted();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={grant}
        disabled={busy}
        className="shrink-0 rounded-xl border border-wit-blue/25 px-4 py-2 text-xs font-bold text-wit-blue transition-colors hover:bg-wit-blue/10 disabled:opacity-50"
      >
        {busy ? "Regalando..." : "+10 solicitudes"}
      </button>
      {error ? <p className="text-[11px] text-red-600">No se pudo. Intenta de nuevo.</p> : null}
    </div>
  );
}

// One membership, one business: this is the only way to correct a
// member's locked brand identity (company name, colors, category, logo)
// once they've submitted their first request — see /api/requests and
// brand-profile.server.ts for the lock itself.
function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [companyName, setCompanyName] = useState(user.brand_company_name ?? "");
  const [brandColors, setBrandColors] = useState(user.brand_colors ?? "");
  const [businessType, setBusinessType] = useState(user.brand_business_type ?? "");
  const [metaPageId, setMetaPageId] = useState(user.brand_meta_page_id ?? "");
  const [metaAdAccountId, setMetaAdAccountId] = useState(user.brand_meta_ad_account_id ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState<string | null>(null);
  const [activatePlan, setActivatePlan] = useState<PlanId>(
    isPlanId(user.membership_plan) ? user.membership_plan : "essential",
  );

  // For a client who paid outside the app (transferencia, en persona) —
  // mirrors what the sandbox checkout does, just triggered by an admin
  // instead of the client's own card form.
  async function activateMembership() {
    setActivating(true);
    setActivateMsg(null);
    try {
      const res = await fetch("/api/admin/activate-membership", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: activatePlan }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setActivateMsg("No pudimos activar la membresía. Intenta de nuevo.");
        return;
      }
      onSaved();
    } catch {
      setActivateMsg("No pudimos activar la membresía. Intenta de nuevo.");
    } finally {
      setActivating(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (companyName.trim().length < 2) {
      setMsg("El nombre de la empresa debe tener al menos 2 caracteres.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let logoKey: string | null | undefined;
      if (clearLogo) {
        logoKey = null;
      } else if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const up = await fetch("/api/upload-reference", { method: "POST", body: fd });
        const upData = (await up.json()) as { ok: boolean; key?: string };
        if (!upData.ok || !upData.key) {
          setMsg("No pudimos subir el logotipo (PNG, JPG o WebP, máx. 8 MB).");
          setBusy(false);
          return;
        }
        logoKey = upData.key;
      }

      const res = await fetch("/api/admin/update-brand-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          companyName,
          brandColors: brandColors || undefined,
          businessType: businessType || undefined,
          metaPageId: metaPageId.trim() || null,
          metaAdAccountId: metaAdAccountId.trim() || null,
          logoKey,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setMsg("Revisa los campos e intenta de nuevo.");
        return;
      }
      onSaved();
    } catch {
      setMsg("No pudimos guardar los cambios. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/90 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-wit-ink">Editar a {user.name}</h2>

        <div className="mt-4 rounded-xl bg-wit-mist/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-wit-gray">Membresía</p>
              <p className="text-sm text-wit-ink">
                {user.membership_status === "active" ? (
                  <span className="font-semibold text-emerald-700">
                    Activa · {user.requests_used ?? 0}/
                    {(user.requests_quota ?? 0) + (user.bonus_requests_quota ?? 0)} solicitudes
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700">Sin activar</span>
                )}
              </p>
            </div>
            {user.membership_status === "active" ? (
              <GrantRequestsButton userId={user.id} onGranted={onSaved} />
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <select
              value={activatePlan}
              onChange={(e) => setActivatePlan(e.target.value as PlanId)}
              className="rounded-xl border border-wit-ink/15 px-2 py-2 text-xs font-semibold text-wit-ink outline-none focus:border-wit-blue"
            >
              {MEMBERSHIP_PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={
                activating ||
                (user.membership_status === "active" && activatePlan === user.membership_plan)
              }
              onClick={activateMembership}
              className="shrink-0 rounded-xl bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {activating
                ? "Guardando..."
                : user.membership_status === "active"
                  ? "Cambiar plan"
                  : "Activar membresía"}
            </button>
          </div>
          {user.membership_status === "active" ? (
            <p className="mt-1.5 text-[11px] text-wit-gray">
              Cambia el plan sin cobrar nada — para clientes que ya pagaron fuera de la app.
            </p>
          ) : null}
        </div>
        {activateMsg ? <p className="mt-2 text-xs text-red-600">{activateMsg}</p> : null}

        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-wit-gray">Marca</p>
        <p className="mt-1 text-xs text-wit-gray">
          Estos datos quedan fijos para el cliente desde su primera solicitud — solo un
          administrador puede cambiarlos.
        </p>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              Nombre de la empresa
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              Colores de marca <span className="font-normal">(hex, separados por coma)</span>
            </label>
            <input
              type="text"
              value={brandColors}
              onChange={(e) => setBrandColors(e.target.value)}
              placeholder="#0047FF, #111827"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              Categoría de negocio
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              ID de Página de Facebook <span className="font-normal">(para que pueda pautar)</span>
            </label>
            <input
              type="text"
              value={metaPageId}
              onChange={(e) => setMetaPageId(e.target.value)}
              placeholder="Vacío = no puede pautar todavía"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              ID de cuenta publicitaria de Meta{" "}
              <span className="font-normal">(su propia cuenta, sin "act_")</span>
            </label>
            <input
              type="text"
              value={metaAdAccountId}
              onChange={(e) => setMetaAdAccountId(e.target.value)}
              placeholder="Vacío = no se pueden mostrar sus campañas todavía"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
            <p className="mt-1 text-[11px] text-wit-gray">
              Requiere que el cliente haya agregado a WITERS como socio en esa cuenta desde su
              Business Manager.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-wit-gray">
              Logotipo{" "}
              {user.brand_logo_key && !clearLogo ? (
                <span className="font-normal">(ya tiene uno registrado)</span>
              ) : null}
            </label>
            {user.brand_logo_key && !clearLogo ? (
              <div className="flex items-center gap-3">
                <img
                  src={`/api/file?key=${encodeURIComponent(user.brand_logo_key)}`}
                  alt=""
                  className="h-10 w-10 rounded-lg border border-wit-ink/10 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setClearLogo(true)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Quitar (vuelve a preguntársele)
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setLogoFile(e.target.files?.[0] ?? null);
                  setClearLogo(false);
                }}
                className="w-full rounded-xl border border-dashed border-wit-ink/20 px-4 py-2.5 text-sm text-wit-gray file:mr-3 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-wit-blue"
              />
            )}
            {clearLogo ? (
              <p className="mt-1.5 text-xs text-wit-gray">
                Se quitará el logotipo actual — el cliente lo verá pedido de nuevo en su próxima
                solicitud.{" "}
                <button
                  type="button"
                  onClick={() => setClearLogo(false)}
                  className="font-semibold text-wit-blue hover:text-wit-blue-deep"
                >
                  Deshacer
                </button>
              </p>
            ) : null}
          </div>

          {msg ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-wit-ink/15 px-5 py-2.5 text-sm font-semibold text-wit-ink hover:border-wit-ink/30"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  dailyBudgetCents: number | null;
  linked: boolean;
};

// Staff picks a client, sees every campaign that really exists right now
// in THEIR OWN Meta ad account (fetched live — WITERS never stores this
// list), and chooses which ones show up in that client's panel. Nothing
// here creates or edits campaigns in Meta; that still happens by hand in
// Ads Manager. See /api/admin/meta-campaigns and /api/admin/link-campaign.
function CampaignsAdmin({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.brand_company_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="wit-glass rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-xl border border-wit-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-wit-blue"
        />
        <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u)}
              className={`flex w-full flex-col items-start rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                selected?.id === u.id
                  ? "bg-wit-blue text-white"
                  : "text-wit-ink hover:bg-wit-mist/50"
              }`}
            >
              <span className="text-sm font-semibold">{u.brand_company_name ?? u.name}</span>
              <span
                className={`text-[11px] ${selected?.id === u.id ? "text-white/70" : "text-wit-gray"}`}
              >
                {u.email}
                {!u.brand_meta_ad_account_id ? " · sin cuenta conectada" : ""}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3.5 py-4 text-sm text-wit-gray">Sin resultados.</p>
          ) : null}
        </div>
      </div>

      {selected ? (
        <ClientCampaignsPanel key={selected.id} user={selected} />
      ) : (
        <div className="wit-glass flex items-center justify-center rounded-2xl p-14 text-center text-sm text-wit-gray shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          Elige un cliente de la lista para ver y elegir sus campañas.
        </div>
      )}
    </div>
  );
}

function ClientCampaignsPanel({ user }: { user: AdminUser }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ["admin-meta-campaigns", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/meta-campaigns?userId=${user.id}`, {
        credentials: "include",
      });
      return (await res.json()) as
        { ok: true; campaigns: MetaCampaign[] } | { ok: false; error: string };
    },
    enabled: Boolean(user.brand_meta_ad_account_id),
  });

  async function toggleLink(c: MetaCampaign) {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${c.linked ? "unlink-campaign" : "link-campaign"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, metaCampaignId: c.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError("No pudimos actualizar esa campaña. Intenta de nuevo.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["admin-meta-campaigns", user.id] });
    } catch {
      setError("No pudimos actualizar esa campaña. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  if (!user.brand_meta_ad_account_id) {
    return (
      <div className="wit-glass rounded-2xl p-8 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <p className="text-sm font-bold text-wit-ink">
          {user.brand_company_name ?? user.name} aún no tiene cuenta publicitaria conectada
        </p>
        <p className="mt-1.5 max-w-md text-xs text-wit-gray">
          Pide al cliente que agregue a WITERS como socio en su cuenta de Meta Ads y guarda el ID de
          esa cuenta en "Usuarios" → editar → ID de cuenta publicitaria de Meta.
        </p>
      </div>
    );
  }

  return (
    <div className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <h3 className="text-sm font-bold text-wit-ink">
        Campañas en la cuenta de {user.brand_company_name ?? user.name}
      </h3>
      <p className="mt-1 text-xs text-wit-gray">
        act_{user.brand_meta_ad_account_id} — elige cuáles ve el cliente en su panel.
      </p>

      {campaigns.isLoading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-wit-mist/40" />
          ))}
        </div>
      ) : !campaigns.data?.ok ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          No pudimos leer esa cuenta publicitaria ({campaigns.data?.error ?? "error desconocido"}).
          Confirma que el cliente ya aprobó a WITERS como socio y que el ID de cuenta es correcto.
        </p>
      ) : campaigns.data.campaigns.length === 0 ? (
        <p className="mt-4 text-sm text-wit-gray">
          Esa cuenta publicitaria todavía no tiene ninguna campaña.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {campaigns.data.campaigns.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-wit-ink/10 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-wit-ink">{c.name}</p>
                <p className="text-[11px] text-wit-gray">
                  {c.status}
                  {c.dailyBudgetCents != null
                    ? ` · $${(c.dailyBudgetCents / 100).toLocaleString("es-MX")} MXN/día`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => toggleLink(c)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                  c.linked
                    ? "border border-red-200 text-red-600 hover:bg-red-50"
                    : "bg-wit-blue text-white hover:bg-wit-blue-deep"
                }`}
              >
                {c.linked ? (
                  <>
                    <Link2Off size={13} strokeWidth={2.4} />
                    Quitar del panel
                  </>
                ) : (
                  <>
                    <Plus size={13} strokeWidth={2.4} />
                    Agregar al panel
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PagosTab = "historial" | "descuentos";

function PagosPanel({
  payments,
  discountCodes,
}: {
  payments: AdminPayment[];
  discountCodes: AdminDiscountCode[];
}) {
  const [tab, setTab] = useState<PagosTab>("historial");
  return (
    <div>
      <div className="mt-6 flex gap-5 overflow-x-auto border-b border-wit-ink/10">
        <AdminSubTab
          active={tab === "historial"}
          onClick={() => setTab("historial")}
          label="Historial"
          count={0}
        />
        <AdminSubTab
          active={tab === "descuentos"}
          onClick={() => setTab("descuentos")}
          label="Códigos de descuento"
          count={discountCodes.filter((c) => c.active).length}
        />
      </div>
      {tab === "historial" ? (
        <PaymentsTable rows={payments} />
      ) : (
        <DiscountCodesPanel rows={discountCodes} />
      )}
    </div>
  );
}

function DiscountCodesPanel({ rows }: { rows: AdminDiscountCode[] }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Editar/Desactivar/Eliminar stay hidden behind the pencil until the PIN
  // gate confirms — same protection as editar usuario, just scoped to one
  // row instead of a whole modal. Unlocking one code doesn't unlock others.
  const [pinTargetId, setPinTargetId] = useState<string | null>(null);
  const [unlockedId, setUnlockedId] = useState<string | null>(null);

  function refresh() {
    return qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch("/api/admin/update-discount-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    await refresh();
  }

  async function remove(id: string, code: string) {
    if (!confirm(`¿Eliminar el código ${code}? Esto no se puede deshacer.`)) return;
    await fetch("/api/admin/delete-discount-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-wit-gray">
          Códigos que un cliente puede usar en el checkout para un descuento porcentual sobre el
          precio con IVA.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="shrink-0 rounded-xl bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {showForm ? "Cancelar" : "+ Nuevo código"}
        </button>
      </div>

      {showForm ? (
        <CreateDiscountCodeForm
          onCreated={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
              <th className="px-5 py-3.5">Código</th>
              <th className="px-5 py-3.5">Descuento</th>
              <th className="px-5 py-3.5">Usos</th>
              <th className="px-5 py-3.5">Expira</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.id}>
                <tr className="border-b border-wit-ink/5 last:border-0">
                  <td className="px-5 py-3.5 font-wit-mono font-bold">{c.code}</td>
                  <td className="px-5 py-3.5">{c.discount_percent}%</td>
                  <td className="px-5 py-3.5 text-xs text-wit-gray">
                    {c.uses_count}
                    {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-wit-gray">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-MX") : "Nunca"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        c.active ? "bg-emerald-50 text-emerald-700" : "bg-wit-mist/60 text-wit-gray"
                      }`}
                    >
                      {c.active ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {unlockedId === c.id ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(editingId === c.id ? null : c.id);
                            setShowForm(false);
                          }}
                          className="text-xs font-bold text-wit-blue hover:underline"
                        >
                          {editingId === c.id ? "Cerrar" : "Editar"}
                        </button>
                        {c.active ? (
                          <button
                            type="button"
                            onClick={() => toggleActive(c.id, false)}
                            className="text-xs font-bold text-amber-600 hover:underline"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleActive(c.id, true)}
                            className="text-xs font-bold text-emerald-700 hover:underline"
                          >
                            Reactivar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(c.id, c.code)}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPinTargetId(c.id)}
                          aria-label={`Editar código ${c.code}`}
                          title="Editar"
                          className="rounded-lg p-2 text-wit-gray transition-colors hover:bg-wit-blue/10 hover:text-wit-blue"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editingId === c.id ? (
                  <tr className="border-b border-wit-ink/5 last:border-0">
                    <td colSpan={6} className="bg-wit-mist/20 px-5 py-4">
                      <EditDiscountCodeForm
                        row={c}
                        onSaved={() => {
                          setEditingId(null);
                          void refresh();
                        }}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wit-gray">
            Sin códigos de descuento todavía.
          </p>
        ) : null}
      </div>

      {pinTargetId
        ? createPortal(
            <PinGateModal
              onClose={() => setPinTargetId(null)}
              onConfirmed={() => {
                setUnlockedId(pinTargetId);
                setPinTargetId(null);
              }}
              description="Ingresa el código para editar este código de descuento."
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function EditDiscountCodeForm({ row, onSaved }: { row: AdminDiscountCode; onSaved: () => void }) {
  const [discountPercent, setDiscountPercent] = useState(String(row.discount_percent));
  const [maxUses, setMaxUses] = useState(row.max_uses !== null ? String(row.max_uses) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const percent = Number(discountPercent);
    if (!(percent > 0 && percent <= 100)) {
      setError("El porcentaje debe estar entre 0.1 y 100.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update-discount-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          discountPercent: percent,
          maxUses: maxUses.trim() ? Number(maxUses) : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError("No se pudo guardar. Intenta de nuevo.");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">
          Código (no editable)
        </label>
        <input
          value={row.code}
          disabled
          className="w-40 rounded-lg border border-wit-ink/15 bg-wit-mist/40 px-3 py-2 text-sm font-wit-mono uppercase text-wit-gray"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">Descuento %</label>
        <input
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          type="number"
          step="0.1"
          min="0.1"
          max="100"
          className="w-28 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">Usos máximos</label>
        <input
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          type="number"
          min="1"
          placeholder="Sin límite"
          className="w-32 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-wit-blue px-4 py-2 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
      >
        {busy ? "Guardando..." : "Guardar cambios"}
      </button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </form>
  );
}

function CreateDiscountCodeForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const percent = Number(discountPercent);
    if (!code.trim() || !(percent > 0 && percent <= 100)) {
      setError("Revisa el código y el porcentaje (0.1 – 100).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/create-discount-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          discountPercent: percent,
          maxUses: maxUses.trim() ? Number(maxUses) : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error === "codigo_ya_existe" ? "Ese código ya existe." : "No se pudo crear.");
        return;
      }
      onCreated();
    } catch {
      setError("No se pudo crear. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-wit-ink/10 bg-wit-mist/20 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">Código</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PRUEBA999"
          className="w-40 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm font-wit-mono uppercase outline-none focus:border-wit-blue"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">Descuento %</label>
        <input
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          type="number"
          step="0.1"
          min="0.1"
          max="100"
          placeholder="99.9"
          className="w-28 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-wit-ink">Usos máximos</label>
        <input
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          type="number"
          min="1"
          placeholder="Sin límite"
          className="w-32 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-wit-blue px-4 py-2 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
      >
        {busy ? "Creando..." : "Crear código"}
      </button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </form>
  );
}

function PaymentsTable({ rows }: { rows: AdminPayment[] }) {
  return (
    <div className="wit-glass mt-6 overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
            <th className="px-5 py-3.5">Fecha</th>
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Monto</th>
            <th className="px-5 py-3.5">Proveedor</th>
            <th className="px-5 py-3.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-wit-ink/5 last:border-0">
              <td className="px-5 py-3.5 text-xs text-wit-gray">
                {new Date(p.created_at + "Z").toLocaleString("es-MX")}
              </td>
              <td className="px-5 py-3.5">{p.user_email}</td>
              <td className="px-5 py-3.5 font-wit-mono">${p.amount_mxn.toLocaleString("es-MX")}</td>
              <td className="px-5 py-3.5">{p.provider}</td>
              <td className="px-5 py-3.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-wit-gray">Sin pagos registrados aún.</p>
      ) : null}
    </div>
  );
}
