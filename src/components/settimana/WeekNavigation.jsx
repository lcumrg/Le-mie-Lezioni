import { differenceInCalendarWeeks, parseISO } from 'date-fns'

export default function WeekNavigation({ weekOffset, setWeekOffset, weekLabel }) {
  // Salto diretto alla settimana di una data (senza N click di frecce)
  function handleJump(e) {
    const value = e.target.value
    if (!value) return
    setWeekOffset(differenceInCalendarWeeks(parseISO(value), new Date(), { weekStartsOn: 1 }))
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setWeekOffset((o) => o - 1)}
        className="p-2 rounded-sm hover:bg-overlay text-fg-muted"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => setWeekOffset(0)}
        className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
          weekOffset === 0
            ? 'bg-badge-s text-accent'
            : 'hover:bg-overlay text-fg'
        }`}
      >
        Questa sett.
      </button>
      <span className="text-sm font-medium text-fg-muted min-w-[180px] text-center">
        {weekLabel}
      </span>
      <button
        onClick={() => setWeekOffset((o) => o + 1)}
        className="p-2 rounded-sm hover:bg-overlay text-fg-muted"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <label
        className="relative p-2 rounded-sm hover:bg-overlay text-fg-muted cursor-pointer"
        title="Vai alla settimana di una data"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <input
          type="date"
          onChange={handleJump}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Vai alla settimana di una data"
        />
      </label>
    </div>
  )
}
