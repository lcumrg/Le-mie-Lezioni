import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  onPercorsi,
  addPercorso,
  updatePercorso,
  deletePercorso,
  onAssegnazioni,
  onUnita,
  getUnita,
  addUnita,
  updateUnita,
} from '../lib/firestore'
import { STATO_UNITA } from '../lib/costanti'
import UnitaPanel from '../components/percorsi/UnitaPanel'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function PercorsiPage() {
  const { annoAttivo, loading: configLoading } = useApp()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [percorsi, setPercorsi] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Inline creation state
  const [inlineAssegnazione, setInlineAssegnazione] = useState('')
  const [inlineTitolo, setInlineTitolo] = useState('')
  const inlineTitoloRef = useRef(null)

  // Inline editing: title + description
  const [editingField, setEditingField] = useState(null) // { id, field }
  const [editingValue, setEditingValue] = useState('')

  // Note inline editing state
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [noteExpandedIds, setNoteExpandedIds] = useState(new Set())

  // View mode
  const [compact, setCompact] = useState(false)
  const [catchupMode, setCatchupMode] = useState(false)
  const [catchupUnita, setCatchupUnita] = useState({}) // percorsoId -> unita[]

  // Duplicate feature state
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [duplicateClasse, setDuplicateClasse] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    if (!annoAttivo) {
      setLoading(false)
      return
    }

    const unsub1 = onPercorsi(annoAttivo, (all) => {
      setPercorsi(all)
      setLoading(false)
    })
    const unsub2 = onAssegnazioni(annoAttivo, setAssegnazioni)

    return () => { unsub1(); unsub2() }
  }, [annoAttivo])

  // Read ?expand= query param to auto-expand a percorso
  useEffect(() => {
    const expandParam = searchParams.get('expand')
    if (expandParam && !loading) {
      setExpandedId(expandParam)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, loading])

  // ── Inline creation ──
  async function handleInlineCreate(e) {
    e.preventDefault()
    const titolo = inlineTitolo.trim()
    if (!titolo || !inlineAssegnazione) return

    const [classe, materia] = inlineAssegnazione.split('||')
    try {
      const ref = await addPercorso({
        annoScolastico: annoAttivo,
        titolo,
        classe,
        materia: materia || '',
        descrizione: '',
        note: '',
      })
      setInlineTitolo('')
      // Auto-expand the new percorso to add units
      setExpandedId(ref.id)
    } catch (err) {
      toast.error('Errore durante la creazione del percorso.')
    }
  }

  // ── Inline field editing ──
  function startFieldEdit(percorso, field) {
    setEditingField({ id: percorso.id, field })
    setEditingValue(percorso[field] || '')
  }

  async function saveFieldEdit() {
    if (!editingField) return
    const { id, field } = editingField
    const trimmed = editingValue.trim()
    const current = percorsi.find((p) => p.id === id)
    if (current && trimmed !== (current[field] || '').trim()) {
      try {
        await updatePercorso(id, { [field]: trimmed })
      } catch (err) {
        toast.error('Errore durante il salvataggio.')
      }
    }
    setEditingField(null)
  }

  // ── Delete ──
  async function handleDelete(id) {
    try {
      await deletePercorso(id)
      if (expandedId === id) setExpandedId(null)
    } catch (err) {
      toast.error('Errore durante l\'eliminazione del percorso.')
    }
    setDeleteConfirm(null)
  }

  // ── Note handling ──
  function toggleNoteExpanded(id, e) {
    e.stopPropagation()
    setNoteExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startNoteEdit(p) {
    setEditingNoteId(p.id)
    setEditingNoteText(p.note || '')
  }

  async function saveNote(percorsoId) {
    const trimmed = editingNoteText.trim()
    const current = percorsi.find((p) => p.id === percorsoId)
    const currentNote = (current?.note || '').trim()
    if (trimmed !== currentNote) {
      try {
        await updatePercorso(percorsoId, { note: trimmed })
      } catch (err) {
        toast.error('Errore durante il salvataggio delle note.')
      }
    }
    setEditingNoteId(null)
  }

  // ── Duplicate ──
  async function handleDuplicate(percorso) {
    if (!duplicateClasse) {
      toast.error('Seleziona una destinazione.')
      return
    }
    const [destClasse, destMateria] = duplicateClasse.split('||')
    if (destClasse === percorso.classe && destMateria === (percorso.materia || '')) {
      toast.error('Seleziona una destinazione diversa da quella attuale.')
      return
    }

    setDuplicating(true)
    try {
      const newPercorsoRef = await addPercorso({
        annoScolastico: annoAttivo,
        titolo: percorso.titolo,
        classe: destClasse,
        materia: destMateria || '',
        descrizione: percorso.descrizione || '',
        note: percorso.note || '',
      })

      const unitaList = await getUnita(percorso.id)
      for (const u of unitaList) {
        await addUnita(newPercorsoRef.id, {
          titolo: u.titolo,
          descrizione: u.descrizione || '',
          ordine: u.ordine,
          orePreviste: u.orePreviste || 0,
          stato: u.stato || 'da_fare',
          materiali: u.materiali || [],
        })
      }

      toast.success(`Percorso duplicato in ${destClasse} — ${destMateria}.`)
      setDuplicatingId(null)
      setDuplicateClasse('')
    } catch (err) {
      toast.error('Errore durante la duplicazione del percorso.')
    } finally {
      setDuplicating(false)
    }
  }

  // ── Catchup mode: load unita for all percorsi ──
  useEffect(() => {
    if (!catchupMode || percorsi.length === 0) return
    const unsubs = []
    for (const p of percorsi) {
      unsubs.push(onUnita(p.id, (units) => {
        setCatchupUnita((prev) => ({ ...prev, [p.id]: units }))
      }))
    }
    return () => unsubs.forEach((u) => u())
  }, [catchupMode, percorsi.map((p) => p.id).join(',')])

  async function handleCatchupClick(percorso, clickedIdx) {
    const units = (catchupUnita[percorso.id] || [])
      .slice()
      .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
    if (units.length === 0) return

    const updates = []
    for (let i = 0; i < units.length; i++) {
      const u = units[i]
      let nuovoStato
      if (i < clickedIdx) {
        nuovoStato = STATO_UNITA.COMPLETATA
      } else if (i === clickedIdx) {
        nuovoStato = STATO_UNITA.IN_CORSO
      } else {
        nuovoStato = STATO_UNITA.DA_FARE
      }
      if (u.stato !== nuovoStato) {
        updates.push(updateUnita(percorso.id, u.id, { stato: nuovoStato }))
      }
    }
    if (updates.length > 0) {
      try {
        await Promise.all(updates)
        toast.success(`${percorso.titolo}: ${clickedIdx} completate, 1 in corso`)
      } catch {
        toast.error('Errore durante l\'aggiornamento.')
      }
    }
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Percorsi</h2>
        <p className="text-fg-muted">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  const assegnazioniOrdinati = [...assegnazioni].sort((a, b) =>
    a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)
  )

  // Auto-select first assegnazione if none selected
  if (!inlineAssegnazione && assegnazioniOrdinati.length > 0) {
    const first = assegnazioniOrdinati[0]
    setInlineAssegnazione(`${first.classe}||${first.materia}`)
  }

  // Group percorsi by classe+materia
  const percorsiPerAssegnazione = {}
  for (const a of assegnazioniOrdinati) {
    const key = `${a.classe}||${a.materia}`
    percorsiPerAssegnazione[key] = []
  }
  for (const p of percorsi) {
    const key = `${p.classe}||${p.materia}`
    if (!percorsiPerAssegnazione[key]) percorsiPerAssegnazione[key] = []
    percorsiPerAssegnazione[key].push(p)
  }
  for (const arr of Object.values(percorsiPerAssegnazione)) {
    arr.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || ''))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-fg">Percorsi Didattici</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatchupMode(!catchupMode)}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors border ${
              catchupMode
                ? 'bg-accent/20 text-accent border-accent/30'
                : 'bg-overlay text-fg-muted border-edge-muted hover:text-fg'
            }`}
          >
            Aggiornamento rapido
          </button>
          {!catchupMode && (
            <div className="flex bg-overlay rounded-sm p-0.5 border border-edge-muted">
              <button
                onClick={() => setCompact(false)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  !compact ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                Normale
              </button>
              <button
                onClick={() => setCompact(true)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  compact ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                Compatta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline creation row ── */}
      {assegnazioniOrdinati.length > 0 && (
        <form
          onSubmit={handleInlineCreate}
          className="flex items-center gap-2 mb-6 bg-surface border border-edge rounded-sm px-3 py-2"
        >
          <span className="text-accent text-sm font-mono shrink-0">+</span>
          <select
            value={inlineAssegnazione}
            onChange={(e) => setInlineAssegnazione(e.target.value)}
            className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          >
            {assegnazioniOrdinati.map((a) => (
              <option key={`${a.classe}||${a.materia}`} value={`${a.classe}||${a.materia}`}>
                {a.classe} — {a.materia}
              </option>
            ))}
          </select>
          <input
            ref={inlineTitoloRef}
            type="text"
            value={inlineTitolo}
            onChange={(e) => setInlineTitolo(e.target.value)}
            placeholder="Titolo del percorso... (Enter per creare)"
            className="flex-1 px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none placeholder:text-fg-subtle"
          />
          <button
            type="submit"
            disabled={!inlineTitolo.trim()}
            className="px-3 py-1 bg-link text-white text-xs font-medium rounded-sm hover:bg-link/80 disabled:opacity-30"
          >
            Crea
          </button>
        </form>
      )}

      {/* ── Catchup mode: compact bubble view ── */}
      {catchupMode && (
        <div className="space-y-4 mb-6">
          <p className="text-xs text-fg-muted">
            Clicca su un pallino per indicare dove sei arrivato: tutto a sinistra diventa completato, quello cliccato diventa "in corso", il resto "da fare".
          </p>
          {Object.entries(percorsiPerAssegnazione).map(([key, groupPercorsi]) => {
            if (groupPercorsi.length === 0) return null
            const [groupClasse, groupMateria] = key.split('||')
            return (
              <div key={key}>
                <h3 className="text-sm font-semibold text-fg mb-2">
                  <span className="bg-overlay text-fg rounded-sm font-bold px-1.5 py-0 text-xs">{groupClasse}</span>
                  {groupMateria && <span className="text-xs font-normal text-fg-muted ml-1.5">{groupMateria}</span>}
                </h3>
                {groupPercorsi.map((p) => {
                  const units = (catchupUnita[p.id] || [])
                    .slice()
                    .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
                  const completate = units.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length
                  const inCorso = units.findIndex((u) => u.stato === STATO_UNITA.IN_CORSO)
                  return (
                    <div key={p.id} className="mb-3 bg-surface border border-edge rounded-sm px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-fg">{p.titolo}</span>
                        <span className="text-xs text-fg-muted font-mono">
                          {completate}/{units.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {units.map((u, i) => (
                          <button
                            key={u.id}
                            onClick={() => handleCatchupClick(p, i)}
                            title={`${u.titolo} (${u.orePreviste || 0}h) — click = in corso da qui`}
                            className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all border ${
                              u.stato === STATO_UNITA.COMPLETATA
                                ? 'bg-accent/30 border-accent/50 text-accent'
                                : u.stato === STATO_UNITA.IN_CORSO
                                  ? 'bg-warn/30 border-warn/50 text-warn ring-2 ring-warn/30'
                                  : 'bg-overlay border-edge text-fg-subtle hover:border-fg-muted'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      {units.length > 0 && inCorso >= 0 && (
                        <p className="text-[11px] text-warn mt-1.5 font-medium">
                          In corso: {units[inCorso].titolo}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Percorsi grouped by classe+materia */}
      {!catchupMode && Object.entries(percorsiPerAssegnazione).map(([key, groupPercorsi]) => {
        if (groupPercorsi.length === 0) return null
        const [groupClasse, groupMateria] = key.split('||')
        return (
          <div key={key} className={compact ? 'mb-4' : 'mb-8'}>
            <h2 className={`font-semibold text-fg flex items-center gap-2 ${compact ? 'text-sm mb-2' : 'text-lg mb-3'}`}>
              <span className={`bg-overlay text-fg rounded-sm font-bold ${compact ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-sm'}`}>
                {groupClasse}
              </span>
              {groupMateria && (
                <span className={`font-normal text-fg-muted ${compact ? 'text-xs' : 'text-sm'}`}>
                  {groupMateria}
                </span>
              )}
            </h2>

            <div className={compact ? 'space-y-1' : 'space-y-3'}>
              {groupPercorsi.map((p) => (
                <div
                  key={p.id}
                  className="bg-surface rounded-sm border border-edge overflow-hidden"
                >
                  {/* Percorso header */}
                  <div
                    className={`flex items-center gap-3 cursor-pointer hover:bg-overlay ${compact ? 'px-3 py-1.5' : 'px-4 py-3'}`}
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    {/* Expand arrow */}
                    <svg
                      className={`w-4 h-4 text-fg-subtle transition-transform shrink-0 ${
                        expandedId === p.id ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>

                    <div className="flex-1 min-w-0">
                      {/* Inline editable title */}
                      {editingField?.id === p.id && editingField?.field === 'titolo' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveFieldEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveFieldEdit() }
                            if (e.key === 'Escape') setEditingField(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-1 py-0 border-b border-link bg-transparent text-sm font-semibold text-fg outline-none"
                          autoFocus
                        />
                      ) : (
                        <h3
                          className={`font-semibold text-fg cursor-text ${compact ? 'text-xs' : 'text-sm'}`}
                          onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(p, 'titolo') }}
                        >
                          {p.titolo}
                        </h3>
                      )}
                      {/* Inline editable description */}
                      {editingField?.id === p.id && editingField?.field === 'descrizione' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveFieldEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveFieldEdit() }
                            if (e.key === 'Escape') setEditingField(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Aggiungi descrizione..."
                          className="w-full px-1 py-0 mt-0.5 border-b border-link bg-transparent text-xs text-fg-muted outline-none placeholder:text-fg-subtle"
                          autoFocus
                        />
                      ) : !compact ? (
                        <p
                          className="text-xs text-fg-muted truncate cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(p, 'descrizione') }}
                        >
                          {p.descrizione || <span className="text-fg-subtle italic">doppio click per aggiungere descrizione</span>}
                        </p>
                      ) : null}
                      {/* Note indicator */}
                      {p.note && (
                        <button
                          onClick={(e) => toggleNoteExpanded(p.id, e)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-warn hover:text-warn/80"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {noteExpandedIds.has(p.id) ? 'Nascondi note' : 'Mostra note'}
                        </button>
                      )}
                      {p.note && noteExpandedIds.has(p.id) && (
                        <p
                          className="mt-1 text-xs text-warn bg-badge-warn rounded-sm px-2 py-1 whitespace-pre-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.note}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (duplicatingId === p.id) {
                          setDuplicatingId(null)
                          setDuplicateClasse('')
                        } else {
                          setDuplicatingId(p.id)
                          setDuplicateClasse('')
                        }
                      }}
                      className="text-fg-subtle hover:text-fg-muted"
                      title="Duplica in altra classe"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: p.id, titolo: p.titolo }) }}
                      className="text-danger/60 hover:text-danger"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Duplicate inline form */}
                  {duplicatingId === p.id && (
                    <div
                      className="px-4 py-3 bg-overlay border-t border-edge flex items-center gap-3 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs font-medium text-fg">Duplica in:</span>
                      <select
                        value={duplicateClasse}
                        onChange={(e) => setDuplicateClasse(e.target.value)}
                        className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                      >
                        <option value="">Seleziona destinazione</option>
                        {assegnazioniOrdinati
                          .filter((a) => !(a.classe === p.classe && a.materia === (p.materia || '')))
                          .map((a) => (
                            <option key={`${a.classe}||${a.materia}`} value={`${a.classe}||${a.materia}`}>{a.classe} — {a.materia}</option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleDuplicate(p)}
                        disabled={!duplicateClasse || duplicating}
                        className="px-3 py-1 bg-link text-white text-xs font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
                      >
                        {duplicating ? 'Duplicazione...' : 'Conferma'}
                      </button>
                      <button
                        onClick={() => { setDuplicatingId(null); setDuplicateClasse('') }}
                        className="px-3 py-1 bg-overlay text-fg-muted text-xs font-medium rounded-sm hover:bg-overlay"
                      >
                        Annulla
                      </button>
                    </div>
                  )}

                  {/* Expanded: inline note editor + units */}
                  {expandedId === p.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-edge-muted">
                      {/* Inline note editor */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-fg-muted">Note</label>
                          {editingNoteId !== p.id && (
                            <button
                              onClick={() => startNoteEdit(p)}
                              className="text-xs text-link hover:text-link/80 font-medium"
                            >
                              {p.note ? 'Modifica note' : 'Aggiungi note'}
                            </button>
                          )}
                        </div>
                        {editingNoteId === p.id ? (
                          <textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            onBlur={() => saveNote(p.id)}
                            rows={3}
                            placeholder="Annotazioni, appunti, promemoria..."
                            className="w-full px-3 py-2 border border-warn/40 rounded-sm text-sm focus:ring-1 focus:ring-warn/40 focus:border-warn outline-none resize-none bg-badge-warn text-fg"
                            autoFocus
                          />
                        ) : p.note ? (
                          <p
                            className="text-xs text-warn bg-badge-warn rounded-sm px-3 py-2 whitespace-pre-wrap cursor-pointer hover:bg-badge-warn/80"
                            onClick={() => startNoteEdit(p)}
                          >
                            {p.note}
                          </p>
                        ) : null}
                      </div>
                      <UnitaPanel percorso={p} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!catchupMode && percorsi.length === 0 && assegnazioniOrdinati.length > 0 && (
        <div className="text-center py-12 bg-surface rounded-sm border border-edge">
          <p className="text-fg-muted mb-3">
            Nessun percorso ancora. Usa la barra qui sopra per crearne uno!
          </p>
        </div>
      )}

      {assegnazioniOrdinati.length === 0 && (
        <div className="text-center py-12 bg-surface rounded-sm border border-edge">
          <p className="text-fg-muted">
            Aggiungi le classi nelle Impostazioni per poter creare percorsi.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Elimina percorso"
        message={deleteConfirm ? `Eliminare "${deleteConfirm.titolo}"? Tutte le unita associate verranno rimosse.` : ''}
        confirmText="Elimina"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
