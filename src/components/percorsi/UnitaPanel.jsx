import { Fragment, useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  onUnita,
  addUnita,
  updateUnita,
  deleteUnita,
  onLezioniByPercorso,
} from '../../lib/firestore'
import {
  STATO_UNITA,
  STATO_UNITA_LABEL,
  STATO_UNITA_NEXT,
  STATO_LEZIONE,
  STATO_LEZIONE_LABEL,
} from '../../lib/costanti'
import { useToast } from '../../contexts/ToastContext'
import ConfirmDialog from '../common/ConfirmDialog'

const STATO_COLORS = {
  [STATO_UNITA.DA_FARE]: 'bg-overlay text-fg-muted',
  [STATO_UNITA.IN_CORSO]: 'bg-badge-warn text-warn',
  [STATO_UNITA.COMPLETATA]: 'bg-badge-s text-accent',
}

const STATO_LEZ_COLORS = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p text-link',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s text-accent',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x text-danger',
}

export default function UnitaPanel({ percorso }) {
  const toast = useToast()

  const [unita, setUnita] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null) // { id, field }
  const [editingValue, setEditingValue] = useState('')

  // New row state (the always-visible empty row at the bottom)
  const [newTitolo, setNewTitolo] = useState('')
  const [newOre, setNewOre] = useState('')
  const newTitoloRef = useRef(null)

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmRemoveMat, setConfirmRemoveMat] = useState(null)

  // Material form
  const [matForm, setMatForm] = useState({ tipo: 'link', titolo: '', url: '', testo: '' })

  // Linked lessons
  const [lezioniCollegate, setLezioniCollegate] = useState([])

  useEffect(() => {
    const unsub1 = onUnita(percorso.id, (data) => {
      setUnita(data)
      setLoading(false)
    })
    const unsub2 = onLezioniByPercorso(percorso.id, setLezioniCollegate)
    return () => { unsub1(); unsub2() }
  }, [percorso.id])

  // ── Inline editing ──
  function startEdit(unitaId, field, currentValue) {
    setEditingCell({ id: unitaId, field })
    setEditingValue(String(currentValue ?? ''))
  }

  async function saveEdit() {
    if (!editingCell) return
    const { id, field } = editingCell
    const u = unita.find((x) => x.id === id)
    if (!u) { setEditingCell(null); return }

    let value = editingValue
    if (field === 'orePreviste') {
      value = Math.max(0, parseInt(value) || 0)
    } else {
      value = value.trim()
    }

    const currentVal = field === 'orePreviste' ? (u.orePreviste || 0) : (u[field] || '')
    if (value !== currentVal) {
      try {
        await updateUnita(percorso.id, id, { [field]: value })
      } catch (err) {
        toast.error('Errore durante il salvataggio.')
      }
    }
    setEditingCell(null)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') {
      setEditingCell(null)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      saveEdit()
      // Move to next editable field
      if (editingCell) {
        const { id, field } = editingCell
        const idx = unita.findIndex((u) => u.id === id)
        if (field === 'titolo') {
          startEdit(id, 'orePreviste', unita[idx]?.orePreviste || 0)
        } else if (field === 'orePreviste' && idx < unita.length - 1) {
          const next = unita[idx + 1]
          startEdit(next.id, 'titolo', next.titolo)
        } else {
          // Tab from last ore field → focus new row
          setTimeout(() => newTitoloRef.current?.focus(), 0)
        }
      }
    }
  }

  // ── New row ──
  async function handleAddRow(e) {
    e?.preventDefault()
    const titolo = newTitolo.trim()
    if (!titolo) return

    const maxOrdine = unita.length > 0 ? Math.max(...unita.map((u) => u.ordine || 0)) : 0
    try {
      await addUnita(percorso.id, {
        titolo,
        descrizione: '',
        ordine: maxOrdine + 1,
        orePreviste: parseInt(newOre) || 1,
        stato: STATO_UNITA.DA_FARE,
        materiali: [],
      })
      setNewTitolo('')
      setNewOre('')
      // Keep focus on the new row for serial creation
      setTimeout(() => newTitoloRef.current?.focus(), 0)
    } catch (err) {
      toast.error('Errore durante l\'aggiunta dell\'unita.')
    }
  }

  // ── Status change ──
  async function handleStatoChange(unitaId) {
    const u = unita.find((x) => x.id === unitaId)
    if (!u) return
    const next = STATO_UNITA_NEXT[u.stato] || STATO_UNITA.DA_FARE
    try {
      await updateUnita(percorso.id, unitaId, { stato: next })
    } catch (err) {
      toast.error('Errore durante l\'aggiornamento dello stato.')
    }
  }

  // ── Reorder ──
  async function handleMove(unitaId, direction) {
    const idx = unita.findIndex((u) => u.id === unitaId)
    if (idx < 0) return
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= unita.length) return

    const currentOrdine = unita[idx].ordine
    const swapOrdine = unita[swapIdx].ordine

    try {
      await Promise.all([
        updateUnita(percorso.id, unita[idx].id, { ordine: swapOrdine }),
        updateUnita(percorso.id, unita[swapIdx].id, { ordine: currentOrdine }),
      ])
    } catch (err) {
      toast.error('Errore durante lo spostamento.')
    }
  }

  // ── Delete ──
  async function handleDelete(unitaId) {
    try {
      await deleteUnita(percorso.id, unitaId)
    } catch (err) {
      toast.error('Errore durante l\'eliminazione dell\'unita.')
    }
  }

  // ── Materials ──
  async function handleAddMaterial(unitaId) {
    const u = unita.find((x) => x.id === unitaId)
    if (!u) return

    const newMat =
      matForm.tipo === 'link'
        ? { tipo: 'link', titolo: matForm.titolo.trim() || matForm.url, url: matForm.url.trim() }
        : { tipo: 'nota', testo: matForm.testo.trim() }

    if (matForm.tipo === 'link' && !matForm.url.trim()) return
    if (matForm.tipo === 'nota' && !matForm.testo.trim()) return

    const materiali = [...(u.materiali || []), newMat]
    try {
      await updateUnita(percorso.id, unitaId, { materiali })
      setMatForm({ tipo: 'link', titolo: '', url: '', testo: '' })
    } catch (err) {
      toast.error('Errore durante l\'aggiunta del materiale.')
    }
  }

  async function handleRemoveMaterial(unitaId, matIndex) {
    const u = unita.find((x) => x.id === unitaId)
    if (!u) return
    const materiali = (u.materiali || []).filter((_, i) => i !== matIndex)
    try {
      await updateUnita(percorso.id, unitaId, { materiali })
    } catch (err) {
      toast.error('Errore durante la rimozione del materiale.')
    }
  }

  // ── Helpers ──
  function lezioniPerUnita(unitaId) {
    return lezioniCollegate
      .filter((l) => l.unitaId === unitaId)
      .sort((a, b) => {
        const da = a.data?.toDate ? a.data.toDate() : new Date(a.data)
        const db2 = b.data?.toDate ? b.data.toDate() : new Date(b.data)
        return da - db2
      })
  }

  // Progress
  const totale = unita.length
  const completate = unita.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length
  const pct = totale > 0 ? Math.round((completate / totale) * 100) : 0
  const oreTotali = unita.reduce((s, u) => s + (u.orePreviste || 0), 0)
  const oreReali = lezioniCollegate
    .filter((l) => l.stato === STATO_LEZIONE.SVOLTA)
    .reduce((s, l) => s + (l.ore || 0), 0)

  if (loading) {
    return <p className="text-sm text-fg-subtle py-4">Caricamento unita...</p>
  }

  return (
    <div className="space-y-3">
      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Elimina unita"
        message="Sei sicuro di voler eliminare questa unita? L'operazione non e reversibile."
        confirmText="Elimina"
        danger
        onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={confirmRemoveMat !== null}
        title="Rimuovi materiale"
        message="Sei sicuro di voler rimuovere questo materiale?"
        confirmText="Rimuovi"
        danger
        onConfirm={() => { handleRemoveMaterial(confirmRemoveMat.unitaId, confirmRemoveMat.matIndex); setConfirmRemoveMat(null) }}
        onCancel={() => setConfirmRemoveMat(null)}
      />

      {/* Progress bar */}
      {totale > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-edge-muted rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-fg-muted shrink-0">
            <span className="font-mono">{completate}/{totale}</span> unita · <span className="font-mono">{oreReali}h</span> svolte / <span className="font-mono">{oreTotali}h</span> previste
          </span>
        </div>
      )}

      {/* ── Spreadsheet table ── */}
      <div className="border border-edge-muted rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-overlay text-xs text-fg-muted">
              <th className="px-2 py-1.5 text-left w-8 font-medium">#</th>
              <th className="px-2 py-1.5 text-left font-medium">Titolo</th>
              <th className="px-2 py-1.5 text-center w-14 font-medium">Ore</th>
              <th className="px-2 py-1.5 text-center w-24 font-medium">Stato</th>
              <th className="px-2 py-1.5 text-right w-24 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {unita.map((u, idx) => {
              const isEditing = editingCell?.id === u.id
              const isExpanded = expandedId === u.id
              const uLez = lezioniPerUnita(u.id)
              const uOreReali = uLez.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).reduce((s, l) => s + (l.ore || 0), 0)

              return (
                <Fragment key={u.id}>
                  <tr className={`border-t border-edge-muted hover:bg-overlay/50 ${isExpanded ? 'bg-overlay/30' : ''}`}>
                    {/* # */}
                    <td className="px-2 py-1.5 text-fg-subtle font-mono text-xs">
                      {idx + 1}
                    </td>

                    {/* Titolo (click to edit) */}
                    <td
                      className="px-2 py-1.5"
                      onClick={() => !isEditing && setExpandedId(isExpanded ? null : u.id)}
                    >
                      {isEditing && editingCell.field === 'titolo' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          className="w-full px-1 py-0 border-b border-link bg-transparent text-sm text-fg outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          className={`cursor-text ${u.stato === STATO_UNITA.COMPLETATA ? 'line-through text-fg-subtle' : 'text-fg'}`}
                          onDoubleClick={(e) => { e.stopPropagation(); startEdit(u.id, 'titolo', u.titolo) }}
                        >
                          <span className="text-sm font-medium">{u.titolo}</span>
                          {u.descrizione && (
                            <span className="text-xs text-fg-muted ml-2">— {u.descrizione}</span>
                          )}
                          {(u.materiali?.length || 0) > 0 && (
                            <span className="text-xs text-link ml-1">[{u.materiali.length} mat.]</span>
                          )}
                          {uLez.length > 0 && (
                            <span className="text-xs text-special ml-1">[{uLez.length} lez.]</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Ore (click to edit) */}
                    <td className="px-2 py-1.5 text-center">
                      {isEditing && editingCell.field === 'orePreviste' ? (
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          className="w-12 px-1 py-0 border-b border-link bg-transparent text-sm text-fg text-center outline-none font-mono"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-text font-mono text-xs text-fg-muted"
                          onDoubleClick={() => startEdit(u.id, 'orePreviste', u.orePreviste || 0)}
                        >
                          {uOreReali > 0 && <span className="text-accent">{uOreReali}/</span>}
                          {u.orePreviste || 0}h
                        </span>
                      )}
                    </td>

                    {/* Stato (click to cycle) */}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleStatoChange(u.id)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATO_COLORS[u.stato] || STATO_COLORS[STATO_UNITA.DA_FARE]}`}
                        title="Clicca per cambiare stato"
                      >
                        {STATO_UNITA_LABEL[u.stato] || STATO_UNITA_LABEL[STATO_UNITA.DA_FARE]}
                      </button>
                    </td>

                    {/* Azioni */}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleMove(u.id, -1)}
                          disabled={idx === 0}
                          className="text-fg-subtle hover:text-fg-muted disabled:opacity-20 p-0.5"
                          title="Sposta su"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMove(u.id, 1)}
                          disabled={idx === unita.length - 1}
                          className="text-fg-subtle hover:text-fg-muted disabled:opacity-20 p-0.5"
                          title="Sposta giu"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="text-danger/50 hover:text-danger p-0.5"
                          title="Elimina"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row: description + lessons + materials */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="bg-surface border-t border-edge-muted">
                        <div className="px-3 py-3 space-y-3">
                          {/* Editable description */}
                          <div>
                            <label className="text-xs font-medium text-fg-muted mb-1 block">Descrizione</label>
                            {isEditing && editingCell.field === 'descrizione' ? (
                              <textarea
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingCell(null)
                                }}
                                rows={2}
                                className="w-full px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs focus:ring-1 focus:ring-link/40 outline-none resize-none"
                                autoFocus
                              />
                            ) : (
                              <p
                                className="text-xs text-fg-muted cursor-text px-2 py-1 rounded-sm hover:bg-overlay min-h-[24px]"
                                onClick={() => startEdit(u.id, 'descrizione', u.descrizione || '')}
                              >
                                {u.descrizione || <span className="text-fg-subtle italic">click per aggiungere descrizione</span>}
                              </p>
                            )}
                          </div>

                          {/* Linked lessons */}
                          {uLez.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-fg-muted mb-1.5">
                                Lezioni collegate ({uLez.length})
                              </p>
                              <div className="space-y-1">
                                {uLez.map((l) => {
                                  const d = l.data?.toDate ? l.data.toDate() : new Date(l.data)
                                  return (
                                    <div key={l.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-fg-muted font-mono w-20 shrink-0">
                                        {format(d, 'dd MMM yyyy', { locale: it })}
                                      </span>
                                      <span className="text-fg-subtle font-mono w-16 shrink-0">
                                        {l.oraInizio}–{l.oraFine}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATO_LEZ_COLORS[l.stato] || ''}`}>
                                        {STATO_LEZIONE_LABEL[l.stato] || STATO_LEZIONE_LABEL[STATO_LEZIONE.PIANIFICATA]}
                                      </span>
                                      <span className="text-fg-subtle font-mono">{l.ore || 0}h</span>
                                      {l.note && (
                                        <span className="text-fg-subtle truncate flex-1 italic">
                                          {l.note}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Materials */}
                          <div>
                            <p className="text-xs font-medium text-fg-muted mb-1.5">Materiali</p>
                            {(u.materiali || []).length > 0 ? (
                              <div className="space-y-1 mb-2">
                                {u.materiali.map((m, mi) => (
                                  <div key={mi} className="flex items-center gap-2 text-xs">
                                    {m.tipo === 'link' ? (
                                      <>
                                        <span className="text-link shrink-0">🔗</span>
                                        <a
                                          href={m.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-link hover:underline truncate flex-1"
                                        >
                                          {m.titolo || m.url}
                                        </a>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-fg-subtle shrink-0">📝</span>
                                        <span className="text-fg-muted flex-1">{m.testo}</span>
                                      </>
                                    )}
                                    <button
                                      onClick={() => setConfirmRemoveMat({ unitaId: u.id, matIndex: mi })}
                                      className="text-danger/60 hover:text-danger shrink-0"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-fg-subtle mb-2">Nessun materiale aggiunto.</p>
                            )}

                            {/* Add material form */}
                            <div className="flex flex-wrap items-end gap-2">
                              <select
                                value={matForm.tipo}
                                onChange={(e) => setMatForm((f) => ({ ...f, tipo: e.target.value }))}
                                className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs focus:ring-1 focus:ring-link/40 outline-none"
                              >
                                <option value="link">Link</option>
                                <option value="nota">Nota</option>
                              </select>

                              {matForm.tipo === 'link' ? (
                                <>
                                  <input
                                    type="text"
                                    value={matForm.titolo}
                                    onChange={(e) => setMatForm((f) => ({ ...f, titolo: e.target.value }))}
                                    placeholder="Titolo (opzionale)"
                                    className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs w-28 focus:ring-1 focus:ring-link/40 outline-none"
                                  />
                                  <input
                                    type="url"
                                    value={matForm.url}
                                    onChange={(e) => setMatForm((f) => ({ ...f, url: e.target.value }))}
                                    placeholder="https://..."
                                    className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs flex-1 min-w-[120px] focus:ring-1 focus:ring-link/40 outline-none"
                                  />
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={matForm.testo}
                                  onChange={(e) => setMatForm((f) => ({ ...f, testo: e.target.value }))}
                                  placeholder="Nota..."
                                  className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs flex-1 min-w-[120px] focus:ring-1 focus:ring-link/40 outline-none"
                                />
                              )}

                              <button
                                onClick={() => handleAddMaterial(u.id)}
                                className="px-2 py-1 bg-link text-white text-xs rounded-sm hover:bg-link/80"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}

            {/* ── New row (always visible) ── */}
            <tr className="border-t border-edge-muted bg-overlay/20">
              <td className="px-2 py-1.5 text-accent font-mono text-xs">+</td>
              <td className="px-2 py-1.5">
                <form onSubmit={handleAddRow} className="flex gap-1">
                  <input
                    ref={newTitoloRef}
                    type="text"
                    value={newTitolo}
                    onChange={(e) => setNewTitolo(e.target.value)}
                    placeholder="Nuova unita... (Enter per aggiungere)"
                    className="flex-1 px-1 py-0 border-b border-edge bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-link"
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey && newTitolo.trim()) {
                        e.preventDefault()
                        // Move focus to ore field
                        const oreInput = e.target.parentElement.parentElement.nextElementSibling?.querySelector('input')
                        if (oreInput) oreInput.focus()
                      }
                    }}
                  />
                </form>
              </td>
              <td className="px-2 py-1.5 text-center">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={newOre}
                  onChange={(e) => setNewOre(e.target.value)}
                  placeholder="1"
                  className="w-12 px-1 py-0 border-b border-edge bg-transparent text-sm text-fg text-center outline-none font-mono placeholder:text-fg-subtle focus:border-link"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddRow()
                    }
                  }}
                />
              </td>
              <td className="px-2 py-1.5"></td>
              <td className="px-2 py-1.5"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {unita.length === 0 && (
        <p className="text-xs text-fg-subtle text-center">Scrivi nella riga sopra per aggiungere la prima unita.</p>
      )}
    </div>
  )
}

