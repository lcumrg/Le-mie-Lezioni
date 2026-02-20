import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  onLezioniSettimana,
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  updateLezione,
} from '../lib/firestore'
import { getWeekRange } from '../lib/settimane'
import { format, addDays, isToday, differenceInCalendarWeeks, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const ORE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const STATO_BADGE = {
  pianificata: 'bg-blue-100 text-blue-700',
  svolta: 'bg-green-100 text-green-700',
  saltata: 'bg-red-100 text-red-700',
}

const STATO_CELL = {
  pianificata: 'bg-blue-50/70',
  svolta: 'bg-green-50/70',
  saltata: 'bg-red-50/60',
}

const STATO_CELL_BORDER = {
  pianificata: 'border-l-blue-400',
  svolta: 'border-l-green-500',
  saltata: 'border-l-red-400',
}

export default function DashboardPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const [lezioni, setLezioni] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [percorsi, setPercorsi] = useState([])
  const [unitaMap, setUnitaMap] = useState({}) // unitaId -> { titolo, ... }
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const { start, end } = getWeekRange(weekOffset)

  // School hours config
  const oreLezione = annoConfig?.oreLezione || []
  const giornoLibero = annoConfig?.giornoLibero ?? null
  const dataFineScuola = annoConfig?.dataFineScuola || null
  const hasOreConfig = oreLezione.length > 0

  // Load data
  useEffect(() => {
    if (!annoAttivo) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubs = []

    unsubs.push(
      onLezioniSettimana(annoAttivo, start, end, (data) => {
        setLezioni(data)
        setLoading(false)
      })
    )
    unsubs.push(
      onAssegnazioni(annoAttivo, (data) => {
        setAssegnazioni(data.filter((a) => a.attiva && !a.archiviata))
      })
    )
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(
      onPercorsi((all) => {
        setPercorsi(all.filter((p) => p.annoScolastico === annoAttivo))
      })
    )

    return () => unsubs.forEach((u) => u())
  }, [annoAttivo, weekOffset])

  // Load unità for percorsi referenced in lessons
  useEffect(() => {
    const percorsoIds = [...new Set(lezioni.filter((l) => l.percorsoId).map((l) => l.percorsoId))]
    if (percorsoIds.length === 0) return

    const unsubs = []
    for (const pId of percorsoIds) {
      unsubs.push(
        onUnita(pId, (units) => {
          setUnitaMap((prev) => {
            const next = { ...prev }
            for (const u of units) {
              next[u.id] = u
            }
            return next
          })
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [lezioni.map((l) => l.percorsoId).filter(Boolean).join(',')])

  // Status change handler
  async function handleStatoChange(lezioneId, nuovoStato) {
    await updateLezione(lezioneId, { stato: nuovoStato })
  }

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
    const match = oreLezione.find((o) => o.inizio === lez.oraInizio)
    return match ? match.numero : null
  }

  // Build lesson lookup: "dayIndex_numeroOra" -> lesson
  const lessonGrid = {}
  for (const lez of lezioni) {
    const data = lez.data instanceof Date
      ? lez.data
      : lez.data?.toDate
        ? lez.data.toDate()
        : new Date(lez.data)
    const dayStr = format(data, 'yyyy-MM-dd')

    for (let i = 0; i < 6; i++) {
      if (format(addDays(start, i), 'yyyy-MM-dd') === dayStr) {
        const numOra = getNumeroOra(lez)
        if (numOra) lessonGrid[`${i}_${numOra}`] = lez
        break
      }
    }
  }

  // ── Percorso lookup ──
  const percorsoMap = {}
  for (const p of percorsi) percorsoMap[p.id] = p

  // ── Remaining hours calculation ──
  let oreRimanentiPerClasse = null
  if (dataFineScuola && orari.length > 0) {
    const fineScuola = parseISO(dataFineScuola)
    const oggi = new Date()
    if (fineScuola > oggi) {
      const settimaneRimanenti = differenceInCalendarWeeks(fineScuola, oggi, { weekStartsOn: 1 }) + 1

      // Count weekly hours per class (excluding giorno libero)
      const orePerClasse = {}
      for (const o of orari) {
        if (o.giorno === giornoLibero) continue
        const key = `${o.classe}|${o.materia}`
        orePerClasse[key] = (orePerClasse[key] || 0) + (o.ore || 1)
      }

      oreRimanentiPerClasse = Object.entries(orePerClasse).map(([key, oreSettimana]) => {
        const [classe, materia] = key.split('|')
        return {
          classe,
          materia,
          oreSettimana,
          settimaneRimanenti,
          totaleOre: oreSettimana * settimaneRimanenti,
        }
      }).sort((a, b) => a.classe.localeCompare(b.classe))
    }
  }

  // Fallback list data
  const lezioniPerGiorno = {}
  for (let i = 0; i < 6; i++) {
    const day = addDays(start, i)
    const dayStr = format(day, 'yyyy-MM-dd')
    lezioniPerGiorno[dayStr] = { date: day, label: GIORNI[i], lezioni: [] }
  }
  for (const lez of lezioni) {
    const data = lez.data instanceof Date
      ? lez.data
      : lez.data?.toDate ? lez.data.toDate() : new Date(lez.data)
    const dayStr = format(data, 'yyyy-MM-dd')
    if (lezioniPerGiorno[dayStr]) lezioniPerGiorno[dayStr].lezioni.push(lez)
  }
  for (const day of Object.values(lezioniPerGiorno)) {
    day.lezioni.sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))
  }

  const weekLabel = `${format(start, 'd MMM', { locale: it })} - ${format(end, 'd MMM yyyy', { locale: it })}`

  // ── Render cell content ──
  function renderCell(lez) {
    const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
    const unita = lez.unitaId ? unitaMap[lez.unitaId] : null

    return (
      <div className={`h-full flex flex-col border-l-3 rounded-sm px-1.5 py-1 ${STATO_CELL[lez.stato] || ''} ${STATO_CELL_BORDER[lez.stato] || 'border-l-gray-300'}`}>
        {/* Row 1: Classe + status buttons */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-gray-800 leading-none">
            {lez.classe}
          </span>
          <div className="flex gap-0.5">
            {['pianificata', 'svolta', 'saltata'].map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); handleStatoChange(lez.id, s) }}
                className={`w-5 h-5 rounded text-[10px] font-bold leading-none flex items-center justify-center transition-colors ${
                  lez.stato === s
                    ? STATO_BADGE[s]
                    : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500'
                }`}
                title={s.charAt(0).toUpperCase() + s.slice(1)}
              >
                {s === 'pianificata' ? 'P' : s === 'svolta' ? 'S' : 'X'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Materia / titolo override */}
        <span className="text-[11px] text-gray-600 leading-tight truncate mt-0.5">
          {lez.titoloOverride || lez.materia}
        </span>

        {/* Row 3: Percorso + Unità (if linked) */}
        {percorso && (
          <div className="mt-auto pt-0.5">
            <div className="text-[10px] leading-tight text-purple-700 font-semibold truncate">
              {percorso.titolo}
            </div>
            {unita && (
              <div className="text-[10px] leading-tight text-purple-500 truncate">
                {unita.titolo}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

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

      {/* ── Timetable Grid ── */}
      {hasOreConfig ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '640px' }}>
              <thead>
                <tr>
                  <th className="w-14 px-1 py-3 bg-gray-50 border-b border-r border-gray-200 text-xs text-gray-500 font-medium">
                    Ora
                  </th>
                  {days.map((day) => {
                    if (day.isFree) return null
                    const today = isToday(day.date)
                    return (
                      <th
                        key={day.index}
                        className={`px-1 py-3 border-b border-r border-gray-200 text-center text-xs font-medium last:border-r-0 ${
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
                    <td className="px-1 py-0.5 border-b border-r border-gray-200 bg-gray-50 text-center align-middle">
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

                      return (
                        <td
                          key={day.index}
                          className={`border-b border-r border-gray-200 last:border-r-0 p-0.5 align-top ${
                            today && !lez ? 'bg-blue-50/20' : ''
                          }`}
                          style={{ height: '5.5rem' }}
                        >
                          {lez ? renderCell(lez) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" /> P = Pianificata
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-200" /> S = Svolta
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> X = Saltata
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1 h-2.5 rounded-sm bg-purple-400" /> = Percorso collegato
            </span>
            {giornoLibero !== null && (
              <span className="ml-auto text-gray-400 italic">
                {GIORNI[giornoLibero]}: giorno libero
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── Fallback: list view ── */
        <div className="space-y-4 mb-6">
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
                  {dayLezioni.map((lez) => {
                    const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
                    const unita = lez.unitaId ? unitaMap[lez.unitaId] : null
                    return (
                      <div
                        key={lez.id}
                        className={`p-3 rounded-lg border ${
                          lez.stato === 'pianificata' ? 'bg-blue-50 border-blue-200' :
                          lez.stato === 'svolta' ? 'bg-green-50 border-green-200' :
                          'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-500 w-12 shrink-0">
                            {lez.oraInizio}
                          </span>
                          <span className="text-sm font-bold text-gray-800 w-12 shrink-0">
                            {lez.classe}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-600 block truncate">
                              {lez.titoloOverride || lez.materia}
                            </span>
                            {percorso && (
                              <span className="text-xs text-purple-600">
                                {percorso.titolo}
                                {unita && <span className="text-purple-400"> / {unita.titolo}</span>}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {['pianificata', 'svolta', 'saltata'].map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatoChange(lez.id, s)}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                                  lez.stato === s
                                    ? STATO_BADGE[s]
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {s === 'pianificata' ? 'P' : s === 'svolta' ? 'S' : 'X'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Ore rimanenti ── */}
      {oreRimanentiPerClasse && oreRimanentiPerClasse.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Ore rimanenti fino al {format(parseISO(dataFineScuola), 'd MMMM yyyy', { locale: it })}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {oreRimanentiPerClasse.map(({ classe, materia, oreSettimana, settimaneRimanenti, totaleOre }) => (
              <div
                key={`${classe}_${materia}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div>
                  <span className="text-sm font-bold text-gray-800">{classe}</span>
                  <span className="text-sm text-gray-500 ml-1.5">{materia}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-600">{totaleOre}</span>
                  <span className="text-xs text-gray-400 ml-0.5">h</span>
                  <div className="text-[10px] text-gray-400 leading-tight">
                    {oreSettimana}h/sett &times; {settimaneRimanenti} sett
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hint if no dataFineScuola ── */}
      {!dataFineScuola && orari.length > 0 && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            Imposta l'<strong>ultimo giorno di scuola</strong> nelle Impostazioni per vedere il calcolo delle ore rimanenti per ogni classe.
          </p>
        </div>
      )}

      {/* ── Active assignments progress ── */}
      {assegnazioni.length > 0 && (
        <div>
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
