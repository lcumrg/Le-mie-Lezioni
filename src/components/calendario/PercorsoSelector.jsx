import { useEffect, useState } from 'react'
import { onUnita, onLezioniByPercorso, addUnita } from '../../lib/firestore'
import { STATO_UNITA, STATO_UNITA_LABEL, STATO_LEZIONE } from '../../lib/costanti'

const STATO_DOT = {
  [STATO_UNITA.DA_FARE]: 'bg-fg-subtle',
  [STATO_UNITA.IN_CORSO]: 'bg-warn',
  [STATO_UNITA.COMPLETATA]: 'bg-accent',
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
        onLezioniByPercorso(p.id, p.annoScolastico, (data) => {
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
        <p className="text-xs text-fg-subtle italic">
          Nessun percorso per questa classe. Creane uno nella pagina Percorsi.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-fg-muted">
          Collega a un percorso
        </label>
        {percorsoId && (
          <button
            onClick={handleDeselectAll}
            className="text-xs text-danger hover:text-danger/80"
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
              className={`rounded-sm border overflow-hidden transition-colors ${
                hasSelectedUnit
                  ? 'border-link/40 bg-badge-p'
                  : 'border-edge bg-overlay'
              }`}
            >
              {/* Percorso header */}
              <button
                type="button"
                onClick={() => setExpandedPercorsoId(isExpanded ? null : p.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface"
              >
                <svg
                  className={`w-3 h-3 text-fg-subtle transition-transform shrink-0 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                <span className="text-xs font-semibold text-fg flex-1 truncate">
                  {p.titolo}
                </span>

                {/* Mini progress */}
                {totaleUnita > 0 && (
                  <span className="text-[10px] text-fg-subtle shrink-0 font-mono">
                    {completate}/{totaleUnita} unita
                  </span>
                )}
                {orePianificate > 0 && (
                  <span className="text-[10px] text-fg-subtle shrink-0 font-mono">
                    {oreReali}/{orePianificate}h
                  </span>
                )}
              </button>

              {/* Units list */}
              {isExpanded && (
                <div className="border-t border-edge">
                  {units.length === 0 && addingToPercorso !== p.id ? (
                    <p className="px-3 py-2 text-xs text-fg-subtle italic">
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
                                ? 'bg-badge-p'
                                : 'hover:bg-surface'
                            }`}
                          >
                            {/* Status dot */}
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${STATO_DOT[u.stato] || STATO_DOT[STATO_UNITA.DA_FARE]}`}
                              title={STATO_UNITA_LABEL[u.stato]}
                            />

                            {/* Order number */}
                            <span className="text-[10px] text-fg-subtle font-mono w-4 shrink-0">
                              {u.ordine || '·'}
                            </span>

                            {/* Title */}
                            <span
                              className={`text-xs flex-1 truncate ${
                                isSelected
                                  ? 'font-semibold text-link'
                                  : u.stato === STATO_UNITA.COMPLETATA
                                    ? 'text-fg-subtle line-through'
                                    : 'text-fg'
                              }`}
                            >
                              {u.titolo}
                            </span>

                            {/* Hours: real / planned */}
                            <span className="text-[10px] text-fg-subtle shrink-0 font-mono">
                              {unitOreReali > 0 && (
                                <span className="text-accent font-medium">{unitOreReali}/</span>
                              )}
                              {u.orePreviste || 0}h
                            </span>

                            {/* Selected check */}
                            {isSelected && (
                              <svg
                                className="w-3.5 h-3.5 text-link shrink-0"
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
                    <div className="px-3 py-2 border-t border-dashed border-edge bg-badge-s/30">
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
                          className="flex-1 px-2 py-1 border border-edge rounded text-xs text-fg bg-surface focus:ring-1 focus:ring-accent/40 focus:border-accent outline-none"
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
                          className="w-12 px-1 py-1 border border-edge rounded text-xs text-fg bg-surface text-center font-mono focus:ring-1 focus:ring-accent/40 focus:border-accent outline-none"
                          title="Ore previste"
                        />
                        <span className="text-[10px] text-fg-subtle">h</span>
                        <button
                          type="button"
                          onClick={() => handleAddUnita(p.id)}
                          disabled={!newUnitaForm.titolo.trim() || savingUnita}
                          className="p-1 text-accent hover:text-accent/80 disabled:opacity-40"
                          title="Aggiungi"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingToPercorso(null); setNewUnitaForm({ titolo: '', orePreviste: 1 }) }}
                          className="p-1 text-fg-subtle hover:text-fg-muted"
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
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-fg-subtle hover:text-accent hover:bg-badge-s/30 transition-colors border-t border-dashed border-edge"
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
