import { useEffect, useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  onVacanze,
  onDistribuzioni,
  setDistribuzioniClasse,
  addPercorso,
  updatePercorso,
  deletePercorso,
  addUnita,
  updateUnita,
  deleteUnita,
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
  da_fare: 'bg-gray-300',
  in_corso: 'bg-yellow-400',
  completata: 'bg-green-500',
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

  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [allPercorsi, setAllPercorsi] = useState([])
  const [unitaByPercorso, setUnitaByPercorso] = useState({})
  const [vacanze, setVacanze] = useState([])
  const [distribuzioni, setDistribuzioni] = useState({})
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [distributing, setDistributing] = useState(false)

  // Percorso editing
  const [editingPercorso, setEditingPercorso] = useState(null) // null or {id, titolo, descrizione}
  const [newPercorsoForm, setNewPercorsoForm] = useState({ titolo: '', descrizione: '' })
  const [showNewPercorso, setShowNewPercorso] = useState(false)

  // Unita editing
  const [newUnitaForm, setNewUnitaForm] = useState({})
  const [showNewUnita, setShowNewUnita] = useState(null) // percorsoId

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
      if (!selectedClasse && active.length > 0) setSelectedClasse(active[0].classe)
      setLoading(false)
    }))
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(onPercorsi((all) => setAllPercorsi(all.filter((p) => p.annoScolastico === annoAttivo))))
    unsubs.push(onVacanze(annoAttivo, setVacanze))
    unsubs.push(onDistribuzioni(setDistribuzioni))
    return () => unsubs.forEach((u) => u())
  }, [annoAttivo])

  // Load unità for percorsi of selected class
  const classePercorsi = allPercorsi.filter((p) => p.classe === selectedClasse)
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
  const classi = useMemo(
    () => [...new Set(assegnazioni.map((a) => a.classe))].sort(),
    [assegnazioni]
  )

  // All unità for selected class, in order (by percorso, then by ordine)
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

  // ── Auto-distribute ──
  async function handleAutoDistribute() {
    if (!selectedClasse || allUnita.length === 0 || weeks.length === 0) return
    setDistributing(true)

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
    setDistributing(false)
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

    await setDistribuzioniClasse(selectedClasse, newDist)
  }

  // ── Percorso CRUD ──
  async function handleAddPercorso(e) {
    e.preventDefault()
    if (!newPercorsoForm.titolo.trim() || !selectedClasse || !annoAttivo) return
    const match = assegnazioni.find((a) => a.classe === selectedClasse)
    await addPercorso({
      annoScolastico: annoAttivo,
      classe: selectedClasse,
      materia: match?.materia || '',
      titolo: newPercorsoForm.titolo.trim(),
      descrizione: newPercorsoForm.descrizione.trim(),
    })
    setNewPercorsoForm({ titolo: '', descrizione: '' })
    setShowNewPercorso(false)
  }

  async function handleSavePercorso() {
    if (!editingPercorso) return
    await updatePercorso(editingPercorso.id, {
      titolo: editingPercorso.titolo,
      descrizione: editingPercorso.descrizione,
    })
    setEditingPercorso(null)
  }

  async function handleDeletePercorso(id) {
    await deletePercorso(id)
  }

  // ── Unita CRUD ──
  async function handleAddUnita(percorsoId) {
    const form = newUnitaForm[percorsoId]
    if (!form?.titolo?.trim()) return
    const existingUnits = unitaByPercorso[percorsoId] || []
    await addUnita(percorsoId, {
      titolo: form.titolo.trim(),
      orePreviste: Number(form.orePreviste) || 2,
      ordine: existingUnits.length + 1,
      stato: 'da_fare',
      descrizione: '',
      materiali: [],
    })
    setNewUnitaForm((prev) => ({ ...prev, [percorsoId]: { titolo: '', orePreviste: 2 } }))
    setShowNewUnita(null)
  }

  async function handleDeleteUnita(percorsoId, unitaId) {
    await deleteUnita(percorsoId, unitaId)
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
        <div className="flex gap-1">
          {classi.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedClasse(c)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedClasse === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Percorsi panel ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Percorsi</h2>
            <button
              onClick={() => setShowNewPercorso(!showNewPercorso)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showNewPercorso ? 'Annulla' : '+ Nuovo'}
            </button>
          </div>

          {/* New percorso form */}
          {showNewPercorso && (
            <form onSubmit={handleAddPercorso} className="p-3 bg-white rounded-lg border border-blue-200 space-y-2">
              <input
                type="text"
                value={newPercorsoForm.titolo}
                onChange={(e) => setNewPercorsoForm((f) => ({ ...f, titolo: e.target.value }))}
                placeholder="Titolo percorso"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
              <input
                type="text"
                value={newPercorsoForm.descrizione}
                onChange={(e) => setNewPercorsoForm((f) => ({ ...f, descrizione: e.target.value }))}
                placeholder="Descrizione (opzionale)"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newPercorsoForm.titolo.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Crea percorso
              </button>
            </form>
          )}

          {/* Percorsi list */}
          {classePercorsi.length === 0 && !showNewPercorso && (
            <p className="text-sm text-gray-400 italic">
              Nessun percorso per {selectedClasse}. Creane uno per iniziare.
            </p>
          )}

          {classePercorsi.map((p) => {
            const units = (unitaByPercorso[p.id] || []).slice().sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
            const color = percorsoColorMap[p.id] || PERCORSO_COLORS[0]
            const totOre = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
            const isEditing = editingPercorso?.id === p.id

            return (
              <div key={p.id} className={`rounded-lg border ${color.border} overflow-hidden`}>
                {/* Percorso header */}
                {isEditing ? (
                  <div className="p-3 space-y-2 bg-white">
                    <input
                      type="text"
                      value={editingPercorso.titolo}
                      onChange={(e) => setEditingPercorso((prev) => ({ ...prev, titolo: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSavePercorso} className="text-xs text-blue-600 font-medium">Salva</button>
                      <button onClick={() => setEditingPercorso(null)} className="text-xs text-gray-500">Annulla</button>
                    </div>
                  </div>
                ) : (
                  <div className={`px-3 py-2 ${color.bg} flex items-center justify-between`}>
                    <div>
                      <span className={`text-sm font-semibold ${color.text}`}>{p.titolo}</span>
                      <span className="text-xs text-gray-500 ml-2">{totOre}h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingPercorso({ id: p.id, titolo: p.titolo, descrizione: p.descrizione || '' })}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePercorso(p.id)}
                        className="text-red-300 hover:text-red-500 p-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Unità list */}
                <div className="bg-white">
                  {units.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATO_UNITA_DOT[u.stato] || STATO_UNITA_DOT.da_fare}`} />
                      <span className="font-mono text-gray-400 w-4 shrink-0">{u.ordine}</span>
                      <span className="flex-1 text-gray-700 truncate">{u.titolo}</span>
                      <span className="text-gray-400 shrink-0">{u.orePreviste || 0}h</span>
                      <button
                        onClick={() => handleDeleteUnita(p.id, u.id)}
                        className="text-red-300 hover:text-red-500"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* Add unità */}
                  {showNewUnita === p.id ? (
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
                      <input
                        type="text"
                        value={newUnitaForm[p.id]?.titolo || ''}
                        onChange={(e) => setNewUnitaForm((prev) => ({
                          ...prev,
                          [p.id]: { ...(prev[p.id] || {}), titolo: e.target.value },
                        }))}
                        placeholder="Titolo unita"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                      <input
                        type="number"
                        value={newUnitaForm[p.id]?.orePreviste || 2}
                        onChange={(e) => setNewUnitaForm((prev) => ({
                          ...prev,
                          [p.id]: { ...(prev[p.id] || {}), orePreviste: e.target.value },
                        }))}
                        className="w-12 px-1 py-1 border border-gray-300 rounded text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        min="1"
                      />
                      <span className="text-xs text-gray-400">h</span>
                      <button
                        onClick={() => handleAddUnita(p.id)}
                        className="text-xs text-blue-600 font-medium"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setShowNewUnita(null)}
                        className="text-xs text-gray-400"
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowNewUnita(p.id)
                        setNewUnitaForm((prev) => ({
                          ...prev,
                          [p.id]: prev[p.id] || { titolo: '', orePreviste: 2 },
                        }))
                      }}
                      className="w-full text-left px-3 py-1.5 border-t border-gray-100 text-xs text-blue-500 hover:bg-blue-50"
                    >
                      + Aggiungi unita
                    </button>
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
                  ? `Nessun orario definito per ${selectedClasse}.`
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
