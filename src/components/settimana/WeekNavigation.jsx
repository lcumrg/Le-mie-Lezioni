export default function WeekNavigation({ weekOffset, setWeekOffset, weekLabel }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setWeekOffset((o) => o - 1)}
        className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => setWeekOffset(0)}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          weekOffset === 0
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-200 text-gray-700'
        }`}
      >
        Questa sett.
      </button>
      <span className="text-sm font-medium text-gray-600 min-w-[180px] text-center">
        {weekLabel}
      </span>
      <button
        onClick={() => setWeekOffset((o) => o + 1)}
        className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
