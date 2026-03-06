import { useState, useRef, useEffect } from 'react'

export default function GenerateButton({
  onGenerate,
  onGenerateMultiWeek,
  generating,
  hasOrari,
  lezioniCount,
  onToggleExtra,
  showExtraForm,
  hasDataFineScuola,
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!showDropdown) return
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {hasOrari && (
        <div className="relative" ref={dropdownRef}>
          <div className="flex">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="px-4 py-2 bg-link text-canvas text-sm font-medium rounded-l-sm hover:bg-link/80 disabled:opacity-50"
            >
              {generating ? 'Generazione...' : 'Genera lezioni da orario'}
            </button>
            {onGenerateMultiWeek && (
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={generating}
                className="px-2 py-2 bg-link text-canvas text-sm font-medium rounded-r-sm border-l border-canvas/20 hover:bg-link/80 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
          </div>
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 bg-surface border border-edge rounded-sm shadow-lg z-20 min-w-[200px]">
              <button
                onClick={() => { setShowDropdown(false); onGenerateMultiWeek(2) }}
                className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-overlay"
              >
                Prossime 2 settimane
              </button>
              <button
                onClick={() => { setShowDropdown(false); onGenerateMultiWeek(4) }}
                className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-overlay"
              >
                Prossime 4 settimane
              </button>
              {hasDataFineScuola && (
                <button
                  onClick={() => { setShowDropdown(false); onGenerateMultiWeek('end') }}
                  className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-overlay border-t border-edge-muted"
                >
                  Fino a fine scuola
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <button
        onClick={onToggleExtra}
        className="px-4 py-2 bg-special text-canvas text-sm font-medium rounded-sm hover:bg-special/80"
      >
        {showExtraForm ? 'Chiudi form extra' : 'Lezione extra'}
      </button>
      {lezioniCount > 0 && (
        <span className="text-sm text-fg-muted">
          {lezioniCount} lezioni questa settimana
        </span>
      )}
    </div>
  )
}
