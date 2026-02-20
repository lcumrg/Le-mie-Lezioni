import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  onPercorsi,
  addPercorso,
  updatePercorso,
  deletePercorso,
  onAssegnazioni,
} from '../lib/firestore'
import UnitaPanel from '../components/percorsi/UnitaPanel'
import LoadingSpinner from '../components/common/LoadingSpinner'

export default function PercorsiPage() {
  const { annoAttivo, loading: configLoading } = useApp()
  const [percorsi, setPercorsi] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Form
  const [form, setForm] = useState({
    titolo: '',
    classe: '',
    materia: '',
    descrizione: '',
  })

  useEffect(() => {
    if (!annoAttivo) {
      setLoading(false)
      return
    }

    const unsub1 = onPercorsi((all) => {
      setPercorsi(all.filter((p) => p.annoScolastico === annoAttivo))
      setLoading(false)
    })
    const unsub2 = onAssegnazioni(annoAttivo, setAssegnazioni)

    return () => { unsub1(); unsub2() }
  }, [annoAttivo])

  function resetForm() {
    setForm({ titolo: '', classe: '', materia: '', descrizione: '' })
    setShowForm(false)
    setEditingId(null)
  }

  // Auto-fill materia when classe changes
  function handleClasseChange(classe) {
    const match = assegnazioni.find((a) => a.classe === classe)
    setForm((f) => ({ ...f, classe, materia: match ? match.materia : f.materia }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titolo.trim() || !form.classe) return

    if (editingId) {
      await updatePercorso(editingId, {
        titolo: form.titolo.trim(),
        classe: form.classe,
        materia: form.materia.trim(),
        descrizione: form.descrizione.trim(),
      })
    } else {
      await addPercorso({
        annoScolastico: annoAttivo,
        titolo: form.titolo.trim(),
        classe: form.classe,
        materia: form.materia.trim(),
        descrizione: form.descrizione.trim(),
      })
    }
    resetForm()
  }

  function startEdit(p) {
    setForm({
      titolo: p.titolo,
      classe: p.classe,
      materia: p.materia || '',
      descrizione: p.descrizione || '',
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    await deletePercorso(id)
    if (expandedId === id) setExpandedId(null)
    if (editingId === id) resetForm()
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

  // Group percorsi by classe
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()
  const percorsiPerClasse = {}
  for (const c of classiDisponibili) percorsiPerClasse[c] = []
  for (const p of percorsi) {
    if (!percorsiPerClasse[p.classe]) percorsiPerClasse[p.classe] = []
    percorsiPerClasse[p.classe].push(p)
  }
  // Sort each group by title
  for (const arr of Object.values(percorsiPerClasse)) {
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Classe</label>
                <select
                  value={form.classe}
                  onChange={(e) => handleClasseChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">—</option>
                  {classiDisponibili.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Materia</label>
                <input
                  type="text"
                  value={form.materia}
                  onChange={(e) => setForm((f) => ({ ...f, materia: e.target.value }))}
                  placeholder="es. Informatica"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
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
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!form.titolo.trim() || !form.classe}
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

      {/* Percorsi grouped by class */}
      {Object.entries(percorsiPerClasse).map(([classe, classPercorsi]) => {
        if (classPercorsi.length === 0) return null
        return (
          <div key={classe} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-sm font-bold">
                {classe}
              </span>
              {assegnazioni.find((a) => a.classe === classe)?.materia && (
                <span className="text-sm font-normal text-gray-500">
                  {assegnazioni.find((a) => a.classe === classe).materia}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {classPercorsi.map((p) => (
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
                    </div>

                    {/* Actions */}
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(p) }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                      className="text-red-300 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded: units */}
                  {expandedId === p.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100">
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
    </div>
  )
}
