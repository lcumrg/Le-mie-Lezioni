import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  onLezioniSettimana,
  onOrari,
  onPercorsi,
  onUnita,
  onVacanze,
  onRicorrenze,
  addLezione,
  updateLezione,
} from '../lib/firestore'
import { getDayRange } from '../lib/settimane'
import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
  STATI_LEZIONE,
  GIORNI_LABEL,
  TIPO_VACANZA_LABEL,
} from '../lib/costanti'
import { format, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import LoadingSpinner from '../components/common/LoadingSpinner'
import QuickNote from '../components/common/QuickNote'
import PercorsoSelector from '../components/calendario/PercorsoSelector'

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p text-link',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s text-accent',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x text-danger',
}

export default function OggiPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const toast = useToast()
  const navigate = useNavigate()

  const [lezioni, setLezioni] = useState([])
  const [updatingLezioni, setUpdatingLezioni] = useState(new Set())
  const [orari, setOrari] = useState([])
  const [percorsi, setPercorsi] = useState([])
  const [unitaMap, setUnitaMap] = useState({})
  const [vacanze, setVacanze] = useState([])
  const [ricorrenze, setRicorrenze] = useState({})
  const [dayOffset, setDayOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingPercorso, setEditingPercorso] = useState(null) // lezioneId being edited

  const { start, end } = getDayRange(dayOffset)
  const giornoLibero = annoConfig?.giornoLibero ?? null

  // Day info
  const dayDate = start
  const dayStr = format(dayDate, 'yyyy-MM-dd')
  const dayIndex = dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1 // Mon=0..Sat=5, Sun=6
  const dayLabel = format(dayDate, 'EEEE d MMMM yyyy', { locale: it })

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
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(onPercorsi(annoAttivo, setPercorsi))
    unsubs.push(onVacanze(annoAttivo, setVacanze))
    unsubs.push(onRicorrenze(setRicorrenze))

    return () => unsubs.forEach((u) => u())
  }, [annoAttivo, dayOffset])

  // Load unita for referenced percorsi
  useEffect(() => {
    const percorsoIds = [...new Set(lezioni.filter((l) => l.percorsoId).map((l) => l.percorsoId))]
    if (percorsoIds.length === 0) return

    const unsubs = []
    for (const pId of percorsoIds) {
      unsubs.push(
        onUnita(pId, (units) => {
          setUnitaMap((prev) => {
            const next = { ...prev }
            for (const u of units) next[u.id] = u
            return next
          })
        })
      )
    }
    return () => unsubs.forEach((u) => u())
  }, [lezioni.map((l) => l.percorsoId).filter(Boolean).join(',')])

  // Sort lessons by time
  const lezioniOggi = lezioni.sort((a, b) => (a.oraInizio || '').localeCompare(b.oraInizio || ''))

  // Stats
  const totale = lezioniOggi.length
  const svolte = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).length
  const daFare = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.PIANIFICATA).length
  const saltate = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.SALTATA).length
  const progressPct = totale > 0 ? Math.round((svolte / totale) * 100) : 0

  // Vacation check
  const vacanza = vacanze.find((v) => dayStr >= v.dataInizio && dayStr <= v.dataFine) || null

  // Slots from timetable for this day
  const slotsOggi = orari.filter((o) => o.giorno === dayIndex)

  // Check if we should show auto-generate banner
  const hasUngenerated = slotsOggi.length > 0 && totale === 0 && !vacanza && dayIndex !== giornoLibero

  // Percorso lookup
  const percorsoMap = {}
  for (const p of percorsi) percorsoMap[p.id] = p

  // Is the current time within a lesson's time range?
  function isLezioneInCorso(lez) {
    if (dayOffset !== 0) return false
    const now = new Date()
    const nowStr = format(now, 'HH:mm')
    return lez.oraInizio && lez.oraFine && nowStr >= lez.oraInizio && nowStr < lez.oraFine
  }

  // Status change handler (same pattern as Dashboard)
  async function handleStatoChange(lezioneId, nuovoStato) {
    const prevStato = lezioni.find((l) => l.id === lezioneId)?.stato
    setUpdatingLezioni((prev) => new Set(prev).add(lezioneId))
    try {
      await updateLezione(lezioneId, { stato: nuovoStato })
      if (prevStato && prevStato !== nuovoStato) {
        toast.action('Stato aggiornato', {
          label: 'Annulla',
          onClick: () => updateLezione(lezioneId, { stato: prevStato }),
        })
      }
    } catch (err) {
      console.error('Errore aggiornamento stato lezione:', err)
      toast.error("Errore nell'aggiornamento dello stato della lezione")
    } finally {
      setUpdatingLezioni((prev) => { const s = new Set(prev); s.delete(lezioneId); return s })
    }
  }

  // Generate lessons for this day only
  async function handleGenerate() {
    if (!annoAttivo || slotsOggi.length === 0) return
    setGenerating(true)

    const existingKeys = new Set(
      lezioni.map((l) => `${dayStr}_${l.oraInizio}_${l.classe}`)
    )

    const promises = []
    for (const slot of slotsOggi) {
      const key = `${dayStr}_${slot.oraInizio}_${slot.classe}`
      if (existingKeys.has(key)) continue

      // Check ricorrenza
      const classeRic = ricorrenze[slot.classe] || {}
      const ricKey = `${dayIndex}-${slot.numeroOra || 0}`
      const ric = classeRic[ricKey]

      promises.push(
        addLezione({
          annoScolastico: annoAttivo,
          data: Timestamp.fromDate(startOfDay(dayDate)),
          giorno: dayIndex,
          numeroOra: slot.numeroOra || null,
          oraInizio: slot.oraInizio,
          oraFine: slot.oraFine,
          classe: slot.classe,
          materia: slot.materia,
          ore: slot.ore,
          stato: STATO_LEZIONE.PIANIFICATA,
          note: '',
          titoloOverride: '',
          ...(ric?.percorsoId ? { percorsoId: ric.percorsoId } : {}),
        })
      )
    }

    try {
      await Promise.all(promises)
      if (promises.length > 0) {
        toast.success(`${promises.length} lezioni generate`)
      }
    } catch {
      toast.error('Errore durante la generazione delle lezioni.')
    }
    setGenerating(false)
  }

  // Mark all pianificate as svolte
  async function handleMarkAllSvolte() {
    const pianificate = lezioniOggi.filter((l) => l.stato === STATO_LEZIONE.PIANIFICATA)
    if (pianificate.length === 0) return
    try {
      await Promise.all(pianificate.map((l) => updateLezione(l.id, { stato: STATO_LEZIONE.SVOLTA })))
      toast.success(`${pianificate.length} lezioni segnate come svolte`)
    } catch {
      toast.error("Errore durante l'aggiornamento.")
    }
  }

  // Save note inline
  const handleNoteSave = useCallback(
    async (lezioneId, note) => {
      try {
        await updateLezione(lezioneId, { note })
      } catch {
        toast.error('Errore nel salvataggio della nota.')
      }
    },
    [toast]
  )

  // Save percorso/unita inline
  async function handlePercorsoSave(lezioneId, percorsoId, unitaId) {
    try {
      await updateLezione(lezioneId, {
        percorsoId: percorsoId || null,
        unitaId: unitaId || null,
      })
      setEditingPercorso(null)
      toast.success('Percorso aggiornato')
    } catch {
      toast.error('Errore nel salvataggio del percorso.')
    }
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Benvenuto!</h2>
        <p className="text-fg-muted">
          Configura l'anno scolastico per iniziare.{' '}
          <button onClick={() => navigate('/impostazioni')} className="text-link hover:underline">
            Vai alle impostazioni
          </button>
        </p>
      </div>
    )
  }

  // Weekend or giorno libero with no lessons
  const isWeekendOrFree = dayIndex > 5 || dayIndex === giornoLibero

  return (
    <div className="max-w-3xl mx-auto">
      {/* -- Day navigation bar -- */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-fg">Oggi</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDayOffset((o) => o - 1)}
            className="p-2 rounded-sm hover:bg-overlay text-fg-muted"
            title="Giorno precedente"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setDayOffset(0)}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
              dayOffset === 0
                ? 'bg-badge-p text-link'
                : 'hover:bg-overlay text-fg-muted'
            }`}
          >
            Oggi
          </button>
          <button
            onClick={() => setDayOffset((o) => o + 1)}
            className="p-2 rounded-sm hover:bg-overlay text-fg-muted"
            title="Giorno successivo"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date label */}
      <p className="text-sm text-fg-muted mb-5 capitalize">{dayLabel}</p>

      {/* -- Vacation banner -- */}
      {vacanza && (
        <div className="mb-4 px-4 py-3 bg-badge-warn border border-warn/30 rounded-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-warn shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-warn">
              {TIPO_VACANZA_LABEL[vacanza.tipo] || 'Giorno non scolastico'}
            </p>
            {vacanza.nome && (
              <p className="text-xs text-warn/70">{vacanza.nome}</p>
            )}
          </div>
        </div>
      )}

      {/* -- Summary + progress -- */}
      {totale > 0 && (
        <div className="mb-4 px-4 py-3 bg-surface border border-edge rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-sm text-fg-muted flex-wrap">
              <span className="font-semibold text-fg font-mono">{totale} lezioni</span>
              <span className="text-accent font-mono">{svolte} svolte</span>
              <span className="text-link font-mono">{daFare} da fare</span>
              {saltate > 0 && <span className="text-danger font-mono">{saltate} saltate</span>}
            </div>
            <span className="text-sm font-bold text-accent font-mono">{progressPct}%</span>
          </div>
          <div className="w-full bg-edge-muted rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* -- Auto-generate banner -- */}
      {hasUngenerated && (
        <div className="mb-4 px-4 py-3 bg-badge-p border border-link/30 rounded-sm flex items-center justify-between gap-3">
          <p className="text-sm text-link">
            Hai <strong>{slotsOggi.length}</strong> ore oggi non ancora generate.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-1.5 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50 shrink-0"
          >
            {generating ? 'Generazione...' : 'Genera lezioni'}
          </button>
        </div>
      )}

      {/* -- Lesson list -- */}
      {totale > 0 ? (
        <div className="space-y-3">
          {lezioniOggi.map((lez) => {
            const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
            const unita = lez.unitaId ? unitaMap[lez.unitaId] : null
            const inCorso = isLezioneInCorso(lez)
            const isUpdating = updatingLezioni.has(lez.id)
            const isEditingPercorso = editingPercorso === lez.id

            return (
              <div
                key={lez.id}
                className={`rounded-sm border bg-surface transition-all ${
                  inCorso
                    ? 'border-link border-l-4 border-l-link'
                    : lez.stato === STATO_LEZIONE.SVOLTA
                      ? 'border-accent/30 bg-badge-s/30'
                      : lez.stato === STATO_LEZIONE.SALTATA
                        ? 'border-danger/30 bg-badge-x/30'
                        : 'border-edge'
                } ${vacanza ? 'opacity-50' : ''}`}
              >
                <div className="p-4">
                  {/* Row 1: Time + Classe + Materia + P/S/X */}
                  <div className="flex items-center gap-3">
                    {/* Time */}
                    <div className="shrink-0 text-center min-w-[4.5rem]">
                      <div className={`text-sm font-bold font-mono ${inCorso ? 'text-link' : 'text-fg'}`}>
                        {lez.oraInizio || '--:--'}
                      </div>
                      <div className="text-xs text-fg-subtle font-mono">{lez.oraFine || ''}</div>
                    </div>

                    {/* Divider */}
                    <div className={`w-0.5 self-stretch rounded-full shrink-0 min-h-[2.5rem] ${
                      lez.stato === STATO_LEZIONE.SVOLTA ? 'bg-accent' :
                      lez.stato === STATO_LEZIONE.SALTATA ? 'bg-danger' :
                      inCorso ? 'bg-link' : 'bg-edge'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-fg">{lez.classe}</span>
                        <span className="text-fg-subtle">&mdash;</span>
                        <span className="text-sm font-medium text-fg-muted truncate">
                          {lez.titoloOverride || lez.materia}
                        </span>
                        {inCorso && (
                          <span className="text-[10px] font-semibold text-link bg-badge-p px-1.5 py-0.5 rounded-full">
                            In corso
                          </span>
                        )}
                      </div>
                    </div>

                    {/* P/S/X buttons */}
                    <div className="flex gap-1 shrink-0">
                      {STATI_LEZIONE.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatoChange(lez.id, s)}
                          disabled={isUpdating}
                          className={`w-8 h-8 rounded-sm text-xs font-bold flex items-center justify-center transition-all ${
                            lez.stato === s
                              ? `${STATO_BADGE[s]} ring-2 ring-offset-1 ring-offset-surface ${
                                  s === STATO_LEZIONE.PIANIFICATA ? 'ring-link/40' :
                                  s === STATO_LEZIONE.SVOLTA ? 'ring-accent/40' : 'ring-danger/40'
                                }`
                              : 'bg-overlay text-fg-subtle hover:bg-surface hover:text-fg-muted'
                          } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                          title={STATO_LEZIONE_LABEL[s]}
                        >
                          {STATO_LEZIONE_SHORT[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 2: Percorso/Unita + edit button */}
                  <div className="mt-2 ml-[5.5rem]">
                    {percorso && !isEditingPercorso ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-badge-special border border-special/30 rounded-sm max-w-full">
                          <svg className="w-3.5 h-3.5 text-special shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-xs font-semibold text-special truncate">{percorso.titolo}</span>
                          {unita && (
                            <>
                              <span className="text-special/40">/</span>
                              <span className="text-xs text-special/70 truncate">{unita.titolo}</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPercorso(lez.id)}
                          className="text-fg-subtle hover:text-fg-muted p-1"
                          title="Modifica percorso"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    ) : !percorso && !isEditingPercorso ? (
                      <button
                        onClick={() => setEditingPercorso(lez.id)}
                        className="text-xs text-special/60 hover:text-special hover:bg-badge-special rounded-sm px-2 py-1 transition-colors"
                      >
                        + Collega percorso
                      </button>
                    ) : null}

                    {/* Inline PercorsoSelector */}
                    {isEditingPercorso && (
                      <div className="mt-2 p-3 bg-overlay border border-edge rounded-sm">
                        <PercorsoSelector
                          percorsi={percorsi.filter((p) => p.classe === lez.classe && p.materia === lez.materia)}
                          percorsoId={lez.percorsoId || null}
                          unitaId={lez.unitaId || null}
                          onChange={({ percorsoId: pId, unitaId: uId }) => {
                            handlePercorsoSave(lez.id, pId, uId)
                          }}
                        />
                        <button
                          onClick={() => setEditingPercorso(null)}
                          className="mt-2 text-xs text-fg-muted hover:text-fg"
                        >
                          Chiudi
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 3: QuickNote */}
                  <div className="mt-2 ml-[5.5rem]">
                    <QuickNote
                      value={lez.note}
                      onSave={(note) => handleNoteSave(lez.id, note)}
                      placeholder="Aggiungi nota..."
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* "Segna tutte svolte" button */}
          {!vacanza && dayOffset <= 0 && daFare > 0 && (
            <button
              onClick={handleMarkAllSvolte}
              className="w-full py-2.5 bg-badge-s border border-accent/30 text-accent rounded-sm font-medium text-sm hover:bg-badge-s/80 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Segna tutte svolte
            </button>
          )}
        </div>
      ) : (
        /* -- Empty state -- */
        <div className="text-center py-12">
          {isWeekendOrFree ? (
            <>
              <svg className="w-12 h-12 mx-auto text-fg-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
              <p className="text-fg-muted font-medium text-base">Nessuna lezione</p>
              <p className="text-fg-subtle text-sm mt-1">Buon riposo!</p>
            </>
          ) : vacanza ? (
            <>
              <svg className="w-12 h-12 mx-auto text-warn/60 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
              <p className="text-warn font-medium text-base">Giorno non scolastico</p>
              <p className="text-warn/60 text-sm mt-1">
                {vacanza.nome || TIPO_VACANZA_LABEL[vacanza.tipo] || 'Buon riposo!'}
              </p>
            </>
          ) : !hasUngenerated ? (
            <>
              <svg className="w-12 h-12 mx-auto text-fg-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-fg-muted font-medium text-base">Nessuna lezione</p>
              <p className="text-fg-subtle text-sm mt-1">Buon riposo!</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
