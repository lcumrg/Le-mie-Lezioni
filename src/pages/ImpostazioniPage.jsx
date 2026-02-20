import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  setAnnoScolasticoConfig,
  onAssegnazioni,
  addAssegnazione,
  deleteAssegnazione,
  onOrari,
  addOrario,
  deleteOrario,
} from '../lib/firestore'
import LoadingSpinner from '../components/common/LoadingSpinner'

const GIORNI_LABEL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

export default function ImpostazioniPage() {
  const { annoAttivo, config, loading: configLoading } = useApp()

  // --- Anno scolastico setup ---
  const [annoInput, setAnnoInput] = useState('')
  const [saving, setSaving] = useState(false)

  // --- Assegnazioni ---
  const [assegnazioni, setAssegnazioni] = useState([])
  const [nuovaClasse, setNuovaClasse] = useState('')
  const [nuovaMateria, setNuovaMateria] = useState('')

  // --- Orari ---
  const [orari, setOrari] = useState([])
  const [orarioForm, setOrarioForm] = useState({
    giorno: 0,
    oraInizio: '08:00',
    oraFine: '09:00',
    classe: '',
    materia: '',
    ore: 1,
  })

  // Load assegnazioni & orari when annoAttivo changes
  useEffect(() => {
    if (!annoAttivo) return
    const unsub1 = onAssegnazioni(annoAttivo, setAssegnazioni)
    const unsub2 = onOrari(annoAttivo, setOrari)
    return () => { unsub1(); unsub2() }
  }, [annoAttivo])

  // Pre-fill anno input
  useEffect(() => {
    if (annoAttivo) setAnnoInput(annoAttivo)
  }, [annoAttivo])

  async function handleSaveAnno(e) {
    e.preventDefault()
    if (!annoInput.trim()) return
    setSaving(true)
    await setAnnoScolasticoConfig({
      annoAttivo: annoInput.trim(),
      anniScolastici: {
        ...(config?.anniScolastici || {}),
        [annoInput.trim()]: config?.anniScolastici?.[annoInput.trim()] || {},
      },
    })
    setSaving(false)
  }

  async function handleAddAssegnazione(e) {
    e.preventDefault()
    if (!nuovaClasse.trim() || !nuovaMateria.trim() || !annoAttivo) return
    await addAssegnazione({
      annoScolastico: annoAttivo,
      classe: nuovaClasse.trim().toUpperCase(),
      materia: nuovaMateria.trim(),
      attiva: true,
      archiviata: false,
    })
    setNuovaClasse('')
    setNuovaMateria('')
  }

  async function handleDeleteAssegnazione(id) {
    await deleteAssegnazione(id)
  }

  async function handleAddOrario(e) {
    e.preventDefault()
    if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return
    await addOrario({
      annoScolastico: annoAttivo,
      giorno: orarioForm.giorno,
      oraInizio: orarioForm.oraInizio,
      oraFine: orarioForm.oraFine,
      classe: orarioForm.classe,
      materia: orarioForm.materia,
      ore: Number(orarioForm.ore),
    })
    setOrarioForm((f) => ({ ...f, classe: '', materia: '' }))
  }

  async function handleDeleteOrario(id) {
    await deleteOrario(id)
  }

  // Auto-fill materia when classe is selected in orario form
  function handleOrarioClasseChange(classe) {
    const match = assegnazioni.find((a) => a.classe === classe)
    setOrarioForm((f) => ({
      ...f,
      classe,
      materia: match ? match.materia : f.materia,
    }))
  }

  if (configLoading) return <LoadingSpinner />

  // Sort orari by giorno then oraInizio
  const orariOrdinati = [...orari].sort(
    (a, b) => a.giorno - b.giorno || a.oraInizio.localeCompare(b.oraInizio)
  )

  // Group orari by giorno
  const orariPerGiorno = {}
  for (let g = 0; g < 6; g++) orariPerGiorno[g] = []
  for (const o of orariOrdinati) {
    if (orariPerGiorno[o.giorno]) orariPerGiorno[o.giorno].push(o)
  }

  // Unique classes from assegnazioni for orario dropdown
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>

      {/* ── 1. Anno Scolastico ── */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Anno Scolastico</h2>
        <form onSubmit={handleSaveAnno} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anno attivo
            </label>
            <input
              type="text"
              value={annoInput}
              onChange={(e) => setAnnoInput(e.target.value)}
              placeholder="es. 2025-2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </form>
        {annoAttivo && (
          <p className="mt-2 text-sm text-green-600">
            Anno attivo: <strong>{annoAttivo}</strong>
          </p>
        )}
      </section>

      {/* ── 2. Assegnazioni (classi/materie) ── */}
      {annoAttivo && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Classi e Materie
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Aggiungi le classi che insegni quest'anno con la relativa materia.
          </p>

          <form onSubmit={handleAddAssegnazione} className="flex items-end gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
              <input
                type="text"
                value={nuovaClasse}
                onChange={(e) => setNuovaClasse(e.target.value)}
                placeholder="es. 1A"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
              <input
                type="text"
                value={nuovaMateria}
                onChange={(e) => setNuovaMateria(e.target.value)}
                placeholder="es. Informatica"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Aggiungi
            </button>
          </form>

          {assegnazioni.length > 0 ? (
            <div className="space-y-2">
              {assegnazioni
                .sort((a, b) => a.classe.localeCompare(b.classe))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm">
                      <strong>{a.classe}</strong> — {a.materia}
                    </span>
                    <button
                      onClick={() => handleDeleteAssegnazione(a.id)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessuna assegnazione ancora.</p>
          )}
        </section>
      )}

      {/* ── 3. Orario Settimanale ── */}
      {annoAttivo && assegnazioni.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Orario Settimanale
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Definisci il tuo orario ricorrente. Per ogni slot indica giorno, ora e classe.
          </p>

          <form onSubmit={handleAddOrario} className="flex flex-wrap items-end gap-3 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giorno</label>
              <select
                value={orarioForm.giorno}
                onChange={(e) =>
                  setOrarioForm((f) => ({ ...f, giorno: Number(e.target.value) }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {GIORNI_LABEL.map((g, i) => (
                  <option key={i} value={i}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inizio</label>
              <input
                type="time"
                value={orarioForm.oraInizio}
                onChange={(e) =>
                  setOrarioForm((f) => ({ ...f, oraInizio: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fine</label>
              <input
                type="time"
                value={orarioForm.oraFine}
                onChange={(e) =>
                  setOrarioForm((f) => ({ ...f, oraFine: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
              <select
                value={orarioForm.classe}
                onChange={(e) => handleOrarioClasseChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">—</option>
                {classiDisponibili.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ore</label>
              <input
                type="number"
                min={1}
                max={4}
                value={orarioForm.ore}
                onChange={(e) =>
                  setOrarioForm((f) => ({ ...f, ore: e.target.value }))
                }
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!orarioForm.classe}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </form>

          {/* Orario grid per giorno */}
          <div className="space-y-4">
            {GIORNI_LABEL.map((giornoLabel, gi) => {
              const slots = orariPerGiorno[gi] || []
              if (slots.length === 0) return null
              return (
                <div key={gi}>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    {giornoLabel}
                  </h3>
                  <div className="space-y-1">
                    {slots.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
                      >
                        <span className="font-mono text-gray-500 w-28 shrink-0">
                          {o.oraInizio} – {o.oraFine}
                        </span>
                        <span className="font-semibold text-gray-800 w-12">
                          {o.classe}
                        </span>
                        <span className="text-gray-600 flex-1">{o.materia}</span>
                        <span className="text-gray-400 w-8">{o.ore}h</span>
                        <button
                          onClick={() => handleDeleteOrario(o.id)}
                          className="text-red-400 hover:text-red-600 ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {orari.length === 0 && (
              <p className="text-sm text-gray-400">
                Nessun orario definito. Aggiungi i tuoi slot settimanali sopra.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
