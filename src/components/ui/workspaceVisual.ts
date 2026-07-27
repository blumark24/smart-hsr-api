/**
 * Shared visual tokens for the client workspace (UI-only).
 * Static Tailwind class strings — no data fetching or business logic.
 */

export const WS_PAGE =
  "space-y-4 sm:space-y-6 min-w-0 max-w-full lg:pb-6";

export const WS_CARD =
  "relative overflow-hidden rounded-[22px] border border-[rgba(148,163,184,0.14)] " +
  "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(145deg,rgba(15,35,65,0.82),rgba(8,18,38,0.94))] " +
  "shadow-[0_16px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[14px] " +
  "transition-[transform,box-shadow,border-color] duration-200 ease-out";

export const WS_SURFACE =
  "relative overflow-hidden rounded-[22px] border border-[rgba(148,163,184,0.14)] " +
  "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),linear-gradient(150deg,rgba(13,25,48,0.92),rgba(7,15,32,0.95))] " +
  "shadow-[0_16px_40px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[14px] " +
  "transition-[transform,box-shadow,border-color] duration-200 ease-out";

/** Safe hover lift for interactive dashboard cards */
export const WS_CARD_HOVER =
  "ws-card-hover hover:-translate-y-0.5 hover:border-[rgba(34,211,238,0.28)] " +
  "hover:shadow-[0_20px_52px_rgba(0,0,0,0.34),0_0_28px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.07)]";

export const WS_INNER_CARD =
  "rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,35,65,0.45)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const WS_SECTION_TITLE = "text-white font-heading font-semibold";
export const WS_MUTED = "text-[rgba(203,213,225,0.72)]";
export const WS_SUBTEXT = "text-[#9db1cf]";

export const WS_METRIC_VALUE =
  "font-heading font-extrabold tracking-tight text-white leading-none " +
  "text-[clamp(1.75rem,3vw,2.625rem)]";

export const WS_METRIC_LABEL =
  "text-[13px] font-medium text-[rgba(203,213,225,0.72)] leading-snug";

export const WS_STATUS_CHIP =
  "inline-flex items-center gap-1.5 min-h-[26px] px-2.5 py-0.5 rounded-full " +
  "text-xs font-semibold text-[rgba(226,232,240,0.92)] " +
  "bg-[rgba(15,35,65,0.58)] border border-[rgba(148,163,184,0.14)]";

export const WS_MOBILE_PAGE =
  "mx-auto w-full max-w-md space-y-3 sm:max-w-none sm:space-y-5";

export const WS_MOBILE_TOUCH_TARGET =
  "min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70";

export const WS_ICON_ORB =
  "grid place-items-center rounded-[15px] " +
  "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(34,211,238,0.16),rgba(30,111,217,0.10))] " +
  "border border-[rgba(34,211,238,0.20)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_20px_rgba(34,211,238,0.06)]";

export const WS_GLASS_MODAL =
  "glass-card w-full max-w-lg rounded-2xl border border-white/[0.10] bg-[#0b1e3a]/95 p-4 sm:p-6 max-h-[90vh] overflow-y-auto";

export const WS_AI_PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/15";

export const WS_LIVE_PILL =
  "inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium";

export type KpiAccent = "cyan" | "emerald" | "amber" | "rose" | "violet" | "sky";

export type KpiTheme = {
  glow: string;
  ambient: string;
  orb: string;
  iconColor: string;
  accent: string;
  livePill: string;
  iconTile: string;
  panelBorder: string;
  spark: string;
};

