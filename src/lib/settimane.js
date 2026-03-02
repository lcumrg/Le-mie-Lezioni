import { startOfWeek, endOfWeek, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns'

/**
 * Given the config's settimane array and a date,
 * returns the matching settimana label (e.g. "Settimana 12")
 * or null if the date is not within any defined week.
 */
export function getSettimanaLabel(settimane, date) {
  if (!settimane || settimane.length === 0) return null

  for (const s of settimane) {
    const inizio = s.inizio instanceof Date ? s.inizio : s.inizio.toDate()
    const fine = s.fine instanceof Date ? s.fine : s.fine.toDate()
    if (isWithinInterval(date, { start: inizio, end: fine })) {
      return s.label
    }
  }
  return null
}

/**
 * Returns the current week boundaries (Monday to Sunday).
 */
export function getCurrentWeekRange() {
  const now = new Date()
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  }
}

/**
 * Returns week boundaries for a given offset from the current week.
 * offset = 0 → this week, 1 → next week, -1 → last week
 */
export function getWeekRange(offset = 0) {
  const now = new Date()
  const shifted = new Date(now)
  shifted.setDate(shifted.getDate() + offset * 7)
  return {
    start: startOfWeek(shifted, { weekStartsOn: 1 }),
    end: endOfWeek(shifted, { weekStartsOn: 1 }),
  }
}

/**
 * Returns day boundaries for a given offset from today.
 * offset = 0 → today, 1 → tomorrow, -1 → yesterday
 */
export function getDayRange(offset = 0) {
  const now = new Date()
  const shifted = new Date(now)
  shifted.setDate(shifted.getDate() + offset)
  return {
    start: startOfDay(shifted),
    end: endOfDay(shifted),
  }
}
