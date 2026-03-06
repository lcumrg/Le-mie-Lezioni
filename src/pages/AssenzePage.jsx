import { useEffect, useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { onVacanze, addVacanza, deleteVacanza } from '../lib/firestore'
import { TIPO_VACANZA, TIPO_VACANZA_LABEL } from '../lib/costanti'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

const MESI = [
  'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
]
const GIORNI_HDR = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

const TIPO_COLORS = {
  [TIPO_VACANZA.VACANZA]: {
    bg: 'bg-amber-200',
    bgHover: 'hover:bg-amber-100',
    text: 'text-amber-900',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    active: 'bg-amber-400 text-amber-950 ring-2 ring-amber-500',
  },
  [TIPO_VACANZA.CONGEDO]: {
    bg: 'bg-sky-200',
    bgHover: 'hover:bg-sky-100',
    text: 'text-sky-900',
    dot: 'bg-sky-400',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    active: 'bg-sky-400 text-sky-950 ring-2 ring-sky-500',
  },
  [TIPO_VACANZA.MALATTIA]: {
    bg: 'bg-rose-200',
    bgHover: 'hover:bg-rose-100',
    text: 'text-rose-900',
    dot: 'bg-rose-400',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    active: 'bg-rose-400 text-rose-950 ring-2 ring-rose-500',
  },
  // backward compat
  chiusura: {
    bg: 'bg-purple-200',
    bgHover: 'hover:bg-purple-100',
    text: 'text-purple-900',
    dot: 'bg-purple-400',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    active: 'bg-purple-400 text-purple-950 ring-2 ring-purple-500',
  },
  assenza: {
    bg: 'bg-slate-200',
    bgHover: 'hover:bg-slate-100',
    text: 'text-slate-900',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    active: 'bg-slate-400 text-slate-950 ring-2 ring-slate-500',
  },
}

function getColorFor(tipo) {
  return TIPO_COLORS[tipo] || TIPO_COLORS[TIPO_VACANZA.VACANZA]
}

// Local date format (NO UTC conversion — avoids off-by-one timezone bug)
function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

export default function AssenzePage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const toast = useToast()
  const [vacanze, setVacanze] = useState([])
  const [brush, setBrush] = useState(TIPO_VACANZA.VACANZA)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', dataInizio: '', dataFine: '', tipo: TIPO_VACANZA.VACANZA })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!annoAttivo) return
    return onVacanze(annoAttivo, setVacanze)
  }, [annoAttivo])

  // Build date -> vacanza map (expanding ranges)
  const vacanzeMap = useMemo(() => {
    const map = new Map()
    for (const v of vacanze) {
      const d = new Date(v.dataInizio + 'T12:00:00')
      const end = new Date(v.dataFine + 'T12:00:00')
      while (d <= end) {
        const key = fmt(d)
        if (!map.has(key)) map.set(key, v)
        d.setDate(d.getDate() + 1)
      }
    }
    return map
  }, [vacanze])

  // Counters
  const counters = useMemo(() => {
    const counts = {}
    const daysByType = {}
    for (const v of vacanze) {
      const d = new Date(v.dataInizio + 'T12:00:00')
      const end = new Date(v.dataFine + 'T12:00:00')
      if (!daysByType[v.tipo]) daysByType[v.tipo] = new Set()
      while (d <= end) {
        daysByType[v.tipo].add(fmt(d))
        d.setDate(d.getDate() + 1)
      }
    }
    for (const [tipo, days] of Object.entries(daysByType)) {
      counts[tipo] = days.size
    }
    return counts
  }, [vacanze])

  const totalDays = Object.values(counters).reduce((s, n) => s + n, 0)

  // Compute school year months
  const months = useMemo(() => {
    if (!annoAttivo) return []
    const match = annoAttivo.match(/(\d{4})\D+(\d{2,4})/)
    if (!match) return []
    const startYear = Number(match[1])
    let endYear = Number(match[2])
    if (endYear < 100) endYear += Math.floor(startYear / 100) * 100
    let endMonth = 5 // June default
    if (annoConfig?.dataFineScuola) {
      const parts = annoConfig.dataFineScuola.split('-')
      if (parts.length >= 2) endMonth = Number(parts[1]) - 1
    }
    const result = []
    for (let m = 8; m <= 11; m++) result.push({ year: startYear, month: m })
    for (let m = 0; m <= endMonth; m++) result.push({ year: endYear, month: m })
    return result
  }, [annoAttivo, annoConfig?.dataFineScuola])

  const today = fmt(new Date())

  async function handleDayClick(date) {
    const key = fmt(date)
    const existing = vacanzeMap.get(key)

    if (existing) {
      // Always allow removing — delete the vacanza doc
      try {
        await deleteVacanza(existing.id)
        if (existing.dataInizio !== existing.dataFine) {
          toast.success(`Rimosso periodo "${existing.nome}"`)
        }
      } catch {
        toast.error('Errore nella rimozione')
      }
      return
    }

    // Create single-day absence
    try {
      await addVacanza({
        annoScolastico: annoAttivo,
        nome: TIPO_VACANZA_LABEL[brush] || brush,
        dataInizio: key,
        dataFine: key,
        tipo: brush,
      })
    } catch {
      toast.error("Errore nell'aggiunta")
    }
  }

  async function handleAddPeriodo(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.dataInizio || !annoAttivo) return
    const df = form.dataFine || form.dataInizio
    if (df < form.dataInizio) {
      toast.error('La data di fine non puo essere precedente alla data di inizio')
      return
    }
    try {
      await addVacanza({
        annoScolastico: annoAttivo,
        nome: form.nome.trim(),
        dataInizio: form.dataInizio,
        dataFine: df,
        tipo: form.tipo,
      })
      setForm({ nome: '', dataInizio: '', dataFine: '', tipo: TIPO_VACANZA.VACANZA })
      toast.success('Periodo aggiunto')
    } catch {
      toast.error("Errore nell'aggiunta del periodo")
    }
  }

  async function handleDeletePeriodo(id) {
    try {
      await deleteVacanza(id)
    } catch {
      toast.error("Errore nell'eliminazione")
    }
  }

  async function handleClearAll() {
    setClearConfirm(false)
    setClearing(true)
    try {
      await Promise.all(vacanze.map((v) => deleteVacanza(v.id)))
      toast.success('Tutte le assenze sono state rimosse')
    } catch {
      toast.error("Errore durante la rimozione")
    } finally {
      setClearing(false)
    }
  }

  if (configLoading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-fg mb-4">Assenze</h1>
        <p className="text-sm text-fg-muted">Configura prima un anno scolastico nelle Impostazioni.</p>
      </div>
    )
  }

  // Multi-day periods (for the list below)
  const periodi = vacanze
    .filter((v) => v.dataInizio !== v.dataFine)
    .sort((a, b) => a.dataInizio.localeCompare(b.dataInizio))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-fg">Assenze</h1>
        <div className="flex items-center gap-3">
          {vacanze.length > 0 && (
            <button
              onClick={() => setClearConfirm(true)}
              disabled={clearing}
              className="px-3 py-1.5 text-xs font-medium text-danger/70 hover:text-danger border border-danger/30 rounded-sm hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              {clearing ? 'Rimozione...' : 'Svuota tutte'}
            </button>
          )}
          <span className="text-sm text-fg-muted font-mono">{annoAttivo}</span>
        </div>
      </div>

      {/* Brush selector + counters */}
      <div className="bg-surface rounded-sm border border-edge p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-fg-muted mr-1">Tipo:</span>
          {Object.values(TIPO_VACANZA).map((tipo) => {
            const c = getColorFor(tipo)
            const isActive = brush === tipo
            return (
              <button
                key={tipo}
                onClick={() => setBrush(tipo)}
                className={`px-3 py-1.5 text-sm font-medium rounded-sm border transition-all ${isActive ? c.active : `${c.badge} ${c.bgHover}`}`}
              >
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot} mr-1.5`} />
                {TIPO_VACANZA_LABEL[tipo]}
              </button>
            )
          })}
        </div>

        {/* Counters */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {Object.values(TIPO_VACANZA).map((tipo) => {
            const c = getColorFor(tipo)
            const count = counters[tipo] || 0
            return (
              <div key={tipo} className="flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded-sm ${c.bg}`} />
                <span className="text-fg-muted">{TIPO_VACANZA_LABEL[tipo]}:</span>
                <span className="font-semibold text-fg font-mono">{count}</span>
                <span className="text-fg-subtle">gg</span>
              </div>
            )
          })}
          {/* Backward compat types */}
          {Object.entries(counters)
            .filter(([tipo]) => !Object.values(TIPO_VACANZA).includes(tipo))
            .map(([tipo, count]) => {
              const c = getColorFor(tipo)
              return (
                <div key={tipo} className="flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded-sm ${c.bg}`} />
                  <span className="text-fg-muted">{TIPO_VACANZA_LABEL[tipo] || tipo}:</span>
                  <span className="font-semibold text-fg font-mono">{count}</span>
                  <span className="text-fg-subtle">gg</span>
                </div>
              )
            })}
          <div className="border-l border-edge pl-4 flex items-center gap-1.5">
            <span className="text-fg-muted">Totale:</span>
            <span className="font-bold text-fg font-mono">{totalDays}</span>
            <span className="text-fg-subtle">gg</span>
          </div>
        </div>

        <p className="text-xs text-fg-subtle">
          Clicca su un giorno per segnare un'assenza. Clicca di nuovo per rimuoverla.
        </p>
      </div>

      {/* Add period form (collapsible) */}
      <div className="bg-surface rounded-sm border border-edge">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-fg-muted hover:text-fg transition-colors"
        >
          <span>Aggiungi periodo (piu giorni)</span>
          <svg className={`w-4 h-4 transition-transform ${showForm ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showForm && (
          <form onSubmit={handleAddPeriodo} className="px-4 pb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-fg-muted mb-1">Nome</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="es. Vacanze di Natale"
                className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Dal</label>
              <input
                type="date"
                value={form.dataInizio}
                onChange={(e) => setForm((f) => ({ ...f, dataInizio: e.target.value }))}
                className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Al</label>
              <input
                type="date"
                value={form.dataFine}
                onChange={(e) => setForm((f) => ({ ...f, dataFine: e.target.value }))}
                className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              >
                {Object.values(TIPO_VACANZA).map((tipo) => (
                  <option key={tipo} value={tipo}>{TIPO_VACANZA_LABEL[tipo]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!form.nome.trim() || !form.dataInizio}
              className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </form>
        )}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map(({ year, month }) => {
          const grid = getMonthGrid(year, month)
          const label = MESI[month >= 8 ? month - 8 : month + 4]
          return (
            <div key={`${year}-${month}`} className="bg-surface rounded-sm border border-edge p-3">
              <h3 className="text-sm font-semibold text-fg mb-2 text-center">
                {label} {year}
              </h3>
              <div className="grid grid-cols-7 gap-px">
                {GIORNI_HDR.map((g, i) => (
                  <div key={i} className={`text-center text-[10px] font-semibold pb-1 ${i >= 5 ? 'text-fg-subtle' : 'text-fg-muted'}`}>
                    {g}
                  </div>
                ))}
                {grid.map((date, i) => {
                  if (!date) return <div key={`e-${i}`} />
                  const key = fmt(date)
                  const vac = vacanzeMap.get(key)
                  const isToday = key === today
                  const dow = date.getDay()
                  const isSunday = dow === 0
                  const colors = vac ? getColorFor(vac.tipo) : null

                  return (
                    <button
                      key={key}
                      onClick={() => !isSunday && handleDayClick(date)}
                      disabled={isSunday}
                      title={vac ? `${TIPO_VACANZA_LABEL[vac.tipo] || vac.tipo}${vac.dataInizio !== vac.dataFine ? ` — ${vac.nome}` : ''} (clicca per rimuovere)` : undefined}
                      className={`
                        relative aspect-square flex items-center justify-center text-xs rounded-sm transition-all
                        ${isSunday ? 'text-fg-subtle/40 cursor-default' : 'cursor-pointer'}
                        ${vac && !isSunday ? `${colors.bg} ${colors.text} font-semibold` : ''}
                        ${!vac && !isSunday ? 'text-fg-muted hover:bg-overlay' : ''}
                        ${isToday ? 'ring-1 ring-accent ring-offset-1' : ''}
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Multi-day periods list */}
      {periodi.length > 0 && (
        <div className="bg-surface rounded-sm border border-edge p-4">
          <h3 className="text-sm font-semibold text-fg mb-3">Periodi</h3>
          <div className="space-y-2">
            {periodi.map((v) => {
              const c = getColorFor(v.tipo)
              return (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${c.badge}`}>
                      {TIPO_VACANZA_LABEL[v.tipo] || v.tipo}
                    </span>
                    <span className="text-sm font-medium text-fg">{v.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-fg-muted font-mono">
                      {v.dataInizio} &rarr; {v.dataFine}
                    </span>
                    <button
                      onClick={() => handleDeletePeriodo(v.id)}
                      className="text-danger/60 hover:text-danger"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={clearConfirm}
        title="Svuota tutte le assenze"
        message={`Vuoi rimuovere tutte le ${vacanze.length} assenze dell'anno ${annoAttivo}?`}
        confirmText="Svuota tutte"
        danger
        onConfirm={handleClearAll}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  )
}