const KPI_THEMES: Record<KpiAccent, KpiTheme> = {
  cyan: {
    glow: "shadow-[0_16px_40px_-12px_rgba(34,211,238,0.35),0_0_0_1px_rgba(34,211,238,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(34,211,238,0.14),transparent_55%)]",
    orb: "bg-cyan-400/10 ring-1 ring-cyan-300/20",
    iconColor: "text-cyan-300",
    accent: "text-cyan-200/85",
    livePill: "bg-cyan-400/10 text-cyan-200 border border-cyan-300/20",
    iconTile: "border-[rgba(34,211,238,0.22)]",
    panelBorder: "border-[rgba(34,211,238,0.28)]",
    spark: "text-cyan-400/60",
  },
  emerald: {
    glow: "shadow-[0_16px_40px_-12px_rgba(16,185,129,0.32),0_0_0_1px_rgba(16,185,129,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(16,185,129,0.14),transparent_55%)]",
    orb: "bg-emerald-400/10 ring-1 ring-emerald-300/20",
    iconColor: "text-emerald-300",
    accent: "text-emerald-200/85",
    livePill: "bg-emerald-400/10 text-emerald-200 border border-emerald-300/20",
    iconTile: "border-[rgba(16,185,129,0.22)]",
    panelBorder: "border-[rgba(16,185,129,0.28)]",
    spark: "text-emerald-400/60",
  },
  amber: {
    glow: "shadow-[0_16px_40px_-12px_rgba(251,191,36,0.28),0_0_0_1px_rgba(251,191,36,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(251,191,36,0.12),transparent_55%)]",
    orb: "bg-amber-400/10 ring-1 ring-amber-300/20",
    iconColor: "text-amber-300",
    accent: "text-amber-200/85",
    livePill: "bg-amber-400/10 text-amber-200 border border-amber-300/20",
    iconTile: "border-[rgba(251,191,36,0.22)]",
    panelBorder: "border-[rgba(251,191,36,0.28)]",
    spark: "text-amber-400/60",
  },
  rose: {
    glow: "shadow-[0_16px_40px_-12px_rgba(244,63,94,0.28),0_0_0_1px_rgba(244,63,94,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(244,63,94,0.12),transparent_55%)]",
    orb: "bg-rose-400/10 ring-1 ring-rose-300/20",
    iconColor: "text-rose-300",
    accent: "text-rose-200/85",
    livePill: "bg-rose-400/10 text-rose-200 border border-rose-300/20",
    iconTile: "border-[rgba(244,63,94,0.22)]",
    panelBorder: "border-[rgba(244,63,94,0.28)]",
    spark: "text-rose-400/60",
  },
  violet: {
    glow: "shadow-[0_16px_40px_-12px_rgba(168,85,247,0.28),0_0_0_1px_rgba(168,85,247,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(168,85,247,0.12),transparent_55%)]",
    orb: "bg-violet-400/10 ring-1 ring-violet-300/20",
    iconColor: "text-violet-300",
    accent: "text-violet-200/85",
    livePill: "bg-violet-400/10 text-violet-200 border border-violet-300/20",
    iconTile: "border-[rgba(168,85,247,0.22)]",
    panelBorder: "border-[rgba(168,85,247,0.28)]",
    spark: "text-violet-400/60",
  },
  sky: {
    glow: "shadow-[0_16px_40px_-12px_rgba(56,189,248,0.28),0_0_0_1px_rgba(56,189,248,0.08)]",
    ambient: "bg-[radial-gradient(135%_120%_at_85%_-12%,rgba(56,189,248,0.12),transparent_55%)]",
    orb: "bg-sky-400/10 ring-1 ring-sky-300/20",
    iconColor: "text-sky-300",
    accent: "text-sky-200/85",
    livePill: "bg-sky-400/10 text-sky-200 border border-sky-300/20",
    iconTile: "border-[rgba(56,189,248,0.22)]",
    panelBorder: "border-[rgba(56,189,248,0.28)]",
    spark: "text-sky-400/60",
  },
};

export function kpiTheme(accent: KpiAccent): KpiTheme {
  return KPI_THEMES[accent];
}

export const WS_TINTS: Record<KpiAccent, { orb: string; icon: string }> = {
  cyan:    { orb: KPI_THEMES.cyan.orb,    icon: KPI_THEMES.cyan.iconColor },
  emerald: { orb: KPI_THEMES.emerald.orb, icon: KPI_THEMES.emerald.iconColor },
  amber:   { orb: KPI_THEMES.amber.orb,   icon: KPI_THEMES.amber.iconColor },
  rose:    { orb: KPI_THEMES.rose.orb,    icon: KPI_THEMES.rose.iconColor },
  violet:  { orb: KPI_THEMES.violet.orb,  icon: KPI_THEMES.violet.iconColor },
  sky:     { orb: KPI_THEMES.sky.orb,     icon: KPI_THEMES.sky.iconColor },
};

// Dashboard KPI board keys (same mapping as before)
export type BoardKey = "activeClients" | "completedTasks" | "incompleteTasks" | "overdueTasks";

export const BOARD_THEME: Record<BoardKey, KpiTheme> = {
  activeClients: KPI_THEMES.cyan,
  completedTasks: KPI_THEMES.emerald,
  incompleteTasks: KPI_THEMES.amber,
  overdueTasks: KPI_THEMES.rose,
};

export const SPARK_POINTS =
  "0,24 12,18 24,21 36,10 48,15 60,6 72,13 84,9 96,16 108,8 120,14";
