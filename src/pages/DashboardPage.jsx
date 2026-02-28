import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  onLezioniSettimana,
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  onVacanze,
  updateLezione,
} from '../lib/firestore'
import { getWeekRange } from '../lib/settimane'
import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
  STATI_LEZIONE,
  GIORNI_LABEL,
  GIORNI_SHORT,
  ORE_ROMAN,
  TIPO_VACANZA_LABEL,
} from '../lib/costanti'
import { format, addDays, isToday, parseISO, startOfWeek, isBefore, isAfter } from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-100 text-blue-700',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-100 text-green-700',
  [STATO_LEZIONE.SALTATA]: 'bg-red-100 text-red-700',
}

const STATO_CELL = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-50/70',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-50/70',
  [STATO_LEZIONE.SALTATA]: 'bg-red-50/60',
}

const STATO_CELL_BORDER = {
  [STATO_LEZIONE.PIANIFICATA]: 'border-l-blue-400',
  [STATO_LEZIONE.SVOLTA]: 'border-l-green-500',
  [STATO_LEZIONE.SALTATA]: 'border-l-red-400',
}

export default function DashboardPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const toast = useToast()
  const [lezioni, setLezioni] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [percorsi, setPercorsi] = useState([])
  const [unitaMap, setUnitaMap] = useState({}) // unitaId -> { titolo, ... }
  const [vacanze, setVacanze] = useState([])
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
    unsubs.push(onVacanze(annoAttivo, setVacanze))
    unsubs.push(
      onPercorsi(annoAttivo, (all) => {
        setPercorsi(all)
      })
    )

    return () => unsubs.forEach((u) => u())
  }, [annoAttivo, weekOffset])

  // Load unita for percorsi referenced in lessons
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
    try {
      await updateLezione(lezioneId, { stato: nuovoStato })
    } catch (err) {
      console.error('Errore aggiornamento stato lezione:', err)
      toast.error('Errore nell\'aggiornamento dello stato della lezione')
    }
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
    const date = addDays(start, i)
    const dayStr = format(date, 'yyyy-MM-dd')
    const vacanza = vacanze.find((v) => dayStr >= v.dataInizio && dayStr <= v.dataFine) || null
    days.push({
      index: i,
      date,
      label: GIORNI_LABEL[i],
      short: GIORNI_SHORT[i],
      isFree: i === giornoLibero,
      vacanza,
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

  // ── Remaining hours calculation (precise, accounting for vacanze) ──
  let oreRimanentiPerClasse = null
  if (dataFineScuola && orari.length > 0) {
    const fineScuola = parseISO(dataFineScuola)
    const oggi = new Date()
    if (fineScuola > oggi) {
      // Unique classes
      const classiInOrario = [...new Set(orari.map((o) => `${o.classe}|${o.materia}`))]

      // Walk through weeks from today to end of school
      const orePerClasse = {}
      let current = startOfWeek(oggi, { weekStartsOn: 1 })

      while (isBefore(current, fineScuola)) {
        for (let d = 0; d < 6; d++) {
          if (d === giornoLibero) continue
          const day = addDays(current, d)
          if (isAfter(day, fineScuola)) continue

          // Check if this day is a vacation
          const isVacDay = vacanze.some((v) => {
            const vStart = parseISO(v.dataInizio)
            const vEnd = parseISO(v.dataFine)
            return !isBefore(day, vStart) && !isAfter(day, vEnd)
          })
          if (isVacDay) continue

          // Count orari for each class on this day
          const dayOrari = orari.filter((o) => o.giorno === d)
          for (const o of dayOrari) {
            const key = `${o.classe}|${o.materia}`
            orePerClasse[key] = (orePerClasse[key] || 0) + (o.ore || 1)
          }
        }
        current = addDays(current, 7)
      }

      oreRimanentiPerClasse = Object.entries(orePerClasse).map(([key, totaleOre]) => {
        const [classe, materia] = key.split('|')
        const oreSettimana = orari.filter(
          (o) => o.classe === classe && o.giorno !== giornoLibero
        ).reduce((s, o) => s + (o.ore || 1), 0)
        return { classe, materia, oreSettimana, totaleOre }
      }).sort((a, b) => a.classe.localeCompare(b.classe))
    }
  }

  // Fallback list data
  const lezioniPerGiorno = {}
  for (let i = 0; i < 6; i++) {
    const day = addDays(start, i)
    const dayStr = format(day, 'yyyy-MM-dd')
    const vacanza = vacanze.find((v) => dayStr >= v.dataInizio && dayStr <= v.dataFine) || null
    lezioniPerGiorno[dayStr] = { date: day, label: GIORNI_LABEL[i], lezioni: [], vacanza }
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
            {STATI_LEZIONE.map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); handleStatoChange(lez.id, s) }}
                className={`w-6 h-6 rounded text-[11px] font-bold leading-none flex items-center justify-center transition-colors ${
                  lez.stato === s
                    ? STATO_BADGE[s]
                    : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500'
                }`}
                title={STATO_LEZIONE_LABEL[s]}
              >
                {STATO_LEZIONE_SHORT[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Materia / titolo override */}
        <span className="text-[11px] text-gray-600 leading-tight truncate mt-0.5">
          {lez.titoloOverride || lez.materia}
        </span>

        {/* Row 3: Percorso + Unita (if linked) */}
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

      {/* ── Vista Oggi ── */}
      {weekOffset === 0 && (() => {
        const lezioniOggi = lezioni
          .filter((lez) => {
            const data = lez.data instanceof Date
              ? lez.data
              : lez.data?.toDate
                ? lez.data.toDate()
                : new Date(lez.data)
            return isToday(data)
          })
          .sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))
        const totale = lezioniOggi.length
        const svolte = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).length
        const daFare = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.PIANIFICATA).length

        return (
          <div className="mb-6 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100/60 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-lg font-bold">
                  Vista Oggi &mdash; {format(new Date(), 'EEEE d MMMM', { locale: it })}
                </h2>
              </div>
              {totale > 0 && (
                <span className="text-sm bg-blue-500/50 backdrop-blur px-3 py-1 rounded-full font-medium">
                  {totale} lezioni oggi, {svolte} svolte, {daFare} da fare
                </span>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {totale === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-10 h-10 mx-auto text-blue-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                  <p className="text-blue-600 font-medium text-base">Nessuna lezione oggi</p>
                  <p className="text-blue-400 text-sm mt-1">Buon riposo!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lezioniOggi.map((lez) => {
                    const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
                    const unita = lez.unitaId ? unitaMap[lez.unitaId] : null

                    return (
                      <div
                        key={lez.id}
                        className={`flex items-start gap-4 p-3.5 rounded-lg border bg-white/80 backdrop-blur-sm transition-all ${
                          lez.stato === STATO_LEZIONE.SVOLTA
                            ? 'border-green-300 bg-green-50/50'
                            : lez.stato === STATO_LEZIONE.SALTATA
                              ? 'border-red-300 bg-red-50/50'
                              : 'border-blue-200'
                        }`}
                      >
                        {/* Time */}
                        <div className="shrink-0 text-center min-w-[4.5rem]">
                          <div className="text-sm font-bold text-blue-700">{lez.oraInizio || '--:--'}</div>
                          <div className="text-xs text-blue-400">{lez.oraFine || ''}</div>
                        </div>

                        {/* Divider */}
                        <div className={`w-0.5 self-stretch rounded-full shrink-0 ${
                          lez.stato === STATO_LEZIONE.SVOLTA
                            ? 'bg-green-400'
                            : lez.stato === STATO_LEZIONE.SALTATA
                              ? 'bg-red-400'
                              : 'bg-blue-400'
                        }`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-base font-bold text-gray-900">{lez.classe}</span>
                            <span className="text-sm text-gray-500">&mdash;</span>
                            <span className="text-sm font-medium text-gray-700">{lez.titoloOverride || lez.materia}</span>
                          </div>
                          {percorso && (
                            <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-md w-fit max-w-full">
                              <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              <span className="text-sm font-semibold text-purple-700 truncate">{percorso.titolo}</span>
                              {unita && (
                                <>
                                  <span className="text-purple-300">/</span>
                                  <span className="text-sm text-purple-600 truncate">{unita.titolo}</span>
                                </>
                              )}
                            </div>
                          )}
                          {lez.note && (
                            <p className="text-xs text-gray-500 mt-1.5 italic leading-relaxed">
                              {lez.note}
                            </p>
                          )}
                        </div>

                        {/* Status buttons */}
                        <div className="flex gap-1 shrink-0 self-center">
                          {STATI_LEZIONE.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatoChange(lez.id, s)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                                lez.stato === s
                                  ? `${STATO_BADGE[s]} ring-2 ring-offset-1 ${
                                      s === STATO_LEZIONE.PIANIFICATA ? 'ring-blue-300' :
                                      s === STATO_LEZIONE.SVOLTA ? 'ring-green-300' :
                                      'ring-red-300'
                                    }`
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                              }`}
                              title={STATO_LEZIONE_LABEL[s]}
                            >
                              {STATO_LEZIONE_SHORT[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

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
                          day.vacanza ? 'bg-amber-50 text-amber-600' : today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="font-semibold">{day.short}</div>
                        <div className={`text-[11px] ${day.vacanza ? 'text-amber-500' : today ? 'text-blue-500' : 'text-gray-400'}`}>
                          {format(day.date, 'd MMM', { locale: it })}
                        </div>
                        {day.vacanza && (
                          <div className="text-[9px] text-amber-500 truncate max-w-[5rem] mx-auto" title={`${TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scolastico'}${day.vacanza.nome ? ': ' + day.vacanza.nome : ''}`}>
                            {TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scol.'}
                          </div>
                        )}
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
                            day.vacanza ? 'bg-amber-50/30' : today && !lez ? 'bg-blue-50/20' : ''
                          }`}
                          style={{ height: '5.5rem' }}
                        >
                          {lez ? (
                            <div className={day.vacanza ? 'opacity-40 line-through' : ''}>
                              {renderCell(lez)}
                            </div>
                          ) : null}
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
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" /> {STATO_LEZIONE_SHORT[STATO_LEZIONE.PIANIFICATA]} = {STATO_LEZIONE_LABEL[STATO_LEZIONE.PIANIFICATA]}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-200" /> {STATO_LEZIONE_SHORT[STATO_LEZIONE.SVOLTA]} = {STATO_LEZIONE_LABEL[STATO_LEZIONE.SVOLTA]}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> {STATO_LEZIONE_SHORT[STATO_LEZIONE.SALTATA]} = {STATO_LEZIONE_LABEL[STATO_LEZIONE.SALTATA]}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1 h-2.5 rounded-sm bg-purple-400" /> = Percorso collegato
            </span>
            {giornoLibero !== null && (
              <span className="ml-auto text-gray-400 italic">
                {GIORNI_LABEL[giornoLibero]}: giorno libero
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── Fallback: list view ── */
        <div className="space-y-4 mb-6">
          {Object.values(lezioniPerGiorno).map(({ date, label, lezioni: dayLezioni, vacanza }) => (
            <div key={label}>
              <h3
                className={`text-sm font-semibold mb-2 ${
                  vacanza ? 'text-amber-600' : isToday(date) ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {label} {format(date, 'd MMM', { locale: it })}
                {isToday(date) && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Oggi
                  </span>
                )}
                {vacanza && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {TIPO_VACANZA_LABEL[vacanza.tipo] || 'Non scolastico'}{vacanza.nome ? ` — ${vacanza.nome}` : ''}
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
                          vacanza
                            ? 'bg-gray-50 border-gray-200 opacity-50'
                            : lez.stato === STATO_LEZIONE.PIANIFICATA ? 'bg-blue-50 border-blue-200' :
                              lez.stato === STATO_LEZIONE.SVOLTA ? 'bg-green-50 border-green-200' :
                              'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-mono w-12 shrink-0 ${vacanza ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                            {lez.oraInizio}
                          </span>
                          <span className={`text-sm font-bold w-12 shrink-0 ${vacanza ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
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
                          <div className="flex items-center gap-1.5">
                            {STATI_LEZIONE.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatoChange(lez.id, s)}
                                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors min-w-[2rem] ${
                                  lez.stato === s
                                    ? STATO_BADGE[s]
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {STATO_LEZIONE_SHORT[s]}
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
            {oreRimanentiPerClasse.map(({ classe, materia, oreSettimana, totaleOre }) => (
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
                    {oreSettimana}h/sett (vacanze escluse)
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
