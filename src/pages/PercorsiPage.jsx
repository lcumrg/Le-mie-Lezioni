import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  onPercorsi,
  addPercorso,
  updatePercorso,
  deletePercorso,
  onAssegnazioni,
  getUnita,
  addUnita,
} from '../lib/firestore'
import UnitaPanel from '../components/percorsi/UnitaPanel'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function PercorsiPage() {
  const { annoAttivo, loading: configLoading } = useApp()
  const toast = useToast()
  const [percorsi, setPercorsi] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Note inline editing state
  const [editingNoteText, setEditingNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)

  // Expanded note display (collapsed by default in header)
  const [noteExpandedIds, setNoteExpandedIds] = useState(new Set())

  // Duplicate feature state
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [duplicateClasse, setDuplicateClasse] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  // Form
  const [form, setForm] = useState({
    titolo: '',
    classe: '',
    materia: '',
    descrizione: '',
    note: '',
  })

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

  function resetForm() {
    setForm({ titolo: '', classe: '', materia: '', descrizione: '', note: '' })
    setShowForm(false)
    setEditingId(null)
  }

  // Auto-fill materia when an assegnazione is selected (classe||materia)
  function handleAssegnazioneChange(value) {
    const [classe, materia] = value.split('||')
    setForm((f) => ({ ...f, classe: classe || '', materia: materia || '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titolo.trim()) {
      toast.error('Inserisci un titolo per il percorso.')
      return
    }
    if (!form.classe || !form.materia) {
      toast.error('Seleziona classe e materia.')
      return
    }

    try {
      if (editingId) {
        await updatePercorso(editingId, {
          titolo: form.titolo.trim(),
          classe: form.classe,
          materia: form.materia.trim(),
          descrizione: form.descrizione.trim(),
          note: form.note.trim(),
        })
      } else {
        await addPercorso({
          annoScolastico: annoAttivo,
          titolo: form.titolo.trim(),
          classe: form.classe,
          materia: form.materia.trim(),
          descrizione: form.descrizione.trim(),
          note: form.note.trim(),
        })
      }
      resetForm()
    } catch (err) {
      toast.error('Errore durante il salvataggio del percorso.')
    }
  }

  function startEdit(p) {
    setForm({
      titolo: p.titolo,
      classe: p.classe,
      materia: p.materia || '',
      descrizione: p.descrizione || '',
      note: p.note || '',
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    try {
      await deletePercorso(id)
      if (expandedId === id) setExpandedId(null)
      if (editingId === id) resetForm()
    } catch (err) {
      toast.error('Errore durante l\'eliminazione del percorso.')
    }
    setDeleteConfirm(null)
  }

  // Toggle note expanded in header
  function toggleNoteExpanded(id, e) {
    e.stopPropagation()
    setNoteExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Inline note editing: start
  function startNoteEdit(p) {
    setEditingNoteId(p.id)
    setEditingNoteText(p.note || '')
  }

  // Inline note editing: save on blur
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

  // Duplicate percorso to another class+materia
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
      // Clone the percorso
      const newPercorsoRef = await addPercorso({
        annoScolastico: annoAttivo,
        titolo: percorso.titolo,
        classe: destClasse,
        materia: destMateria || '',
        descrizione: percorso.descrizione || '',
        note: percorso.note || '',
      })

      // Clone all unita from the original percorso
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

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Percorsi</h2>
        <p className="text-gray-500">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  // Assegnazioni sorted for dropdowns
  const assegnazioniOrdinati = [...assegnazioni].sort((a, b) =>
    a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)
  )
  // Keep classiDisponibili for duplicate dropdown
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()

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
  // Sort each group by title
  for (const arr of Object.values(percorsiPerAssegnazione)) {
    arr.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || ''))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Percorsi Didattici</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuovo percorso
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="mb-6 bg-blue-50 rounded-lg border border-blue-200 p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">
            {editingId ? 'Modifica percorso' : 'Nuovo percorso'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Titolo</label>
                <input
                  type="text"
                  value={form.titolo}
                  onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))}
                  placeholder="es. Introduzione alla programmazione"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Classe — Materia</label>
                <select
                  value={form.classe ? `${form.classe}||${form.materia}` : ''}
                  onChange={(e) => handleAssegnazioneChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">—</option>
                  {assegnazioniOrdinati.map((a) => (
                    <option key={`${a.classe}||${a.materia}`} value={`${a.classe}||${a.materia}`}>
                      {a.classe} — {a.materia}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Descrizione (opzionale)
              </label>
              <textarea
                value={form.descrizione}
                onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
                rows={2}
                placeholder="Obiettivi generali del percorso..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Note (opzionale)
              </label>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                placeholder="Annotazioni, appunti, promemoria..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!form.titolo.trim() || !form.classe || !form.materia}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingId ? 'Salva' : 'Crea percorso'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Percorsi grouped by classe+materia */}
      {Object.entries(percorsiPerAssegnazione).map(([key, groupPercorsi]) => {
        if (groupPercorsi.length === 0) return null
        const [groupClasse, groupMateria] = key.split('||')
        return (
          <div key={key} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-sm font-bold">
                {groupClasse}
              </span>
              {groupMateria && (
                <span className="text-sm font-normal text-gray-500">
                  {groupMateria}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {groupPercorsi.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* Percorso header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    {/* Expand arrow */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${
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
                      <h3 className="text-sm font-semibold text-gray-900">{p.titolo}</h3>
                      {p.descrizione && (
                        <p className="text-xs text-gray-500 truncate">{p.descrizione}</p>
                      )}
                      {/* Collapsed note indicator in header */}
                      {p.note && (
                        <button
                          onClick={(e) => toggleNoteExpanded(p.id, e)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {noteExpandedIds.has(p.id) ? 'Nascondi note' : 'Mostra note'}
                        </button>
                      )}
                      {p.note && noteExpandedIds.has(p.id) && (
                        <p
                          className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 whitespace-pre-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.note}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {/* Duplicate button */}
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
                      className="text-gray-400 hover:text-blue-600"
                      title="Duplica in altra classe"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(p) }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: p.id, titolo: p.titolo }) }}
                      className="text-red-300 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Duplicate inline form */}
                  {duplicatingId === p.id && (
                    <div
                      className="px-4 py-3 bg-blue-50 border-t border-blue-200 flex items-center gap-3 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs font-medium text-blue-800">Duplica in:</span>
                      <select
                        value={duplicateClasse}
                        onChange={(e) => setDuplicateClasse(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {duplicating ? 'Duplicazione...' : 'Conferma'}
                      </button>
                      <button
                        onClick={() => { setDuplicatingId(null); setDuplicateClasse('') }}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200"
                      >
                        Annulla
                      </button>
                    </div>
                  )}

                  {/* Expanded: inline note editor + units */}
                  {expandedId === p.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                      {/* Inline note editor */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-600">Note</label>
                          {editingNoteId !== p.id && (
                            <button
                              onClick={() => startNoteEdit(p)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none bg-amber-50"
                            autoFocus
                          />
                        ) : p.note ? (
                          <p
                            className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 whitespace-pre-wrap cursor-pointer hover:bg-amber-100"
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

      {percorsi.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-3">
            Nessun percorso ancora. Crea il tuo primo percorso didattico!
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Crea percorso
          </button>
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
