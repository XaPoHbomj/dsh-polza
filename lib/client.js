window.__ModuleLoader__.load({
	id: "dsh-polza",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/PolzaPanel.jsx
var import_react2 = require("react");
var import_react_dom = require("react-dom");

// src/client/api.js
var BASE = "/polza/api";
function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === void 0 || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}
async function request(path, params, options = {}) {
  const url = `${BASE}${path}${query(params)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = void 0;
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? `HTTP ${response.status}`);
    error.code = body?.error?.code ?? "polza/http";
    error.status = response.status;
    throw error;
  }
  if (body === void 0) throw new Error("\u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u0445\u043E\u0441\u0442\u0430");
  return body;
}
var api = {
  health: (options) => request("/health", void 0, options),
  refresh: (options) => request("/refresh", void 0, options),
  summary: (options) => request("/summary", void 0, options),
  models: (options) => request("/models", void 0, options),
  overview: (params, options) => request("/overview", params, options),
  generations: (params, options) => request("/generations", params, options),
  generation: (id, options) => request("/generation", { id }, options)
};

// src/client/format.js
var rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
var rubPrecise = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 8
});
var count = new Intl.NumberFormat("ru-RU");
var dateTime = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
var dayMonth = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "short"
});
function money(value) {
  return Number.isFinite(value) ? rub.format(value) : "\u2014";
}
function preciseMoney(value) {
  return Number.isFinite(value) ? rubPrecise.format(value) : "\u2014";
}
function amount(value) {
  return Number.isFinite(value) ? count.format(Math.round(value)) : "\u2014";
}
function timestamp(value) {
  if (value === null || value === void 0) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "\u2014" : dateTime.format(date);
}
function shortDate(value) {
  const date = /* @__PURE__ */ new Date(`${value}T12:00:00+03:00`);
  return Number.isNaN(date.getTime()) ? value : dayMonth.format(date);
}
function periodLabel(key) {
  switch (key) {
    case "today":
      return "\u0421\u0435\u0433\u043E\u0434\u043D\u044F";
    case "week":
      return "\u041D\u0435\u0434\u0435\u043B\u044F";
    case "7d":
      return "7 \u0434\u043D\u0435\u0439";
    case "30d":
      return "30 \u0434\u043D\u0435\u0439";
    case "month":
      return "\u042D\u0442\u043E\u0442 \u043C\u0435\u0441\u044F\u0446";
    case "all":
      return "\u0412\u0441\u0451 \u0432\u0440\u0435\u043C\u044F";
    case "custom":
      return "\u0421\u0432\u043E\u0439 \u043F\u0435\u0440\u0438\u043E\u0434";
    default:
      return key;
  }
}
function typeLabel(key) {
  switch (key) {
    case "chat":
      return "\u0427\u0430\u0442";
    case "image":
      return "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435";
    case "video":
      return "\u0412\u0438\u0434\u0435\u043E";
    case "audio":
      return "\u0410\u0443\u0434\u0438\u043E";
    default:
      return key || "\u0414\u0440\u0443\u0433\u043E\u0435";
  }
}
function statusLabel(key) {
  switch (key) {
    case "completed":
      return "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E";
    case "failed":
      return "\u041E\u0448\u0438\u0431\u043A\u0430";
    case "pending":
      return "\u0412 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435";
    default:
      return key || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
  }
}
function costLineLabel(kind) {
  switch (kind) {
    case "prompt":
      return "\u0412\u0445\u043E\u0434";
    case "cached_read":
      return "\u0412\u0445\u043E\u0434 \u0438\u0437 \u043A\u044D\u0448\u0430";
    case "cache_write":
      return "\u0417\u0430\u043F\u0438\u0441\u044C \u0432 \u043A\u044D\u0448";
    case "completion":
      return "\u0412\u044B\u0445\u043E\u0434";
    case "reasoning":
      return "Reasoning";
    case "audio_in":
      return "\u0410\u0443\u0434\u0438\u043E \u043D\u0430 \u0432\u0445\u043E\u0434\u0435";
    case "audio_out":
      return "\u0410\u0443\u0434\u0438\u043E \u043D\u0430 \u0432\u044B\u0445\u043E\u0434\u0435";
    case "image_in":
      return "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0430 \u0432\u0445\u043E\u0434\u0435";
    case "request_fee":
      return "\u041F\u043B\u0430\u0442\u0430 \u0437\u0430 \u0437\u0430\u043F\u0440\u043E\u0441";
    case "output":
      return "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442";
    case "native_web_search":
      return "\u0412\u0435\u0431-\u043F\u043E\u0438\u0441\u043A";
    case "refund":
      return "\u0412\u043E\u0437\u0432\u0440\u0430\u0442";
    case "model":
      return "\u041C\u043E\u0434\u0435\u043B\u044C";
    default:
      if (typeof kind === "string" && kind.startsWith("plugin:")) return `\u041F\u043B\u0430\u0433\u0438\u043D ${kind.slice(7)}`;
      if (typeof kind === "string" && kind.startsWith("tool:")) return `\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 ${kind.slice(5)}`;
      return kind || "\u0414\u0440\u0443\u0433\u043E\u0435";
  }
}
function unitLabel(unit) {
  if (unit === "token" || unit === "tokens") return "\u0442\u043E\u043A.";
  if (unit === "request" || unit === "requests") return "\u0437\u0430\u043F.";
  if (unit === "image" || unit === "images") return "\u0438\u0437\u043E\u0431\u0440.";
  if (unit === "second" || unit === "seconds") return "\u0441\u0435\u043A.";
  return unit ?? "";
}
function balanceTone(available, low, critical) {
  if (!Number.isFinite(available)) return "muted";
  if (available <= critical) return "critical";
  if (available <= low) return "warn";
  return "ok";
}

// src/client/hooks.js
var import_react = require("react");
function useAsync(load, deps) {
  const [state, setState] = (0, import_react.useState)({ data: null, error: null, loading: true });
  const generation = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => {
    const current = generation.current + 1;
    generation.current = current;
    let alive = true;
    const controller = new AbortController();
    setState((previous) => ({ data: previous.data, error: null, loading: true }));
    load(controller.signal).then(
      (data) => {
        if (!alive || generation.current !== current) return;
        setState({ data, error: null, loading: false });
      },
      (error) => {
        if (!alive || generation.current !== current || error?.name === "AbortError") return;
        setState({ data: null, error, loading: false });
      }
    );
    return () => {
      alive = false;
      controller.abort();
    };
  }, deps);
  return state;
}
function useCachedAsync(loadCache, loadFresh, deps, resetKey = null) {
  const [state, setState] = (0, import_react.useState)({ data: null, error: null, loading: true, stale: false });
  const generation = (0, import_react.useRef)(0);
  const resetRef = (0, import_react.useRef)(resetKey);
  const mountedRef = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    const current = generation.current + 1;
    generation.current = current;
    const shouldReset = resetRef.current !== resetKey;
    resetRef.current = resetKey;
    const isRefreshTick = mountedRef.current && !shouldReset;
    mountedRef.current = true;
    if (shouldReset) {
      setState({ data: null, error: null, loading: true, stale: false });
    } else {
      setState((previous) => ({ ...previous, error: null, loading: true }));
    }
    let alive = true;
    let freshStarted = false;
    const cacheController = new AbortController();
    const freshController = new AbortController();
    const startFresh = () => {
      if (freshStarted || !alive) return;
      freshStarted = true;
      loadFresh(freshController.signal).then(
        (data) => {
          if (!alive || generation.current !== current) return;
          setState({ data, error: null, loading: false, stale: false });
        },
        (error) => {
          if (!alive || generation.current !== current || error?.name === "AbortError") return;
          setState((previous) => previous.data !== null ? { ...previous, loading: false, stale: true } : { data: null, error, loading: false, stale: false });
        }
      );
    };
    loadCache(cacheController.signal).then(
      (data) => {
        if (!alive || generation.current !== current) return;
        const source = data?.cache?.source;
        if (source !== void 0 && source !== "none") {
          const stale = data.cache.stale !== false || isRefreshTick;
          setState({ data, error: null, loading: stale, stale });
          if (!stale) {
            freshStarted = true;
            return;
          }
        }
        startFresh();
      },
      () => startFresh()
    );
    return () => {
      alive = false;
      cacheController.abort();
      freshController.abort();
    };
  }, deps);
  return state;
}
function useRefreshTick(seconds) {
  const [tick, setTick] = (0, import_react.useState)(0);
  const bump = (0, import_react.useCallback)(() => setTick((value) => value + 1), []);
  (0, import_react.useEffect)(() => {
    const interval = setInterval(bump, Math.max(15, seconds) * 1e3);
    const onFocus = () => bump();
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bump, seconds]);
  return [tick, bump];
}

// src/client/PolzaPanel.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var detailCache = /* @__PURE__ */ new Map();
function rememberDetail(id, value) {
  detailCache.set(id, value);
  if (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value);
}
function PolzaMark({ size = 18, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      style: { color: active ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "currentColor", flex: "none" },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v1", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "8.5", width: "18", height: "10.5", rx: "2.6", stroke: "currentColor", strokeWidth: "1.6" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "16.6", cy: "13.8", r: "1.15", fill: "currentColor" })
      ]
    }
  );
}
function PolzaPanelIcon({ size = 16, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PolzaMark, { size, active });
}
function BalanceChip({ wide = true, openPanel }) {
  const [healthTick] = useRefreshTick(300);
  const health = useAsync((signal) => api.health({ signal }), [healthTick]);
  const [tick] = useRefreshTick(health.data?.config?.refreshSeconds ?? 60);
  const summary = useAsync((signal) => api.summary({ signal }), [tick]);
  const balance = summary.data?.balance ?? null;
  const current = balance?.amount;
  const reserved = balance?.reservedAmount;
  const daySpend = summary.data?.key?.usageDaily;
  const spentToday = daySpend === void 0 ? void 0 : Math.max(0, daySpend - (typeof reserved === "number" && Number.isFinite(reserved) ? reserved : 0));
  const thresholds = health.data?.config ?? { lowBalanceThreshold: 100, criticalBalanceThreshold: 20 };
  const tone = balanceTone(current, thresholds.lowBalanceThreshold, thresholds.criticalBalanceThreshold);
  const label = current === void 0 ? "Polza" : spentToday === void 0 ? `Polza: \u0431\u0430\u043B\u0430\u043D\u0441 ${money(current)}` : `Polza: \u0431\u0430\u043B\u0430\u043D\u0441 ${money(current)}, \u0440\u0430\u0441\u0445\u043E\u0434 \u0437\u0430 \u0434\u0435\u043D\u044C ${money(spentToday)}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      className: "polza-chip",
      "data-wide": wide ? "true" : "false",
      "data-tone": tone,
      title: label,
      "aria-label": label,
      onClick: openPanel,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PolzaMark, { size: wide ? 17 : 19 }),
        wide && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-chip-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-chip-amount", children: current === void 0 ? "Polza" : money(current) }),
          spentToday !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-chip-sub", children: [
            "\u0437\u0430 \u0434\u0435\u043D\u044C ",
            money(spentToday)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-chip-dot", "aria-hidden": "true" })
      ]
    }
  );
}
function Card({ label, value, note, tone }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-card-label", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-card-value", "data-tone": tone, children: value }),
    note !== void 0 && note !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-card-note", children: note })
  ] });
}
function PeriodTabs({ value, onChange }) {
  const periods = [["today", "\u0421\u0435\u0433\u043E\u0434\u043D\u044F"], ["week", "\u041D\u0435\u0434\u0435\u043B\u044F"], ["month", "\u041C\u0435\u0441\u044F\u0446"], ["all", "\u0412\u0441\u0451 \u0432\u0440\u0435\u043C\u044F"]];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-tabs", role: "tablist", "aria-label": "\u041F\u0435\u0440\u0438\u043E\u0434", children: periods.map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "tab",
      className: "polza-tab",
      "data-active": value === key ? "true" : "false",
      "aria-selected": value === key,
      onClick: () => onChange(key),
      children: label
    },
    key
  )) });
}
function SpendChart({ days, loading }) {
  if (loading && (days === void 0 || days.length === 0)) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-skeleton", style: { height: 168 } });
  }
  const rows = Array.isArray(days) ? days : [];
  const max = rows.reduce((peak, row) => Math.max(peak, row.cost ?? 0), 0);
  if (rows.length === 0 || max <= 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-empty", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PolzaMark, { size: 26 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0417\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u043D\u0435\u0442" })
    ] });
  }
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-chart", children: rows.map((row) => {
      const height = Math.max(2, Math.round(Math.max(0, row.cost) / max * 140));
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-bar-wrap", title: `${shortDate(row.date)}: ${money(row.cost)} \xB7 ${amount(row.requests)} \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: row.cost > 0 ? "polza-bar" : "polza-bar polza-bar-empty", style: { height } }) }, row.date);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-chart-axis", "aria-hidden": "true", children: rows.map((row, index) => index % labelEvery === 0 || index === rows.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: shortDate(row.date) }, row.date) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}, row.date)) })
  ] });
}
function ModelBreakdown({ models, totalCost, loading }) {
  if (loading && (models === void 0 || models.length === 0)) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-skeleton", style: { height: 150 } });
  }
  const rows = Array.isArray(models) ? models.filter((row) => row.key !== "other" || row.cost > 0) : [];
  if (rows.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-empty", style: { height: 120 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043E \u043C\u043E\u0434\u0435\u043B\u044F\u043C" }) });
  }
  const peak = rows.reduce((max, row) => Math.max(max, row.cost), 0) || 1;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-models", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-model", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-model-label", title: row.label, children: row.label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-model-cost", children: money(row.cost) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-model-track", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-model-fill", style: { width: `${Math.max(3, row.cost / peak * 100)}%` } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-model-share", children: totalCost > 0 ? `${Math.round(row.cost / totalCost * 100)}%` : "\u2014" })
  ] }, row.key)) });
}
function TypeBreakdown({ types }) {
  const rows = Array.isArray(types) ? types.filter((row) => row.requests > 0) : [];
  if (rows.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-note", children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-types", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-type", children: [
    typeLabel(row.key),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: money(row.cost) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: amount(row.requests) })
  ] }, row.key)) });
}
function FilterSelect({ label, value, onChange, options, anyLabel = "\u0412\u0441\u0435" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: "polza-select", "aria-label": label, value, onChange: (event) => onChange(event.target.value), children: [
    anyLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: anyLabel }) : null,
    options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.value, children: option.label }, option.value))
  ] });
}
function GenerationHoverCard({ item, rect }) {
  const [detail, setDetail] = (0, import_react2.useState)(() => detailCache.get(item.id) ?? null);
  const [failed, setFailed] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (detailCache.has(item.id)) {
      setDetail(detailCache.get(item.id));
      setFailed(false);
      return void 0;
    }
    let alive = true;
    api.generation(item.id).then(
      (value) => {
        rememberDetail(item.id, value);
        if (alive) setDetail(value);
      },
      () => {
        if (alive) setFailed(true);
      }
    );
    return () => {
      alive = false;
    };
  }, [item.id]);
  const usage = detail?.usage ?? item.usage;
  const cost = detail?.cost ?? item.cost;
  const total = usage.totalTokens || usage.promptTokens + usage.completionTokens;
  const lines = Array.isArray(detail?.costLines) ? detail.costLines.filter((line) => line.cost !== 0 || line.quantity !== 0) : [];
  const width = 336;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = rect.bottom + 8;
  const top = below + 330 > window.innerHeight ? Math.max(8, rect.top - 338) : below;
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hovercard", style: { top, left, width }, role: "tooltip", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-hovercard-title", children: "\u0418\u0437 \u0447\u0435\u0433\u043E \u0441\u043B\u043E\u0436\u0438\u043B\u0430\u0441\u044C \u0446\u0435\u043D\u0430" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-strong", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0422\u043E\u043A\u0435\u043D\u044B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(total) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-sub", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0412\u0445\u043E\u0434" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(usage.promptTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-sub2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0438\u0437 \u043D\u0438\u0445 \u0438\u0437 \u043A\u044D\u0448\u0430" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(usage.cachedTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-sub2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u043A\u044D\u0448" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(usage.cacheWriteTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-sub", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0412\u044B\u0445\u043E\u0434" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(usage.completionTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-sub2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0438\u0437 \u043D\u0438\u0445 reasoning" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: amount(usage.reasoningTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-hover-divider" }),
      lines.length > 0 ? lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-line", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          costLineLabel(line.kind),
          line.quantity > 0 ? ` \xB7 ${amount(line.quantity)} ${unitLabel(line.unit)}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: preciseMoney(line.cost) })
      ] }, `${line.kind}-${index}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-hover-muted", children: failed ? "\u0414\u0435\u0442\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u0446\u0435\u043D\u044B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430" : detail === null ? "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0435\u0442\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044E\u2026" : "\u041F\u043E\u0441\u0442\u0440\u043E\u0447\u043D\u0430\u044F \u0434\u0435\u0442\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043D\u0435 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0430" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-hover-divider" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-row polza-hover-total", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u0418\u0442\u043E\u0433\u043E" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: preciseMoney(cost) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-hover-muted", children: item.id }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-hover-muted", children: [
        item.modelDisplayName ?? item.model,
        " \xB7 ",
        timestamp(item.createdAt)
      ] })
    ] }),
    document.body
  );
}
function GenerationsTable({ data, loading, error, page, limit, sortBy, sortOrder, onPage, onLimit, onSort, onRetry }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const [hover, setHover] = (0, import_react2.useState)(null);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-title", children: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0439" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-head-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        FilterSelect,
        {
          label: "\u0421\u0442\u0440\u043E\u043A \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435",
          value: String(limit),
          onChange: (value) => onLimit(Number(value)),
          options: [20, 25, 50, 100].map((value) => ({ value: String(value), label: `${value} \u0441\u0442\u0440\u043E\u043A` })),
          anyLabel: ""
        }
      ) })
    ] }),
    error !== null && error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-banner", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: error.message ?? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", onClick: onRetry, children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-table-wrap", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "polza-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", { "data-sortable": "true", onClick: () => onSort("createdAt"), children: [
          "\u0412\u0440\u0435\u043C\u044F ",
          sortBy === "createdAt" ? sortOrder === "desc" ? "\u2193" : "\u2191" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u041C\u043E\u0434\u0435\u043B\u044C" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "polza-hide-sm", children: "\u0422\u0438\u043F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "polza-cell-tokens", children: "\u0422\u043E\u043A\u0435\u043D\u044B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", { className: "polza-cell-money", "data-sortable": "true", onClick: () => onSort("clientCost"), children: [
          "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C ",
          sortBy === "clientCost" ? sortOrder === "desc" ? "\u2193" : "\u2191" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u0421\u0442\u0430\u0442\u0443\u0441" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "polza-hide-sm", children: "ID" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: loading && items.length === 0 ? Array.from({ length: 6 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { colSpan: 7, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-skeleton", style: { height: 18 } }) }) }, `skeleton-${index}`)) : items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { colSpan: 7, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-empty", style: { height: 120 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PolzaMark, { size: 24 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u041D\u0435\u0442 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0439 \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434" })
      ] }) }) }) : items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "tr",
        {
          onMouseEnter: (event) => setHover({ item, rect: event.currentTarget.getBoundingClientRect() }),
          onMouseLeave: () => setHover(null),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-cell-time", children: timestamp(item.createdAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-cell-model", title: item.model, children: item.modelDisplayName ?? item.model }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-hide-sm", children: typeLabel(item.requestType) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-cell-tokens", children: amount(item.usage.totalTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-cell-money polza-cell-detail", title: "\u041D\u0430\u0432\u0435\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0440\u0430\u0437\u0431\u0438\u0432\u043A\u0443 \u043F\u043E \u0442\u043E\u043A\u0435\u043D\u0430\u043C", children: preciseMoney(item.cost) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-status", "data-status": item.status, children: statusLabel(item.status) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "polza-cell-id polza-hide-sm", title: item.id, children: item.id })
          ]
        },
        item.id
      )) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-table-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        meta.total > 0 ? `${amount((meta.page - 1) * meta.limit + 1)}\u2013${amount(Math.min(meta.page * meta.limit, meta.total))} \u0438\u0437 ${amount(meta.total)}` : "\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439",
        data?.partial ? " \xB7 \u0447\u0430\u0441\u0442\u0438\u0447\u043D\u043E" : "",
        data?.cache?.source === "disk" ? " \xB7 \u0438\u0437 \u043A\u044D\u0448\u0430" : "",
        loading ? " \xB7 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C\u2026" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-pager", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", disabled: meta.page <= 1 || loading, onClick: () => onPage(meta.page - 1), children: "\u041D\u0430\u0437\u0430\u0434" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-page-number", children: [
          meta.page,
          " / ",
          Math.max(1, meta.totalPages)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", disabled: meta.page >= meta.totalPages || loading, onClick: () => onPage(meta.page + 1), children: "\u0412\u043F\u0435\u0440\u0451\u0434" })
      ] })
    ] }),
    hover !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenerationHoverCard, { item: hover.item, rect: hover.rect }) : null
  ] });
}
function SetupCard({ health, onRetry }) {
  const ref = health?.ref ?? "POLZA_API_KEY";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-setup", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043A\u043B\u044E\u0447 Polza" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      "\u041F\u043B\u0430\u0433\u0438\u043D \u0447\u0438\u0442\u0430\u0435\u0442 \u043A\u043B\u044E\u0447 \u0438\u0437 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E\u0433\u043E \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430 DSH \u0438 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0451\u0442 \u0435\u0433\u043E \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: ref }),
      " \u0432 ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "~/.dsh/.credentials.yaml" }),
      ":"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: `version: 1
refs:
  ${ref}: pza_...` }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      "\u041F\u043E\u0434\u043E\u0439\u0434\u0451\u0442 \u0438 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: ref }),
      " \u2014 \u043E\u043D\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u043A\u0430\u043A \u0437\u0430\u043F\u0430\u0441\u043D\u043E\u0439 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u043D\u043E\u0432\u0430\xBB."
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", "data-primary": "true", onClick: onRetry, children: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u043D\u043E\u0432\u0430" })
  ] });
}
function PolzaPanel() {
  const [period, setPeriod] = (0, import_react2.useState)("month");
  const [requestType, setRequestType] = (0, import_react2.useState)("");
  const [status, setStatus] = (0, import_react2.useState)("");
  const [model, setModel] = (0, import_react2.useState)("");
  const [page, setPage] = (0, import_react2.useState)(1);
  const [limit, setLimit] = (0, import_react2.useState)(25);
  const [sortBy, setSortBy] = (0, import_react2.useState)("createdAt");
  const [sortOrder, setSortOrder] = (0, import_react2.useState)("desc");
  const [healthTick] = useRefreshTick(300);
  const health = useAsync((signal) => api.health({ signal }), [healthTick]);
  const [tick, refresh] = useRefreshTick(health.data?.config?.refreshSeconds ?? 60);
  const modelOptions = useAsync((signal) => api.models({ signal }), [tick]);
  const scopeKey = `${period}|${requestType}|${status}|${model}`;
  const tableKey = `${scopeKey}|${page}|${limit}|${sortBy}|${sortOrder}`;
  const overview = useCachedAsync(
    (signal) => api.overview({ period, requestType, status, model, cache: "1" }, { signal }),
    (signal) => api.overview({ period, requestType, status, model, fresh: "1" }, { signal }),
    [period, requestType, status, model, tick],
    scopeKey
  );
  const table = useCachedAsync(
    (signal) => api.generations({ period, requestType, status, model, page, limit, sortBy, sortOrder, cache: "1" }, { signal }),
    (signal) => api.generations({ period, requestType, status, model, page, limit, sortBy, sortOrder }, { signal }),
    [period, requestType, status, model, page, limit, sortBy, sortOrder, tick],
    tableKey
  );
  (0, import_react2.useEffect)(() => {
    setPage(1);
  }, [period, requestType, status, model, limit, sortBy, sortOrder]);
  async function refreshNow() {
    try {
      await api.refresh();
    } catch {
    }
    refresh();
  }
  if (health.data !== null && health.data.configured === false) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-page", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupCard, { health: health.data, onRetry: refresh }) });
  }
  const data = overview.data;
  const balance = data?.balance ?? null;
  const key = data?.key ?? null;
  const totals = data?.totals ?? null;
  const exact = data?.exactCost ?? null;
  const periodCost = data?.periodCost ?? (totals?.cost ?? 0);
  const thresholds = health.data?.config ?? { lowBalanceThreshold: 100, criticalBalanceThreshold: 20 };
  const tone = balanceTone(balance?.available, thresholds.lowBalanceThreshold, thresholds.criticalBalanceThreshold);
  const promptTokens = totals?.promptTokens ?? 0;
  const cachedTokens = totals?.cachedTokens ?? 0;
  const cacheShare = promptTokens > 0 ? Math.round(cachedTokens / promptTokens * 100) : 0;
  const filtered = Boolean(data?.filters && (data.filters.requestType || data.filters.status || data.filters.model));
  const exactNote = exact === null ? data?.history?.partial ? `\u043F\u043E ${amount(data.history.scanned)} \u0438\u0437 ${amount(data.history.total)} \u0437\u0430\u043F\u0438\u0441\u0435\u0439` : filtered ? "\u043F\u043E \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438" : "\u043F\u043E \u0438\u0441\u0442\u043E\u0440\u0438\u0438, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438" : exact.source === "usage_daily" ? "\u0442\u043E\u0447\u043D\u043E \u0437\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438" : exact.source === "usage_weekly" ? "\u0442\u043E\u0447\u043D\u043E \u0437\u0430 \u043D\u0435\u0434\u0435\u043B\u044E \u0441 \u043F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A\u0430, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438" : exact.source === "usage_monthly" ? "\u0442\u043E\u0447\u043D\u043E \u0437\u0430 \u043C\u0435\u0441\u044F\u0446, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438" : "\u0442\u043E\u0447\u043D\u043E \u0437\u0430 \u0432\u0441\u0451 \u0432\u0440\u0435\u043C\u044F, \u0431\u0435\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u0438";
  const modelSource = modelOptions.data?.items?.length ? modelOptions.data.items : overview.data?.models ?? [];
  const modelsForFilter = modelSource.filter((item) => item.key !== "other").map((item) => ({ value: item.key, label: item.label }));
  if (model !== "" && !modelsForFilter.some((item) => item.value === model)) {
    modelsForFilter.unshift({ value: model, label: model });
  }
  const busy = overview.loading || table.loading;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-page", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "polza-progress", "data-active": busy ? "true" : "false", "aria-hidden": busy ? "false" : "true" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "polza-title", children: "Polza" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "polza-sub", children: [
          "\u0411\u0430\u043B\u0430\u043D\u0441 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0438 \u0440\u0430\u0441\u0445\u043E\u0434 API-\u043A\u043B\u044E\u0447\u0430",
          data?.fetchedAt ? ` \xB7 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ${timestamp(data.fetchedAt)}` : "",
          key?.label ? ` \xB7 ${key.label}` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-head-actions", children: [
        overview.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-sync", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-spinner", "aria-hidden": "true" }),
          overview.stale ? "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u043C \u043A\u044D\u0448, \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C\u2026" : "\u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435\u2026"
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", onClick: refreshNow, disabled: overview.loading, children: overview.loading ? "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u2026" : "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" })
      ] })
    ] }),
    overview.error !== null && overview.error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-banner", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: overview.error.message ?? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 Polza" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "polza-button", onClick: refreshNow, children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" })
    ] }) : null,
    data?.history?.partial ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-banner", "data-kind": "info", children: [
      "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 ",
      amount(data.history.scanned),
      " \u0438\u0437 ",
      amount(data.history.total),
      " \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0439. \u0418\u0442\u043E\u0433 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u0431\u0435\u0440\u0451\u0442\u0441\u044F \u0438\u0437 \u0441\u0432\u043E\u0434\u043A\u0438 \u043A\u043B\u044E\u0447\u0430, \u0440\u0430\u0437\u0431\u0438\u0432\u043A\u0438 \u2014 \u043F\u043E \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438."
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-cards", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Card,
        {
          label: "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043A \u0442\u0440\u0430\u0442\u0435",
          value: money(balance?.available),
          tone,
          note: balance?.reservedAmount ? `\u0432 \u0440\u0435\u0437\u0435\u0440\u0432\u0435 ${money(balance.reservedAmount)}` : "\u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u0440\u0435\u0437\u0435\u0440\u0432\u0430 \u0438 \u043B\u0438\u043C\u0438\u0442\u043E\u0432"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Card,
        {
          label: "\u0411\u0430\u043B\u0430\u043D\u0441 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430",
          value: money(balance?.amount),
          note: balance?.spentAmount !== null && balance?.spentAmount !== void 0 ? `\u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E ${money(balance.spentAmount)}` : "\u0431\u0430\u043B\u0430\u043D\u0441 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Card,
        {
          label: `\u0420\u0430\u0441\u0445\u043E\u0434 \xB7 ${periodLabel(period)}`,
          value: money(periodCost),
          note: exactNote
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Card,
        {
          label: "\u0417\u0430\u043F\u0440\u043E\u0441\u043E\u0432",
          value: amount(totals?.requests),
          note: data?.history?.partial ? `\u0432 \u0432\u044B\u0431\u043E\u0440\u043A\u0435 \u0438\u0437 ${amount(data.history.total)}` : totals ? `\u0441\u0440\u0435\u0434\u043D\u0438\u0439 ${money(totals.averageCost)}` : "\u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-split", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-title", children: "\u0420\u0430\u0441\u0445\u043E\u0434 \u043F\u043E \u0434\u043D\u044F\u043C" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-note", children: periodLabel(period) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpendChart, { days: data?.days, loading: overview.loading })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-title", children: "\u041C\u043E\u0434\u0435\u043B\u0438" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-note", children: data?.history?.partial ? "\u0434\u043E\u043B\u044F \u043E\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438" : `${amount(totals?.requests)} \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432` })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelBreakdown, { models: data?.models, totalCost: totals?.cost ?? 0, loading: overview.loading })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "polza-panel-title", children: "\u0414\u0435\u0442\u0430\u043B\u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0430" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "polza-panel-note", children: [
          "\u043A\u044D\u0448 ",
          cacheShare,
          "% \xB7 \u0442\u043E\u043A\u0435\u043D\u043E\u0432 ",
          amount(totals?.totalTokens)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeBreakdown, { types: data?.types }),
      key?.limit !== null && key?.limit !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-panel-note", style: { marginTop: 10 }, children: [
        "\u041B\u0438\u043C\u0438\u0442 \u043A\u043B\u044E\u0447\u0430: \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ",
        money(key.limitRemaining),
        " \u0438\u0437 ",
        money(key.limit),
        key.limitReset ? ` \xB7 \u0441\u0431\u0440\u043E\u0441 ${key.limitReset}` : ""
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "polza-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PeriodTabs, { value: period, onChange: (value) => {
        setPeriod(value);
        setPage(1);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        FilterSelect,
        {
          label: "\u0422\u0438\u043F \u0437\u0430\u043F\u0440\u043E\u0441\u0430",
          value: requestType,
          onChange: (value) => {
            setRequestType(value);
            setPage(1);
          },
          options: [["chat", "\u0427\u0430\u0442"], ["image", "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F"], ["video", "\u0412\u0438\u0434\u0435\u043E"], ["audio", "\u0410\u0443\u0434\u0438\u043E"]].map(([value, label]) => ({ value, label })),
          anyLabel: "\u0412\u0441\u0435 \u0442\u0438\u043F\u044B"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        FilterSelect,
        {
          label: "\u0421\u0442\u0430\u0442\u0443\u0441",
          value: status,
          onChange: (value) => {
            setStatus(value);
            setPage(1);
          },
          options: [["completed", "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E"], ["failed", "\u041E\u0448\u0438\u0431\u043A\u0430"], ["pending", "\u0412 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435"]].map(([value, label]) => ({ value, label })),
          anyLabel: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        FilterSelect,
        {
          label: "\u041C\u043E\u0434\u0435\u043B\u044C",
          value: model,
          onChange: (value) => {
            setModel(value);
            setPage(1);
          },
          options: modelsForFilter,
          anyLabel: "\u0412\u0441\u0435 \u043C\u043E\u0434\u0435\u043B\u0438"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GenerationsTable,
      {
        data: table.data,
        loading: table.loading,
        error: table.error,
        page,
        limit,
        sortBy,
        sortOrder,
        onPage: setPage,
        onLimit: (value) => {
          setLimit(value);
          setPage(1);
        },
        onSort: (field) => {
          if (sortBy === field) setSortOrder((order) => order === "desc" ? "asc" : "desc");
          else {
            setSortBy(field);
            setSortOrder("desc");
          }
          setPage(1);
        },
        onRetry: refresh
      }
    )
  ] }) });
}

