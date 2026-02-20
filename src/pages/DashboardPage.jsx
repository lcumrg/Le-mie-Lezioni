import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { onLezioniSettimana, onAssegnazioni } from '../lib/firestore'
import { getCurrentWeekRange, getWeekRange } from '../lib/settimane'
import { format, addDays, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const ORE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const STATO_COLORS = {
  pianificata: 'bg-blue-50 border-blue-200 text-blue-800',
  svolta: 'bg-green-50 border-green-200 text-green-800',
  saltata: 'bg-red-50 border-red-200 text-red-800',
}

const STATO_BADGE = {
  pianificata: 'bg-blue-100 text-blue-700',
  svolta: 'bg-green-100 text-green-700',
  saltata: 'bg-red-100 text-red-700',
}

const STATO_CELL = {
  pianificata: 'bg-blue-50 border-blue-200',
  svolta: 'bg-green-50 border-green-200',
  saltata: 'bg-red-50 border-red-200',
}

export default function DashboardPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const [lezioni, setLezioni] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const { start, end } = getWeekRange(weekOffset)

  // School hours config
  const oreLezione = annoConfig?.oreLezione || []
  const giornoLibero = annoConfig?.giornoLibero ?? null
  const hasOreConfig = oreLezione.length > 0

  useEffect(() => {
    if (!annoAttivo) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubLezioni = onLezioniSettimana(annoAttivo, start, end, (data) => {
      setLezioni(data)
      setLoading(false)
    })

    const unsubAssegnazioni = onAssegnazioni(annoAttivo, (data) => {
      setAssegnazioni(data.filter((a) => a.attiva && !a.archiviata))
    })

    return () => {
      unsubLezioni()
      unsubAssegnazioni()
    }
  }, [annoAttivo, weekOffset])

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Benvenuto!</h2>
        <p className="text-gray-500">
          Configura l'anno scolastico per iniziare. Vai nelle impostazioni per aggiungere
          la configurazione iniziale.
        </p>
      </div>
    )
  }

  // ── Build days structure ──
  const days = []
  for (let i = 0; i < 6; i++) {
    days.push({
      index: i,
      date: addDays(start, i),
      label: GIORNI[i],
      short: GIORNI_SHORT[i],
      isFree: i === giornoLibero,
    })
  }

  // ── Map lessons to period number ──
  function getNumeroOra(lez) {
    if (lez.numeroOra) return lez.numeroOra
    // Fallback: match by start time
    const match = oreLezione.find((o) => o.inizio === lez.oraInizio)
    return match ? match.numero : null
  }

  // Build lesson lookup: dayIndex -> numeroOra -> lesson
  const lessonGrid = {}
  for (const lez of lezioni) {
    const data = lez.data instanceof Date
      ? lez.data
      : lez.data?.toDate
        ? lez.data.toDate()
        : new Date(lez.data)
    const dayStr = format(data, 'yyyy-MM-dd')

    for (let i = 0; i < 6; i++) {
      const dayDate = addDays(start, i)
      if (format(dayDate, 'yyyy-MM-dd') === dayStr) {
        const numOra = getNumeroOra(lez)
        if (numOra) {
          const key = `${i}_${numOra}`
          lessonGrid[key] = lez
        }
        break
      }
    }
  }

  // Group lessons by day for fallback list view
  const lezioniPerGiorno = {}
  for (let i = 0; i < 6; i++) {
    const day = addDays(start, i)
    const dayStr = format(day, 'yyyy-MM-dd')
    lezioniPerGiorno[dayStr] = {
      date: day,
      label: GIORNI[i],
      lezioni: [],
    }
  }
  for (const lez of lezioni) {
    const data = lez.data instanceof Date
      ? lez.data
      : lez.data?.toDate
        ? lez.data.toDate()
        : new Date(lez.data)
    const dayStr = format(data, 'yyyy-MM-dd')
    if (lezioniPerGiorno[dayStr]) {
      lezioniPerGiorno[dayStr].lezioni.push(lez)
    }
  }
  for (const day of Object.values(lezioniPerGiorno)) {
    day.lezioni.sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))
  }

  const weekLabel = `${format(start, 'd MMM', { locale: it })} - ${format(end, 'd MMM yyyy', { locale: it })}`

  return (
    <div className="max-w-6xl mx-auto">
      {/* Week header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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
            className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-200 text-gray-700"
          >
            Oggi
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
      </div>

      {/* ── Timetable Grid (when ore config exists) ── */}
      {hasOreConfig ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-16 px-2 py-3 bg-gray-50 border-b border-r border-gray-200 text-xs text-gray-500 font-medium">
                    Ora
                  </th>
                  {days.map((day) => {
                    if (day.isFree) return null
                    const today = isToday(day.date)
                    return (
                      <th
                        key={day.index}
                        className={`px-2 py-3 border-b border-r border-gray-200 text-center text-xs font-medium last:border-r-0 ${
                          today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="font-semibold">{day.short}</div>
                        <div className={`text-[11px] ${today ? 'text-blue-500' : 'text-gray-400'}`}>
                          {format(day.date, 'd MMM', { locale: it })}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {oreLezione.map((ora) => (
                  <tr key={ora.numero}>
                    {/* Period label */}
                    <td className="px-2 py-1 border-b border-r border-gray-200 bg-gray-50 text-center align-middle">
                      <div className="font-semibold text-sm text-gray-700">
                        {ORE_ROMAN[ora.numero - 1]}
                      </div>
                      <div className="text-[10px] text-gray-400 leading-tight">
                        {ora.inizio}
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      if (day.isFree) return null
                      const key = `${day.index}_${ora.numero}`
                      const lez = lessonGrid[key]
                      const today = isToday(day.date)

                      if (!lez) {
                        return (
                          <td
                            key={day.index}
                            className={`px-2 py-1 border-b border-r border-gray-200 last:border-r-0 h-16 ${
                              today ? 'bg-blue-50/30' : ''
                            }`}
                          />
                        )
                      }

                      return (
                        <td
                          key={day.index}
                          className={`px-2 py-1 border-b border-r border-gray-200 last:border-r-0 h-16 ${
                            STATO_CELL[lez.stato] || ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center h-full gap-0.5">
                            <span className="text-sm font-bold text-gray-800 leading-tight">
                              {lez.classe}
                            </span>
                            <span className="text-[11px] text-gray-500 leading-tight text-center truncate max-w-full">
                              {lez.titoloOverride || lez.materia}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${
                                STATO_BADGE[lez.stato] || ''
                              }`}
                            >
                              {lez.stato === 'pianificata' ? 'P' : lez.stato === 'svolta' ? 'S' : 'X'}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" /> Pianificata
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-200" /> Svolta
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> Saltata
            </span>
            {giornoLibero !== null && (
              <span className="ml-auto text-gray-400 italic">
                {GIORNI[giornoLibero]}: giorno libero
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── Fallback: list view (no ore config) ── */
        <div className="space-y-4 mb-8">
          {Object.values(lezioniPerGiorno).map(({ date, label, lezioni: dayLezioni }) => (
            <div key={label}>
              <h3
                className={`text-sm font-semibold mb-2 ${
                  isToday(date) ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {label} {format(date, 'd MMM', { locale: it })}
                {isToday(date) && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Oggi
                  </span>
                )}
              </h3>

              {dayLezioni.length === 0 ? (
                <p className="text-sm text-gray-400 pl-2">Nessuna lezione</p>
              ) : (
                <div className="space-y-2">
                  {dayLezioni.map((lez) => (
                    <div
                      key={lez.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${STATO_COLORS[lez.stato] || 'bg-white border-gray-200'}`}
                    >
                      <span className="text-sm font-mono text-gray-500 w-12 shrink-0">
                        {lez.oraInizio}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 w-12 shrink-0">
                        {lez.classe}
                      </span>
                      <span className="text-sm text-gray-600 flex-1">
                        {lez.titoloOverride || lez.materia}
                      </span>
                      <span className="text-xs text-gray-400">{lez.ore}h</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATO_BADGE[lez.stato] || ''}`}
                      >
                        {lez.stato}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active assignments progress */}
      {assegnazioni.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Percorsi attivi</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {assegnazioni.map((a) => {
              const progresso = a.progresso || {}
              const totale = Object.keys(progresso).length
              const completate = Object.values(progresso).filter(
                (p) => p.stato === 'completata'
              ).length
              const pct = totale > 0 ? Math.round((completate / totale) * 100) : 0

              return (
                <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {a.classe} — {a.materia}
                    </span>
                    <span className="text-xs text-gray-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
