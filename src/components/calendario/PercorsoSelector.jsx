import { useEffect, useState } from 'react'
import { onUnita, onLezioniByPercorso, addUnita } from '../../lib/firestore'
import { STATO_UNITA, STATO_UNITA_LABEL, STATO_LEZIONE } from '../../lib/costanti'

const STATO_DOT = {
  [STATO_UNITA.DA_FARE]: 'bg-gray-300',
  [STATO_UNITA.IN_CORSO]: 'bg-yellow-400',
  [STATO_UNITA.COMPLETATA]: 'bg-green-500',
}

/**
 * Rich inline panel to select a percorso + unità for a lesson.
 *
 * Props:
 *   percorsi     - array of percorsi filtered for the current class
 *   percorsoId   - currently selected percorsoId (or null)
 *   unitaId      - currently selected unitaId (or null)
 *   onChange      - ({ percorsoId, unitaId, unitaTitolo }) => void
 */
export default function PercorsoSelector({ percorsi, percorsoId, unitaId, onChange }) {
  const [expandedPercorsoId, setExpandedPercorsoId] = useState(percorsoId || null)
  const [unitaByPercorso, setUnitaByPercorso] = useState({})
  const [lezioniByPercorso, setLezioniByPercorso] = useState({})

  // Load unità and linked lezioni for each percorso
  useEffect(() => {
    if (percorsi.length === 0) return

    const unsubs = []

    for (const p of percorsi) {
      // Load units
      unsubs.push(
        onUnita(p.id, (data) => {
          setUnitaByPercorso((prev) => ({ ...prev, [p.id]: data }))
        })
      )
      // Load linked lessons (for real hours count)
      unsubs.push(
        onLezioniByPercorso(p.id, (data) => {
          setLezioniByPercorso((prev) => ({ ...prev, [p.id]: data }))
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [percorsi])

  function handleSelectUnit(pId, uId, uTitolo) {
    // Toggle: if already selected, deselect
    if (percorsoId === pId && unitaId === uId) {
      onChange({ percorsoId: null, unitaId: null, unitaTitolo: '' })
    } else {
      onChange({ percorsoId: pId, unitaId: uId, unitaTitolo: uTitolo })
    }
  }

  function handleDeselectAll() {
    onChange({ percorsoId: null, unitaId: null, unitaTitolo: '' })
  }

  // ── Inline add-unita ──
  const [addingToPercorso, setAddingToPercorso] = useState(null) // percorsoId or null
  const [newUnitaForm, setNewUnitaForm] = useState({ titolo: '', orePreviste: 1 })
  const [savingUnita, setSavingUnita] = useState(false)

  async function handleAddUnita(pId) {
    const titolo = newUnitaForm.titolo.trim()
    if (!titolo || savingUnita) return
    const units = unitaByPercorso[pId] || []
    const maxOrdine = units.length > 0 ? Math.max(...units.map((u) => u.ordine || 0)) : 0

    setSavingUnita(true)
    try {
      await addUnita(pId, {
        titolo,
        descrizione: '',
        ordine: maxOrdine + 1,
        orePreviste: Number(newUnitaForm.orePreviste) || 1,
        stato: STATO_UNITA.DA_FARE,
        materiali: [],
      })
      setAddingToPercorso(null)
      setNewUnitaForm({ titolo: '', orePreviste: 1 })
    } catch {
      // silently fail - the user will see nothing was added
    } finally {
      setSavingUnita(false)
    }
  }

  if (percorsi.length === 0) {
    return (
      <div className="py-2">
        <p className="text-xs text-gray-400 italic">
          Nessun percorso per questa classe. Creane uno nella pagina Percorsi.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600">
          Collega a un percorso
        </label>
        {percorsoId && (
          <button
            onClick={handleDeselectAll}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Scollega
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {percorsi.map((p) => {
          const units = unitaByPercorso[p.id] || []
          const pLezioni = lezioniByPercorso[p.id] || []
          const isExpanded = expandedPercorsoId === p.id
          const hasSelectedUnit = percorsoId === p.id

          // Progress summary
          const totaleUnita = units.length
          const completate = units.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length
          const orePianificate = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
          const oreReali = pLezioni
            .filter((l) => l.stato === STATO_LEZIONE.SVOLTA)
            .reduce((s, l) => s + (l.ore || 0), 0)

          return (
            <div
              key={p.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                hasSelectedUnit
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Percorso header */}
              <button
                type="button"
                onClick={() => setExpandedPercorsoId(isExpanded ? null : p.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100"
              >
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                <span className="text-xs font-semibold text-gray-800 flex-1 truncate">
                  {p.titolo}
                </span>

                {/* Mini progress */}
                {totaleUnita > 0 && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {completate}/{totaleUnita} unita
                  </span>
                )}
                {orePianificate > 0 && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {oreReali}/{orePianificate}h
                  </span>
                )}
              </button>

              {/* Units list */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {units.length === 0 && addingToPercorso !== p.id ? (
                    <p className="px-3 py-2 text-xs text-gray-400 italic">
                      Nessuna unita in questo percorso.
                    </p>
                  ) : (
                    <div className="py-1">
                      {units.map((u) => {
                        const isSelected = percorsoId === p.id && unitaId === u.id
                        // Hours for this specific unit
                        const unitLezioni = pLezioni.filter(
                          (l) => l.unitaId === u.id && l.stato === STATO_LEZIONE.SVOLTA
                        )
                        const unitOreReali = unitLezioni.reduce(
                          (s, l) => s + (l.ore || 0),
                          0
                        )

                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSelectUnit(p.id, u.id, u.titolo)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-100'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {/* Status dot */}
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[u.stato] || STATO_DOT[STATO_UNITA.DA_FARE]}`}
                              title={STATO_UNITA_LABEL[u.stato]}
                            />

                            {/* Order number */}
                            <span className="text-[10px] text-gray-400 font-mono w-4 shrink-0">
                              {u.ordine || '·'}
                            </span>

                            {/* Title */}
                            <span
                              className={`text-xs flex-1 truncate ${
                                isSelected
                                  ? 'font-semibold text-blue-800'
                                  : u.stato === STATO_UNITA.COMPLETATA
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-700'
                              }`}
                            >
                              {u.titolo}
                            </span>

                            {/* Hours: real / planned */}
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {unitOreReali > 0 && (
                                <span className="text-green-600 font-medium">{unitOreReali}/</span>
                              )}
                              {u.orePreviste || 0}h
                            </span>

                            {/* Selected check */}
                            {isSelected && (
                              <svg
                                className="w-3.5 h-3.5 text-blue-600 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Inline add-unita form */}
                  {addingToPercorso === p.id ? (
                    <div className="px-3 py-2 border-t border-dashed border-gray-200 bg-green-50">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newUnitaForm.titolo}
                          onChange={(e) => setNewUnitaForm((f) => ({ ...f, titolo: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddUnita(p.id) }
                            if (e.key === 'Escape') { setAddingToPercorso(null); setNewUnitaForm({ titolo: '', orePreviste: 1 }) }
                          }}
                          placeholder="Titolo nuova unita..."
                          autoFocus
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                        <input
                          type="number"
                          value={newUnitaForm.orePreviste}
                          onChange={(e) => setNewUnitaForm((f) => ({ ...f, orePreviste: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddUnita(p.id) }
                            if (e.key === 'Escape') { setAddingToPercorso(null); setNewUnitaForm({ titolo: '', orePreviste: 1 }) }
                          }}
                          min="1"
                          className="w-12 px-1 py-1 border border-gray-300 rounded text-xs text-center focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                          title="Ore previste"
                        />
                        <span className="text-[10px] text-gray-400">h</span>
                        <button
                          type="button"
                          onClick={() => handleAddUnita(p.id)}
                          disabled={!newUnitaForm.titolo.trim() || savingUnita}
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-40"
                          title="Aggiungi"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingToPercorso(null); setNewUnitaForm({ titolo: '', orePreviste: 1 }) }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Annulla"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAddingToPercorso(p.id); setNewUnitaForm({ titolo: '', orePreviste: 1 }) }}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors border-t border-dashed border-gray-200"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Aggiungi unita
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
