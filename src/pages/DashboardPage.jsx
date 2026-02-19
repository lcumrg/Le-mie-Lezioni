import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { onLezioniSettimana, onAssegnazioni } from '../lib/firestore'
import { getCurrentWeekRange, getWeekRange } from '../lib/settimane'
import { format, addDays, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

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

export default function DashboardPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const [lezioni, setLezioni] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const { start, end } = getWeekRange(weekOffset)

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

  // Group lessons by day
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

  // Sort each day's lessons by time
  for (const day of Object.values(lezioniPerGiorno)) {
    day.lezioni.sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))
  }

  const weekLabel = `${format(start, 'd MMM', { locale: it })} - ${format(end, 'd MMM yyyy', { locale: it })}`

  return (
    <div className="max-w-5xl mx-auto">
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

      {/* Weekly grid */}
      <div className="space-y-4">
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
