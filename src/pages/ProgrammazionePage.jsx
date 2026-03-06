import { useEffect, useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { STATO_UNITA, STATO_LEZIONE, GIORNI_SHORT, ORE_EFFETTIVE } from '../lib/costanti'
import {
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  onVacanze,
  onLezioni,
  onDistribuzioni,
  setDistribuzioniClasse,
  onRicorrenze,
  setRicorrenzeClasse,
} from '../lib/firestore'
import {
  format,
  addDays,
  parseISO,
  startOfWeek,
  isBefore,
  isAfter,
  isWithinInterval,
} from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'
import SlidePanel from '../components/common/SlidePanel'
import UnitaPanel from '../components/percorsi/UnitaPanel'

const STATO_UNITA_DOT = {
  [STATO_UNITA.DA_FARE]: 'bg-edge',
  [STATO_UNITA.IN_CORSO]: 'bg-warn',
  [STATO_UNITA.COMPLETATA]: 'bg-accent',
}

// Color palette for percorsi (dark-friendly)
const PERCORSO_COLORS = [
  { bg: 'bg-badge-p', text: 'text-link', border: 'border-link/30', fill: 'bg-link/20' },
  { bg: 'bg-badge-special', text: 'text-special', border: 'border-special/30', fill: 'bg-special/20' },
  { bg: 'bg-badge-s', text: 'text-highlight', border: 'border-highlight/30', fill: 'bg-highlight/20' },
  { bg: 'bg-badge-warn', text: 'text-warn', border: 'border-warn/30', fill: 'bg-warn/20' },
  { bg: 'bg-badge-x', text: 'text-danger', border: 'border-danger/30', fill: 'bg-danger/20' },
  { bg: 'bg-overlay', text: 'text-fg', border: 'border-edge', fill: 'bg-surface' },
]

export default function ProgrammazionePage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const toast = useToast()

  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [allPercorsi, setAllPercorsi] = useState([])
  const [unitaByPercorso, setUnitaByPercorso] = useState({})
  const [vacanze, setVacanze] = useState([])
  const [distribuzioni, setDistribuzioni] = useState({})
  const [ricorrenze, setRicorrenze] = useState({})
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [selectedMateria, setSelectedMateria] = useState(null)
  const [loading, setLoading] = useState(true)
  const [distributing, setDistributing] = useState(false)
  const [slidePanelPercorso, setSlidePanelPercorso] = useState(null)
  const [allLezioni, setAllLezioni] = useState([])
  const [showConsuntivo, setShowConsuntivo] = useState(false)

  const giornoLibero = annoConfig?.giornoLibero ?? null
  const dataFineScuola = annoConfig?.dataFineScuola || null

  // ── Load data ──
  useEffect(() => {
    if (!annoAttivo) { setLoading(false); return }
    setLoading(true)
    const unsubs = []
    unsubs.push(onAssegnazioni(annoAttivo, (data) => {
      const active = data.filter((a) => a.attiva && !a.archiviata)
      setAssegnazioni(active)
      if (!selectedClasse && active.length > 0) {
        setSelectedClasse(active[0].classe)
        setSelectedMateria(active[0].materia)
      }
      setLoading(false)
    }))
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(onPercorsi(annoAttivo, (all) => setAllPercorsi(all)))
    unsubs.push(onVacanze(annoAttivo, setVacanze))
    unsubs.push(onLezioni(annoAttivo, setAllLezioni))
    unsubs.push(onDistribuzioni(setDistribuzioni))
    unsubs.push(onRicorrenze(setRicorrenze))
    return () => unsubs.forEach((u) => u())
  }, [annoAttivo])

  // Load unita for percorsi of selected class+materia
  const classePercorsi = allPercorsi.filter((p) => p.classe === selectedClasse && p.materia === selectedMateria)
  useEffect(() => {
    if (classePercorsi.length === 0) return
    const unsubs = []
    for (const p of classePercorsi) {
      unsubs.push(onUnita(p.id, (units) => {
        setUnitaByPercorso((prev) => ({ ...prev, [p.id]: units }))
      }))
    }
    return () => unsubs.forEach((u) => u())
  }, [classePercorsi.map((p) => p.id).join(',')])

  // ── Derived data ──
  // Assegnazioni as classe+materia tabs
  const assegnazioniTabs = useMemo(
    () => [...assegnazioni].sort((a, b) => a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)),
    [assegnazioni]
  )

  // All unita for selected class, in order (by percorso, then by ordine)
  const allUnita = useMemo(() => {
    const result = []
    for (const p of classePercorsi) {
      const units = (unitaByPercorso[p.id] || [])
        .slice()
        .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      for (const u of units) {
        result.push({ ...u, percorsoId: p.id, percorsoTitolo: p.titolo })
      }
    }
    return result
  }, [classePercorsi, unitaByPercorso])

  // Weekly hours for selected class+materia
  const oreSettimanali = useMemo(() => {
    if (!selectedClasse) return 0
    return orari.filter((o) => o.classe === selectedClasse && o.materia === selectedMateria && o.giorno !== giornoLibero).length
  }, [selectedClasse, selectedMateria, orari, giornoLibero])

  // Percorso color map
  const percorsoColorMap = useMemo(() => {
    const map = {}
    classePercorsi.forEach((p, i) => {
      map[p.id] = PERCORSO_COLORS[i % PERCORSO_COLORS.length]
    })
    return map
  }, [classePercorsi])

  // Total planned hours
  const orePianificate = allUnita.reduce((s, u) => s + (u.orePreviste || 0), 0)

  // Lezioni for selected class+materia (Passo 2: bilancio vivente)
  const classeLezioni = useMemo(() => {
    if (!selectedClasse) return []
    return allLezioni.filter((l) => l.classe === selectedClasse && l.materia === selectedMateria)
  }, [allLezioni, selectedClasse, selectedMateria])

  // Ore already done (from actual lezioni)
  const oreSvolte = useMemo(() => {
    return classeLezioni.reduce((s, l) => s + (ORE_EFFETTIVE[l.stato] || 0) * (l.ore || 1), 0)
  }, [classeLezioni])

  // Ore saltate
  const oreSaltate = useMemo(() => {
    return classeLezioni.filter((l) => l.stato === STATO_LEZIONE.SALTATA).reduce((s, l) => s + (l.ore || 1), 0)
  }, [classeLezioni])

  // Ore rimaste da fare
  const oreRimasteDaFare = Math.max(0, orePianificate - oreSvolte)

  // Consuntivo per settimana (lezioni raggruppate per settimana)
  const consuntivoPerSettimana = useMemo(() => {
    if (!showConsuntivo) return {}
    const map = {} // weekStartStr -> { svolte, parziali, saltate, totale }
    for (const lez of classeLezioni) {
      const d = lez.data?.toDate ? lez.data.toDate() : new Date(lez.data)
      const weekStart = startOfWeek(d, { weekStartsOn: 1 })
      const key = format(weekStart, 'yyyy-MM-dd')
      if (!map[key]) map[key] = { svolte: 0, parziali: 0, saltate: 0, totale: 0 }
      map[key].totale += (lez.ore || 1)
      if (lez.stato === STATO_LEZIONE.SVOLTA) map[key].svolte += (lez.ore || 1)
      else if (lez.stato === STATO_LEZIONE.PARZIALE) map[key].parziali += (lez.ore || 1)
      else if (lez.stato === STATO_LEZIONE.SALTATA) map[key].saltate += (lez.ore || 1)
    }
    return map
  }, [classeLezioni, showConsuntivo])

  // ── Generate weeks from today to end of school ──
  const weeks = useMemo(() => {
    if (!dataFineScuola || !selectedClasse) return []
    const fineScuola = parseISO(dataFineScuola)
    const oggi = new Date()
    let current = startOfWeek(oggi, { weekStartsOn: 1 })
    const result = []

    while (isBefore(current, fineScuola) || format(current, 'yyyy-MM-dd') === format(startOfWeek(fineScuola, { weekStartsOn: 1 }), 'yyyy-MM-dd')) {
      const weekEnd = addDays(current, 5) // Saturday
      const startStr = format(current, 'yyyy-MM-dd')

      // Count available hours for this class this week
      let oreDisponibili = 0
      let vacanzaGiorni = 0
      let vacanzaNome = null

      for (let d = 0; d < 6; d++) {
        const day = addDays(current, d)
        if (d === giornoLibero) continue

        // Check if this day is a vacation/chiusura/assenza
        const isVacDay = vacanze.some((v) => {
          const vStart = parseISO(v.dataInizio)
          const vEnd = parseISO(v.dataFine)
          return (
            (isWithinInterval(day, { start: vStart, end: vEnd }) ||
             format(day, 'yyyy-MM-dd') === v.dataInizio ||
             format(day, 'yyyy-MM-dd') === v.dataFine) &&
            !isBefore(day, vStart) &&
            !isAfter(day, vEnd)
          )
        })

        if (isVacDay) {
          vacanzaGiorni++
          if (!vacanzaNome) {
            const v = vacanze.find((v) => {
              const vStart = parseISO(v.dataInizio)
              const vEnd = parseISO(v.dataFine)
              return !isBefore(day, vStart) && !isAfter(day, vEnd)
            })
            if (v) vacanzaNome = v.nome
          }
          continue
        }

        // Count orari for this class+materia on this day-of-week
        oreDisponibili += orari.filter(
          (o) => o.giorno === d && o.classe === selectedClasse && o.materia === selectedMateria
        ).length
      }

      result.push({
        start: current,
        startStr,
        label: `${format(current, 'd', { locale: it })}–${format(weekEnd, 'd MMM', { locale: it })}`,
        oreDisponibili,
        isVacanza: oreDisponibili === 0 && vacanzaGiorni > 0,
        vacanzaNome,
        parzialmenteVacanza: vacanzaGiorni > 0 && oreDisponibili > 0,
      })

      current = addDays(current, 7)
    }

    return result
  }, [dataFineScuola, selectedClasse, selectedMateria, orari, vacanze, giornoLibero])

  // Total available hours
  const oreDisponibiliTotali = weeks.reduce((s, w) => s + w.oreDisponibili, 0)

  // Current distribution for selected class
  const classeDistribuzioni = distribuzioni[selectedClasse] || {}

  // Current ricorrenze for selected class
  const classeRicorrenze = ricorrenze[selectedClasse] || {}

  // Build orario grid for selected class+materia: array of { giorno, numeroOra, oraInizio, oraFine }
  const classeOrarioSlots = useMemo(() => {
    if (!selectedClasse) return []
    return orari
      .filter((o) => o.classe === selectedClasse && o.materia === selectedMateria && o.giorno !== giornoLibero)
      .sort((a, b) => a.giorno - b.giorno || (a.numeroOra || 0) - (b.numeroOra || 0))
  }, [selectedClasse, selectedMateria, orari, giornoLibero])

  // Unique giorni that have slots for this class
  const giorniConOre = useMemo(() => {
    const set = new Set(classeOrarioSlots.map((s) => s.giorno))
    return [...set].sort()
  }, [classeOrarioSlots])

  // Unique ore (numeroOra) across all giorni for this class
  const oreUniche = useMemo(() => {
    const set = new Set(classeOrarioSlots.map((s) => s.numeroOra || 0))
    return [...set].sort((a, b) => a - b)
  }, [classeOrarioSlots])

  // Summary: ore per percorso per settimana from ricorrenze
  const orePerPercorsoSettimanali = useMemo(() => {
    const map = {} // percorsoId -> { titolo, oreSettimanali }
    for (const key of Object.keys(classeRicorrenze)) {
      const ric = classeRicorrenze[key]
      if (!ric?.percorsoId) continue
      if (!map[ric.percorsoId]) {
        map[ric.percorsoId] = { titolo: ric.percorsoTitolo, oreSettimanali: 0 }
      }
      map[ric.percorsoId].oreSettimanali++
    }
    return map
  }, [classeRicorrenze])

  // Handle ricorrenza change for a slot
  async function handleRicorrenzaChange(giorno, numeroOra, percorsoId) {
    const key = `${giorno}-${numeroOra || 0}`
    const newRic = { ...classeRicorrenze }

    if (!percorsoId) {
      delete newRic[key]
    } else {
      const percorso = classePercorsi.find((p) => p.id === percorsoId)
      if (percorso) {
        newRic[key] = {
          percorsoId: percorso.id,
          percorsoTitolo: percorso.titolo,
        }
      }
    }

    try {
      await setRicorrenzeClasse(selectedClasse, newRic)
    } catch (err) {
      toast.error('Errore durante il salvataggio della ricorrenza.')
    }
  }

  // ── Redistribute from current week forward (Passo 4) ──
  async function handleAutoDistributeFromNow() {
    if (!selectedClasse || allUnita.length === 0 || weeks.length === 0) return
    setDistributing(true)

    try {
      const oggi = format(new Date(), 'yyyy-MM-dd')
      const newDist = { ...classeDistribuzioni }

      // Remove future assignments only
      for (const week of weeks) {
        if (week.startStr >= oggi) {
          delete newDist[week.startStr]
        }
      }

      // Find which unita are already completed or in progress
      const completedUnitaIds = new Set(
        allUnita.filter((u) => u.stato === STATO_UNITA.COMPLETATA).map((u) => u.id)
      )
      const remainingUnita = allUnita.filter((u) => !completedUnitaIds.has(u.id))

      // Simple sequential distribution for remaining weeks
      let unitaIndex = 0
      let oreAccumulate = 0

      for (const week of weeks) {
        if (week.startStr < oggi) continue // Skip past weeks
        if (week.oreDisponibili === 0) continue
        if (unitaIndex >= remainingUnita.length) break

        const unita = remainingUnita[unitaIndex]
        newDist[week.startStr] = {
          percorsoId: unita.percorsoId,
          unitaId: unita.id,
          percorsoTitolo: unita.percorsoTitolo,
          unitaTitolo: unita.titolo,
        }

        oreAccumulate += week.oreDisponibili
        if (oreAccumulate >= (unita.orePreviste || 1)) {
          unitaIndex++
          oreAccumulate = 0
        }
      }

      await setDistribuzioniClasse(selectedClasse, newDist)
      toast.success('Distribuzione aggiornata dalle settimane rimanenti')
    } catch (err) {
      toast.error('Errore durante la ridistribuzione.')
    } finally {
      setDistributing(false)
    }
  }

  // ── Auto-distribute ──
  async function handleAutoDistribute() {
    if (!selectedClasse || allUnita.length === 0 || weeks.length === 0) return
    setDistributing(true)

    try {
      const hasRicorrenze = Object.keys(classeRicorrenze).length > 0

      if (hasRicorrenze) {
        // ── Smart distribution using ricorrenze ──
        // Each percorso gets its units distributed based on weekly recurring hours
        const newDist = {}

        // Group unita by percorso
        const unitaPerPercorso = {}
        for (const u of allUnita) {
          if (!unitaPerPercorso[u.percorsoId]) unitaPerPercorso[u.percorsoId] = []
          unitaPerPercorso[u.percorsoId].push(u)
        }

        // Track progress per percorso
        const progressPerPercorso = {} // percorsoId -> { unitaIndex, oreAccumulate }
        for (const pId of Object.keys(unitaPerPercorso)) {
          progressPerPercorso[pId] = { unitaIndex: 0, oreAccumulate: 0 }
        }

        // For each week, determine how many hours each percorso gets
        // based on which days of the week are available (not vacation)
        for (const week of weeks) {
          if (week.oreDisponibili === 0) continue

          // Count per-percorso hours for this specific week
          // by checking which day slots are actually available (not vacation)
          const orePercorsoThisWeek = {} // percorsoId -> hours

          for (let d = 0; d < 6; d++) {
            if (d === giornoLibero) continue

            const day = addDays(week.start, d)
            // Check if this day is vacation
            const isVacDay = vacanze.some((v) => {
              const vStart = parseISO(v.dataInizio)
              const vEnd = parseISO(v.dataFine)
              return !isBefore(day, vStart) && !isAfter(day, vEnd)
            })
            if (isVacDay) continue

            // Find all orario slots for this day
            const daySlots = classeOrarioSlots.filter((s) => s.giorno === d)
            for (const slot of daySlots) {
              const key = `${d}-${slot.numeroOra || 0}`
              const ric = classeRicorrenze[key]
              if (ric?.percorsoId) {
                orePercorsoThisWeek[ric.percorsoId] = (orePercorsoThisWeek[ric.percorsoId] || 0) + 1
              }
            }
          }

          // For each percorso that has hours this week, advance its unit distribution
          // A week can have multiple percorsi — store the one with the most hours as the main assignment,
          // but we track all percorso progress
          let mainAssignment = null
          let maxOre = 0

          for (const [pId, ore] of Object.entries(orePercorsoThisWeek)) {
            const prog = progressPerPercorso[pId]
            const units = unitaPerPercorso[pId]
            if (!prog || !units || prog.unitaIndex >= units.length) continue

            const currentUnit = units[prog.unitaIndex]
            prog.oreAccumulate += ore

            // Store assignment for the percorso with most hours this week
            if (ore > maxOre) {
              maxOre = ore
              mainAssignment = {
                percorsoId: currentUnit.percorsoId,
                unitaId: currentUnit.id,
                percorsoTitolo: currentUnit.percorsoTitolo,
                unitaTitolo: currentUnit.titolo,
              }
            }

            // Move to next unit if enough hours accumulated
            if (prog.oreAccumulate >= (currentUnit.orePreviste || 1)) {
              prog.unitaIndex++
              prog.oreAccumulate = 0
            }
          }

          if (mainAssignment) {
            newDist[week.startStr] = mainAssignment
          }
        }

        await setDistribuzioniClasse(selectedClasse, newDist)
      } else {
        // ── Simple sequential distribution (original algorithm) ──
        const newDist = {}
        let unitaIndex = 0
        let oreAccumulate = 0

        for (const week of weeks) {
          if (week.oreDisponibili === 0) continue
          if (unitaIndex >= allUnita.length) break

          const unita = allUnita[unitaIndex]
          newDist[week.startStr] = {
            percorsoId: unita.percorsoId,
            unitaId: unita.id,
            percorsoTitolo: unita.percorsoTitolo,
            unitaTitolo: unita.titolo,
          }

          oreAccumulate += week.oreDisponibili
          if (oreAccumulate >= (unita.orePreviste || 1)) {
            unitaIndex++
            oreAccumulate = 0
          }
        }

        await setDistribuzioniClasse(selectedClasse, newDist)
      }
    } catch (err) {
      toast.error('Errore durante la distribuzione automatica.')
    } finally {
      setDistributing(false)
    }
  }

  // ── Manual week assignment change ──
  async function handleWeekAssignment(weekStr, unitaId) {
    const newDist = { ...classeDistribuzioni }

    if (!unitaId) {
      delete newDist[weekStr]
    } else {
      const unita = allUnita.find((u) => u.id === unitaId)
      if (unita) {
        newDist[weekStr] = {
          percorsoId: unita.percorsoId,
          unitaId: unita.id,
          percorsoTitolo: unita.percorsoTitolo,
          unitaTitolo: unita.titolo,
        }
      }
    }

    try {
      await setDistribuzioniClasse(selectedClasse, newDist)
    } catch (err) {
      toast.error('Errore durante l\'assegnazione della settimana.')
    }
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Programmazione</h2>
        <p className="text-fg-muted">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  if (assegnazioniTabs.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Programmazione</h2>
        <p className="text-fg-muted">
          Aggiungi le classi nelle Impostazioni per iniziare a programmare.
        </p>
      </div>
    )
  }

  const bilancioOre = oreDisponibiliTotali - orePianificate

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header + class selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-fg">Programmazione</h1>
        <div className="flex flex-wrap gap-1">
          {assegnazioniTabs.map((a) => (
            <button
              key={`${a.classe}||${a.materia}`}
              onClick={() => { setSelectedClasse(a.classe); setSelectedMateria(a.materia) }}
              className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                selectedClasse === a.classe && selectedMateria === a.materia
                  ? 'bg-link/20 text-link border border-link/30'
                  : 'bg-overlay text-fg-muted hover:bg-overlay'
              }`}
            >
              {a.classe} — {a.materia}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ore summary banner (4 cards) ── */}
      {dataFineScuola && selectedClasse && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-surface rounded-sm border border-edge text-center">
            <div className="text-2xl font-bold text-link font-mono">{oreDisponibiliTotali}</div>
            <div className="text-xs text-fg-muted">Ore disponibili</div>
            <div className="text-[10px] text-fg-subtle font-mono">{oreSettimanali}h/sett &times; {weeks.filter((w) => w.oreDisponibili > 0).length} sett</div>
          </div>
          <div className="p-3 bg-surface rounded-sm border border-edge text-center">
            <div className="text-2xl font-bold text-special font-mono">{orePianificate}</div>
            <div className="text-xs text-fg-muted">Ore pianificate</div>
            <div className="text-[10px] text-fg-subtle font-mono">{allUnita.length} unita totali</div>
          </div>
          <div className="p-3 bg-surface rounded-sm border border-edge text-center">
            <div className="text-2xl font-bold text-accent font-mono">{oreSvolte}</div>
            <div className="text-xs text-fg-muted">Ore svolte</div>
            <div className="text-[10px] text-fg-subtle font-mono">
              {oreSaltate > 0 && <span className="text-danger">{oreSaltate}h saltate</span>}
              {oreSaltate === 0 && `${classeLezioni.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).length} lezioni`}
            </div>
          </div>
          <div className={`p-3 rounded-sm border text-center ${
            bilancioOre >= 0
              ? 'bg-badge-s border-accent/30'
              : 'bg-badge-x border-danger/30'
          }`}>
            <div className={`text-2xl font-bold font-mono ${bilancioOre >= 0 ? 'text-accent' : 'text-danger'}`}>
              {bilancioOre >= 0 ? '+' : ''}{bilancioOre}
            </div>
            <div className="text-xs text-fg-muted">Margine</div>
            <div className="text-[10px] text-fg-subtle">
              {oreRimasteDaFare > 0
                ? `${oreRimasteDaFare}h ancora da fare`
                : 'Tutto completato'}
            </div>
          </div>
        </div>
      )}

      {!dataFineScuola && (
        <div className="mb-6 p-3 bg-badge-warn border border-warn/30 rounded-sm">
          <p className="text-sm text-warn">
            Imposta l'<strong>ultimo giorno di scuola</strong> e le <strong>ore scolastiche</strong> nelle Impostazioni per vedere la timeline e il bilancio ore.
          </p>
        </div>
      )}

      {/* ── Ricorrenze grid (slot → percorso) ── */}
      {selectedClasse && classeOrarioSlots.length > 0 && classePercorsi.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-fg">Ore ricorrenti</h2>
          </div>
          <p className="text-xs text-fg-muted mb-3">
            Assegna un percorso fisso a ogni slot orario della settimana. Quando generi le lezioni, verranno automaticamente collegate al percorso assegnato qui.
          </p>

          <div className="bg-surface rounded-sm border border-edge overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-overlay border-b border-edge">
                  <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted w-16">Ora</th>
                  {giorniConOre.map((g) => (
                    <th key={g} className="px-2 py-2 text-center text-xs font-medium text-fg-muted">
                      {GIORNI_SHORT[g]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oreUniche.map((ora) => (
                  <tr key={ora} className="border-b border-edge-muted last:border-b-0">
                    <td className="px-3 py-2 text-xs font-medium text-fg-muted font-mono">{ora}ª</td>
                    {giorniConOre.map((giorno) => {
                      const slot = classeOrarioSlots.find(
                        (s) => s.giorno === giorno && (s.numeroOra || 0) === ora
                      )
                      if (!slot) {
                        return <td key={giorno} className="px-2 py-2 text-center text-fg-subtle">—</td>
                      }

                      const key = `${giorno}-${ora}`
                      const ric = classeRicorrenze[key]
                      const color = ric ? percorsoColorMap[ric.percorsoId] : null

                      return (
                        <td
                          key={giorno}
                          className="px-1 py-1"
                          title={ric ? `Ogni ${GIORNI_SHORT[giorno]} alla ${ora}ª ora → ${ric.percorsoTitolo}` : `${GIORNI_SHORT[giorno]} ${ora}ª ora — non assegnata`}
                        >
                          <select
                            value={ric?.percorsoId || ''}
                            onChange={(e) => handleRicorrenzaChange(giorno, ora, e.target.value || null)}
                            className={`w-full px-1.5 py-1 rounded-sm text-xs border outline-none cursor-pointer ${
                              ric
                                ? `${color?.bg || 'bg-overlay'} ${color?.border || 'border-edge'} ${color?.text || 'text-fg'} font-medium`
                                : 'bg-inset border-edge text-fg-subtle'
                            }`}
                          >
                            <option value="">—</option>
                            {classePercorsi.map((p) => (
                              <option key={p.id} value={p.id}>{p.titolo}</option>
                            ))}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Riepilogo ore settimanali per percorso con previsione */}
          {Object.keys(orePerPercorsoSettimanali).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {Object.entries(orePerPercorsoSettimanali).map(([pId, info]) => {
                const color = percorsoColorMap[pId] || PERCORSO_COLORS[0]
                const units = unitaByPercorso[pId] || []
                const oreTotali = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
                const settimaneStimate = info.oreSettimanali > 0 ? Math.ceil(oreTotali / info.oreSettimanali) : null
                return (
                  <div key={pId} className={`flex items-center justify-between px-3 py-1.5 rounded-sm ${color.bg} border ${color.border}`}>
                    <span className={`text-xs font-medium ${color.text}`}>
                      {info.titolo}: {info.oreSettimanali}h/sett
                    </span>
                    {settimaneStimate !== null && oreTotali > 0 && (
                      <span className="text-[10px] text-fg-muted font-mono">
                        {oreTotali}h totali ~ {settimaneStimate} settimane
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tooltip hint for slots */}
          {Object.keys(classeRicorrenze).length > 0 && (
            <p className="mt-2 text-[10px] text-fg-subtle italic">
              Le assegnazioni ricorrenti vengono applicate automaticamente alla generazione delle lezioni.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Percorsi summary panel (click to edit in SlidePanel) ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Percorsi</h2>
            <span className="text-[10px] text-fg-subtle">click per modificare</span>
          </div>

          {classePercorsi.length === 0 && (
            <p className="text-sm text-fg-subtle italic">
              Nessun percorso per {selectedClasse} {selectedMateria}.
            </p>
          )}

          {classePercorsi.map((p) => {
            const units = (unitaByPercorso[p.id] || []).slice().sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
            const color = percorsoColorMap[p.id] || PERCORSO_COLORS[0]
            const totOre = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
            const completate = units.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length
            const inCorso = units.filter((u) => u.stato === STATO_UNITA.IN_CORSO).length
            const pct = units.length > 0 ? Math.round((completate / units.length) * 100) : 0

            // Check for skipped hours (delay indicator)
            const percLezioni = classeLezioni.filter((l) => l.percorsoId === p.id)
            const percOreSaltate = percLezioni.filter((l) => l.stato === STATO_LEZIONE.SALTATA).reduce((s, l) => s + (l.ore || 1), 0)

            return (
              <div
                key={p.id}
                className={`rounded-sm border ${color.border} overflow-hidden cursor-pointer hover:ring-1 hover:ring-link/40 transition-shadow`}
                onClick={() => setSlidePanelPercorso(p)}
              >
                {/* Percorso header */}
                <div className={`px-3 py-2 ${color.bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm font-semibold ${color.text}`}>{p.titolo}</span>
                      <span className="text-xs text-fg-muted ml-2 font-mono">{totOre}h</span>
                    </div>
                    <span className="text-xs text-fg-muted font-mono">
                      {completate}/{units.length}
                      {inCorso > 0 && <span className="text-warn ml-1">({inCorso} in corso)</span>}
                    </span>
                  </div>
                  {/* Progress bar */}
                  {units.length > 0 && (
                    <div className="mt-1.5 h-1.5 bg-edge-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {/* Delay warning */}
                  {percOreSaltate > 0 && (
                    <div className="mt-1 text-[10px] text-danger font-medium">
                      {percOreSaltate}h saltate — in ritardo
                    </div>
                  )}
                </div>

                {/* Unita list (compact) */}
                <div className="bg-surface">
                  {units.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 border-t border-edge-muted text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_UNITA_DOT[u.stato] || STATO_UNITA_DOT[STATO_UNITA.DA_FARE]}`} />
                      <span className="font-mono text-fg-subtle w-4 shrink-0">{u.ordine}</span>
                      <span className={`flex-1 truncate ${u.stato === STATO_UNITA.COMPLETATA ? 'text-fg-subtle line-through' : 'text-fg'}`}>{u.titolo}</span>
                      <span className="text-fg-subtle shrink-0 font-mono">{u.orePreviste || 0}h</span>
                    </div>
                  ))}
                  {units.length === 0 && (
                    <div className="px-3 py-2 text-xs text-fg-subtle italic border-t border-edge-muted">
                      Nessuna unita
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── RIGHT: Timeline ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-fg">Timeline</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConsuntivo(!showConsuntivo)}
                className={`px-2 py-1 text-xs font-medium rounded-sm border transition-colors ${
                  showConsuntivo
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : 'bg-overlay text-fg-muted border-edge-muted hover:text-fg'
                }`}
              >
                Consuntivo
              </button>
              {allUnita.length > 0 && weeks.length > 0 && (
                <>
                  <button
                    onClick={handleAutoDistributeFromNow}
                    disabled={distributing}
                    className="px-2 py-1 bg-special/20 text-special text-xs font-medium rounded-sm border border-special/30 hover:bg-special/30 disabled:opacity-50"
                  >
                    {distributing ? '...' : 'Ridistribuisci da oggi'}
                  </button>
                  <button
                    onClick={handleAutoDistribute}
                    disabled={distributing}
                    className="px-2 py-1 bg-link text-white text-xs font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
                  >
                    {distributing ? '...' : 'Distribuisci tutto'}
                  </button>
                </>
              )}
            </div>
          </div>

          {weeks.length === 0 ? (
            <div className="p-6 bg-surface rounded-sm border border-edge text-center text-sm text-fg-subtle">
              {!dataFineScuola
                ? 'Configura la data di fine scuola nelle Impostazioni.'
                : oreSettimanali === 0
                  ? `Nessun orario definito per ${selectedClasse} ${selectedMateria}.`
                  : 'Nessuna settimana disponibile.'}
            </div>
          ) : (
            <div className="bg-surface rounded-sm border border-edge overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-overlay border-b border-edge">
                    <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted w-32">Settimana</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted w-12">Ore</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Attivita prevista</th>
                    {showConsuntivo && (
                      <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted w-24">Effettivo</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => {
                    const assignment = classeDistribuzioni[week.startStr]
                    const color = assignment ? percorsoColorMap[assignment.percorsoId] : null
                    const oggi = format(new Date(), 'yyyy-MM-dd')
                    const isPast = week.startStr < oggi
                    const isCurrent = !isPast && week.startStr <= format(addDays(new Date(), 6), 'yyyy-MM-dd')
                    const consuntivo = consuntivoPerSettimana[week.startStr]

                    return (
                      <tr
                        key={week.startStr}
                        className={`border-b border-edge-muted last:border-b-0 ${
                          week.isVacanza ? 'bg-badge-warn/30'
                          : isCurrent ? 'bg-link/5 border-l-2 border-l-link'
                          : week.parzialmenteVacanza ? 'bg-badge-warn/15'
                          : isPast ? 'bg-canvas/50'
                          : 'bg-surface hover:bg-overlay'
                        }`}
                      >
                        <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
                          isCurrent ? 'text-link' : isPast ? 'text-fg-subtle' : 'text-fg-muted'
                        }`}>
                          {isCurrent && <span className="mr-1">&#9654;</span>}
                          {week.label}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {week.isVacanza ? (
                            <span className="text-[10px] text-warn">—</span>
                          ) : (
                            <span className={`text-xs font-semibold font-mono ${week.oreDisponibili > 0 ? (isPast ? 'text-fg-subtle' : 'text-fg') : 'text-fg-subtle'}`}>
                              {week.oreDisponibili}h
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {week.isVacanza ? (
                            <span className="text-xs text-warn italic">
                              {week.vacanzaNome || 'Vacanza'}
                            </span>
                          ) : week.oreDisponibili === 0 ? (
                            <span className="text-xs text-fg-subtle">—</span>
                          ) : (
                            <select
                              value={assignment?.unitaId || ''}
                              onChange={(e) => handleWeekAssignment(week.startStr, e.target.value || null)}
                              className={`w-full px-2 py-1 rounded-sm text-xs border outline-none ${
                                assignment
                                  ? `${color?.bg || 'bg-overlay'} ${color?.border || 'border-edge'} ${color?.text || 'text-fg'} font-medium`
                                  : 'bg-inset border-edge text-fg-subtle'
                              }`}
                            >
                              <option value="">— non assegnata —</option>
                              {allUnita.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.percorsoTitolo} / {u.titolo} ({u.orePreviste}h)
                                </option>
                              ))}
                            </select>
                          )}

                          {week.parzialmenteVacanza && !week.isVacanza && (
                            <div className="text-[10px] text-warn mt-0.5">
                              {week.vacanzaNome} (parziale)
                            </div>
                          )}
                        </td>
                        {showConsuntivo && (
                          <td className="px-2 py-2 text-center">
                            {consuntivo ? (
                              <div className="flex items-center justify-center gap-1">
                                {consuntivo.svolte > 0 && (
                                  <span className="text-[10px] font-bold text-accent font-mono">{consuntivo.svolte}S</span>
                                )}
                                {consuntivo.parziali > 0 && (
                                  <span className="text-[10px] font-bold text-warn font-mono">{consuntivo.parziali}½</span>
                                )}
                                {consuntivo.saltate > 0 && (
                                  <span className="text-[10px] font-bold text-danger font-mono">{consuntivo.saltate}X</span>
                                )}
                              </div>
                            ) : isPast && !week.isVacanza && week.oreDisponibili > 0 ? (
                              <span className="text-[10px] text-fg-subtle">—</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── SlidePanel for editing percorso ── */}
      <SlidePanel
        open={slidePanelPercorso !== null}
        onClose={() => setSlidePanelPercorso(null)}
        title={slidePanelPercorso ? `${slidePanelPercorso.titolo} — ${slidePanelPercorso.classe}` : ''}
        width="md"
      >
        {slidePanelPercorso && (
          <UnitaPanel percorso={slidePanelPercorso} />
        )}
      </SlidePanel>
    </div>
  )
}
