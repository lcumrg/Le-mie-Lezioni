import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  getAssegnazioni,
  getPercorsi,
  clonePercorsiSelezionati,
} from '../lib/firestore'
import { isAnnoValido, annoSuccessivo, annoPrecedente, classeSuccessiva } from '../lib/anni'
import { TIPO_VACANZA, TIPO_VACANZA_LABEL } from '../lib/costanti'
import StepWizard from '../components/common/StepWizard'
import AssegnazioniEditor from '../components/impostazioni/AssegnazioniEditor'
import OreScolasticheEditor from '../components/impostazioni/OreScolasticheEditor'
import OrarioEditor from '../components/impostazioni/OrarioEditor'
import LoadingSpinner from '../components/common/LoadingSpinner'

const STEPS = ['Anno', 'Classi', 'Ore e date', 'Orario', 'Vacanze', 'Riepilogo']

export default function NuovoAnnoPage() {
  const { config, annoAttivo, annoConfig, annoChiuso, loading: configLoading } = useApp()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // ── Step 0: anno ──
  // Default: l'anno dopo quello attivo se questo è finito/chiuso (flusso
  // tipico di fine anno); l'anno attivo stesso se sembra appena creato
  // (ripresa del wizard a metà)
  const [annoInput, setAnnoInput] = useState(() => {
    if (!annoAttivo) return ''
    const cfg = config?.anniScolastici?.[annoAttivo] || {}
    const sembraNuovo = !cfg.dataFineScuola && !cfg.chiuso
    return sembraNuovo ? annoAttivo : annoSuccessivo(annoAttivo) || ''
  })
  const [copiaConfig, setCopiaConfig] = useState(true)

  // ── Dati live dell'anno attivo (si aggiornano da soli dopo lo step 0) ──
  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [vacanze, setVacanze] = useState([])
  useEffect(() => {
    if (!annoAttivo) return
    const unsubs = [
      onAssegnazioni(annoAttivo, (data) => setAssegnazioni(data.filter((a) => a.attiva && !a.archiviata))),
      onOrari(annoAttivo, setOrari),
      onVacanze(annoAttivo, setVacanze),
    ]
    return () => unsubs.forEach((u) => u())
  }, [annoAttivo])

  // ── Anno precedente: suggerimenti classi + percorsi da clonare ──
  const annoOrigine = annoPrecedente(annoAttivo)
  const origineEsiste = !!(annoOrigine && config?.anniScolastici?.[annoOrigine])
  const [suggerimenti, setSuggerimenti] = useState([])
  useEffect(() => {
    if (step < 1 || !origineEsiste) return
    let cancelled = false
    getAssegnazioni(annoOrigine)
      .then((data) => { if (!cancelled) setSuggerimenti(data.filter((a) => a.attiva !== false)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [step, annoOrigine, origineEsiste])

  // ── Step 2: ore e date (stato locale, salvato su Avanti) ──
  const [oreLezione, setOreLezione] = useState([])
  const [giornoLibero, setGiornoLibero] = useState(null)
  const [dataInizioScuola, setDataInizioScuola] = useState('')
  const [dataFineScuola, setDataFineScuola] = useState('')
  // Inizializza dallo stato salvato quando si entra nello step (per anno)
  const [oreInitAnno, setOreInitAnno] = useState(null)
  if (step === 2 && oreInitAnno !== annoAttivo) {
    setOreInitAnno(annoAttivo)
    setOreLezione(annoConfig?.oreLezione || [])
    setGiornoLibero(annoConfig?.giornoLibero ?? null)
    setDataInizioScuola(annoConfig?.dataInizioScuola || '')
    setDataFineScuola(annoConfig?.dataFineScuola || '')
  }

  // ── Step 4: vacanze (form a periodi) ──
  const [vacForm, setVacForm] = useState({ nome: '', tipo: TIPO_VACANZA.VACANZA, dataInizio: '', dataFine: '' })

  // ── Step 5: clonazione percorsi ──
  const [percorsiOrigine, setPercorsiOrigine] = useState(null) // null = non caricati
  const [cloneSel, setCloneSel] = useState({})
  const [cloning, setCloning] = useState(false)
  const [clonati, setClonati] = useState(0)
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()
  useEffect(() => {
    if (step !== 5 || !origineEsiste || percorsiOrigine !== null) return
    let cancelled = false
    getPercorsi(annoOrigine)
      .then((percorsi) => {
        if (cancelled) return
        setPercorsiOrigine(percorsi)
        const sel = {}
        for (const p of percorsi) {
          const avanzata = classeSuccessiva(p.classe)
          const classe = avanzata && classiDisponibili.includes(avanzata)
            ? avanzata
            : classiDisponibili.includes(p.classe)
              ? p.classe
              : classiDisponibili[0] || ''
          sel[p.id] = { selected: true, classe }
        }
        setCloneSel(sel)
      })
      .catch(() => { if (!cancelled) toast.error('Errore nel caricamento dei percorsi da clonare') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, annoOrigine, origineEsiste, percorsiOrigine])

  // ── Azioni ──

  async function handleCreaAnno() {
    const value = annoInput.trim()
    if (!isAnnoValido(value)) {
      toast.error('Formato anno non valido: servono due anni consecutivi, es. 2026-2027')
      return
    }
    if (value === annoAttivo) {
      if (annoChiuso) {
        toast.error(`L'anno ${value} è chiuso: indica un anno nuovo da creare`)
        return
      }
      setStep(1)
      return
    }
    setBusy(true)
    try {
      const origineCfg = annoAttivo ? config?.anniScolastici?.[annoAttivo] : null
      const esistente = config?.anniScolastici?.[value]
      const base = esistente || (copiaConfig && origineCfg
        ? { oreLezione: origineCfg.oreLezione || [], giornoLibero: origineCfg.giornoLibero ?? null }
        : {})
      await setAnnoScolasticoConfig({
        annoAttivo: value,
        anniScolastici: { ...(config?.anniScolastici || {}), [value]: base },
      })
      toast.success(`Anno ${value} creato e attivato`)
      setStep(1)
    } catch {
      toast.error("Errore nella creazione dell'anno scolastico")
    } finally {
      setBusy(false)
    }
  }

  async function handleAddAssegnazione(classe, materia) {
    try {
      await addAssegnazione({ annoScolastico: annoAttivo, classe, materia, attiva: true, archiviata: false })
    } catch {
      toast.error("Errore nell'aggiunta dell'assegnazione")
    }
  }

  async function handleSalvaOre() {
    setBusy(true)
    try {
      await setAnnoScolasticoConfig({
        anniScolastici: {
          ...(config?.anniScolastici || {}),
          [annoAttivo]: {
            ...(config?.anniScolastici?.[annoAttivo] || {}),
            oreLezione,
            giornoLibero,
            dataInizioScuola: dataInizioScuola || null,
            dataFineScuola: dataFineScuola || null,
          },
        },
      })
      setStep(3)
    } catch {
      toast.error('Errore nel salvataggio della configurazione ore')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddOrario({ giorno, numeroOra, classe, materia }) {
    const oraConfig = (annoConfig?.oreLezione || []).find((o) => o.numero === numeroOra)
    if (!oraConfig) return
    try {
      await addOrario({
        annoScolastico: annoAttivo,
        giorno,
        numeroOra,
        oraInizio: oraConfig.inizio,
        oraFine: oraConfig.fine,
        classe,
        materia,
        ore: 1,
      })
    } catch {
      toast.error("Errore nell'aggiunta dell'orario")
    }
  }

  async function handleAddVacanza(e) {
    e.preventDefault()
    const { nome, tipo, dataInizio } = vacForm
    const dataFine = vacForm.dataFine || dataInizio
    if (!nome.trim() || !dataInizio) return
    if (dataFine < dataInizio) {
      toast.error('La data di fine precede quella di inizio')
      return
    }
    try {
      await addVacanza({ annoScolastico: annoAttivo, nome: nome.trim(), dataInizio, dataFine, tipo })
      setVacForm({ nome: '', tipo: TIPO_VACANZA.VACANZA, dataInizio: '', dataFine: '' })
    } catch {
      toast.error("Errore nell'aggiunta della vacanza")
    }
  }

  async function handleClone() {
    const selezioni = (percorsiOrigine || [])
      .filter((p) => cloneSel[p.id]?.selected)
      .map((p) => ({ percorso: p, classeDestinazione: cloneSel[p.id].classe || p.classe }))
    if (selezioni.length === 0) return
    setCloning(true)
    try {
      const count = await clonePercorsiSelezionati(annoAttivo, selezioni)
      setClonati(count)
      toast.success(`${count} percorsi clonati in ${annoAttivo}`)
    } catch {
      toast.error('Errore durante la clonazione dei percorsi')
    } finally {
      setCloning(false)
    }
  }

  function handleNext() {
    if (step === 0) handleCreaAnno()
    else if (step === 2) handleSalvaOre()
    else if (step === 5) {
      toast.success(`L'anno ${annoAttivo} è pronto. Buon lavoro!`)
      navigate('/')
    } else setStep(step + 1)
  }

  const nextDisabled =
    (step === 0 && !annoInput.trim()) ||
    (step === 1 && assegnazioni.length === 0) ||
    (step === 2 && oreLezione.length === 0)

  if (configLoading) return <LoadingSpinner />

  const origineCfg = annoAttivo ? config?.anniScolastici?.[annoAttivo] : null
  const numSelezionati = (percorsiOrigine || []).filter((p) => cloneSel[p.id]?.selected).length

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-1">Nuovo anno scolastico</h1>
      <p className="text-sm text-fg-muted mb-6">
        Sei passi per partire: puoi interrompere e riprendere quando vuoi, ogni passo salva subito.
      </p>

      <StepWizard
        steps={STEPS}
        current={step}
        onBack={() => setStep(Math.max(0, step - 1))}
        onNext={handleNext}
        nextLabel={step === 5 ? 'Fine' : 'Avanti'}
        nextDisabled={nextDisabled}
        busy={busy}
      >
        {/* ── Step 0: Anno ── */}
        {step === 0 && (
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1">Nuovo anno scolastico</label>
            <input
              type="text"
              value={annoInput}
              onChange={(e) => setAnnoInput(e.target.value)}
              placeholder="es. 2026-2027"
              className="w-48 px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
            />
            {annoAttivo && annoInput.trim() !== annoAttivo && (
              <label className="mt-4 flex items-start gap-2 text-sm text-fg cursor-pointer">
                <input
                  type="checkbox"
                  checked={copiaConfig}
                  onChange={(e) => setCopiaConfig(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Copia le <strong>ore scolastiche</strong> e il <strong>giorno libero</strong> da {annoAttivo}
                  {!origineCfg?.oreLezione?.length && (
                    <span className="text-fg-subtle"> (l'anno {annoAttivo} non ha ore configurate)</span>
                  )}
                </span>
              </label>
            )}
            <p className="mt-4 text-xs text-fg-subtle">
              Creando il nuovo anno, {annoAttivo ? `${annoAttivo} resta consultabile dall'Archivio e dal selettore in alto a sinistra` : "l'app si attiva su quell'anno"}.
              {annoAttivo && !annoChiuso && (
                <> Consiglio: dopo il wizard, chiudi {annoAttivo} dalle <Link to="/impostazioni#anno" className="underline">Impostazioni</Link> per proteggerlo da modifiche accidentali.</>
              )}
            </p>
          </div>
        )}

        {/* ── Step 1: Classi ── */}
        {step === 1 && (
          <div>
            <p className="text-sm text-fg-muted mb-4">
              Le classi che insegni nel {annoAttivo}, con la materia.
              {suggerimenti.length > 0 && ' Se segui gli stessi studenti, ricorda che le classi avanzano (1A → 2A).'}
            </p>
            <AssegnazioniEditor
              assegnazioni={assegnazioni}
              onAdd={handleAddAssegnazione}
              onDelete={(id) => deleteAssegnazione(id).catch(() => toast.error("Errore durante l'eliminazione"))}
              suggerimenti={suggerimenti}
            />
          </div>
        )}

        {/* ── Step 2: Ore e date ── */}
        {step === 2 && (
          <div>
            <p className="text-sm text-fg-muted mb-4">
              Gli orari delle ore di lezione, il giorno libero e le date del {annoAttivo}. Le date servono a
              timeline, generazione lezioni e conteggio ore: vale la pena metterle subito.
            </p>
            <OreScolasticheEditor
              oreLezione={oreLezione}
              giornoLibero={giornoLibero}
              dataInizioScuola={dataInizioScuola}
              dataFineScuola={dataFineScuola}
              onOreChange={setOreLezione}
              onGiornoLiberoChange={setGiornoLibero}
              onDataInizioChange={setDataInizioScuola}
              onDataFineChange={setDataFineScuola}
            />
            <p className="text-xs text-fg-subtle">"Avanti" salva la configurazione.</p>
          </div>
        )}

        {/* ── Step 3: Orario ── */}
        {step === 3 && (
          <div>
            <p className="text-sm text-fg-muted mb-4">
              L'orario settimanale ricorrente: da qui l'app genera le lezioni.
              In alternativa puoi <Link to="/impostazioni#import" className="text-link underline">importare tutto da Excel</Link> e
              tornare al wizard.
            </p>
            <OrarioEditor
              orari={orari}
              oreLezione={annoConfig?.oreLezione || []}
              giornoLibero={annoConfig?.giornoLibero ?? null}
              assegnazioni={assegnazioni}
              onAdd={handleAddOrario}
              onDelete={(id) => deleteOrario(id).catch(() => toast.error("Errore durante l'eliminazione"))}
            />
          </div>
        )}

        {/* ── Step 4: Vacanze ── */}
        {step === 4 && (
          <div>
            <p className="text-sm text-fg-muted mb-4">
              I periodi di chiusura già noti (vacanze di Natale, Pasqua, ponti…): verranno esclusi da
              generazione lezioni e conteggi. I giorni singoli si possono sempre rifinire dalla pagina{' '}
              <Link to="/assenze" className="text-link underline">Assenze</Link>.
            </p>
            <form onSubmit={handleAddVacanza} className="flex flex-wrap items-end gap-3 mb-5">
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-sm font-medium text-fg-muted mb-1">Nome</label>
                <input
                  type="text"
                  value={vacForm.nome}
                  onChange={(e) => setVacForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="es. Vacanze di Natale"
                  className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Dal</label>
                <input
                  type="date"
                  value={vacForm.dataInizio}
                  onChange={(e) => setVacForm((f) => ({ ...f, dataInizio: e.target.value }))}
                  className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Al (incluso)</label>
                <input
                  type="date"
                  value={vacForm.dataFine}
                  onChange={(e) => setVacForm((f) => ({ ...f, dataFine: e.target.value }))}
                  className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!vacForm.nome.trim() || !vacForm.dataInizio}
                className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
              >
                Aggiungi
              </button>
            </form>
            {vacanze.length > 0 ? (
              <div className="space-y-2">
                {[...vacanze].sort((a, b) => a.dataInizio.localeCompare(b.dataInizio)).map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm text-sm">
                    <span className="text-fg">
                      <strong>{v.nome}</strong>
                      <span className="text-fg-muted ml-2 font-mono text-xs">
                        {v.dataInizio}{v.dataFine !== v.dataInizio ? ` → ${v.dataFine}` : ''}
                      </span>
                      <span className="text-fg-subtle ml-2 text-xs">{TIPO_VACANZA_LABEL[v.tipo] || v.tipo}</span>
                    </span>
                    <button
                      onClick={() => deleteVacanza(v.id).catch(() => toast.error("Errore durante l'eliminazione"))}
                      className="text-danger/60 hover:text-danger"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-subtle">Nessun periodo inserito (puoi farlo anche più avanti).</p>
            )}
          </div>
        )}

        {/* ── Step 5: Riepilogo + clonazione percorsi ── */}
        {step === 5 && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 text-sm">
              <div className="bg-overlay rounded-sm px-3 py-2">
                <div className="text-lg font-bold text-link font-mono">{assegnazioni.length}</div>
                <div className="text-xs text-fg-muted">Classi</div>
              </div>
              <div className="bg-overlay rounded-sm px-3 py-2">
                <div className="text-lg font-bold text-link font-mono">{orari.length}</div>
                <div className="text-xs text-fg-muted">Slot orario</div>
              </div>
              <div className="bg-overlay rounded-sm px-3 py-2">
                <div className="text-lg font-bold text-link font-mono">{vacanze.length}</div>
                <div className="text-xs text-fg-muted">Periodi vacanza</div>
              </div>
              <div className="bg-overlay rounded-sm px-3 py-2">
                <div className={`text-lg font-bold font-mono ${annoConfig?.dataFineScuola ? 'text-accent' : 'text-warn'}`}>
                  {annoConfig?.dataFineScuola ? '✓' : '—'}
                </div>
                <div className="text-xs text-fg-muted">Date anno</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-fg mb-2">Percorsi dall'anno precedente</h3>
            {!origineEsiste ? (
              <p className="text-sm text-fg-subtle">Nessun anno precedente da cui clonare.</p>
            ) : percorsiOrigine === null ? (
              <p className="text-sm text-fg-subtle">Caricamento percorsi di {annoOrigine}…</p>
            ) : percorsiOrigine.length === 0 ? (
              <p className="text-sm text-fg-subtle">L'anno {annoOrigine} non ha percorsi.</p>
            ) : clonati > 0 ? (
              <p className="text-sm text-accent font-medium">
                ✓ {clonati} percorsi clonati in {annoAttivo} (unità azzerate a "da fare"). Ora puoi assegnare le
                ricorrenze in <Link to="/programmazione" className="underline">Programmazione</Link>.
              </p>
            ) : (
              <>
                <p className="text-xs text-fg-muted mb-3">
                  Scegli quali percorsi riutilizzare e in quale classe (chi segue gli stessi studenti: 1A → 2A).
                  Le unità vengono copiate con stato azzerato.
                </p>
                <div className="space-y-2 mb-4">
                  {percorsiOrigine.map((p) => {
                    const sel = cloneSel[p.id] || { selected: false, classe: '' }
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-overlay rounded-sm text-sm">
                        <input
                          type="checkbox"
                          checked={sel.selected}
                          onChange={(e) =>
                            setCloneSel((prev) => ({ ...prev, [p.id]: { ...sel, selected: e.target.checked } }))
                          }
                        />
                        <span className="flex-1 min-w-0 truncate text-fg">
                          <strong>{p.titolo}</strong>
                          <span className="text-fg-subtle ml-2 text-xs">({p.classe} — {p.materia})</span>
                        </span>
                        <span className="text-fg-subtle text-xs shrink-0">→</span>
                        <select
                          value={sel.classe}
                          onChange={(e) =>
                            setCloneSel((prev) => ({ ...prev, [p.id]: { ...sel, classe: e.target.value } }))
                          }
                          disabled={!sel.selected}
                          className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-xs focus:ring-1 focus:ring-link/40 outline-none disabled:opacity-40"
                        >
                          {classiDisponibili.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleClone}
                  disabled={cloning || numSelezionati === 0 || classiDisponibili.length === 0}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-sm hover:bg-accent/80 disabled:opacity-50"
                >
                  {cloning ? 'Clonazione in corso…' : `Clona ${numSelezionati} percorsi selezionati`}
                </button>
                {classiDisponibili.length === 0 && (
                  <p className="mt-2 text-xs text-warn">Aggiungi prima le classi (passo 2) per poter clonare.</p>
                )}
              </>
            )}
          </div>
        )}
      </StepWizard>
    </div>
  )
}
