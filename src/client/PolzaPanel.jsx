import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api.js'
import {
  amount, balanceTone, costLineLabel, money, periodLabel, preciseMoney,
  shortDate, statusLabel, timestamp, typeLabel, unitLabel,
} from './format.js'
import { useAsync, useCachedAsync, useRefreshTick } from './hooks.js'

/** Hover detail cache, bounded so a long session cannot grow it without limit. */
const detailCache = new Map()

function rememberDetail(id, value) {
  detailCache.set(id, value)
  if (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value)
}

/** Small wallet mark used by the sidebar entry and the balance chip. */
export function PolzaMark({ size = 18, active = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: active ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'currentColor', flex: 'none' }}
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3" y="8.5" width="18" height="10.5" rx="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.6" cy="13.8" r="1.15" fill="currentColor" />
    </svg>
  )
}

/** Sidebar icon entry for the Polza panel. */
export function PolzaPanelIcon({ size = 16, active = false }) {
  return <PolzaMark size={size} active={active} />
}

/** Always-visible balance chip in the sidebar footer. */
export function BalanceChip({ wide = true, openPanel }) {
  const [healthTick] = useRefreshTick(300)
  const health = useAsync(signal => api.health({ signal }), [healthTick])
  const [tick] = useRefreshTick(health.data?.config?.refreshSeconds ?? 60)
  const summary = useAsync(signal => api.summary({ signal }), [tick])

  const balance = summary.data?.balance ?? null
  const available = balance?.available
  const daySpend = summary.data?.key?.usageDaily
  const thresholds = health.data?.config ?? { lowBalanceThreshold: 100, criticalBalanceThreshold: 20 }
  const tone = balanceTone(available, thresholds.lowBalanceThreshold, thresholds.criticalBalanceThreshold)
  const label = available === undefined
    ? 'Polza'
    : (daySpend === undefined
        ? `Polza: доступно ${money(available)}`
        : `Polza: доступно ${money(available)}, расход за день ${money(daySpend)}`)

  return (
    <button
      type="button"
      className="polza-chip"
      data-wide={wide ? 'true' : 'false'}
      data-tone={tone}
      title={label}
      aria-label={label}
      onClick={openPanel}
    >
      <PolzaMark size={wide ? 17 : 19} />
      {wide && (
        <span className="polza-chip-text">
          <span className="polza-chip-amount">
            {available === undefined ? 'Polza' : money(available)}
          </span>
          {daySpend !== undefined && (
            <span className="polza-chip-sub">за день {money(daySpend)}</span>
          )}
        </span>
      )}
      <span className="polza-chip-dot" aria-hidden="true" />
    </button>
  )
}

/** One KPI card. */
function Card({ label, value, note, tone }) {
  return (
    <div className="polza-card">
      <div className="polza-card-label">{label}</div>
      <div className="polza-card-value" data-tone={tone}>{value}</div>
      {note !== undefined && note !== null && <div className="polza-card-note">{note}</div>}
    </div>
  )
}

