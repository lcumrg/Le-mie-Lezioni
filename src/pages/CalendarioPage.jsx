import { useEffect, useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  onLezioniSettimana,
  onOrari,
  onAssegnazioni,
  addLezione,
  updateLezione,
  deleteLezione,
} from '../lib/firestore'
import { getWeekRange } from '../lib/settimane'
import { format, addDays, isToday, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import LoadingSpinner from '../components/common/LoadingSpinner'

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

const STATO_COLORS = {
  pianificata: 'bg-blue-50 border-blue-200',
  svolta: 'bg-green-50 border-green-200',
  saltata: 'bg-red-50 border-red-200',
}

const STATO_BADGE = {
  pianificata: 'bg-blue-100 text-blue-700',
  svolta: 'bg-green-100 text-green-700',
  saltata: 'bg-red-100 text-red-700',
}

export default function CalendarioPage() {
  const { annoAttivo, loading: configLoading } = useApp()
  const [lezioni, setLezioni] = useState([])
  const [orari, setOrari] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingLezione, setEditingLezione] = useState(null)

  const { start, end } = getWeekRange(weekOffset)

  useEffect(() => {
    if (!annoAttivo) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub1 = onLezioniSettimana(annoAttivo, start, end, (data) => {
      setLezioni(data)
      setLoading(false)
    })
    const unsub2 = onOrari(annoAttivo, setOrari)
    const unsub3 = onAssegnazioni(annoAttivo, setAssegnazioni)

    return () => { unsub1(); unsub2(); unsub3() }
  }, [annoAttivo, weekOffset])

  // Build day structure
  const giorniSettimana = useMemo(() => {
    const days = []
    for (let i = 0; i < 6; i++) {
      const date = addDays(start, i)
      const dayStr = format(date, 'yyyy-MM-dd')

      // Lessons for this day
      const dayLezioni = lezioni
        .filter((lez) => {
          const d = lez.data instanceof Date
            ? lez.data
            : lez.data?.toDate
              ? lez.data.toDate()
              : new Date(lez.data)
          return format(d, 'yyyy-MM-dd') === dayStr
        })
        .sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))

      // Expected slots from timetable for this day-of-week
      const expectedSlots = orari
        .filter((o) => o.giorno === i)
        .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio))

      days.push({ index: i, date, dayStr, label: GIORNI[i], lezioni: dayLezioni, expectedSlots })
    }
    return days
  }, [start, lezioni, orari])

  // Generate lessons from timetable for the current week
  async function handleGenerate() {
    if (!annoAttivo || orari.length === 0) return
    setGenerating(true)

    const existingKeys = new Set(
      lezioni.map((l) => {
        const d = l.data instanceof Date
          ? l.data
          : l.data?.toDate
            ? l.data.toDate()
            : new Date(l.data)
        return `${format(d, 'yyyy-MM-dd')}_${l.oraInizio}_${l.classe}`
      })
    )

    const promises = []
    for (let i = 0; i < 6; i++) {
      const date = addDays(start, i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const slotsForDay = orari.filter((o) => o.giorno === i)

      for (const slot of slotsForDay) {
        const key = `${dayStr}_${slot.oraInizio}_${slot.classe}`
        if (existingKeys.has(key)) continue

        promises.push(
          addLezione({
            annoScolastico: annoAttivo,
            data: Timestamp.fromDate(startOfDay(date)),
            giorno: i,
            oraInizio: slot.oraInizio,
            oraFine: slot.oraFine,
            classe: slot.classe,
            materia: slot.materia,
            ore: slot.ore,
            stato: 'pianificata',
            note: '',
            titoloOverride: '',
          })
        )
      }
    }

    await Promise.all(promises)
    setGenerating(false)
  }

  // Update lesson status
  async function handleStatoChange(lezioneId, nuovoStato) {
    await updateLezione(lezioneId, { stato: nuovoStato })
  }

  // Save edited lesson
  async function handleSaveEdit() {
    if (!editingLezione) return
    const { id, note, titoloOverride, stato } = editingLezione
    await updateLezione(id, { note, titoloOverride, stato })
    setEditingLezione(null)
  }

  // Delete lesson
  async function handleDeleteLezione(id) {
    await deleteLezione(id)
    if (editingLezione?.id === id) setEditingLezione(null)
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Calendario</h2>
        <p className="text-gray-500">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  const weekLabel = `${format(start, 'd MMM', { locale: it })} – ${format(end, 'd MMM yyyy', { locale: it })}`

  const hasOrari = orari.length > 0
  const weekHasLezioni = lezioni.length > 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
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

      {/* Generate button */}
      {hasOrari && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generazione...' : 'Genera lezioni da orario'}
          </button>
          {weekHasLezioni && (
            <span className="text-sm text-gray-500">
              {lezioni.length} lezioni questa settimana
            </span>
          )}
        </div>
      )}

      {!hasOrari && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Definisci prima il tuo orario settimanale nelle <strong>Impostazioni</strong> per poter generare le lezioni automaticamente.
          </p>
        </div>
      )}

      {/* Weekly grid */}
      <div className="space-y-4">
        {giorniSettimana.map(({ index, date, label, lezioni: dayLezioni, expectedSlots }) => (
          <div key={index}>
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

            {dayLezioni.length === 0 && expectedSlots.length === 0 ? (
              <p className="text-sm text-gray-400 pl-2">Nessuna lezione</p>
            ) : dayLezioni.length === 0 && expectedSlots.length > 0 ? (
              <p className="text-sm text-gray-400 pl-2 italic">
                {expectedSlots.length} slot dall'orario — clicca "Genera lezioni" per crearle
              </p>
            ) : (
              <div className="space-y-2">
                {dayLezioni.map((lez) => (
                  <div
                    key={lez.id}
                    className={`p-3 rounded-lg border ${STATO_COLORS[lez.stato] || 'bg-white border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-500 w-24 shrink-0">
                        {lez.oraInizio} – {lez.oraFine}
                      </span>
                      <span className="text-sm font-bold text-gray-800 w-12 shrink-0">
                        {lez.classe}
                      </span>
                      <span className="text-sm text-gray-600 flex-1">
                        {lez.titoloOverride || lez.materia}
                      </span>
                      <span className="text-xs text-gray-400">{lez.ore}h</span>

                      {/* Quick status buttons */}
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

                      {/* Edit button */}
                      <button
                        onClick={() =>
                          setEditingLezione(
                            editingLezione?.id === lez.id
                              ? null
                              : { id: lez.id, note: lez.note || '', titoloOverride: lez.titoloOverride || '', stato: lez.stato }
                          )
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>

                    {/* Note preview */}
                    {lez.note && editingLezione?.id !== lez.id && (
                      <p className="mt-1 text-xs text-gray-500 pl-24 italic">{lez.note}</p>
                    )}

                    {/* Edit panel */}
                    {editingLezione?.id === lez.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Titolo/argomento
                          </label>
                          <input
                            type="text"
                            value={editingLezione.titoloOverride}
                            onChange={(e) =>
                              setEditingLezione((p) => ({ ...p, titoloOverride: e.target.value }))
                            }
                            placeholder={lez.materia}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Note
                          </label>
                          <textarea
                            value={editingLezione.note}
                            onChange={(e) =>
                              setEditingLezione((p) => ({ ...p, note: e.target.value }))
                            }
                            rows={2}
                            placeholder="Appunti sulla lezione..."
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                          >
                            Salva
                          </button>
                          <button
                            onClick={() => setEditingLezione(null)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                          >
                            Annulla
                          </button>
                          <button
                            onClick={() => handleDeleteLezione(lez.id)}
                            className="ml-auto px-3 py-1.5 text-red-600 text-xs font-medium hover:bg-red-50 rounded-lg"
                          >
                            Elimina lezione
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-4 text-xs text-gray-500">
        <span>Stato:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-200" /> P = Pianificata
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-200" /> S = Svolta
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-200" /> X = Saltata
        </span>
      </div>
    </div>
  )
}
