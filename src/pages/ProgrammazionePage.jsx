import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
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
import { format, addDays, parseISO, startOfWeek } from 'date-fns'
import { settimaneScolastiche, oreDisponibili, giornoIndex, toDayStr, inizioEffettivo } from '../lib/calendario'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'
import SlidePanel from '../components/common/SlidePanel'
import UnitaPanel from '../components/percorsi/UnitaPanel'

const STATO_UNITA_DOT = {
  [STATO_UNITA.DA_FARE]: 'bg-edge',
  [STATO_UNITA.IN_CORSO]: 'bg-warn',
  [STATO_UNITA.COMPLETATA]: 'bg-accent',
  [STATO_UNITA.SALTATA]: 'bg-danger',
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
  const [viewMode, setViewMode] = useState('detail') // 'detail' | 'panoramica'
  const [dragSourceSlot, setDragSourceSlot] = useState(null)
  const [dragOverSlot, setDragOverSlot] = useState(null)

  const giornoLibero = annoConfig?.giornoLibero ?? null
  const dataInizioScuola = annoConfig?.dataInizioScuola || null
  const dataFineScuola = annoConfig?.dataFineScuola || null

  // Il callback dello snapshot vive oltre il primo render: senza il ref
  // leggerebbe per sempre selectedClasse=null e riporterebbe la selezione
  // al primo tab a ogni aggiornamento delle assegnazioni
  const selectedClasseRef = useRef(null)
  useEffect(() => { selectedClasseRef.current = selectedClasse }, [selectedClasse])

  // ── Load data ──
  useEffect(() => {
    if (!annoAttivo) { setLoading(false); return }
    setLoading(true)
    const unsubs = []
    unsubs.push(onAssegnazioni(annoAttivo, (data) => {
      const active = data.filter((a) => a.attiva && !a.archiviata)
      setAssegnazioni(active)
      if (!selectedClasseRef.current && active.length > 0) {
        setSelectedClasse(active[0].classe)
        setSelectedMateria(active[0].materia)
      }
      setLoading(false)
    }))
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(onPercorsi(annoAttivo, (all) => setAllPercorsi(all)))
    unsubs.push(onVacanze(annoAttivo, setVacanze))
    unsubs.push(onLezioni(annoAttivo, setAllLezioni))
    unsubs.push(onDistribuzioni(annoAttivo, setDistribuzioni))
    unsubs.push(onRicorrenze(annoAttivo, setRicorrenze))
    return () => unsubs.forEach((u) => u())
  }, [annoAttivo])

  // Load unita for percorsi of selected class+materia
  const classePercorsi = useMemo(
    () => allPercorsi.filter((p) => p.classe === selectedClasse && p.materia === selectedMateria),
    [allPercorsi, selectedClasse, selectedMateria]
  )
  // Chiave derivata stabile: risottoscrive solo quando cambia l'insieme dei
  // percorsi. In panoramica servono le unità di TUTTE le classi (senza,
  // le classi mai aperte in dettaglio mostravano 0 ore e margine gonfiato)
  const unitaIdsKey = useMemo(
    () => (viewMode === 'panoramica' ? allPercorsi : classePercorsi).map((p) => p.id).sort().join(','),
    [viewMode, allPercorsi, classePercorsi]
  )
  useEffect(() => {
    if (!unitaIdsKey) return
    const unsubs = unitaIdsKey.split(',').map((pId) =>
      onUnita(pId, (units) => {
        setUnitaByPercorso((prev) => ({ ...prev, [pId]: units }))
      })
    )
    return () => unsubs.forEach((u) => u())
  }, [unitaIdsKey])

  // ── Derived data ──
  // Assegnazioni as classe+materia tabs
  const assegnazioniTabs = useMemo(
    () => [...assegnazioni].sort((a, b) => a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)),
    [assegnazioni]
  )

  // All unita for selected class, in order (by percorso, then by ordine)
  const allUnitaInclSaltate = useMemo(() => {
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

  // Active unita (exclude saltate — used for distribution and bilancio)
  const allUnita = useMemo(() => {
    return allUnitaInclSaltate.filter((u) => u.stato !== STATO_UNITA.SALTATA)
  }, [allUnitaInclSaltate])

  const unitaSaltate = allUnitaInclSaltate.filter((u) => u.stato === STATO_UNITA.SALTATA)
  const oreSaltateUnita = unitaSaltate.reduce((s, u) => s + (u.orePreviste || 0), 0)

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
  // La struttura settimane viene da lib/calendario (ultima settimana troncata
  // alla fine scuola); le ore per settimana sono della classe+materia selezionata
  const weeks = useMemo(() => {
    if (!dataFineScuola || !selectedClasse) return []
    const slotClasse = orari.filter((o) => o.classe === selectedClasse && o.materia === selectedMateria)
    return settimaneScolastiche({
      da: inizioEffettivo(new Date(), dataInizioScuola),
      a: parseISO(dataFineScuola),
      giornoLibero,
      vacanze,
    }).map((w) => {
      const weekEnd = addDays(w.start, 5) // Saturday
      const ore = w.giorni.reduce(
        (s, day) => s + slotClasse.filter((o) => o.giorno === giornoIndex(day)).reduce((x, o) => x + (o.ore || 1), 0),
        0
      )
      return {
        start: w.start,
        startStr: w.startStr,
        giorni: w.giorni,
        label: `${format(w.start, 'd', { locale: it })}–${format(weekEnd, 'd MMM', { locale: it })}`,
        oreDisponibili: ore,
        isVacanza: ore === 0 && w.vacanzaGiorni > 0,
        vacanzaNome: w.vacanzaNome,
        parzialmenteVacanza: w.vacanzaGiorni > 0 && ore > 0,
      }
    })
  }, [dataInizioScuola, dataFineScuola, selectedClasse, selectedMateria, orari, vacanze, giornoLibero])

  // Total available hours — da oggi (i giorni già trascorsi non sono più "disponibili")
  const oreDisponibiliTotali = useMemo(() => {
    if (!dataFineScuola || !selectedClasse) return 0
    return oreDisponibili(orari, {
      da: inizioEffettivo(new Date(), dataInizioScuola),
      a: parseISO(dataFineScuola),
      giornoLibero,
      vacanze,
      classe: selectedClasse,
      materia: selectedMateria,
    })
  }, [dataInizioScuola, dataFineScuola, selectedClasse, selectedMateria, orari, vacanze, giornoLibero])

  // Current distribution for selected class+materia
  const classeDistribuzioni = useMemo(
    () => distribuzioni[selectedClasse]?.[selectedMateria] || {},
    [distribuzioni, selectedClasse, selectedMateria]
  )

  // Current ricorrenze for selected class+materia
  const classeRicorrenze = useMemo(
    () => ricorrenze[selectedClasse]?.[selectedMateria] || {},
    [ricorrenze, selectedClasse, selectedMateria]
  )

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

  // ── Flat list of all lesson slots (one per actual hour) ──
  // Key format: "yyyy-MM-dd_numeroOra" (e.g. "2026-03-17_1")
  const slots = useMemo(() => {
    if (!dataFineScuola || !selectedClasse) return []
    const result = []
    for (const week of weeks) {
      // week.giorni: solo giorni scolastici, già senza vacanze/giorno libero
      // e troncati all'ultimo giorno di scuola
      for (const day of week.giorni) {
        const d = giornoIndex(day)
        const daySlots = classeOrarioSlots
          .filter((s) => s.giorno === d)
          .sort((a, b) => (a.numeroOra || 0) - (b.numeroOra || 0))
        for (const slot of daySlots) {
          const dateStr = toDayStr(day)
          const numeroOra = slot.numeroOra || 0
          const key = `${dateStr}_${numeroOra}`
          const ricKey = `${d}-${numeroOra}`
          const ric = classeRicorrenze[ricKey]
          result.push({
            key,
            dateStr,
            weekStr: week.startStr,
            weekLabel: week.label,
            giorno: d,
            numeroOra,
            percorsoId: ric?.percorsoId || null,
            percorsoTitolo: ric?.percorsoTitolo || null,
          })
        }
      }
    }
    return result
  }, [weeks, classeOrarioSlots, classeRicorrenze, dataFineScuola, selectedClasse])

  // Group slots by week for display
  const slotsByWeek = useMemo(() => {
    const map = {}
    for (const slot of slots) {
      if (!map[slot.weekStr]) map[slot.weekStr] = { weekStr: slot.weekStr, label: slot.weekLabel, slots: [] }
      map[slot.weekStr].slots.push(slot)
    }
    return Object.values(map).sort((a, b) => a.weekStr.localeCompare(b.weekStr))
  }, [slots])

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
      await setRicorrenzeClasse(annoAttivo, selectedClasse, selectedMateria, newRic)
    } catch {
      toast.error('Errore durante il salvataggio della ricorrenza.')
    }
  }

  // ── Manual slot assignment ──
  async function handleSlotAssignment(slotKey, unitaId) {
    const newDist = { ...classeDistribuzioni }
    if (!unitaId) {
      delete newDist[slotKey]
    } else {
      const unita = allUnita.find((u) => u.id === unitaId)
      if (unita) {
        newDist[slotKey] = {
          percorsoId: unita.percorsoId,
          unitaId: unita.id,
          percorsoTitolo: unita.percorsoTitolo,
          unitaTitolo: unita.titolo,
        }
      }
    }
    try {
      await setDistribuzioniClasse(annoAttivo, selectedClasse, selectedMateria, newDist)
    } catch {
      toast.error("Errore durante l'assegnazione.")
    }
  }

  // ── Swap two slot assignments (drag & drop) ──
  async function handleSwapSlots(sourceKey, targetKey) {
    if (sourceKey === targetKey) return
    const newDist = { ...classeDistribuzioni }
    const src = newDist[sourceKey]
    const tgt = newDist[targetKey]
    if (tgt) { newDist[sourceKey] = tgt } else { delete newDist[sourceKey] }
    if (src) { newDist[targetKey] = src } else { delete newDist[targetKey] }
    try {
      await setDistribuzioniClasse(annoAttivo, selectedClasse, selectedMateria, newDist)
    } catch {
      toast.error('Errore durante lo spostamento.')
    }
  }

  // ── Auto-distribute: assign units to slots per-percorso sequentially ──
  function buildDistribution(slotsToFill, keepExisting = false) {
    const newDist = keepExisting ? { ...classeDistribuzioni } : {}
    // Group slots by percorsoId
    const slotsByPercorso = {}
    for (const slot of slotsToFill) {
      if (!slot.percorsoId) continue
      if (!slotsByPercorso[slot.percorsoId]) slotsByPercorso[slot.percorsoId] = []
      slotsByPercorso[slot.percorsoId].push(slot)
    }
    // For each percorso, sequentially assign units
    for (const [pId, pSlots] of Object.entries(slotsByPercorso)) {
      const units = (unitaByPercorso[pId] || [])
        .filter((u) => u.stato !== STATO_UNITA.SALTATA)
        .slice()
        .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      let unitaIndex = 0
      let count = 0
      for (const slot of pSlots) {
        if (unitaIndex >= units.length) break
        const unita = units[unitaIndex]
        newDist[slot.key] = {
          percorsoId: unita.percorsoId,
          unitaId: unita.id,
          percorsoTitolo: unita.percorsoTitolo,
          unitaTitolo: unita.titolo,
        }
        count++
        if (count >= (unita.orePreviste || 1)) { unitaIndex++; count = 0 }
      }
    }
    return newDist
  }

  async function handleAutoDistribute() {
    if (!selectedClasse || allUnita.length === 0 || slots.length === 0) return
    setDistributing(true)
    try {
      const newDist = buildDistribution(slots, false)
      await setDistribuzioniClasse(annoAttivo, selectedClasse, selectedMateria, newDist)
      toast.success('Distribuzione completata')
    } catch {
      toast.error('Errore durante la distribuzione automatica.')
    } finally {
      setDistributing(false)
    }
  }

  async function handleAutoDistributeFromNow() {
    if (!selectedClasse || allUnita.length === 0 || slots.length === 0) return
    setDistributing(true)
    try {
      const oggi = format(new Date(), 'yyyy-MM-dd')
      // Remove future slot assignments, keep past
      const newDistBase = { ...classeDistribuzioni }
      for (const slot of slots) {
        if (slot.dateStr >= oggi) delete newDistBase[slot.key]
      }
      const futureSlots = slots.filter((s) => s.dateStr >= oggi)
      // Find remaining units (non-completed)
      const completedIds = new Set(allUnita.filter((u) => u.stato === STATO_UNITA.COMPLETATA).map((u) => u.id))
      const remainingSlots = futureSlots.filter((s) => s.percorsoId)
      // Ore già svolte per unità (dalle lezioni reali): un'unità in corso
      // occupa solo le ore che le restano, non tutte le orePreviste
      const oreSvoltePerUnita = {}
      for (const l of classeLezioni) {
        if (!l.unitaId) continue
        oreSvoltePerUnita[l.unitaId] = (oreSvoltePerUnita[l.unitaId] || 0) + (ORE_EFFETTIVE[l.stato] || 0) * (l.ore || 1)
      }
      const oreResidue = (u) => Math.max(0, Math.ceil((u.orePreviste || 1) - (oreSvoltePerUnita[u.id] || 0)))
      // Build a fresh distribution for future slots only
      const slotsByPercorso = {}
      for (const slot of remainingSlots) {
        if (!slotsByPercorso[slot.percorsoId]) slotsByPercorso[slot.percorsoId] = []
        slotsByPercorso[slot.percorsoId].push(slot)
      }
      for (const [pId, pSlots] of Object.entries(slotsByPercorso)) {
        const units = (unitaByPercorso[pId] || [])
          .filter((u) => u.stato !== STATO_UNITA.SALTATA && !completedIds.has(u.id) && oreResidue(u) > 0)
          .slice()
          .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
        let unitaIndex = 0
        let count = 0
        for (const slot of pSlots) {
          if (unitaIndex >= units.length) break
          const unita = units[unitaIndex]
          newDistBase[slot.key] = {
            percorsoId: unita.percorsoId,
            unitaId: unita.id,
            percorsoTitolo: unita.percorsoTitolo,
            unitaTitolo: unita.titolo,
          }
          count++
          if (count >= oreResidue(unita)) { unitaIndex++; count = 0 }
        }
      }
      await setDistribuzioniClasse(annoAttivo, selectedClasse, selectedMateria, newDistBase)
      toast.success('Distribuzione aggiornata dalle settimane rimanenti')
    } catch {
      toast.error('Errore durante la ridistribuzione.')
    } finally {
      setDistributing(false)
    }
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Programmazione</h2>
        <p className="text-fg-muted">
          Configura l'anno scolastico nelle <Link to="/impostazioni#anno" className="text-link underline">Impostazioni</Link> per iniziare.
        </p>
      </div>
    )
  }

  if (assegnazioniTabs.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Programmazione</h2>
        <p className="text-fg-muted">
          Aggiungi le classi nelle <Link to="/impostazioni#classi" className="text-link underline">Impostazioni</Link> per iniziare a programmare.
        </p>
      </div>
    )
  }

  const bilancioOre = oreDisponibiliTotali - orePianificate

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header + view toggle + class selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-fg">Programmazione</h1>
          <div className="flex bg-overlay rounded-sm p-0.5 border border-edge-muted">
            <button
              onClick={() => setViewMode('detail')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                viewMode === 'detail' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              Dettaglio
            </button>
            <button
              onClick={() => setViewMode('panoramica')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                viewMode === 'panoramica' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              Panoramica
            </button>
          </div>
        </div>
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

      {/* ── PANORAMICA VIEW ── */}
      {viewMode === 'panoramica' && dataFineScuola && (
        <PanoramicaView
          assegnazioniTabs={assegnazioniTabs}
          allPercorsi={allPercorsi}
          unitaByPercorso={unitaByPercorso}
          allLezioni={allLezioni}
          orari={orari}
          vacanze={vacanze}
          giornoLibero={giornoLibero}
          dataInizioScuola={dataInizioScuola}
          dataFineScuola={dataFineScuola}
          onSelectClasse={(classe, materia) => { setSelectedClasse(classe); setSelectedMateria(materia); setViewMode('detail') }}
          onOpenPercorso={setSlidePanelPercorso}
        />
      )}

      {viewMode === 'panoramica' && !dataFineScuola && (
        <div className="p-6 bg-surface rounded-sm border border-edge text-center text-sm text-fg-subtle">
          Configura la <Link to="/impostazioni#ore" className="text-link underline">data di fine scuola</Link> nelle Impostazioni per vedere la panoramica.
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {viewMode === 'detail' && <>

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
            <div className="text-[10px] text-fg-subtle font-mono">
              {allUnita.length} unita
              {unitaSaltate.length > 0 && <span className="text-danger"> · {unitaSaltate.length} saltate ({oreSaltateUnita}h)</span>}
            </div>
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
            Imposta l'<Link to="/impostazioni#ore" className="underline font-semibold">ultimo giorno di scuola</Link> e le <Link to="/impostazioni#ore" className="underline font-semibold">ore scolastiche</Link> nelle Impostazioni per vedere la timeline e il bilancio ore.
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
              {allUnita.length > 0 && slots.length > 0 && (
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

          {slots.length === 0 ? (
            <div className="p-6 bg-surface rounded-sm border border-edge text-center text-sm text-fg-subtle">
              {!dataFineScuola
                ? 'Configura la data di fine scuola nelle Impostazioni.'
                : classeOrarioSlots.length === 0
                  ? `Nessun orario definito per ${selectedClasse} ${selectedMateria}.`
                  : 'Nessuna lezione disponibile.'}
            </div>
          ) : (
            <div className="bg-surface rounded-sm border border-edge overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-overlay border-b border-edge">
                    <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted w-24">Data</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted w-10">Ora</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-fg-muted w-28">Percorso</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Unita prevista</th>
                    {showConsuntivo && (
                      <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted w-20">Effettivo</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const oggi = format(new Date(), 'yyyy-MM-dd')
                    const rows = []
                    for (const weekGroup of slotsByWeek) {
                      const weekConsuntivo = consuntivoPerSettimana[weekGroup.weekStr]
                      const isCurrentWeek = oggi >= weekGroup.weekStr && oggi <= format(addDays(parseISO(weekGroup.weekStr), 6), 'yyyy-MM-dd')
                      // Week header row
                      rows.push(
                        <tr key={`week-${weekGroup.weekStr}`} className="bg-overlay border-b border-edge">
                          <td colSpan={showConsuntivo ? 5 : 4} className="px-3 py-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] font-semibold ${isCurrentWeek ? 'text-link' : 'text-fg-muted'}`}>
                                {isCurrentWeek && <span className="mr-1">&#9654;</span>}
                                {weekGroup.label}
                              </span>
                              {showConsuntivo && weekConsuntivo && (
                                <div className="flex items-center gap-1">
                                  {weekConsuntivo.svolte > 0 && <span className="text-[10px] font-bold text-accent font-mono">{weekConsuntivo.svolte}S</span>}
                                  {weekConsuntivo.parziali > 0 && <span className="text-[10px] font-bold text-warn font-mono">{weekConsuntivo.parziali}½</span>}
                                  {weekConsuntivo.saltate > 0 && <span className="text-[10px] font-bold text-danger font-mono">{weekConsuntivo.saltate}X</span>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                      // Slot rows
                      for (const slot of weekGroup.slots) {
                        const assignment = classeDistribuzioni[slot.key]
                        const color = assignment ? percorsoColorMap[assignment.percorsoId] : (slot.percorsoId ? percorsoColorMap[slot.percorsoId] : null)
                        const isPast = slot.dateStr < oggi
                        const isDragSource = dragSourceSlot === slot.key
                        const isDragOver = dragOverSlot === slot.key && dragSourceSlot !== slot.key
                        // Units for the percorso of this slot (if ricorrenza set), otherwise all units
                        const slotUnits = slot.percorsoId
                          ? allUnita.filter((u) => u.percorsoId === slot.percorsoId)
                          : allUnita

                        rows.push(
                          <tr
                            key={slot.key}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragSourceSlot(slot.key) }}
                            onDragOver={(e) => { if (dragSourceSlot && dragSourceSlot !== slot.key) { e.preventDefault(); setDragOverSlot(slot.key) } }}
                            onDragLeave={() => setDragOverSlot(null)}
                            onDrop={(e) => { e.preventDefault(); if (dragSourceSlot) handleSwapSlots(dragSourceSlot, slot.key); setDragOverSlot(null) }}
                            onDragEnd={() => { setDragSourceSlot(null); setDragOverSlot(null) }}
                            className={`border-b border-edge-muted last:border-b-0 transition-colors cursor-grab active:cursor-grabbing ${
                              isDragOver ? 'bg-link/15 outline outline-2 outline-link/40'
                              : isDragSource ? 'opacity-40'
                              : isPast ? 'bg-canvas/50'
                              : 'hover:bg-overlay'
                            }`}
                          >
                            <td className={`px-3 py-1.5 text-xs whitespace-nowrap font-mono ${isPast ? 'text-fg-subtle' : 'text-fg-muted'}`}>
                              {format(parseISO(slot.dateStr), 'EEE d/M', { locale: it })}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className="text-[11px] font-mono text-fg-subtle">{slot.numeroOra}ª</span>
                            </td>
                            <td className="px-2 py-1.5">
                              {slot.percorsoId ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border truncate max-w-[100px] ${color?.bg || 'bg-overlay'} ${color?.border || 'border-edge'} ${color?.text || 'text-fg'}`}>
                                  {slot.percorsoTitolo}
                                </span>
                              ) : (
                                <span className="text-[10px] text-fg-subtle italic">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={assignment?.unitaId || ''}
                                onChange={(e) => handleSlotAssignment(slot.key, e.target.value || null)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-full px-2 py-0.5 rounded-sm text-xs border outline-none ${
                                  assignment
                                    ? `${color?.bg || 'bg-overlay'} ${color?.border || 'border-edge'} ${color?.text || 'text-fg'} font-medium`
                                    : 'bg-inset border-edge text-fg-subtle'
                                }`}
                              >
                                <option value="">— non assegnata —</option>
                                {slotUnits.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {slot.percorsoId ? u.titolo : `${u.percorsoTitolo} / ${u.titolo}`} ({u.orePreviste}h)
                                  </option>
                                ))}
                              </select>
                            </td>
                            {showConsuntivo && <td />}
                          </tr>
                        )
                      }
                    }
                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      </>}

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

// ── Panoramica component (multi-class overview) ──
function PanoramicaView({
  assegnazioniTabs,
  allPercorsi,
  unitaByPercorso,
  allLezioni,
  orari,
  vacanze,
  giornoLibero,
  dataInizioScuola,
  dataFineScuola,
  onSelectClasse,
  onOpenPercorso,
}) {
  const fineScuola = parseISO(dataFineScuola)

  // Ore rimaste da oggi (o dal primo giorno di scuola) alla fine (stessa logica del dettaglio)
  function computeOreRimaste(classe, materia) {
    return oreDisponibili(orari, {
      da: inizioEffettivo(new Date(), dataInizioScuola),
      a: fineScuola,
      giornoLibero,
      vacanze,
      classe,
      materia,
    })
  }

  const rows = assegnazioniTabs.map((a) => {
    const percorsi = allPercorsi.filter((p) => p.classe === a.classe && p.materia === a.materia)
    const allUnits = []
    for (const p of percorsi) {
      const units = (unitaByPercorso[p.id] || []).sort((x, y) => (x.ordine || 0) - (y.ordine || 0))
      for (const u of units) allUnits.push({ ...u, percorsoId: p.id, percorsoTitolo: p.titolo })
    }

    const lezioni = allLezioni.filter((l) => l.classe === a.classe && l.materia === a.materia)
    const oreSvolte = lezioni.reduce((s, l) => s + (ORE_EFFETTIVE[l.stato] || 0) * (l.ore || 1), 0)
    const oreSaltateL = lezioni.filter((l) => l.stato === STATO_LEZIONE.SALTATA).reduce((s, l) => s + (l.ore || 1), 0)

    const unitaAttive = allUnits.filter((u) => u.stato !== STATO_UNITA.SALTATA)
    const unitaSaltate = allUnits.filter((u) => u.stato === STATO_UNITA.SALTATA)
    const unitaCompletate = allUnits.filter((u) => u.stato === STATO_UNITA.COMPLETATA)
    const unitaDaFare = allUnits.filter((u) => u.stato === STATO_UNITA.DA_FARE || u.stato === STATO_UNITA.IN_CORSO)

    const orePianificate = unitaAttive.reduce((s, u) => s + (u.orePreviste || 0), 0)
    const oreRimaste = computeOreRimaste(a.classe, a.materia)
    const margine = oreRimaste - (orePianificate - oreSvolte)

    return {
      classe: a.classe,
      materia: a.materia,
      percorsi,
      allUnits,
      unitaAttive,
      unitaSaltate,
      unitaCompletate,
      unitaDaFare,
      orePianificate,
      oreSvolte,
      oreSaltateL,
      oreRimaste,
      margine,
    }
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-muted">
        Panoramica di tutte le classi. Click su una riga per vedere i dettagli. Click su un percorso per modificare le unita.
      </p>

      <div className="bg-surface rounded-sm border border-edge overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-overlay border-b border-edge">
              <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Classe</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted">Ore rimaste</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted">Pianificate</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted">Svolte</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted">Margine</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-fg-muted">Unita</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Percorsi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.classe}||${r.materia}`}
                className="border-b border-edge-muted last:border-b-0 hover:bg-overlay/50 cursor-pointer"
                onClick={() => onSelectClasse(r.classe, r.materia)}
              >
                <td className="px-3 py-2.5">
                  <span className="text-sm font-bold text-fg">{r.classe}</span>
                  <span className="text-xs text-fg-muted ml-1.5">{r.materia}</span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="text-sm font-bold text-link font-mono">{r.oreRimaste}h</span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="text-sm font-mono text-special">{r.orePianificate}h</span>
                  {r.unitaSaltate.length > 0 && (
                    <div className="text-[10px] text-danger font-mono">-{r.unitaSaltate.reduce((s, u) => s + (u.orePreviste || 0), 0)}h saltate</div>
                  )}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="text-sm font-mono text-accent">{r.oreSvolte}h</span>
                  {r.oreSaltateL > 0 && (
                    <div className="text-[10px] text-danger font-mono">{r.oreSaltateL}h perse</div>
                  )}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className={`text-sm font-bold font-mono ${r.margine >= 0 ? 'text-accent' : 'text-danger'}`}>
                    {r.margine >= 0 ? '+' : ''}{r.margine}h
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <div className="text-xs font-mono text-fg-muted">
                    <span className="text-accent">{r.unitaCompletate.length}</span>
                    /<span>{r.unitaAttive.length}</span>
                    {r.unitaSaltate.length > 0 && (
                      <span className="text-danger ml-0.5">({r.unitaSaltate.length} skip)</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    {r.percorsi.map((p) => {
                      const units = (unitaByPercorso[p.id] || [])
                      const completate = units.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length
                      const pct = units.length > 0 ? Math.round((completate / units.length) * 100) : 0
                      return (
                        <button
                          key={p.id}
                          onClick={() => onOpenPercorso(p)}
                          className="text-[10px] px-1.5 py-0.5 rounded-sm bg-overlay border border-edge-muted text-fg-muted hover:border-link/40 hover:text-link transition-colors font-medium"
                          title={`${p.titolo} — ${pct}% completato. Click per modificare.`}
                        >
                          {p.titolo}
                          <span className="ml-1 font-mono text-fg-subtle">{pct}%</span>
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-fg-muted px-1">
          <span>Totale ore rimaste: <strong className="text-link font-mono">{rows.reduce((s, r) => s + r.oreRimaste, 0)}h</strong></span>
          <span>Totale pianificate: <strong className="text-special font-mono">{rows.reduce((s, r) => s + r.orePianificate, 0)}h</strong></span>
          <span>Totale svolte: <strong className="text-accent font-mono">{rows.reduce((s, r) => s + r.oreSvolte, 0)}h</strong></span>
          {rows.some((r) => r.margine < 0) && (
            <span className="text-danger font-medium">
              {rows.filter((r) => r.margine < 0).length} classi in ritardo
            </span>
          )}
        </div>
      )}
    </div>
  )
}
