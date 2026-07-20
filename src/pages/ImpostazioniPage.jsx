import { useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  setAnnoScolasticoConfig,
  deleteAnnoScolastico,
  onAssegnazioni,
  addAssegnazione,
  deleteAssegnazione,
  onOrari,
  addOrario,
  deleteOrario,
  resetAnnoScolastico,
} from '../lib/firestore'
import { parseExcel, importToFirestore } from '../lib/importExcel'
import {
  GIORNI_LABEL,
  GIORNI_SHORT,
  ORE_ROMAN,
} from '../lib/costanti'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'
import AssegnazioniEditor from '../components/impostazioni/AssegnazioniEditor'
import OreScolasticheEditor from '../components/impostazioni/OreScolasticheEditor'
import OrarioEditor from '../components/impostazioni/OrarioEditor'
import { isAnnoValido } from '../lib/anni'

export default function ImpostazioniPage() {
  const { annoAttivo, annoConfig, config, loading: configLoading } = useApp()
  const toast = useToast()
  const [annoInput, setAnnoInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [assegnazioni, setAssegnazioni] = useState([])
  const [oreLezione, setOreLezione] = useState([])
  const [giornoLibero, setGiornoLibero] = useState(null)
  const [dataInizioScuola, setDataInizioScuola] = useState('')
  const [dataFineScuola, setDataFineScuola] = useState('')
  const [savingOre, setSavingOre] = useState(false)
  const [orari, setOrari] = useState([])
  const [orarioForm, setOrarioForm] = useState({ giorno: 0, numeroOra: 1, classe: '', materia: '' })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, type: '', label: '' })
  const fileInputRef = useRef(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleteAnnoConfirm, setDeleteAnnoConfirm] = useState(null)

  useEffect(() => { if (!annoAttivo) return; const u1 = onAssegnazioni(annoAttivo, setAssegnazioni); const u2 = onOrari(annoAttivo, setOrari); return () => { u1(); u2() } }, [annoAttivo])
  useEffect(() => { if (annoAttivo) setAnnoInput(annoAttivo) }, [annoAttivo])
  useEffect(() => { if (annoConfig?.oreLezione) setOreLezione(annoConfig.oreLezione); setGiornoLibero(annoConfig?.giornoLibero ?? null); setDataInizioScuola(annoConfig?.dataInizioScuola || ''); setDataFineScuola(annoConfig?.dataFineScuola || '') }, [annoConfig])
  // Deep-link alle sezioni: /impostazioni#ore, #orario, #classi, #anno, #import, #reset
  const location = useLocation()
  useEffect(() => {
    if (!configLoading && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, configLoading])

  async function handleSaveAnno(e) {
    e.preventDefault()
    const value = annoInput.trim()
    if (!value) return
    if (!isAnnoValido(value)) { toast.error('Formato anno non valido: servono due anni consecutivi, es. 2026-2027'); return }
    setSaving(true)
    try {
      await setAnnoScolasticoConfig({ annoAttivo: value, anniScolastici: { ...(config?.anniScolastici || {}), [value]: config?.anniScolastici?.[value] || {} } })
      toast.success('Anno scolastico salvato')
    } catch {
      toast.error("Errore nel salvataggio dell'anno scolastico")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleChiusura() {
    if (!annoAttivo) return
    const chiuso = !annoConfig?.chiuso
    try {
      await setAnnoScolasticoConfig({ anniScolastici: { ...(config?.anniScolastici || {}), [annoAttivo]: { ...(config?.anniScolastici?.[annoAttivo] || {}), chiuso } } })
      toast.success(chiuso ? `Anno ${annoAttivo} chiuso: consultazione in sola lettura` : `Anno ${annoAttivo} riaperto`)
    } catch {
      toast.error("Errore nell'aggiornamento dello stato dell'anno")
    }
  }

  async function handleConfirmDeleteAnno() {
    const anno = deleteAnnoConfirm
    setDeleteAnnoConfirm(null)
    if (!anno || anno === annoAttivo) return
    try {
      await deleteAnnoScolastico(anno)
      toast.success(`Anno ${anno} rimosso dall'elenco`)
    } catch {
      toast.error("Errore durante la rimozione dell'anno")
    }
  }
  async function handleAddAssegnazione(classe, materia) { if (!classe || !materia || !annoAttivo) return; try { await addAssegnazione({ annoScolastico: annoAttivo, classe, materia, attiva: true, archiviata: false }); toast.success('Assegnazione aggiunta') } catch { toast.error('Errore nell\'aggiunta dell\'assegnazione') } }
  function handleDeleteAssegnazione(id) { const a = assegnazioni.find((x) => x.id === id); setDeleteConfirm({ open: true, id, type: 'assegnazione', label: a ? `${a.classe} — ${a.materia}` : 'questa assegnazione' }) }
  async function handleSaveOreConfig() { if (!annoAttivo) return; setSavingOre(true); try { await setAnnoScolasticoConfig({ anniScolastici: { ...(config?.anniScolastici || {}), [annoAttivo]: { ...(config?.anniScolastici?.[annoAttivo] || {}), oreLezione, giornoLibero, dataInizioScuola: dataInizioScuola || null, dataFineScuola: dataFineScuola || null } } }); toast.success('Configurazione ore salvata') } catch { toast.error('Errore nel salvataggio della configurazione ore') } finally { setSavingOre(false) } }
  async function handleAddOrario({ giorno, numeroOra, classe, materia }) { if (!classe || !materia || !annoAttivo) return; const oraConfig = oreLezione.find((o) => o.numero === numeroOra); if (!oraConfig) return; try { await addOrario({ annoScolastico: annoAttivo, giorno, numeroOra, oraInizio: oraConfig.inizio, oraFine: oraConfig.fine, classe, materia, ore: 1 }); toast.success('Orario aggiunto') } catch { toast.error('Errore nell\'aggiunta dell\'orario') } }
  function handleDeleteOrario(id) { const o = orari.find((x) => x.id === id); setDeleteConfirm({ open: true, id, type: 'orario', label: o ? `${GIORNI_SHORT[o.giorno]} ${o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] + 'a ora' : o.oraInizio} — ${o.classe}` : 'questo slot orario' }) }
  async function handleConfirmDelete() { const { id, type } = deleteConfirm; setDeleteConfirm({ open: false, id: null, type: '', label: '' }); try { if (type === 'assegnazione') await deleteAssegnazione(id); else if (type === 'orario') await deleteOrario(id) } catch { toast.error('Errore durante l\'eliminazione') } }
  function handleCancelDelete() { setDeleteConfirm({ open: false, id: null, type: '', label: '' }) }
  async function handleResetAnno() { if (!annoAttivo) return; setResetting(true); setResetConfirm(false); try { const summary = await resetAnnoScolastico(annoAttivo); const parts = []; if (summary.assegnazioni) parts.push(`${summary.assegnazioni} assegnazioni`); if (summary.orari) parts.push(`${summary.orari} orari`); if (summary.percorsi) parts.push(`${summary.percorsi} percorsi`); if (summary.unita) parts.push(`${summary.unita} unita`); if (summary.lezioni) parts.push(`${summary.lezioni} lezioni`); if (summary.vacanze) parts.push(`${summary.vacanze} vacanze`); toast.success(parts.length > 0 ? `Dati eliminati: ${parts.join(', ')}` : 'Nessun dato da eliminare') } catch (err) { toast.error('Errore durante il reset: ' + err.message) } finally { setResetting(false) } }
  async function handleFileSelect(e) { const file = e.target.files?.[0]; if (!file) return; try { const preview = await parseExcel(file); setImportPreview({ ...preview, file }) } catch (err) { toast.error('Errore nella lettura del file Excel: ' + err.message) }; if (fileInputRef.current) fileInputRef.current.value = '' }
  async function handleConfirmImport() { if (!importPreview || !annoAttivo) return; setImporting(true); try { const oreConfig = annoConfig?.oreLezione || null; const summary = await importToFirestore(importPreview, annoAttivo, oreConfig); const parts = []; if (summary.classi) parts.push(`${summary.classi} classi`); if (summary.orario) parts.push(`${summary.orario} slot orario`); if (summary.percorsi) parts.push(`${summary.percorsi} percorsi`); if (summary.unita) parts.push(`${summary.unita} unita`); if (summary.ricorrenze) parts.push(`${summary.ricorrenze} ricorrenze`); if (summary.vacanze) parts.push(`${summary.vacanze} vacanze`); toast.success(`Importazione completata: ${parts.join(', ')}`); setImportPreview(null) } catch (err) { toast.error('Errore durante l\'importazione: ' + err.message) } finally { setImporting(false) } }
  function handleOrarioAssegnazioneChange(value) { const [classe, materia] = value.split('||'); setOrarioForm((f) => ({ ...f, classe: classe || '', materia: materia || '' })) }

  if (configLoading) return <LoadingSpinner />

  const orariOrdinati = [...orari].sort((a, b) => a.giorno - b.giorno || (a.numeroOra || 0) - (b.numeroOra || 0) || a.oraInizio.localeCompare(b.oraInizio))
  const orariPerGiorno = {}
  for (let g = 0; g < 6; g++) orariPerGiorno[g] = []
  for (const o of orariOrdinati) { if (orariPerGiorno[o.giorno]) orariPerGiorno[o.giorno].push(o) }
  const assegnazioniOrdinati = [...assegnazioni].sort((a, b) => a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia))
  const hasOreConfig = oreLezione.length > 0

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-fg">Impostazioni</h1>

      <section id="anno" className="bg-surface rounded-sm border border-edge p-6 scroll-mt-4">
        <h2 className="text-lg font-semibold text-fg mb-4">Anno Scolastico</h2>
        <div className="mb-4">
          <Link
            to="/nuovo-anno"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-sm hover:bg-accent/80"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Prepara il nuovo anno (procedura guidata)
          </Link>
          <p className="mt-1 text-xs text-fg-subtle">Ti accompagna passo passo: anno, classi, ore, orario, vacanze e clonazione dei percorsi.</p>
        </div>
        <form onSubmit={handleSaveAnno} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-fg-muted mb-1">Anno attivo</label>
            <input type="text" value={annoInput} onChange={(e) => setAnnoInput(e.target.value)} placeholder="es. 2025-2026" className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva'}</button>
        </form>
        {annoAttivo && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-accent">
              Anno attivo: <strong>{annoAttivo}</strong>
              {annoConfig?.chiuso && <span className="ml-2 text-warn font-semibold">(chiuso — sola lettura)</span>}
            </p>
            <button
              type="button"
              onClick={handleToggleChiusura}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                annoConfig?.chiuso
                  ? 'bg-badge-s text-accent border-accent/30 hover:bg-badge-s/70'
                  : 'bg-badge-warn text-warn border-warn/30 hover:bg-badge-warn/70'
              }`}
            >
              {annoConfig?.chiuso ? 'Riapri anno' : 'Chiudi anno (sola lettura)'}
            </button>
          </div>
        )}
        {(() => {
          const altriAnni = Object.keys(config?.anniScolastici || {}).filter((a) => a !== annoAttivo).sort().reverse()
          if (altriAnni.length === 0) return null
          return (
            <div className="mt-4">
              <p className="text-sm font-medium text-fg-muted mb-2">Altri anni</p>
              <div className="space-y-2">
                {altriAnni.map((a) => (
                  <div key={a} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm">
                    <span className="text-sm text-fg font-mono">
                      {a}
                      {config?.anniScolastici?.[a]?.chiuso && <span className="ml-2 text-xs text-fg-subtle">chiuso</span>}
                    </span>
                    <button onClick={() => setDeleteAnnoConfirm(a)} className="text-danger/60 hover:text-danger text-sm">Rimuovi</button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-fg-subtle">
                "Rimuovi" toglie l'anno dall'elenco ma non cancella i suoi dati: per eliminarli, attiva l'anno e usa il Reset in fondo alla pagina.
              </p>
            </div>
          )
        })()}
      </section>

      {annoAttivo && (
        <section id="classi" className="bg-surface rounded-sm border border-edge p-6 scroll-mt-4">
          <h2 className="text-lg font-semibold text-fg mb-4">Classi e Materie</h2>
          <p className="text-sm text-fg-muted mb-4">Aggiungi le classi che insegni quest'anno con la relativa materia.</p>
          <AssegnazioniEditor assegnazioni={assegnazioni} onAdd={handleAddAssegnazione} onDelete={handleDeleteAssegnazione} />
        </section>
      )}

      {annoAttivo && (
        <section id="ore" className="bg-surface rounded-sm border border-edge p-6 scroll-mt-4">
          <h2 className="text-lg font-semibold text-fg mb-4">Ore Scolastiche</h2>
          <p className="text-sm text-fg-muted mb-4">Configura gli orari delle ore di lezione giornaliere e il giorno libero.</p>
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
          <button type="button" onClick={handleSaveOreConfig} disabled={savingOre || oreLezione.length === 0} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">{savingOre ? 'Salvataggio...' : 'Salva configurazione'}</button>
        </section>
      )}


      {annoAttivo && assegnazioni.length > 0 && (
        <section id="orario" className="bg-surface rounded-sm border border-edge p-6 scroll-mt-4">
          <h2 className="text-lg font-semibold text-fg mb-4">Orario Settimanale</h2>
          <p className="text-sm text-fg-muted mb-4">Definisci il tuo orario ricorrente. Seleziona giorno, ora e classe.</p>
          {!hasOreConfig && (
            <div className="mb-4 p-3 bg-badge-warn border border-warn/30 rounded-sm">
              <p className="text-sm text-warn">Configura prima le <strong>Ore Scolastiche</strong> qui sopra per poter inserire l'orario in modo rapido.</p>
            </div>
          )}
          {hasOreConfig ? (
            <OrarioEditor
              orari={orari}
              oreLezione={oreLezione}
              giornoLibero={giornoLibero}
              assegnazioni={assegnazioni}
              onAdd={handleAddOrario}
              onDelete={handleDeleteOrario}
            />
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return; try { await addOrario({ annoScolastico: annoAttivo, giorno: orarioForm.giorno, oraInizio: orarioForm.oraInizio || '08:00', oraFine: orarioForm.oraFine || '09:00', classe: orarioForm.classe, materia: orarioForm.materia, ore: 1 }); setOrarioForm((f) => ({ ...f, classe: '', materia: '' })); toast.success('Orario aggiunto') } catch { toast.error('Errore nell\'aggiunta dell\'orario') } }} className="flex flex-wrap items-end gap-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Giorno</label>
                <select value={orarioForm.giorno} onChange={(e) => setOrarioForm((f) => ({ ...f, giorno: Number(e.target.value) }))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none">
                  {GIORNI_LABEL.map((g, i) => <option key={i} value={i}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Inizio</label>
                <input type="time" value={orarioForm.oraInizio || '08:00'} onChange={(e) => setOrarioForm((f) => ({ ...f, oraInizio: e.target.value }))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Fine</label>
                <input type="time" value={orarioForm.oraFine || '09:00'} onChange={(e) => setOrarioForm((f) => ({ ...f, oraFine: e.target.value }))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Classe — Materia</label>
                <select value={orarioForm.classe ? `${orarioForm.classe}||${orarioForm.materia}` : ''} onChange={(e) => handleOrarioAssegnazioneChange(e.target.value)} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none">
                  <option value="">—</option>
                  {assegnazioniOrdinati.map((a) => <option key={`${a.classe}||${a.materia}`} value={`${a.classe}||${a.materia}`}>{a.classe} — {a.materia}</option>)}
                </select>
              </div>
              <button type="submit" disabled={!orarioForm.classe} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">Aggiungi</button>
            </form>
          )}
          {!hasOreConfig && (
          <div className="space-y-4">
            {GIORNI_LABEL.map((giornoLabel, gi) => {
              if (gi === giornoLibero) return null
              const slots = orariPerGiorno[gi] || []
              if (slots.length === 0) return null
              return (
                <div key={gi}>
                  <h3 className="text-sm font-semibold text-fg-muted mb-2">{giornoLabel}</h3>
                  <div className="space-y-1">
                    {slots.map((o) => (
                      <div key={o.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm text-sm">
                        <span className="font-semibold text-link w-10 shrink-0">{o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] : '—'}</span>
                        <span className="font-mono text-fg-subtle w-28 shrink-0 text-xs">{o.oraInizio} – {o.oraFine}</span>
                        <span className="font-semibold text-fg w-12">{o.classe}</span>
                        <span className="text-fg-muted flex-1">{o.materia}</span>
                        <button onClick={() => handleDeleteOrario(o.id)} className="text-danger/60 hover:text-danger ml-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {giornoLibero !== null && <div className="px-3 py-2 bg-overlay rounded-sm text-sm text-fg-subtle italic">{GIORNI_LABEL[giornoLibero]} — giorno libero</div>}
            {orari.length === 0 && <p className="text-sm text-fg-subtle">Nessun orario definito. Aggiungi i tuoi slot settimanali sopra.</p>}
          </div>
          )}
        </section>
      )}

      {annoAttivo && (
        <section id="import" className="bg-surface rounded-sm border border-edge p-6 scroll-mt-4">
          <h2 className="text-lg font-semibold text-fg mb-4">Importa da Excel</h2>
          <p className="text-sm text-fg-muted mb-4">Importa classi, orario, percorsi, ricorrenze e vacanze da un file Excel. I dati vengono <strong>aggiunti</strong> a quelli esistenti (non sostituiti).</p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <a href="/template-importazione.xlsx" download className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-sm hover:bg-accent/80">Scarica template Excel</a>
            <a href="/test-anno-prova.xlsx" download className="px-4 py-2 bg-warn text-fg text-sm font-medium rounded-sm hover:bg-warn/80">Scarica dati di prova</a>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80">Seleziona file da importare</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          </div>
          {importPreview && (
            <div className="border border-edge bg-overlay rounded-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-fg">Anteprima importazione</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {importPreview.classi.length > 0 && <div className="bg-surface rounded-sm px-3 py-2 border border-edge"><div className="text-lg font-bold text-link font-mono">{importPreview.classi.length}</div><div className="text-xs text-fg-muted">Classi</div><div className="text-[10px] text-fg-subtle mt-1">{importPreview.classi.map((c) => c.classe).join(', ')}</div></div>}
                {importPreview.orario.length > 0 && <div className="bg-surface rounded-sm px-3 py-2 border border-edge"><div className="text-lg font-bold text-link font-mono">{importPreview.orario.length}</div><div className="text-xs text-fg-muted">Slot orario</div></div>}
                {importPreview.percorsi.length > 0 && <div className="bg-surface rounded-sm px-3 py-2 border border-edge"><div className="text-lg font-bold text-special font-mono">{importPreview.percorsi.length}</div><div className="text-xs text-fg-muted">Unita (percorsi)</div><div className="text-[10px] text-fg-subtle mt-1">{[...new Set(importPreview.percorsi.map((p) => p.percorso))].join(', ')}</div></div>}
                {importPreview.ricorrenze.length > 0 && <div className="bg-surface rounded-sm px-3 py-2 border border-edge"><div className="text-lg font-bold text-highlight font-mono">{importPreview.ricorrenze.length}</div><div className="text-xs text-fg-muted">Ricorrenze</div></div>}
                {importPreview.vacanze.length > 0 && <div className="bg-surface rounded-sm px-3 py-2 border border-edge"><div className="text-lg font-bold text-warn font-mono">{importPreview.vacanze.length}</div><div className="text-xs text-fg-muted">Vacanze</div><div className="text-[10px] text-fg-subtle mt-1">{importPreview.vacanze.map((v) => `${v.nome} (${v.dataInizio})`).join(', ')}</div></div>}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleConfirmImport} disabled={importing} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">{importing ? 'Importazione in corso...' : 'Conferma importazione'}</button>
                <button onClick={() => setImportPreview(null)} disabled={importing} className="px-4 py-2 bg-overlay text-fg-muted text-sm font-medium rounded-sm hover:bg-overlay disabled:opacity-50">Annulla</button>
              </div>
            </div>
          )}
        </section>
      )}

      {annoAttivo && (
        <section id="reset" className="bg-surface rounded-sm border border-danger/30 p-6 scroll-mt-4">
          <h2 className="text-lg font-semibold text-danger mb-4">Reset Dati Anno</h2>
          <p className="text-sm text-fg-muted mb-4">Cancella <strong>tutti</strong> i dati dell'anno scolastico attivo ({annoAttivo}): classi, orario, percorsi, unita, lezioni, vacanze, ricorrenze e distribuzioni. La configurazione (ore scolastiche, giorno libero, fine scuola) viene mantenuta.</p>
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)} disabled={resetting} className="px-4 py-2 bg-danger/15 text-danger border border-danger/30 text-sm font-medium rounded-sm hover:bg-danger/25 disabled:opacity-50">{resetting ? 'Eliminazione in corso...' : 'Cancella tutti i dati'}</button>
          ) : (
            <div className="p-4 bg-badge-x border border-danger/30 rounded-sm space-y-3">
              <p className="text-sm font-semibold text-danger">Sei sicuro? Questa azione e' irreversibile.</p>
              <p className="text-xs text-danger/80">Verranno eliminati tutti i dati dell'anno {annoAttivo}.</p>
              <div className="flex gap-2">
                <button onClick={handleResetAnno} disabled={resetting} className="px-4 py-2 bg-danger text-white text-sm font-medium rounded-sm hover:bg-danger/80 disabled:opacity-50">{resetting ? 'Eliminazione in corso...' : 'Conferma eliminazione'}</button>
                <button onClick={() => setResetConfirm(false)} disabled={resetting} className="px-4 py-2 bg-overlay text-fg-muted text-sm font-medium rounded-sm hover:bg-overlay disabled:opacity-50">Annulla</button>
              </div>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog open={deleteConfirm.open} title="Conferma eliminazione" message={`Vuoi eliminare ${deleteConfirm.label}?`} confirmText="Elimina" danger onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />
      <ConfirmDialog
        open={deleteAnnoConfirm !== null}
        title="Rimuovi anno dall'elenco"
        message={`Rimuovere l'anno ${deleteAnnoConfirm} dall'elenco? La sua configurazione (ore, date) viene eliminata, ma lezioni, percorsi e gli altri dati restano su Firestore e riappaiono se ricrei lo stesso anno.`}
        confirmText="Rimuovi"
        danger
        onConfirm={handleConfirmDeleteAnno}
        onCancel={() => setDeleteAnnoConfirm(null)}
      />
    </div>
  )
}
