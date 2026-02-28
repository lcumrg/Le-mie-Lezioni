import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { STATO_UNITA, GIORNI_SHORT } from '../lib/costanti'
import {
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  onVacanze,
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

const STATO_UNITA_DOT = {
  [STATO_UNITA.DA_FARE]: 'bg-gray-300',
  [STATO_UNITA.IN_CORSO]: 'bg-yellow-400',
  [STATO_UNITA.COMPLETATA]: 'bg-green-500',
}

// Color palette for percorsi
const PERCORSO_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', fill: 'bg-blue-200' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', fill: 'bg-purple-200' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', fill: 'bg-teal-200' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', fill: 'bg-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', fill: 'bg-rose-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', fill: 'bg-indigo-200' },
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

  // Weekly hours for selected class
  const oreSettimanali = useMemo(() => {
    if (!selectedClasse) return 0
    return orari.filter((o) => o.classe === selectedClasse && o.giorno !== giornoLibero).length
  }, [selectedClasse, orari, giornoLibero])

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

        // Count orari for this class on this day-of-week
        oreDisponibili += orari.filter(
          (o) => o.giorno === d && o.classe === selectedClasse
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
  }, [dataFineScuola, selectedClasse, orari, vacanze, giornoLibero])

  // Total available hours
  const oreDisponibiliTotali = weeks.reduce((s, w) => s + w.oreDisponibili, 0)

  // Current distribution for selected class
  const classeDistribuzioni = distribuzioni[selectedClasse] || {}

  // Current ricorrenze for selected class
  const classeRicorrenze = ricorrenze[selectedClasse] || {}

  // Build orario grid for selected class: array of { giorno, numeroOra, oraInizio, oraFine }
  const classeOrarioSlots = useMemo(() => {
    if (!selectedClasse) return []
    return orari
      .filter((o) => o.classe === selectedClasse && o.giorno !== giornoLibero)
      .sort((a, b) => a.giorno - b.giorno || (a.numeroOra || 0) - (b.numeroOra || 0))
  }, [selectedClasse, orari, giornoLibero])

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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Programmazione</h2>
        <p className="text-gray-500">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  if (classi.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Programmazione</h2>
        <p className="text-gray-500">
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
        <h1 className="text-2xl font-bold text-gray-900">Programmazione</h1>
        <div className="flex flex-wrap gap-1">
          {assegnazioniTabs.map((a) => (
            <button
              key={`${a.classe}||${a.materia}`}
              onClick={() => { setSelectedClasse(a.classe); setSelectedMateria(a.materia) }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedClasse === a.classe && selectedMateria === a.materia
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {a.classe} — {a.materia}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ore summary banner ── */}
      {dataFineScuola && selectedClasse && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
            <div className="text-2xl font-bold text-blue-600">{oreDisponibiliTotali}</div>
            <div className="text-xs text-gray-500">Ore disponibili</div>
            <div className="text-[10px] text-gray-400">{oreSettimanali}h/sett &times; {weeks.filter((w) => w.oreDisponibili > 0).length} sett</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
            <div className="text-2xl font-bold text-purple-600">{orePianificate}</div>
            <div className="text-xs text-gray-500">Ore pianificate</div>
            <div className="text-[10px] text-gray-400">{allUnita.length} unita totali</div>
          </div>
          <div className={`p-3 rounded-lg border text-center ${
            bilancioOre >= 0
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-2xl font-bold ${bilancioOre >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {bilancioOre >= 0 ? '+' : ''}{bilancioOre}
            </div>
            <div className="text-xs text-gray-500">Bilancio ore</div>
            <div className="text-[10px] text-gray-400">
              {bilancioOre >= 0 ? 'margine' : 'ore mancanti'}
            </div>
          </div>
        </div>
      )}

      {!dataFineScuola && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            Imposta l'<strong>ultimo giorno di scuola</strong> e le <strong>ore scolastiche</strong> nelle Impostazioni per vedere la timeline e il bilancio ore.
          </p>
        </div>
      )}

      {/* ── Ricorrenze grid (slot → percorso) ── */}
      {selectedClasse && classeOrarioSlots.length > 0 && classePercorsi.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Ore ricorrenti</h2>
            <span className="text-xs text-gray-400">Assegna un percorso fisso a ogni slot orario</span>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-16">Ora</th>
                  {giorniConOre.map((g) => (
                    <th key={g} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
                      {GIORNI_SHORT[g]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oreUniche.map((ora) => (
                  <tr key={ora} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2 text-xs font-medium text-gray-500">{ora}ª</td>
                    {giorniConOre.map((giorno) => {
                      const slot = classeOrarioSlots.find(
                        (s) => s.giorno === giorno && (s.numeroOra || 0) === ora
                      )
                      if (!slot) {
                        return <td key={giorno} className="px-2 py-2 text-center text-gray-200">—</td>
                      }

                      const key = `${giorno}-${ora}`
                      const ric = classeRicorrenze[key]
                      const color = ric ? percorsoColorMap[ric.percorsoId] : null

                      return (
                        <td key={giorno} className="px-1 py-1">
                          <select
                            value={ric?.percorsoId || ''}
                            onChange={(e) => handleRicorrenzaChange(giorno, ora, e.target.value || null)}
                            className={`w-full px-1.5 py-1 rounded text-xs border outline-none cursor-pointer ${
                              ric
                                ? `${color?.bg || 'bg-gray-100'} ${color?.border || 'border-gray-300'} ${color?.text || 'text-gray-700'} font-medium`
                                : 'border-gray-200 text-gray-400'
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

          {/* Riepilogo ore settimanali per percorso */}
          {Object.keys(orePerPercorsoSettimanali).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(orePerPercorsoSettimanali).map(([pId, info]) => {
                const color = percorsoColorMap[pId] || PERCORSO_COLORS[0]
                return (
                  <span key={pId} className={`text-xs px-2 py-1 rounded-full ${color.bg} ${color.text} font-medium`}>
                    {info.titolo}: {info.oreSettimanali}h/sett
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Read-only Percorsi summary panel ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Percorsi</h2>
            <Link
              to="/percorsi"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Gestisci in Percorsi
            </Link>
          </div>

          {/* Percorsi list (read-only) */}
          {classePercorsi.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              Nessun percorso per {selectedClasse} {selectedMateria}.{' '}
              <Link to="/percorsi" className="text-blue-500 hover:text-blue-700 not-italic">
                Creane uno nella pagina Percorsi.
              </Link>
            </p>
          )}

          {classePercorsi.map((p) => {
            const units = (unitaByPercorso[p.id] || []).slice().sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
            const color = percorsoColorMap[p.id] || PERCORSO_COLORS[0]
            const totOre = units.reduce((s, u) => s + (u.orePreviste || 0), 0)

            return (
              <div key={p.id} className={`rounded-lg border ${color.border} overflow-hidden`}>
                {/* Percorso header */}
                <div className={`px-3 py-2 ${color.bg} flex items-center justify-between`}>
                  <div>
                    <span className={`text-sm font-semibold ${color.text}`}>{p.titolo}</span>
                    <span className="text-xs text-gray-500 ml-2">{totOre}h</span>
                  </div>
                </div>

                {/* Unita list (read-only) */}
                <div className="bg-white">
                  {units.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_UNITA_DOT[u.stato] || STATO_UNITA_DOT[STATO_UNITA.DA_FARE]}`} />
                      <span className="font-mono text-gray-400 w-4 shrink-0">{u.ordine}</span>
                      <span className="flex-1 text-gray-700 truncate">{u.titolo}</span>
                      <span className="text-gray-400 shrink-0">{u.orePreviste || 0}h</span>
                    </div>
                  ))}
                  {units.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400 italic border-t border-gray-100">
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            {allUnita.length > 0 && weeks.length > 0 && (
              <button
                onClick={handleAutoDistribute}
                disabled={distributing}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {distributing ? 'Distribuzione...' : 'Distribuisci automaticamente'}
              </button>
            )}
          </div>

          {weeks.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-gray-200 text-center text-sm text-gray-400">
              {!dataFineScuola
                ? 'Configura la data di fine scuola nelle Impostazioni.'
                : oreSettimanali === 0
                  ? `Nessun orario definito per ${selectedClasse} ${selectedMateria}.`
                  : 'Nessuna settimana disponibile.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-32">Settimana</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">Ore</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Attivita prevista</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => {
                    const assignment = classeDistribuzioni[week.startStr]
                    const color = assignment ? percorsoColorMap[assignment.percorsoId] : null

                    return (
                      <tr
                        key={week.startStr}
                        className={`border-b border-gray-100 last:border-b-0 ${
                          week.isVacanza ? 'bg-orange-50/50' : week.parzialmenteVacanza ? 'bg-yellow-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-600 font-medium whitespace-nowrap">
                          {week.label}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {week.isVacanza ? (
                            <span className="text-[10px] text-orange-500">—</span>
                          ) : (
                            <span className={`text-xs font-semibold ${week.oreDisponibili > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                              {week.oreDisponibili}h
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {week.isVacanza ? (
                            <span className="text-xs text-orange-600 italic">
                              {week.vacanzaNome || 'Vacanza'}
                            </span>
                          ) : week.oreDisponibili === 0 ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : (
                            <select
                              value={assignment?.unitaId || ''}
                              onChange={(e) => handleWeekAssignment(week.startStr, e.target.value || null)}
                              className={`w-full px-2 py-1 rounded text-xs border outline-none ${
                                assignment
                                  ? `${color?.bg || 'bg-gray-100'} ${color?.border || 'border-gray-300'} ${color?.text || 'text-gray-700'} font-medium`
                                  : 'border-gray-200 text-gray-400'
                              }`}
                            >
                              <option value="">— non assegnata —</option>
                              {allUnita.map((u) => {
                                const pColor = percorsoColorMap[u.percorsoId]
                                return (
                                  <option key={u.id} value={u.id}>
                                    {u.percorsoTitolo} / {u.titolo} ({u.orePreviste}h)
                                  </option>
                                )
                              })}
                            </select>
                          )}

                          {/* Show partial vacation note */}
                          {week.parzialmenteVacanza && !week.isVacanza && (
                            <div className="text-[10px] text-orange-500 mt-0.5">
                              {week.vacanzaNome} (parziale)
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