/** Segmented period picker. */
function PeriodTabs({ value, onChange }) {
  const periods = [['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']]
  return (
    <div className="polza-tabs" role="tablist" aria-label="Период">
      {periods.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          className="polza-tab"
          data-active={value === key ? 'true' : 'false'}
          aria-selected={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Daily spend bars with an empty state. */
function SpendChart({ days, loading }) {
  if (loading && (days === undefined || days.length === 0)) {
    return <div className="polza-skeleton" style={{ height: 168 }} />
  }
  const rows = Array.isArray(days) ? days : []
  const max = rows.reduce((peak, row) => Math.max(peak, row.cost ?? 0), 0)
  if (rows.length === 0 || max <= 0) {
    return <div className="polza-empty"><PolzaMark size={26} /><span>За этот период расходов нет</span></div>
  }
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6))
  return (
    <div>
      <div className="polza-chart">
        {rows.map(row => {
          const height = Math.max(2, Math.round((Math.max(0, row.cost) / max) * 140))
          return (
            <div className="polza-bar-wrap" key={row.date} title={`${shortDate(row.date)}: ${money(row.cost)} · ${amount(row.requests)} запросов`}>
              <div className={row.cost > 0 ? 'polza-bar' : 'polza-bar polza-bar-empty'} style={{ height }} />
            </div>
          )
        })}
      </div>
      <div className="polza-chart-axis" aria-hidden="true">
        {rows.map((row, index) => (
          index % labelEvery === 0 || index === rows.length - 1
            ? <span key={row.date}>{shortDate(row.date)}</span>
            : <span key={row.date} />
        ))}
      </div>
    </div>
  )
}

/** Top models with share bars. */
function ModelBreakdown({ models, totalCost, loading }) {
  if (loading && (models === undefined || models.length === 0)) {
    return <div className="polza-skeleton" style={{ height: 150 }} />
  }
  const rows = Array.isArray(models) ? models.filter(row => row.key !== 'other' || row.cost > 0) : []
  if (rows.length === 0) {
    return <div className="polza-empty" style={{ height: 120 }}><span>Нет данных по моделям</span></div>
  }
  const peak = rows.reduce((max, row) => Math.max(max, row.cost), 0) || 1
  return (
    <div className="polza-models">
      {rows.map(row => (
        <div className="polza-model" key={row.key}>
          <span className="polza-model-label" title={row.label}>{row.label}</span>
          <span className="polza-model-cost">{money(row.cost)}</span>
          <div className="polza-model-track">
            <div className="polza-model-fill" style={{ width: `${Math.max(3, (row.cost / peak) * 100)}%` }} />
          </div>
          <span className="polza-model-share">{totalCost > 0 ? `${Math.round((row.cost / totalCost) * 100)}%` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

/** Request-type chips. */
function TypeBreakdown({ types }) {
  const rows = Array.isArray(types) ? types.filter(row => row.requests > 0) : []
  if (rows.length === 0) return <span className="polza-panel-note">Нет данных</span>
  return (
    <div className="polza-types">
      {rows.map(row => (
        <span className="polza-type" key={row.key}>
          {typeLabel(row.key)}
          <b>{money(row.cost)}</b>
          <span>{amount(row.requests)}</span>
        </span>
      ))}
    </div>
  )
}

/** One select with a stable empty option. */
function FilterSelect({ label, value, onChange, options, anyLabel = 'Все' }) {
  return (
    <select className="polza-select" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {anyLabel ? <option value="">{anyLabel}</option> : null}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

/** Hover breakdown of one generation's tokens and cost lines. */
function GenerationHoverCard({ item, rect }) {
  const [detail, setDetail] = useState(() => detailCache.get(item.id) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (detailCache.has(item.id)) {
      setDetail(detailCache.get(item.id))
      setFailed(false)
      return undefined
    }
    let alive = true
    api.generation(item.id).then(
      value => {
        rememberDetail(item.id, value)
        if (alive) setDetail(value)
      },
      () => { if (alive) setFailed(true) },
    )
    return () => { alive = false }
  }, [item.id])

  const usage = detail?.usage ?? item.usage
  const cost = detail?.cost ?? item.cost
  const total = usage.totalTokens || (usage.promptTokens + usage.completionTokens)
  const lines = Array.isArray(detail?.costLines) ? detail.costLines.filter(line => line.cost !== 0 || line.quantity !== 0) : []
  const width = 336
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const below = rect.bottom + 8
  const top = below + 330 > window.innerHeight ? Math.max(8, rect.top - 338) : below

  return createPortal(
    <div className="polza-hovercard" style={{ top, left, width }} role="tooltip">
      <div className="polza-hovercard-title">Из чего сложилась цена</div>
      <div className="polza-hover-row polza-hover-strong"><span>Токены</span><b>{amount(total)}</b></div>
      <div className="polza-hover-row polza-hover-sub"><span>Вход</span><b>{amount(usage.promptTokens)}</b></div>
      <div className="polza-hover-row polza-hover-sub2"><span>из них из кэша</span><b>{amount(usage.cachedTokens)}</b></div>
      <div className="polza-hover-row polza-hover-sub2"><span>запись в кэш</span><b>{amount(usage.cacheWriteTokens)}</b></div>
      <div className="polza-hover-row polza-hover-sub"><span>Выход</span><b>{amount(usage.completionTokens)}</b></div>
      <div className="polza-hover-row polza-hover-sub2"><span>из них reasoning</span><b>{amount(usage.reasoningTokens)}</b></div>

      <div className="polza-hover-divider" />

      {lines.length > 0 ? lines.map((line, index) => (
        <div className="polza-hover-row polza-hover-line" key={`${line.kind}-${index}`}>
          <span>
            {costLineLabel(line.kind)}
            {line.quantity > 0 ? ` · ${amount(line.quantity)} ${unitLabel(line.unit)}` : ''}
          </span>
          <b>{preciseMoney(line.cost)}</b>
        </div>
      )) : (
        <div className="polza-hover-muted">
          {failed ? 'Детализация цены недоступна' : (detail === null ? 'Загружаем детализацию…' : 'Построчная детализация не возвращена')}
        </div>
      )}

      <div className="polza-hover-divider" />
      <div className="polza-hover-row polza-hover-total"><span>Итого</span><b>{preciseMoney(cost)}</b></div>
      <div className="polza-hover-muted">{item.id}</div>
      <div className="polza-hover-muted">{item.modelDisplayName ?? item.model} · {timestamp(item.createdAt)}</div>
    </div>,
    document.body,
  )
}

/** Paginated generation table. */
function GenerationsTable({ data, loading, error, page, limit, sortBy, sortOrder, onPage, onLimit, onSort, onRetry }) {
  const items = Array.isArray(data?.items) ? data.items : []
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 }
  const [hover, setHover] = useState(null)

  return (
    <div className="polza-panel">
      <div className="polza-panel-head">
        <span className="polza-panel-title">История генераций</span>
        <div className="polza-head-actions">
          <FilterSelect
            label="Строк на странице"
            value={String(limit)}
            onChange={value => onLimit(Number(value))}
            options={[20, 25, 50, 100].map(value => ({ value: String(value), label: `${value} строк` }))}
            anyLabel=""
          />
        </div>
      </div>

      {error !== null && error !== undefined ? (
        <div className="polza-banner">
          <span>{error.message ?? 'Не удалось загрузить историю'}</span>
          <button type="button" className="polza-button" onClick={onRetry}>Повторить</button>
        </div>
      ) : null}

      <div className="polza-table-wrap">
        <table className="polza-table">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => onSort('createdAt')}>
                Время {sortBy === 'createdAt' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th>Модель</th>
              <th className="polza-hide-sm">Тип</th>
              <th className="polza-cell-tokens">Токены</th>
              <th className="polza-cell-money" data-sortable="true" onClick={() => onSort('clientCost')}>
                Стоимость {sortBy === 'clientCost' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th>Статус</th>
              <th className="polza-hide-sm">ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              Array.from({ length: 6 }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={7}><div className="polza-skeleton" style={{ height: 18 }} /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="polza-empty" style={{ height: 120 }}>
                    <PolzaMark size={24} />
                    <span>Нет генераций за выбранный период</span>
                  </div>
                </td>
              </tr>
            ) : items.map(item => (
              <tr
                key={item.id}
                onMouseEnter={event => setHover({ item, rect: event.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHover(null)}
              >
                <td className="polza-cell-time">{timestamp(item.createdAt)}</td>
                <td className="polza-cell-model" title={item.model}>{item.modelDisplayName ?? item.model}</td>
                <td className="polza-hide-sm">{typeLabel(item.requestType)}</td>
                <td className="polza-cell-tokens">{amount(item.usage.totalTokens)}</td>
                <td className="polza-cell-money polza-cell-detail" title="Наведите, чтобы увидеть разбивку по токенам">
                  {preciseMoney(item.cost)}
                </td>
                <td><span className="polza-status" data-status={item.status}>{statusLabel(item.status)}</span></td>
                <td className="polza-cell-id polza-hide-sm" title={item.id}>{item.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="polza-table-foot">
        <span>
          {meta.total > 0
            ? `${amount((meta.page - 1) * meta.limit + 1)}–${amount(Math.min(meta.page * meta.limit, meta.total))} из ${amount(meta.total)}`
            : 'Нет записей'}
          {data?.partial ? ' · частично' : ''}
          {data?.cache?.source === 'disk' ? ' · из кэша' : ''}
          {loading ? ' · обновляем…' : ''}
        </span>
        <div className="polza-pager">
          <button type="button" className="polza-button" disabled={meta.page <= 1 || loading} onClick={() => onPage(meta.page - 1)}>Назад</button>
          <span className="polza-page-number">{meta.page} / {Math.max(1, meta.totalPages)}</span>
          <button type="button" className="polza-button" disabled={meta.page >= meta.totalPages || loading} onClick={() => onPage(meta.page + 1)}>Вперёд</button>
        </div>
      </div>

      {hover !== null ? <GenerationHoverCard item={hover.item} rect={hover.rect} /> : null}
    </div>
  )
}

/** Credential setup instructions. */
function SetupCard({ health, onRetry }) {
  const ref = health?.ref ?? 'POLZA_API_KEY'
  return (
    <div className="polza-setup">
      <h2>Подключите ключ Polza</h2>
      <p>
        Плагин читает ключ из стандартного хранилища DSH и никогда не передаёт его в браузер.
        Добавьте ссылку <code>{ref}</code> в <code>~/.dsh/.credentials.yaml</code>:
      </p>
      <pre>{`version: 1\nrefs:\n  ${ref}: pza_...`}</pre>
      <p>
        Подойдёт и переменная окружения <code>{ref}</code> — она используется как запасной источник.
        После сохранения нажмите «Проверить снова».
      </p>
      <button type="button" className="polza-button" data-primary="true" onClick={onRetry}>Проверить снова</button>
    </div>
  )
}

/** Main Polza panel. */
export function PolzaPanel() {
  const [period, setPeriod] = useState('month')
  const [requestType, setRequestType] = useState('')
  const [status, setStatus] = useState('')
  const [model, setModel] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [healthTick] = useRefreshTick(300)
  const health = useAsync(signal => api.health({ signal }), [healthTick])
  const [tick, refresh] = useRefreshTick(health.data?.config?.refreshSeconds ?? 60)
  const modelOptions = useAsync(signal => api.models({ signal }), [tick])
  const scopeKey = `${period}|${requestType}|${status}|${model}`
  const tableKey = `${scopeKey}|${page}|${limit}|${sortBy}|${sortOrder}`
  const overview = useCachedAsync(
    signal => api.overview({ period, requestType, status, model, cache: '1' }, { signal }),
    signal => api.overview({ period, requestType, status, model, fresh: '1' }, { signal }),
    [period, requestType, status, model, tick],
    scopeKey,
  )
  const table = useCachedAsync(
    signal => api.generations({ period, requestType, status, model, page, limit, sortBy, sortOrder, cache: '1' }, { signal }),
    signal => api.generations({ period, requestType, status, model, page, limit, sortBy, sortOrder }, { signal }),
    [period, requestType, status, model, page, limit, sortBy, sortOrder, tick],
    tableKey,
  )

  useEffect(() => { setPage(1) }, [period, requestType, status, model, limit, sortBy, sortOrder])

  async function refreshNow() {
    try {
      await api.refresh()
    } catch {
      // A failed cache flush still lets the reads fall through to their TTL.
    }
    refresh()
  }

  if (health.data !== null && health.data.configured === false) {
    return <div className="polza-page"><SetupCard health={health.data} onRetry={refresh} /></div>
  }

  const data = overview.data
  const balance = data?.balance ?? null
  const key = data?.key ?? null
  const totals = data?.totals ?? null
  const exact = data?.exactCost ?? null
  const periodCost = exact !== null ? exact.cost : (totals?.cost ?? 0)
  const thresholds = health.data?.config ?? { lowBalanceThreshold: 100, criticalBalanceThreshold: 20 }
  const tone = balanceTone(balance?.available, thresholds.lowBalanceThreshold, thresholds.criticalBalanceThreshold)
  const promptTokens = totals?.promptTokens ?? 0
  const cachedTokens = totals?.cachedTokens ?? 0
  const cacheShare = promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0
  const filtered = Boolean(data?.filters && (data.filters.requestType || data.filters.status || data.filters.model))
  const exactNote = exact === null
    ? (data?.history?.partial
        ? `по ${amount(data.history.scanned)} из ${amount(data.history.total)} записей`
        : (filtered ? 'по истории с учётом фильтров' : 'по истории ключа'))
    : (exact.source === 'usage_daily'
        ? 'точно за сегодня'
        : exact.source === 'usage_weekly'
          ? 'точно за неделю, с понедельника'
          : exact.source === 'usage_monthly'
            ? 'точно за месяц'
            : 'точно за всё время')

  // `/models` does one cold page-1 read and can take seconds. The overview
  // already carries the models for the selected period, so the filter can
  // populate from that immediately and be replaced by the full list later.
  const modelSource = modelOptions.data?.items?.length
    ? modelOptions.data.items
    : (overview.data?.models ?? [])
  const modelsForFilter = modelSource
    .filter(item => item.key !== 'other')
    .map(item => ({ value: item.key, label: item.label }))
  if (model !== '' && !modelsForFilter.some(item => item.value === model)) {
    modelsForFilter.unshift({ value: model, label: model })
  }

  const busy = overview.loading || table.loading

  return (
    <div className="polza-page">
      <div className="polza-inner">
        <div className="polza-progress" data-active={busy ? 'true' : 'false'} aria-hidden={busy ? 'false' : 'true'} />
        <div className="polza-head">
          <div>
            <h1 className="polza-title">Polza</h1>
            <p className="polza-sub">
              Баланс организации и расход API-ключа
              {data?.fetchedAt ? ` · обновлено ${timestamp(data.fetchedAt)}` : ''}
              {key?.label ? ` · ${key.label}` : ''}
            </p>
          </div>
          <div className="polza-head-actions">
            {overview.loading ? (
              <span className="polza-sync">
                <span className="polza-spinner" aria-hidden="true" />
                {overview.stale ? 'Показываем кэш, обновляем…' : 'Обновляем данные…'}
              </span>
            ) : null}
            <button type="button" className="polza-button" onClick={refreshNow} disabled={overview.loading}>
              {overview.loading ? 'Обновление…' : 'Обновить'}
            </button>
          </div>
        </div>

        {overview.error !== null && overview.error !== undefined ? (
          <div className="polza-banner">
            <span>{overview.error.message ?? 'Не удалось загрузить данные Polza'}</span>
            <button type="button" className="polza-button" onClick={refreshNow}>Повторить</button>
          </div>
        ) : null}

        {data?.history?.partial ? (
          <div className="polza-banner" data-kind="info">
            Показаны последние {amount(data.history.scanned)} из {amount(data.history.total)} генераций.
            Итог за период берётся из сводки ключа, разбивки — по загруженной части.
          </div>
        ) : null}

        <div className="polza-cards">
          <Card
            label="Доступно к трате"
            value={money(balance?.available)}
            tone={tone}
            note={balance?.reservedAmount ? `в резерве ${money(balance.reservedAmount)}` : 'с учётом резерва и лимитов'}
          />
          <Card
            label="Баланс кошелька"
            value={money(balance?.amount)}
            note={balance?.spentAmount !== null && balance?.spentAmount !== undefined ? `потрачено ${money(balance.spentAmount)}` : 'баланс организации'}
          />
          <Card
            label={`Расход · ${periodLabel(period)}`}
            value={money(periodCost)}
            note={exactNote}
          />
          <Card
            label="Запросов"
            value={amount(totals?.requests)}
            note={data?.history?.partial
              ? `в выборке из ${amount(data.history.total)}`
              : (totals ? `средний ${money(totals.averageCost)}` : 'за выбранный период')}
          />
        </div>

        <div className="polza-split">
          <div className="polza-panel">
            <div className="polza-panel-head">
              <span className="polza-panel-title">Расход по дням</span>
              <span className="polza-panel-note">{periodLabel(period)}</span>
            </div>
            <SpendChart days={data?.days} loading={overview.loading} />
          </div>
          <div className="polza-panel">
            <div className="polza-panel-head">
              <span className="polza-panel-title">Модели</span>
              <span className="polza-panel-note">
                {data?.history?.partial ? 'доля от загруженной части' : `${amount(totals?.requests)} запросов`}
              </span>
            </div>
            <ModelBreakdown models={data?.models} totalCost={totals?.cost ?? 0} loading={overview.loading} />
          </div>
        </div>

        <div className="polza-panel">
          <div className="polza-panel-head">
            <span className="polza-panel-title">Детали периода</span>
            <span className="polza-panel-note">
              кэш {cacheShare}% · токенов {amount(totals?.totalTokens)}
            </span>
          </div>
          <TypeBreakdown types={data?.types} />
          {key?.limit !== null && key?.limit !== undefined ? (
            <div className="polza-panel-note" style={{ marginTop: 10 }}>
              Лимит ключа: осталось {money(key.limitRemaining)} из {money(key.limit)}
              {key.limitReset ? ` · сброс ${key.limitReset}` : ''}
            </div>
          ) : null}
        </div>

        <div className="polza-toolbar">
          <PeriodTabs value={period} onChange={value => { setPeriod(value); setPage(1) }} />
          <FilterSelect
            label="Тип запроса"
            value={requestType}
            onChange={value => { setRequestType(value); setPage(1) }}
            options={[['chat', 'Чат'], ['image', 'Изображения'], ['video', 'Видео'], ['audio', 'Аудио']].map(([value, label]) => ({ value, label }))}
            anyLabel="Все типы"
          />
          <FilterSelect
            label="Статус"
            value={status}
            onChange={value => { setStatus(value); setPage(1) }}
            options={[['completed', 'Завершено'], ['failed', 'Ошибка'], ['pending', 'В процессе']].map(([value, label]) => ({ value, label }))}
            anyLabel="Все статусы"
          />
          <FilterSelect
            label="Модель"
            value={model}
            onChange={value => { setModel(value); setPage(1) }}
            options={modelsForFilter}
            anyLabel="Все модели"
          />
        </div>

        <GenerationsTable
          data={table.data}
          loading={table.loading}
          error={table.error}
          page={page}
          limit={limit}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPage={setPage}
          onLimit={value => { setLimit(value); setPage(1) }}
          onSort={field => {
            if (sortBy === field) setSortOrder(order => (order === 'desc' ? 'asc' : 'desc'))
            else { setSortBy(field); setSortOrder('desc') }
            setPage(1)
          }}
          onRetry={refresh}
        />
      </div>
    </div>
  )
}
