/** One scoped stylesheet, injected once per page. */

const CSS = `
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
`

/** Inject the stylesheet once. */
export function ensureStyles() {
  if (document.querySelector('style[data-dsh-polza-style]') !== null) return
  const tag = document.createElement('style')
  tag.dataset.dshPolzaStyle = ''
  tag.textContent = CSS
  document.head.appendChild(tag)
}
