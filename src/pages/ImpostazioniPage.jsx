import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  setAnnoScolasticoConfig,
  onAssegnazioni,
  addAssegnazione,
  deleteAssegnazione,
  onOrari,
  addOrario,
  deleteOrario,
  onVacanze,
  addVacanza,
  deleteVacanza,
} from '../lib/firestore'
import {
  GIORNI_LABEL,
  GIORNI_SHORT,
  ORE_ROMAN,
  TIPO_VACANZA,
  TIPO_VACANZA_LABEL,
} from '../lib/costanti'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

function generateDefaultOre(count, startTime = '08:00') {
  const ore = []
  let [h, m] = startTime.split(':').map(Number)
  for (let i = 0; i < count; i++) {
    const inizio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    h += 1
    const fine = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    ore.push({ numero: i + 1, inizio, fine })
  }
  return ore
}

const ANNO_PATTERN = /^\d{4}-\d{4}$/

export default function ImpostazioniPage() {
  const { annoAttivo, annoConfig, config, loading: configLoading } = useApp()
  const toast = useToast()

  // --- Anno scolastico setup ---
  const [annoInput, setAnnoInput] = useState('')
  const [saving, setSaving] = useState(false)

  // --- Assegnazioni ---
  const [assegnazioni, setAssegnazioni] = useState([])
  const [nuovaClasse, setNuovaClasse] = useState('')
  const [nuovaMateria, setNuovaMateria] = useState('')

  // --- Ore scolastiche ---
  const [oreLezione, setOreLezione] = useState([])
  const [giornoLibero, setGiornoLibero] = useState(null)
  const [dataFineScuola, setDataFineScuola] = useState('')
  const [savingOre, setSavingOre] = useState(false)

  // --- Vacanze/Assenze ---
  const [vacanze, setVacanze] = useState([])
  const [vacanzaForm, setVacanzaForm] = useState({
    nome: '',
    dataInizio: '',
    dataFine: '',
    tipo: TIPO_VACANZA.VACANZA,
  })

  // --- Orari ---
  const [orari, setOrari] = useState([])
  const [orarioForm, setOrarioForm] = useState({
    giorno: 0,
    numeroOra: 1,
    classe: '',
    materia: '',
  })

  // --- Confirm dialog state (shared for all delete operations) ---
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    id: null,
    type: '',
    label: '',
  })

  // Load assegnazioni, orari, vacanze when annoAttivo changes
  useEffect(() => {
    if (!annoAttivo) return
    const unsub1 = onAssegnazioni(annoAttivo, setAssegnazioni)
    const unsub2 = onOrari(annoAttivo, setOrari)
    const unsub3 = onVacanze(annoAttivo, setVacanze)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [annoAttivo])

  // Pre-fill anno input
  useEffect(() => {
    if (annoAttivo) setAnnoInput(annoAttivo)
  }, [annoAttivo])

  // Load ore config from annoConfig
  useEffect(() => {
    if (annoConfig?.oreLezione) {
      setOreLezione(annoConfig.oreLezione)
    }
    setGiornoLibero(annoConfig?.giornoLibero ?? null)
    setDataFineScuola(annoConfig?.dataFineScuola || '')
  }, [annoConfig])

  // Keep orarioForm.giorno valid (skip giorno libero)
  useEffect(() => {
    if (giornoLibero !== null && orarioForm.giorno === giornoLibero) {
      const firstValid = [0, 1, 2, 3, 4, 5].find((g) => g !== giornoLibero)
      setOrarioForm((f) => ({ ...f, giorno: firstValid ?? 0 }))
    }
  }, [giornoLibero])

  // ── Anno scolastico handlers ──

  async function handleSaveAnno(e) {
    e.preventDefault()
    const value = annoInput.trim()
    if (!value) return

    if (!ANNO_PATTERN.test(value)) {
      toast.error('Formato anno non valido. Usa il formato: 2025-2026')
      return
    }

    setSaving(true)
    try {
      await setAnnoScolasticoConfig({
        annoAttivo: value,
        anniScolastici: {
          ...(config?.anniScolastici || {}),
          [value]: config?.anniScolastici?.[value] || {},
        },
      })
      toast.success('Anno scolastico salvato')
    } catch (err) {
      toast.error('Errore nel salvataggio dell\'anno scolastico')
    } finally {
      setSaving(false)
    }
  }

  // ── Assegnazioni handlers ──

  async function handleAddAssegnazione(e) {
    e.preventDefault()
    if (!nuovaClasse.trim() || !nuovaMateria.trim() || !annoAttivo) return
    try {
      await addAssegnazione({
        annoScolastico: annoAttivo,
        classe: nuovaClasse.trim().toUpperCase(),
        materia: nuovaMateria.trim(),
        attiva: true,
        archiviata: false,
      })
      setNuovaClasse('')
      setNuovaMateria('')
      toast.success('Assegnazione aggiunta')
    } catch (err) {
      toast.error('Errore nell\'aggiunta dell\'assegnazione')
    }
  }

  function handleDeleteAssegnazione(id) {
    const a = assegnazioni.find((x) => x.id === id)
    setDeleteConfirm({
      open: true,
      id,
      type: 'assegnazione',
      label: a ? `${a.classe} — ${a.materia}` : 'questa assegnazione',
    })
  }

  // ── Ore scolastiche handlers ──

  function handleSetNumeroOre(count) {
    if (oreLezione.length === 0) {
      // First time: generate defaults
      setOreLezione(generateDefaultOre(count))
    } else if (count > oreLezione.length) {
      // Adding more periods: continue from last end time
      const last = oreLezione[oreLezione.length - 1]
      const additional = generateDefaultOre(count - oreLezione.length, last.fine)
      const renumbered = additional.map((o, i) => ({
        ...o,
        numero: oreLezione.length + i + 1,
      }))
      setOreLezione([...oreLezione, ...renumbered])
    } else {
      // Fewer periods: trim
      setOreLezione(oreLezione.slice(0, count))
    }
  }

  function handleOraChange(index, field, value) {
    setOreLezione((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    )
  }

  async function handleSaveOreConfig() {
    if (!annoAttivo) return
    setSavingOre(true)
    try {
      await setAnnoScolasticoConfig({
        anniScolastici: {
          ...(config?.anniScolastici || {}),
          [annoAttivo]: {
            ...(config?.anniScolastici?.[annoAttivo] || {}),
            oreLezione,
            giornoLibero,
            dataFineScuola: dataFineScuola || null,
          },
        },
      })
      toast.success('Configurazione ore salvata')
    } catch (err) {
      toast.error('Errore nel salvataggio della configurazione ore')
    } finally {
      setSavingOre(false)
    }
  }

  // ── Vacanze handlers ──

  async function handleAddVacanza(e) {
    e.preventDefault()
    if (!vacanzaForm.nome.trim() || !vacanzaForm.dataInizio || !annoAttivo) return

    const dataFine = vacanzaForm.dataFine || vacanzaForm.dataInizio
    if (dataFine < vacanzaForm.dataInizio) {
      toast.error('La data di fine non può essere precedente alla data di inizio')
      return
    }

    try {
      await addVacanza({
        annoScolastico: annoAttivo,
        nome: vacanzaForm.nome.trim(),
        dataInizio: vacanzaForm.dataInizio,
        dataFine,
        tipo: vacanzaForm.tipo,
      })
      setVacanzaForm({ nome: '', dataInizio: '', dataFine: '', tipo: TIPO_VACANZA.VACANZA })
      toast.success('Vacanza aggiunta')
    } catch (err) {
      toast.error('Errore nell\'aggiunta della vacanza')
    }
  }

  function handleDeleteVacanza(id) {
    const v = vacanze.find((x) => x.id === id)
    setDeleteConfirm({
      open: true,
      id,
      type: 'vacanza',
      label: v ? v.nome : 'questa vacanza',
    })
  }

  // ── Orario settimanale handlers ──

  async function handleAddOrario(e) {
    e.preventDefault()
    if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return

    // Derive times from ore config
    const oraConfig = oreLezione.find((o) => o.numero === orarioForm.numeroOra)
    if (!oraConfig) return

    try {
      await addOrario({
        annoScolastico: annoAttivo,
        giorno: orarioForm.giorno,
        numeroOra: orarioForm.numeroOra,
        oraInizio: oraConfig.inizio,
        oraFine: oraConfig.fine,
        classe: orarioForm.classe,
        materia: orarioForm.materia,
        ore: 1,
      })
      setOrarioForm((f) => ({ ...f, classe: '', materia: '' }))
      toast.success('Orario aggiunto')
    } catch (err) {
      toast.error('Errore nell\'aggiunta dell\'orario')
    }
  }

  function handleDeleteOrario(id) {
    const o = orari.find((x) => x.id === id)
    setDeleteConfirm({
      open: true,
      id,
      type: 'orario',
      label: o
        ? `${GIORNI_SHORT[o.giorno]} ${o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] + 'a ora' : o.oraInizio} — ${o.classe}`
        : 'questo slot orario',
    })
  }

  // ── Confirm dialog handler ──

  async function handleConfirmDelete() {
    const { id, type } = deleteConfirm
    setDeleteConfirm({ open: false, id: null, type: '', label: '' })

    try {
      if (type === 'assegnazione') {
        await deleteAssegnazione(id)
      } else if (type === 'vacanza') {
        await deleteVacanza(id)
      } else if (type === 'orario') {
        await deleteOrario(id)
      }
    } catch (err) {
      toast.error('Errore durante l\'eliminazione')
    }
  }

  function handleCancelDelete() {
    setDeleteConfirm({ open: false, id: null, type: '', label: '' })
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

  // Sort orari by giorno then numeroOra/oraInizio
  const orariOrdinati = [...orari].sort(
    (a, b) => a.giorno - b.giorno || (a.numeroOra || 0) - (b.numeroOra || 0) || a.oraInizio.localeCompare(b.oraInizio)
  )

  // Group orari by giorno
  const orariPerGiorno = {}
  for (let g = 0; g < 6; g++) orariPerGiorno[g] = []
  for (const o of orariOrdinati) {
    if (orariPerGiorno[o.giorno]) orariPerGiorno[o.giorno].push(o)
  }

  // Unique classes from assegnazioni for orario dropdown
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()

  const hasOreConfig = oreLezione.length > 0

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

      {/* ── 3. Ore Scolastiche ── */}
      {annoAttivo && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ore Scolastiche
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Configura gli orari delle ore di lezione giornaliere e il giorno libero.
          </p>

          {/* Numero ore */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ore giornaliere
            </label>
            <div className="flex gap-2">
              {[4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSetNumeroOre(n)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                    oreLezione.length === n
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Tabella ore */}
          {oreLezione.length > 0 && (
            <div className="mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-2 w-16">Ora</th>
                    <th className="pb-2">Inizio</th>
                    <th className="pb-2">Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {oreLezione.map((ora, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-semibold text-gray-700">
                        {ORE_ROMAN[i]}
                      </td>
                      <td className="py-2">
                        <input
                          type="time"
                          value={ora.inizio}
                          onChange={(e) => handleOraChange(i, 'inizio', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="time"
                          value={ora.fine}
                          onChange={(e) => handleOraChange(i, 'fine', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Giorno libero */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Giorno libero
            </label>
            <select
              value={giornoLibero ?? ''}
              onChange={(e) =>
                setGiornoLibero(e.target.value === '' ? null : Number(e.target.value))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Nessuno</option>
              {GIORNI_LABEL.map((g, i) => (
                <option key={i} value={i}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Data fine scuola */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ultimo giorno di scuola
            </label>
            <input
              type="date"
              value={dataFineScuola}
              onChange={(e) => setDataFineScuola(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Serve per calcolare le ore rimanenti per ogni classe.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveOreConfig}
            disabled={savingOre || oreLezione.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {savingOre ? 'Salvataggio...' : 'Salva configurazione'}
          </button>
        </section>
      )}

      {/* ── 4. Vacanze e Assenze ── */}
      {annoAttivo && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Vacanze e Assenze
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Inserisci periodi di vacanza, chiusure e giorni di assenza personale. Servono per calcolare le ore effettive disponibili.
          </p>

          <form onSubmit={handleAddVacanza} className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={vacanzaForm.nome}
                onChange={(e) => setVacanzaForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="es. Vacanze di Natale"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dal</label>
              <input
                type="date"
                value={vacanzaForm.dataInizio}
                onChange={(e) => setVacanzaForm((f) => ({ ...f, dataInizio: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Al</label>
              <input
                type="date"
                value={vacanzaForm.dataFine}
                onChange={(e) => setVacanzaForm((f) => ({ ...f, dataFine: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={vacanzaForm.tipo}
                onChange={(e) => setVacanzaForm((f) => ({ ...f, tipo: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {Object.values(TIPO_VACANZA).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_VACANZA_LABEL[tipo]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!vacanzaForm.nome.trim() || !vacanzaForm.dataInizio}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </form>

          {vacanze.length > 0 ? (
            <div className="space-y-2">
              {[...vacanze]
                .sort((a, b) => a.dataInizio.localeCompare(b.dataInizio))
                .map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          v.tipo === TIPO_VACANZA.VACANZA
                            ? 'bg-orange-100 text-orange-700'
                            : v.tipo === TIPO_VACANZA.CHIUSURA
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {TIPO_VACANZA_LABEL[v.tipo] || v.tipo}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{v.nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-mono">
                        {v.dataInizio === v.dataFine
                          ? v.dataInizio
                          : `${v.dataInizio} → ${v.dataFine}`}
                      </span>
                      <button
                        onClick={() => handleDeleteVacanza(v.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessuna vacanza o assenza inserita.</p>
          )}
        </section>
      )}

      {/* ── 5. Orario Settimanale ── */}
      {annoAttivo && assegnazioni.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Orario Settimanale
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Definisci il tuo orario ricorrente. Seleziona giorno, ora e classe.
          </p>

          {!hasOreConfig && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Configura prima le <strong>Ore Scolastiche</strong> qui sopra per poter inserire l'orario in modo rapido.
              </p>
            </div>
          )}

          {hasOreConfig ? (
            /* ── Form semplificato con numero ora ── */
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
                  {GIORNI_LABEL.map((g, i) => {
                    if (i === giornoLibero) return null
                    return (
                      <option key={i} value={i}>
                        {g}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
                <select
                  value={orarioForm.numeroOra}
                  onChange={(e) =>
                    setOrarioForm((f) => ({ ...f, numeroOra: Number(e.target.value) }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {oreLezione.map((o) => (
                    <option key={o.numero} value={o.numero}>
                      {ORE_ROMAN[o.numero - 1]} ({o.inizio}–{o.fine})
                    </option>
                  ))}
                </select>
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
              <button
                type="submit"
                disabled={!orarioForm.classe}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Aggiungi
              </button>
            </form>
          ) : (
            /* ── Fallback: form manuale (senza config ore) ── */
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return
              try {
                await addOrario({
                  annoScolastico: annoAttivo,
                  giorno: orarioForm.giorno,
                  oraInizio: orarioForm.oraInizio || '08:00',
                  oraFine: orarioForm.oraFine || '09:00',
                  classe: orarioForm.classe,
                  materia: orarioForm.materia,
                  ore: 1,
                })
                setOrarioForm((f) => ({ ...f, classe: '', materia: '' }))
                toast.success('Orario aggiunto')
              } catch (err) {
                toast.error('Errore nell\'aggiunta dell\'orario')
              }
            }} className="flex flex-wrap items-end gap-3 mb-6">
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
                    <option key={i} value={i}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inizio</label>
                <input
                  type="time"
                  value={orarioForm.oraInizio || '08:00'}
                  onChange={(e) => setOrarioForm((f) => ({ ...f, oraInizio: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fine</label>
                <input
                  type="time"
                  value={orarioForm.oraFine || '09:00'}
                  onChange={(e) => setOrarioForm((f) => ({ ...f, oraFine: e.target.value }))}
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
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!orarioForm.classe}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Aggiungi
              </button>
            </form>
          )}

          {/* Orario display per giorno */}
          <div className="space-y-4">
            {GIORNI_LABEL.map((giornoLabel, gi) => {
              if (gi === giornoLibero) return null
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
                        <span className="font-semibold text-blue-600 w-10 shrink-0">
                          {o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] : '—'}
                        </span>
                        <span className="font-mono text-gray-400 w-28 shrink-0 text-xs">
                          {o.oraInizio} – {o.oraFine}
                        </span>
                        <span className="font-semibold text-gray-800 w-12">
                          {o.classe}
                        </span>
                        <span className="text-gray-600 flex-1">{o.materia}</span>
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

            {/* Show free day indicator */}
            {giornoLibero !== null && (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-400 italic">
                {GIORNI_LABEL[giornoLibero]} — giorno libero
              </div>
            )}

            {orari.length === 0 && (
              <p className="text-sm text-gray-400">
                Nessun orario definito. Aggiungi i tuoi slot settimanali sopra.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Confirm Dialog (shared) ── */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Conferma eliminazione"
        message={`Vuoi eliminare ${deleteConfirm.label}?`}
        confirmText="Elimina"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
