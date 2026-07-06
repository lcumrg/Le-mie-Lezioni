import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { onPercorsi, onLezioni, onUnita } from '../../lib/firestore'

const TYPE_CONFIG = {
  percorso: {
    label: 'Percorso',
    color: 'text-link bg-badge-p',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  unita: {
    label: 'Unita',
    color: 'text-special bg-badge-special',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  lezione: {
    label: 'Lezione',
    color: 'text-accent bg-badge-s',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
}

function truncateMatch(text, query, maxLen = 80) {
  if (!text) return ''
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '')
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + query.length + 40)
  let snippet = ''
  if (start > 0) snippet += '...'
  snippet += text.slice(start, end)
  if (end < text.length) snippet += '...'
  return snippet
}

export default function GlobalSearch() {
  const { annoAttivo } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [percorsi, setPercorsi] = useState([])
  const [unitaMap, setUnitaMap] = useState({})
  const [lezioni, setLezioni] = useState([])
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Load percorsi + lezioni
  useEffect(() => {
    if (!annoAttivo) return
    const unsub1 = onPercorsi(annoAttivo, setPercorsi)
    const unsub2 = onLezioni(annoAttivo, setLezioni)
    return () => { unsub1(); unsub2() }
  }, [annoAttivo])

  // Load unita for each percorso
  useEffect(() => {
    if (percorsi.length === 0) return
    const unsubs = []
    for (const p of percorsi) {
      const unsub = onUnita(p.id, (units) => {
        setUnitaMap((prev) => ({ ...prev, [p.id]: units }))
      })
      unsubs.push(unsub)
    }
    return () => unsubs.forEach((u) => u())
  }, [percorsi])

  // Debounced search (il reset per query corte avviene nell'onChange dell'input)
  useEffect(() => {
    if (query.length < 2) return

    const timer = setTimeout(() => {
      const q = query.toLowerCase()
      const found = []

      // Search percorsi
      for (const p of percorsi) {
        const fields = [p.titolo, p.descrizione, p.note].filter(Boolean)
        const matchField = fields.find((f) => f.toLowerCase().includes(q))
        if (matchField) {
          found.push({
            type: 'percorso',
            id: p.id,
            title: p.titolo,
            classe: p.classe || '',
            preview: truncateMatch(matchField, query),
            route: '/percorsi',
          })
        }
      }

      // Search unita
      for (const p of percorsi) {
        const units = unitaMap[p.id] || []
        for (const u of units) {
          const fields = [u.titolo, u.descrizione, u.note].filter(Boolean)
          const matchField = fields.find((f) => f.toLowerCase().includes(q))
          if (matchField) {
            found.push({
              type: 'unita',
              id: u.id,
              title: u.titolo,
              classe: p.classe || '',
              preview: truncateMatch(matchField, query),
              route: '/percorsi',
              parentTitle: p.titolo,
            })
          }
        }
      }

      // Search lezioni
      for (const l of lezioni) {
        const fields = [l.titolo, l.descrizione, l.note].filter(Boolean)
        const matchField = fields.find((f) => f.toLowerCase().includes(q))
        if (matchField) {
          found.push({
            type: 'lezione',
            id: l.id,
            title: l.titolo || `Lezione ${l.data || ''}`,
            classe: l.classe || '',
            preview: truncateMatch(matchField, query),
            route: '/settimana',
          })
        }
      }

      setResults(found.slice(0, 20))
      setOpen(found.length > 0)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, percorsi, unitaMap, lezioni])

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(result) {
    setOpen(false)
    setQuery('')
    navigate(result.route)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            if (v.length < 2) {
              setResults([])
              setOpen(false)
            }
          }}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Cerca percorsi, unita, lezioni..."
          className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-1 focus:ring-link/40 focus:border-link"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-edge rounded-sm max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-fg-muted">Nessun risultato</div>
          ) : (
            <ul>
              {results.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type]
                return (
                  <li key={`${r.type}-${r.id}-${i}`}>
                    <button
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-4 py-3 hover:bg-overlay flex items-start gap-3 transition-colors border-b border-edge-muted last:border-b-0"
                    >
                      {/* Type icon */}
                      <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded ${cfg.color}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                        </svg>
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-fg truncate">{r.title}</span>
                          {r.classe && (
                            <span className="shrink-0 text-xs px-1.5 py-0.5 bg-overlay text-fg-muted rounded font-mono">
                              {r.classe}
                            </span>
                          )}
                        </div>
                        {r.parentTitle && (
                          <div className="text-xs text-fg-subtle truncate">{cfg.label} in {r.parentTitle}</div>
                        )}
                        <p className="text-xs text-fg-muted mt-0.5 line-clamp-1">{r.preview}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