// src/client/PolzaSettings.jsx
var import_react3 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var FIELDS = [
  {
    key: "refreshSeconds",
    label: "\u0410\u0432\u0442\u043E\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435, \u0441\u0435\u043A\u0443\u043D\u0434",
    hint: "\u041A\u0430\u043A \u0447\u0430\u0441\u0442\u043E \u0447\u0438\u043F \u0438 \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442 \u0431\u0430\u043B\u0430\u043D\u0441. \u041C\u0438\u043D\u0438\u043C\u0443\u043C 15.",
    min: 15,
    max: 3600,
    step: 1
  },
  {
    key: "lowBalanceThreshold",
    label: "\u0416\u0451\u043B\u0442\u044B\u0439 \u043F\u043E\u0440\u043E\u0433, \u20BD",
    hint: "\u041D\u0438\u0436\u0435 \u044D\u0442\u043E\u0439 \u0441\u0443\u043C\u043C\u044B \u0447\u0438\u043F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0436\u0451\u043B\u0442\u044B\u043C.",
    min: 0,
    max: 1e6,
    step: 1
  },
  {
    key: "criticalBalanceThreshold",
    label: "\u041A\u0440\u0430\u0441\u043D\u044B\u0439 \u043F\u043E\u0440\u043E\u0433, \u20BD",
    hint: "\u041D\u0438\u0436\u0435 \u044D\u0442\u043E\u0439 \u0441\u0443\u043C\u043C\u044B \u0447\u0438\u043F \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043A\u0440\u0430\u0441\u043D\u044B\u043C.",
    min: 0,
    max: 1e6,
    step: 1
  },
  {
    key: "historyMaxPages",
    label: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446 \u0438\u0441\u0442\u043E\u0440\u0438\u0438",
    hint: "\u0413\u043B\u0443\u0431\u0438\u043D\u0430 \u0433\u0440\u0430\u0444\u0438\u043A\u043E\u0432: \u043E\u0434\u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u2014 100 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0439. \u0411\u043E\u043B\u044C\u0448\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446 = \u043F\u043E\u043B\u043D\u0435\u0435 \u0433\u0440\u0430\u0444\u0438\u043A \u0438 \u0434\u043E\u043B\u044C\u0448\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442.",
    min: 1,
    max: 200,
    step: 1
  }
];
var EMPTY_FORM = {
  subscribe: () => () => {
  },
  getSnapshot: () => ({ status: "unavailable", value: void 0, base: void 0, user: void 0, revision: void 0, writable: false })
};
var DEFAULTS = {
  refreshSeconds: 60,
  lowBalanceThreshold: 100,
  criticalBalanceThreshold: 20,
  historyMaxPages: 100
};
function draftOf(value) {
  return {
    refreshSeconds: Number(value?.refreshSeconds ?? DEFAULTS.refreshSeconds),
    lowBalanceThreshold: Number(value?.lowBalanceThreshold ?? DEFAULTS.lowBalanceThreshold),
    criticalBalanceThreshold: Number(value?.criticalBalanceThreshold ?? DEFAULTS.criticalBalanceThreshold),
    historyMaxPages: Number(value?.historyMaxPages ?? DEFAULTS.historyMaxPages)
  };
}
function validate(draft) {
  const errors = {};
  for (const field of FIELDS) {
    const value = Number(draft[field.key]);
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      errors[field.key] = `\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E \u043E\u0442 ${field.min} \u0434\u043E ${field.max}`;
    }
  }
  return errors;
}
function PolzaSettings(props) {
  const form = props.form ?? props.injectedForm ?? EMPTY_FORM;
  const subscribe = (0, import_react3.useCallback)((listener) => form.subscribe(listener), [form]);
  const getSnapshot = (0, import_react3.useCallback)(() => form.getSnapshot(), [form]);
  const state = (0, import_react3.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
  const accepted = draftOf(state.value);
  const [draft, setDraft] = (0, import_react3.useState)(accepted);
  const [saveState, setSaveState] = (0, import_react3.useState)("idle");
  (0, import_react3.useEffect)(() => {
    setDraft(draftOf(state.value));
    setSaveState("idle");
  }, [state.revision]);
  if (state.status === "loading") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "polza-settings", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "polza-skeleton", style: { height: 22, width: 180 } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "polza-skeleton", style: { height: 64, marginTop: 14 } })
    ] });
  }
  if (state.status === "unavailable") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "polza-settings polza-settings-muted", children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Polza \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0432 \u044D\u0442\u043E\u0439 \u0441\u0431\u043E\u0440\u043A\u0435." });
  }
  const errors = validate(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = FIELDS.some((field) => Number(draft[field.key]) !== Number(accepted[field.key]));
  const disabled = state.writable !== true || saveState === "saving";
  async function save() {
    if (invalid || !dirty || disabled) return;
    setSaveState("saving");
    try {
      const acceptedWrite = await form.mutate(
        FIELDS.map((field) => ({ op: "set", path: [field.key], value: Number(draft[field.key]) })),
        state.revision
      );
      setSaveState(acceptedWrite ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "polza-settings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "polza-settings-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "polza-settings-title", children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Polza" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "polza-settings-sub", children: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "polza-settings-status", "data-kind": saveState, children: [
        saveState === "saving" ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435\u2026" : null,
        saveState === "saved" ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E" : null,
        saveState === "error" ? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "polza-settings-grid", children: FIELDS.map((field) => {
      const id = `polza-setting-${field.key}`;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "polza-setting", htmlFor: id, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "polza-setting-label", children: field.label }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            id,
            className: "polza-input",
            type: "number",
            inputMode: "numeric",
            min: field.min,
            max: field.max,
            step: field.step,
            value: draft[field.key],
            disabled,
            "aria-invalid": errors[field.key] !== void 0 || void 0,
            onChange: (event) => setDraft((previous) => ({ ...previous, [field.key]: event.target.value }))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "polza-setting-hint", "data-error": errors[field.key] !== void 0 || void 0, children: errors[field.key] ?? field.hint })
      ] }, field.key);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "polza-settings-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "polza-button", "data-primary": "true", disabled: disabled || !dirty || invalid, onClick: save, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "polza-button", disabled: disabled || !dirty, onClick: () => {
        setDraft(accepted);
        setSaveState("idle");
      }, children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" }),
      state.writable !== true ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "polza-setting-hint", children: "\u0425\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F." }) : null
    ] })
  ] });
}

