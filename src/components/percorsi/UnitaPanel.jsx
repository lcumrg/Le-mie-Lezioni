import { useEffect, useState } from 'react'
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
  [STATO_UNITA.DA_FARE]: 'bg-gray-100 text-gray-600',
  [STATO_UNITA.IN_CORSO]: 'bg-yellow-100 text-yellow-700',
  [STATO_UNITA.COMPLETATA]: 'bg-green-100 text-green-700',
}

const STATO_LEZ_COLORS = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-100 text-blue-700',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-100 text-green-700',
  [STATO_LEZIONE.SALTATA]: 'bg-red-100 text-red-700',
}

export default function UnitaPanel({ percorso }) {
  const toast = useToast()

  const [unita, setUnita] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState(null) // unitaId
  const [confirmRemoveMat, setConfirmRemoveMat] = useState(null) // { unitaId, matIndex }

  // Form state
  const [form, setForm] = useState({
    titolo: '',
    descrizione: '',
    orePreviste: 1,
    stato: STATO_UNITA.DA_FARE,
  })

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

  function resetForm() {
    setForm({ titolo: '', descrizione: '', orePreviste: 1, stato: STATO_UNITA.DA_FARE })
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titolo.trim()) return

    try {
      if (editingId) {
        await updateUnita(percorso.id, editingId, {
          titolo: form.titolo.trim(),
          descrizione: form.descrizione.trim(),
          orePreviste: Number(form.orePreviste),
          stato: form.stato,
        })
      } else {
        const maxOrdine = unita.length > 0 ? Math.max(...unita.map((u) => u.ordine || 0)) : 0
        await addUnita(percorso.id, {
          titolo: form.titolo.trim(),
          descrizione: form.descrizione.trim(),
          ordine: maxOrdine + 1,
          orePreviste: Number(form.orePreviste),
          stato: STATO_UNITA.DA_FARE,
          materiali: [],
        })
      }
      resetForm()
    } catch (err) {
      toast.error('Errore durante il salvataggio dell\'unita.')
    }
  }

  function startEdit(u) {
    setForm({
      titolo: u.titolo,
      descrizione: u.descrizione || '',
      orePreviste: u.orePreviste || 1,
      stato: u.stato || STATO_UNITA.DA_FARE,
    })
    setEditingId(u.id)
    setShowForm(true)
  }

  async function handleDelete(unitaId) {
    try {
      await deleteUnita(percorso.id, unitaId)
      if (editingId === unitaId) resetForm()
    } catch (err) {
      toast.error('Errore durante l\'eliminazione dell\'unita.')
    }
  }

  async function handleStatoChange(unitaId, nuovoStato) {
    try {
      await updateUnita(percorso.id, unitaId, { stato: nuovoStato })
    } catch (err) {
      toast.error('Errore durante l\'aggiornamento dello stato.')
    }
  }

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
      toast.error('Errore durante lo spostamento dell\'unita.')
    }
  }

  // Materials management
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

  // Helper: get linked lessons for a specific unit
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
  const oreCompletate = unita
    .filter((u) => u.stato === STATO_UNITA.COMPLETATA)
    .reduce((s, u) => s + (u.orePreviste || 0), 0)
  const oreReali = lezioniCollegate
    .filter((l) => l.stato === STATO_LEZIONE.SVOLTA)
    .reduce((s, l) => s + (l.ore || 0), 0)

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">Caricamento unita...</p>
  }

  return (
    <div className="space-y-4">
      {/* Confirm dialog: delete unita */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Elimina unita"
        message="Sei sicuro di voler eliminare questa unita? L'operazione non e reversibile."
        confirmText="Elimina"
        danger
        onConfirm={() => {
          handleDelete(confirmDelete)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confirm dialog: remove material */}
      <ConfirmDialog
        open={confirmRemoveMat !== null}
        title="Rimuovi materiale"
        message="Sei sicuro di voler rimuovere questo materiale?"
        confirmText="Rimuovi"
        danger
        onConfirm={() => {
          handleRemoveMaterial(confirmRemoveMat.unitaId, confirmRemoveMat.matIndex)
          setConfirmRemoveMat(null)
        }}
        onCancel={() => setConfirmRemoveMat(null)}
      />

      {/* Progress bar */}
      {totale > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">
            {completate}/{totale} unita · {oreReali}h svolte / {oreTotali}h previste
          </span>
        </div>
      )}

      {/* Units list */}
      <div className="space-y-2">
        {unita.map((u, idx) => (
          <div
            key={u.id}
            className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Unit header */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-gray-400 font-mono w-6 shrink-0">
                {idx + 1}.
              </span>

              {/* Status button */}
              <button
                onClick={() => {
                  const next = STATO_UNITA_NEXT[u.stato] || STATO_UNITA.DA_FARE
                  handleStatoChange(u.id, next)
                }}
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATO_COLORS[u.stato] || STATO_COLORS[STATO_UNITA.DA_FARE]}`}
                title="Clicca per cambiare stato"
              >
                {STATO_UNITA_LABEL[u.stato] || STATO_UNITA_LABEL[STATO_UNITA.DA_FARE]}
              </button>

              {/* Title & description */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                <span className={`text-sm font-medium ${u.stato === STATO_UNITA.COMPLETATA ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {u.titolo}
                </span>
                {u.descrizione && (
                  <p className="text-xs text-gray-500 truncate">{u.descrizione}</p>
                )}
              </div>

              {/* Hours: real / planned */}
              {(() => {
                const uLez = lezioniPerUnita(u.id)
                const uOreReali = uLez.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).reduce((s, l) => s + (l.ore || 0), 0)
                return (
                  <span className="text-xs text-gray-400 shrink-0">
                    {uOreReali > 0 && <span className="text-green-600">{uOreReali}/</span>}
                    {u.orePreviste || 0}h
                  </span>
                )
              })()}

              {/* Linked lessons count */}
              {lezioniPerUnita(u.id).length > 0 && (
                <span className="text-xs text-purple-500 shrink-0">
                  {lezioniPerUnita(u.id).length} lez.
                </span>
              )}

              {/* Materials count */}
              {(u.materiali?.length || 0) > 0 && (
                <span className="text-xs text-blue-500 shrink-0">
                  {u.materiali.length} mat.
                </span>
              )}

              {/* Move buttons */}
              <button
                onClick={() => handleMove(u.id, -1)}
                disabled={idx === 0}
                className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => handleMove(u.id, 1)}
                disabled={idx === unita.length - 1}
                className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Edit / Delete */}
              <button
                onClick={() => startEdit(u)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(u.id)}
                className="text-red-300 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Expanded: linked lessons + materials */}
            {expandedId === u.id && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-200 bg-white space-y-3">
                {/* Linked lessons */}
                {(() => {
                  const uLez = lezioniPerUnita(u.id)
                  if (uLez.length === 0) return null

                  return (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1.5">
                        Lezioni collegate ({uLez.length})
                      </p>
                      <div className="space-y-1">
                        {uLez.map((l) => {
                          const d = l.data?.toDate ? l.data.toDate() : new Date(l.data)
                          return (
                            <div key={l.id} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 font-mono w-20 shrink-0">
                                {format(d, 'dd MMM yyyy', { locale: it })}
                              </span>
                              <span className="text-gray-400 w-16 shrink-0">
                                {l.oraInizio}–{l.oraFine}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATO_LEZ_COLORS[l.stato] || ''}`}>
                                {STATO_LEZIONE_LABEL[l.stato] || STATO_LEZIONE_LABEL[STATO_LEZIONE.PIANIFICATA]}
                              </span>
                              <span className="text-gray-400">{l.ore || 0}h</span>
                              {l.note && (
                                <span className="text-gray-400 truncate flex-1 italic">
                                  {l.note}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <p className="text-xs font-medium text-gray-600 mb-2">Materiali</p>

                {/* Existing materials */}
                {(u.materiali || []).length > 0 ? (
                  <div className="space-y-1 mb-3">
                    {u.materiali.map((m, mi) => (
                      <div key={mi} className="flex items-center gap-2 text-sm">
                        {m.tipo === 'link' ? (
                          <>
                            <span className="text-blue-500 shrink-0">🔗</span>
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate flex-1"
                            >
                              {m.titolo || m.url}
                            </a>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-400 shrink-0">📝</span>
                            <span className="text-gray-600 flex-1">{m.testo}</span>
                          </>
                        )}
                        <button
                          onClick={() => setConfirmRemoveMat({ unitaId: u.id, matIndex: mi })}
                          className="text-red-300 hover:text-red-500 shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">Nessun materiale aggiunto.</p>
                )}

                {/* Add material form */}
                <div className="flex flex-wrap items-end gap-2">
                  <select
                    value={matForm.tipo}
                    onChange={(e) => setMatForm((f) => ({ ...f, tipo: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
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
                        className="px-2 py-1 border border-gray-300 rounded text-xs w-28 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <input
                        type="url"
                        value={matForm.url}
                        onChange={(e) => setMatForm((f) => ({ ...f, url: e.target.value }))}
                        placeholder="https://..."
                        className="px-2 py-1 border border-gray-300 rounded text-xs flex-1 min-w-[120px] focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      value={matForm.testo}
                      onChange={(e) => setMatForm((f) => ({ ...f, testo: e.target.value }))}
                      placeholder="Nota..."
                      className="px-2 py-1 border border-gray-300 rounded text-xs flex-1 min-w-[120px] focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  )}

                  <button
                    onClick={() => handleAddMaterial(u.id)}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {unita.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Nessuna unita. Aggiungine una per iniziare.</p>
      )}

      {/* Add / Edit unit form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-800">
            {editingId ? 'Modifica unita' : 'Nuova unita'}
          </h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Titolo</label>
              <input
                type="text"
                value={form.titolo}
                onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))}
                placeholder="es. Introduzione HTML"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-700 mb-1">Ore</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.orePreviste}
                onChange={(e) => setForm((f) => ({ ...f, orePreviste: e.target.value }))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            {editingId && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Stato</label>
                <select
                  value={form.stato}
                  onChange={(e) => setForm((f) => ({ ...f, stato: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value={STATO_UNITA.DA_FARE}>{STATO_UNITA_LABEL[STATO_UNITA.DA_FARE]}</option>
                  <option value={STATO_UNITA.IN_CORSO}>{STATO_UNITA_LABEL[STATO_UNITA.IN_CORSO]}</option>
                  <option value={STATO_UNITA.COMPLETATA}>{STATO_UNITA_LABEL[STATO_UNITA.COMPLETATA]}</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrizione (opzionale)
            </label>
            <textarea
              value={form.descrizione}
              onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
              rows={2}
              placeholder="Obiettivi, appunti..."
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
            >
              {editingId ? 'Salva' : 'Aggiungi'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
            >
              Annulla
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi unita
        </button>
      )}
    </div>
  )
}
