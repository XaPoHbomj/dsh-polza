/** Display formatting for the Polza surface: RUB, counts, dates, and labels. */

const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const rubPrecise = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
})

const count = new Intl.NumberFormat('ru-RU')

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const dayMonth = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: 'short',
})

/** Full ruble amount. */
export function money(value) {
  return Number.isFinite(value) ? rub.format(value) : '—'
}

/** Per-request amount without rounding to kopecks. */
export function preciseMoney(value) {
  return Number.isFinite(value) ? rubPrecise.format(value) : '—'
}

/** Integer count with Russian grouping. */
export function amount(value) {
  return Number.isFinite(value) ? count.format(Math.round(value)) : '—'
}

/** One timestamp as `dd.MM, HH:mm` in Moscow. */
export function timestamp(value) {
  if (value === null || value === undefined) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

/** One `YYYY-MM-DD` billing date as `dd MMM`. */
export function shortDate(value) {
  const date = new Date(`${value}T12:00:00+03:00`)
  return Number.isNaN(date.getTime()) ? value : dayMonth.format(date)
}

/** Human label for a period key. */
export function periodLabel(key) {
  switch (key) {
    case 'today': return 'Сегодня'
    case 'week': return 'Неделя'
    case '7d': return '7 дней'
    case '30d': return '30 дней'
    case 'month': return 'Этот месяц'
    case 'all': return 'Всё время'
    case 'custom': return 'Свой период'
    default: return key
  }
}

/** Human label for a request type. */
export function typeLabel(key) {
  switch (key) {
    case 'chat': return 'Чат'
    case 'image': return 'Изображение'
    case 'video': return 'Видео'
    case 'audio': return 'Аудио'
    default: return key || 'Другое'
  }
}

/** Human label for a generation status. */
export function statusLabel(key) {
  switch (key) {
    case 'completed': return 'Завершено'
    case 'failed': return 'Ошибка'
    case 'pending': return 'В процессе'
    default: return key || 'Неизвестно'
  }
}

/** Human label for one Polza cost-line kind. */
export function costLineLabel(kind) {
  switch (kind) {
    case 'prompt': return 'Вход'
    case 'cached_read': return 'Вход из кэша'
    case 'cache_write': return 'Запись в кэш'
    case 'completion': return 'Выход'
    case 'reasoning': return 'Reasoning'
    case 'audio_in': return 'Аудио на входе'
    case 'audio_out': return 'Аудио на выходе'
    case 'image_in': return 'Изображение на входе'
    case 'request_fee': return 'Плата за запрос'
    case 'output': return 'Результат'
    case 'native_web_search': return 'Веб-поиск'
    case 'refund': return 'Возврат'
    case 'model': return 'Модель'
    default:
      if (typeof kind === 'string' && kind.startsWith('plugin:')) return `Плагин ${kind.slice(7)}`
      if (typeof kind === 'string' && kind.startsWith('tool:')) return `Инструмент ${kind.slice(5)}`
      return kind || 'Другое'
  }
}

/** Human label for one cost-line unit. */
export function unitLabel(unit) {
  if (unit === 'token' || unit === 'tokens') return 'ток.'
  if (unit === 'request' || unit === 'requests') return 'зап.'
  if (unit === 'image' || unit === 'images') return 'изобр.'
  if (unit === 'second' || unit === 'seconds') return 'сек.'
  return unit ?? ''
}

/** Whether a balance is below one of the configured thresholds. */
export function balanceTone(available, low, critical) {
  if (!Number.isFinite(available)) return 'muted'
  if (available <= critical) return 'critical'
  if (available <= low) return 'warn'
  return 'ok'
}
