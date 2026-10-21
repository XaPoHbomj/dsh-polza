/**
 * Live settings card for the Polza bundle, rendered on the Plugins page. The
 * page's config form is addressed by the row id (`polza`), so the same card
 * serves the bundle page and the row's own configure page.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const FIELDS = [
  {
    key: 'refreshSeconds',
    label: 'Автообновление, секунд',
    hint: 'Как часто чип и панель перечитывают баланс. Минимум 15.',
    min: 15,
    max: 3600,
    step: 1,
  },
  {
    key: 'lowBalanceThreshold',
    label: 'Жёлтый порог, ₽',
    hint: 'Ниже этой суммы чип становится жёлтым.',
    min: 0,
    max: 1_000_000,
    step: 1,
  },
  {
    key: 'criticalBalanceThreshold',
    label: 'Красный порог, ₽',
    hint: 'Ниже этой суммы чип становится красным.',
    min: 0,
    max: 1_000_000,
    step: 1,
  },
  {
    key: 'historyMaxPages',
    label: 'Страниц истории',
    hint: 'Глубина графиков: одна страница — 100 генераций. Больше страниц = полнее график и дольше первый расчёт.',
    min: 1,
    max: 200,
    step: 1,
  },
]

const EMPTY_FORM = {
  subscribe: () => () => {},
  getSnapshot: () => ({ status: 'unavailable', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false }),
}

const DEFAULTS = {
  refreshSeconds: 60,
  lowBalanceThreshold: 100,
  criticalBalanceThreshold: 20,
  historyMaxPages: 100,
}

/** Build the editable draft from accepted Host values. */
function draftOf(value) {
  return {
    refreshSeconds: Number(value?.refreshSeconds ?? DEFAULTS.refreshSeconds),
    lowBalanceThreshold: Number(value?.lowBalanceThreshold ?? DEFAULTS.lowBalanceThreshold),
    criticalBalanceThreshold: Number(value?.criticalBalanceThreshold ?? DEFAULTS.criticalBalanceThreshold),
    historyMaxPages: Number(value?.historyMaxPages ?? DEFAULTS.historyMaxPages),
  }
}

/** Validate one draft, returning field messages. */
function validate(draft) {
  const errors = {}
  for (const field of FIELDS) {
    const value = Number(draft[field.key])
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      errors[field.key] = `Допустимо от ${field.min} до ${field.max}`
    }
  }
  return errors
}

/**
 * Render the editable settings card.
 * @param props - slot props; `form` arrives from the row page, the injected one serves the bundle page.
 */
export function PolzaSettings(props) {
  const form = props.form ?? props.injectedForm ?? EMPTY_FORM
  const subscribe = useCallback(listener => form.subscribe(listener), [form])
  const getSnapshot = useCallback(() => form.getSnapshot(), [form])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const accepted = draftOf(state.value)
  const [draft, setDraft] = useState(accepted)
  const [saveState, setSaveState] = useState('idle')

  useEffect(() => {
    setDraft(draftOf(state.value))
    setSaveState('idle')
    // The accepted Host revision is the single signal that a write landed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.revision])

  if (state.status === 'loading') {
    return (
      <div className="polza-settings">
        <div className="polza-skeleton" style={{ height: 22, width: 180 }} />
        <div className="polza-skeleton" style={{ height: 64, marginTop: 14 }} />
      </div>
    )
  }
  if (state.status === 'unavailable') {
    return <div className="polza-settings polza-settings-muted">Настройки Polza недоступны в этой сборке.</div>
  }

  const errors = validate(draft)
  const invalid = Object.keys(errors).length > 0
  const dirty = FIELDS.some(field => Number(draft[field.key]) !== Number(accepted[field.key]))
  const disabled = state.writable !== true || saveState === 'saving'

  async function save() {
    if (invalid || !dirty || disabled) return
    setSaveState('saving')
    try {
      const acceptedWrite = await form.mutate(
        FIELDS.map(field => ({ op: 'set', path: [field.key], value: Number(draft[field.key]) })),
        state.revision,
      )
      setSaveState(acceptedWrite ? 'saved' : 'error')
    } catch {
      setSaveState('error')
    }
  }

  return (
    <div className="polza-settings">
      <div className="polza-settings-head">
        <div>
          <h3 className="polza-settings-title">Настройки Polza</h3>
          <p className="polza-settings-sub">Изменения применяются без перезапуска.</p>
        </div>
        <span className="polza-settings-status" data-kind={saveState}>
          {saveState === 'saving' ? 'Сохранение…' : null}
          {saveState === 'saved' ? 'Сохранено' : null}
          {saveState === 'error' ? 'Не удалось сохранить' : null}
        </span>
      </div>

      <div className="polza-settings-grid">
        {FIELDS.map(field => {
          const id = `polza-setting-${field.key}`
          return (
            <label className="polza-setting" key={field.key} htmlFor={id}>
              <span className="polza-setting-label">{field.label}</span>
              <input
                id={id}
                className="polza-input"
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key]}
                disabled={disabled}
                aria-invalid={errors[field.key] !== undefined || undefined}
                onChange={event => setDraft(previous => ({ ...previous, [field.key]: event.target.value }))}
              />
              <span className="polza-setting-hint" data-error={errors[field.key] !== undefined || undefined}>
                {errors[field.key] ?? field.hint}
              </span>
            </label>
          )
        })}
      </div>

      <div className="polza-settings-actions">
        <button type="button" className="polza-button" data-primary="true" disabled={disabled || !dirty || invalid} onClick={save}>
          Сохранить
        </button>
        <button type="button" className="polza-button" disabled={disabled || !dirty} onClick={() => { setDraft(accepted); setSaveState('idle') }}>
          Отменить
        </button>
        {state.writable !== true ? <span className="polza-setting-hint">Хранилище настроек доступно только для чтения.</span> : null}
      </div>
    </div>
  )
}