// src/client/styles.js
var CSS = `
.polza-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #555);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.polza-chip:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05)); }
.polza-chip:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, #4d6bfe); outline-offset: 1px; }
.polza-chip[data-wide="false"] { justify-content: center; padding: 0; width: 36px; }
.polza-chip-amount { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--dsw-alias-label-primary, #111); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.polza-chip-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; flex: 1 1 auto; }
.polza-chip-sub { font-size: 10px; line-height: 1.2; color: var(--dsw-alias-label-tertiary, #777); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.polza-chip[data-tone="warn"] .polza-chip-amount { color: var(--dsw-alias-state-warn-primary, #b26a00); }
.polza-chip[data-tone="critical"] .polza-chip-amount { color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-success-primary, #2e7d32); flex: none; }
.polza-chip[data-tone="warn"] .polza-chip-dot { background: var(--dsw-alias-state-warn-primary, #b26a00); }
.polza-chip[data-tone="critical"] .polza-chip-dot { background: var(--dsw-alias-state-error-primary, #c62828); }
.polza-chip[data-tone="muted"] .polza-chip-dot { background: var(--dsw-alias-label-tertiary, #999); }

.polza-page {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  overflow: auto;
  padding: calc(28px + var(--dsh-frame-top-clearance, 0px)) 32px 48px;
  color: var(--dsw-alias-label-primary, #111);
  font-family: var(--dsw-font-family, system-ui, sans-serif);
}
.polza-inner { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.polza-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.polza-title { margin: 0; font-size: 26px; line-height: 1.2; font-weight: 650; letter-spacing: -0.02em; }
.polza-sub { margin: 6px 0 0; color: var(--dsw-alias-label-tertiary, #777); font-size: 13px; }
.polza-head-actions { display: flex; align-items: center; gap: 10px; }
.polza-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #111);
  font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.polza-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05)); }
.polza-button:disabled { opacity: .55; cursor: default; }
.polza-button[data-primary="true"] {
  background: #4d6bfe;
  border-color: transparent;
  color: #fff;
}
.polza-button[data-primary="true"]:hover:not(:disabled) { background: #3f5df5; }

.polza-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.polza-card {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1, #fff);
}
.polza-card-label { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; }
.polza-card-value { margin-top: 8px; font-size: 24px; line-height: 1.15; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.polza-card-value[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #b26a00); }
.polza-card-value[data-tone="critical"] { color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-card-note { margin-top: 6px; color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.polza-panel {
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1, #fff);
  padding: 16px;
  min-width: 0;
}
.polza-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.polza-panel-title { font-size: 13px; font-weight: 600; }
.polza-panel-note { color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; }
.polza-split { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }

.polza-tabs { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04)); }
.polza-tab { height: 26px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary, #555); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.polza-tab:hover { color: var(--dsw-alias-label-primary, #111); }
.polza-tab[data-active="true"] { background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #111); box-shadow: 0 1px 2px rgba(0,0,0,.08); font-weight: 600; }

.polza-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.polza-select {
  height: 30px; padding: 0 26px 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #111);
  font: inherit; font-size: 12px; cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 13px) 13px, calc(100% - 9px) 13px;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}
.polza-spacer { flex: 1 1 auto; }

.polza-chart { display: flex; align-items: flex-end; gap: 3px; height: 168px; padding-top: 12px; }
.polza-bar-wrap { flex: 1 1 0; min-width: 2px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; gap: 4px; }
.polza-bar { width: 100%; min-height: 2px; border-radius: 3px 3px 0 0; background: var(--dsw-alias-brand-primary, #4d6bfe); opacity: .82; transition: opacity .12s ease; }
.polza-bar-wrap:hover .polza-bar { opacity: 1; }
.polza-bar-empty { background: var(--dsw-alias-border-l2, rgba(0,0,0,.1)); opacity: 1; }
.polza-chart-axis { display: flex; justify-content: space-between; margin-top: 8px; color: var(--dsw-alias-label-tertiary, #777); font-size: 10px; }
.polza-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; height: 160px; color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; text-align: center; }

.polza-models { display: flex; flex-direction: column; gap: 10px; }
.polza-model { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; }
.polza-model-label { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.polza-model-cost { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #555); }
.polza-model-track { grid-column: 1 / -1; height: 5px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.06)); overflow: hidden; }
.polza-model-fill { height: 100%; border-radius: 4px; background: var(--dsw-alias-brand-primary, #4d6bfe); opacity: .8; }
.polza-model-share { color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; font-variant-numeric: tabular-nums; }

.polza-types { display: flex; flex-wrap: wrap; gap: 6px; }
.polza-type { display: inline-flex; align-items: baseline; gap: 6px; padding: 4px 9px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04)); font-size: 11px; color: var(--dsw-alias-label-secondary, #555); }
.polza-type b { color: var(--dsw-alias-label-primary, #111); font-weight: 600; font-variant-numeric: tabular-nums; }

.polza-table-wrap { overflow-x: auto; }
.polza-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.polza-table th { position: sticky; top: 0; z-index: 1; padding: 8px 10px; text-align: left; font-weight: 500; color: var(--dsw-alias-label-tertiary, #777); background: var(--dsw-alias-bg-layer-1, #fff); border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); white-space: nowrap; }
.polza-table th[data-sortable="true"] { cursor: pointer; user-select: none; }
.polza-table th[data-sortable="true"]:hover { color: var(--dsw-alias-label-primary, #111); }
.polza-table td { padding: 9px 10px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06)); vertical-align: middle; }
.polza-table tr:last-child td { border-bottom: 0; }
.polza-table tbody tr:hover td { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.03)); }
.polza-cell-time { white-space: nowrap; color: var(--dsw-alias-label-secondary, #555); font-variant-numeric: tabular-nums; }
.polza-cell-id { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-markdown-code-font-family, ui-monospace, monospace); font-size: 11px; color: var(--dsw-alias-label-tertiary, #777); }
.polza-cell-model { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.polza-cell-money { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.polza-cell-tokens { text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #555); white-space: nowrap; }
.polza-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px; font-size: 10px; white-space: nowrap; background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05)); color: var(--dsw-alias-label-secondary, #555); }
.polza-status[data-status="completed"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e7d32) 12%, transparent); color: var(--dsw-alias-state-success-primary, #2e7d32); }
.polza-status[data-status="failed"] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c62828) 12%, transparent); color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-status[data-status="pending"] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b26a00) 14%, transparent); color: var(--dsw-alias-state-warn-primary, #b26a00); }

.polza-cell-detail { cursor: help; text-decoration: underline dotted rgba(127,127,127,.45); text-underline-offset: 3px; }

.polza-hovercard {
  position: fixed;
  z-index: 10000;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--dsw-alias-tooltip-bg, #1e222b);
  color: var(--dsw-alias-toast-label, #f2f3f5);
  box-shadow: 0 12px 32px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.18);
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
}
.polza-hovercard-title { margin-bottom: 8px; font-weight: 600; font-size: 13px; }
.polza-hover-row { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 1px 0; font-variant-numeric: tabular-nums; }
.polza-hover-row b { font-weight: 500; white-space: nowrap; }
.polza-hover-strong { font-weight: 600; }
.polza-hover-sub { padding-left: 12px; color: color-mix(in srgb, currentColor 78%, transparent); }
.polza-hover-sub2 { padding-left: 24px; color: color-mix(in srgb, currentColor 62%, transparent); font-size: 11px; }
.polza-hover-line { font-size: 11.5px; }
.polza-hover-divider { height: 1px; margin: 9px 0; background: rgba(255,255,255,.14); }
.polza-hover-total { font-weight: 650; font-size: 12.5px; }
.polza-hover-muted { color: color-mix(in srgb, currentColor 58%, transparent); font-size: 11px; margin-top: 4px; }

.polza-table-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; color: var(--dsw-alias-label-tertiary, #777); font-size: 11px; }
.polza-pager { display: flex; align-items: center; gap: 6px; }
.polza-pager button { height: 26px; padding: 0 9px; }
.polza-page-number { font-variant-numeric: tabular-nums; }

.polza-settings {
  margin: 4px 0 18px;
  padding: 16px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1, #fff);
}
.polza-settings-muted { color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; }
.polza-settings-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.polza-settings-title { margin: 0; font-size: 14px; font-weight: 600; }
.polza-settings-sub { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary, #777); font-size: 12px; }
.polza-settings-status { font-size: 11px; color: var(--dsw-alias-label-tertiary, #777); white-space: nowrap; }
.polza-settings-status[data-kind="saved"] { color: var(--dsw-alias-state-success-primary, #2e7d32); }
.polza-settings-status[data-kind="error"] { color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.polza-setting { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.polza-setting-label { font-size: 12px; font-weight: 500; }
.polza-setting-hint { font-size: 11px; line-height: 1.4; color: var(--dsw-alias-label-tertiary, #777); }
.polza-setting-hint[data-error="true"] { color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-input {
  box-sizing: border-box; width: 100%; height: 32px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #111);
  font: inherit; font-size: 13px; font-variant-numeric: tabular-nums;
}
.polza-input:focus { outline: 2px solid var(--dsw-focus-ring-color, #4d6bfe); outline-offset: 0; border-color: transparent; }
.polza-input:disabled { opacity: .6; }
.polza-input[aria-invalid="true"] { border-color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-settings-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
@media (max-width: 640px) { .polza-settings-grid { grid-template-columns: minmax(0, 1fr); } }

.polza-banner { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: var(--dsw-radius-md, 8px); font-size: 12px; background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c62828) 9%, transparent); color: var(--dsw-alias-state-error-primary, #c62828); }
.polza-banner[data-kind="info"] { background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04)); color: var(--dsw-alias-label-secondary, #555); }

.polza-setup { max-width: 640px; margin: 40px auto; padding: 24px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-layer-1, #fff); }
.polza-setup h2 { margin: 0 0 8px; font-size: 18px; }
.polza-setup p { margin: 0 0 12px; color: var(--dsw-alias-label-secondary, #555); font-size: 13px; line-height: 1.5; }
.polza-setup code, .polza-setup pre { font-family: var(--dsw-font-markdown-code-font-family, ui-monospace, monospace); font-size: 12px; }
.polza-setup pre { padding: 12px; border-radius: 8px; background: var(--dsw-alias-markdown-code-block, rgba(0,0,0,.05)); overflow: auto; }

.polza-skeleton { border-radius: 6px; background: linear-gradient(90deg, var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05)) 25%, var(--dsw-alias-bg-layer-3, rgba(0,0,0,.08)) 37%, var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05)) 63%); background-size: 400% 100%; animation: polza-shimmer 1.4s ease infinite; }
@keyframes polza-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

@media (max-width: 900px) {
  .polza-page { padding: calc(20px + var(--dsh-frame-top-clearance, 0px)) 16px 32px; }
  .polza-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .polza-split { grid-template-columns: minmax(0, 1fr); }
  .polza-cell-model { max-width: 150px; }
}
@media (max-width: 560px) {
  .polza-cards { grid-template-columns: minmax(0, 1fr); }
  .polza-hide-sm { display: none; }
}
/* A visible progress line for long all-time scans; a cached table can stay
   on screen while this runs, so the page must still look busy. */
.polza-progress {
  flex: 0 0 2px;
  height: 2px;
  border-radius: 999px;
  overflow: hidden;
  background: transparent;
  opacity: 0;
  transition: opacity .15s ease;
}
.polza-progress[data-active="true"] { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.06)); }
.polza-progress[data-active="true"]::after {
  content: '';
  display: block;
  width: 38%;
  height: 100%;
  border-radius: inherit;
  background: #4d6bfe;
  animation: polza-progress 1.1s ease-in-out infinite;
}
@keyframes polza-progress {
  0% { transform: translateX(-105%); }
  100% { transform: translateX(290%); }
}
.polza-sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-secondary, #555);
  font-size: 12px;
  white-space: nowrap;
}
.polza-spinner {
  width: 11px;
  height: 11px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: polza-spin .7s linear infinite;
}
@keyframes polza-spin { to { transform: rotate(360deg); } }
`;
function ensureStyles() {
  if (document.querySelector("style[data-dsh-polza-style]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.dshPolzaStyle = "";
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

// src/client/index.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "dsh-polza";
var inject = ["slots", "layout", "configForms"];
var PANEL_ID = "polza";
function apply(ctx) {
  ensureStyles();
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID
  }, PolzaPanel));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 40,
    label: () => "Polza"
  }, PolzaPanelIcon));
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: "dsh-polza",
    inject: () => ({ injectedForm: ctx.configForms.get("polza") })
  }, PolzaSettings));
  ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
    name: "plugins.row.config",
    key: "dsh-polza#polza",
    inject: () => ({ injectedForm: ctx.configForms.get("polza") })
  }, PolzaSettings));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "polza-balance"
  }, (props) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    BalanceChip,
    {
      wide: props.wide !== false,
      openPanel: () => ctx.layout.selectPanel(PANEL_ID)
    }
  )));
}
//# sourceMappingURL=client.js.map

		return module.exports;
	}
});
