import { useEffect, useState, useRef } from 'react'
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
  const [annoInput, setAnnoInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [assegnazioni, setAssegnazioni] = useState([])
  const [nuovaClasse, setNuovaClasse] = useState('')
  const [nuovaMateria, setNuovaMateria] = useState('')
  const [oreLezione, setOreLezione] = useState([])
  const [giornoLibero, setGiornoLibero] = useState(null)
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

  useEffect(() => { if (!annoAttivo) return; const u1 = onAssegnazioni(annoAttivo, setAssegnazioni); const u2 = onOrari(annoAttivo, setOrari); return () => { u1(); u2() } }, [annoAttivo])
  useEffect(() => { if (annoAttivo) setAnnoInput(annoAttivo) }, [annoAttivo])
  useEffect(() => { if (annoConfig?.oreLezione) setOreLezione(annoConfig.oreLezione); setGiornoLibero(annoConfig?.giornoLibero ?? null); setDataFineScuola(annoConfig?.dataFineScuola || '') }, [annoConfig])
  useEffect(() => { if (giornoLibero !== null && orarioForm.giorno === giornoLibero) { const fv = [0,1,2,3,4,5].find((g) => g !== giornoLibero); setOrarioForm((f) => ({ ...f, giorno: fv ?? 0 })) } }, [giornoLibero])

  async function handleSaveAnno(e) { e.preventDefault(); const value = annoInput.trim(); if (!value) return; if (!ANNO_PATTERN.test(value)) { toast.error('Formato anno non valido. Usa il formato: 2025-2026'); return }; setSaving(true); try { await setAnnoScolasticoConfig({ annoAttivo: value, anniScolastici: { ...(config?.anniScolastici || {}), [value]: config?.anniScolastici?.[value] || {} } }); toast.success('Anno scolastico salvato') } catch (err) { toast.error('Errore nel salvataggio dell\'anno scolastico') } finally { setSaving(false) } }
  async function handleAddAssegnazione(e) { e.preventDefault(); if (!nuovaClasse.trim() || !nuovaMateria.trim() || !annoAttivo) return; try { await addAssegnazione({ annoScolastico: annoAttivo, classe: nuovaClasse.trim().toUpperCase(), materia: nuovaMateria.trim(), attiva: true, archiviata: false }); setNuovaClasse(''); setNuovaMateria(''); toast.success('Assegnazione aggiunta') } catch (err) { toast.error('Errore nell\'aggiunta dell\'assegnazione') } }
  function handleDeleteAssegnazione(id) { const a = assegnazioni.find((x) => x.id === id); setDeleteConfirm({ open: true, id, type: 'assegnazione', label: a ? `${a.classe} — ${a.materia}` : 'questa assegnazione' }) }
  function handleSetNumeroOre(count) { if (oreLezione.length === 0) { setOreLezione(generateDefaultOre(count)) } else if (count > oreLezione.length) { const last = oreLezione[oreLezione.length - 1]; const additional = generateDefaultOre(count - oreLezione.length, last.fine); const renumbered = additional.map((o, i) => ({ ...o, numero: oreLezione.length + i + 1 })); setOreLezione([...oreLezione, ...renumbered]) } else { setOreLezione(oreLezione.slice(0, count)) } }
  function handleOraChange(index, field, value) { setOreLezione((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))) }
  async function handleSaveOreConfig() { if (!annoAttivo) return; setSavingOre(true); try { await setAnnoScolasticoConfig({ anniScolastici: { ...(config?.anniScolastici || {}), [annoAttivo]: { ...(config?.anniScolastici?.[annoAttivo] || {}), oreLezione, giornoLibero, dataFineScuola: dataFineScuola || null } } }); toast.success('Configurazione ore salvata') } catch (err) { toast.error('Errore nel salvataggio della configurazione ore') } finally { setSavingOre(false) } }
  async function handleAddOrario(e) { e.preventDefault(); if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return; const oraConfig = oreLezione.find((o) => o.numero === orarioForm.numeroOra); if (!oraConfig) return; try { await addOrario({ annoScolastico: annoAttivo, giorno: orarioForm.giorno, numeroOra: orarioForm.numeroOra, oraInizio: oraConfig.inizio, oraFine: oraConfig.fine, classe: orarioForm.classe, materia: orarioForm.materia, ore: 1 }); setOrarioForm((f) => ({ ...f, classe: '', materia: '' })); toast.success('Orario aggiunto') } catch (err) { toast.error('Errore nell\'aggiunta dell\'orario') } }
  function handleDeleteOrario(id) { const o = orari.find((x) => x.id === id); setDeleteConfirm({ open: true, id, type: 'orario', label: o ? `${GIORNI_SHORT[o.giorno]} ${o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] + 'a ora' : o.oraInizio} — ${o.classe}` : 'questo slot orario' }) }
  async function handleConfirmDelete() { const { id, type } = deleteConfirm; setDeleteConfirm({ open: false, id: null, type: '', label: '' }); try { if (type === 'assegnazione') await deleteAssegnazione(id); else if (type === 'orario') await deleteOrario(id) } catch (err) { toast.error('Errore durante l\'eliminazione') } }
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
  const classiDisponibili = [...new Set(assegnazioni.map((a) => a.classe))].sort()
  const hasOreConfig = oreLezione.length > 0

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-fg">Impostazioni</h1>

      <section className="bg-surface rounded-sm border border-edge p-6">
        <h2 className="text-lg font-semibold text-fg mb-4">Anno Scolastico</h2>
        <form onSubmit={handleSaveAnno} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-fg-muted mb-1">Anno attivo</label>
            <input type="text" value={annoInput} onChange={(e) => setAnnoInput(e.target.value)} placeholder="es. 2025-2026" className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva'}</button>
        </form>
        {annoAttivo && <p className="mt-2 text-sm text-accent">Anno attivo: <strong>{annoAttivo}</strong></p>}
      </section>

      {annoAttivo && (
        <section className="bg-surface rounded-sm border border-edge p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Classi e Materie</h2>
          <p className="text-sm text-fg-muted mb-4">Aggiungi le classi che insegni quest'anno con la relativa materia.</p>
          <form onSubmit={handleAddAssegnazione} className="flex items-end gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Classe</label>
              <input type="text" value={nuovaClasse} onChange={(e) => setNuovaClasse(e.target.value)} placeholder="es. 1A" className="w-24 px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-fg-muted mb-1">Materia</label>
              <input type="text" value={nuovaMateria} onChange={(e) => setNuovaMateria(e.target.value)} placeholder="es. Informatica" className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
            </div>
            <button type="submit" className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80">Aggiungi</button>
          </form>
          {assegnazioni.length > 0 ? (
            <div className="space-y-2">
              {assegnazioni.sort((a, b) => a.classe.localeCompare(b.classe)).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm">
                  <span className="text-sm text-fg"><strong>{a.classe}</strong> — {a.materia}</span>
                  <button onClick={() => handleDeleteAssegnazione(a.id)} className="text-danger/60 hover:text-danger text-sm">Rimuovi</button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-fg-subtle">Nessuna assegnazione ancora.</p>}
        </section>
      )}

      {annoAttivo && (
        <section className="bg-surface rounded-sm border border-edge p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Ore Scolastiche</h2>
          <p className="text-sm text-fg-muted mb-4">Configura gli orari delle ore di lezione giornaliere e il giorno libero.</p>
          <div className="mb-5">
            <label className="block text-sm font-medium text-fg-muted mb-2">Ore giornaliere</label>
            <div className="flex gap-2">
              {[4, 5, 6, 7, 8].map((n) => (
                <button key={n} type="button" onClick={() => handleSetNumeroOre(n)} className={`w-10 h-10 rounded-sm text-sm font-semibold transition-colors ${oreLezione.length === n ? 'bg-link text-white' : 'bg-overlay text-fg-muted hover:bg-overlay'}`}>{n}</button>
              ))}
            </div>
          </div>
          {oreLezione.length > 0 && (
            <div className="mb-5">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-fg-muted border-b border-edge"><th className="pb-2 w-16">Ora</th><th className="pb-2">Inizio</th><th className="pb-2">Fine</th></tr></thead>
                <tbody>
                  {oreLezione.map((ora, i) => (
                    <tr key={i} className="border-b border-edge-muted">
                      <td className="py-2 font-semibold text-fg">{ORE_ROMAN[i]}</td>
                      <td className="py-2"><input type="time" value={ora.inizio} onChange={(e) => handleOraChange(i, 'inizio', e.target.value)} className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" /></td>
                      <td className="py-2"><input type="time" value={ora.fine} onChange={(e) => handleOraChange(i, 'fine', e.target.value)} className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mb-5">
            <label className="block text-sm font-medium text-fg-muted mb-2">Giorno libero</label>
            <select value={giornoLibero ?? ''} onChange={(e) => setGiornoLibero(e.target.value === '' ? null : Number(e.target.value))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none">
              <option value="">Nessuno</option>
              {GIORNI_LABEL.map((g, i) => <option key={i} value={i}>{g}</option>)}
            </select>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-fg-muted mb-2">Ultimo giorno di scuola</label>
            <input type="date" value={dataFineScuola} onChange={(e) => setDataFineScuola(e.target.value)} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none" />
            <p className="mt-1 text-xs text-fg-subtle">Serve per calcolare le ore rimanenti per ogni classe.</p>
          </div>
          <button type="button" onClick={handleSaveOreConfig} disabled={savingOre || oreLezione.length === 0} className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50">{savingOre ? 'Salvataggio...' : 'Salva configurazione'}</button>
        </section>
      )}


      {annoAttivo && assegnazioni.length > 0 && (
        <section className="bg-surface rounded-sm border border-edge p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Orario Settimanale</h2>
          <p className="text-sm text-fg-muted mb-4">Definisci il tuo orario ricorrente. Seleziona giorno, ora e classe.</p>
          {!hasOreConfig && (
            <div className="mb-4 p-3 bg-badge-warn border border-warn/30 rounded-sm">
              <p className="text-sm text-warn">Configura prima le <strong>Ore Scolastiche</strong> qui sopra per poter inserire l'orario in modo rapido.</p>
            </div>
          )}
          {hasOreConfig ? (
            <form onSubmit={handleAddOrario} className="flex flex-wrap items-end gap-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Giorno</label>
                <select value={orarioForm.giorno} onChange={(e) => setOrarioForm((f) => ({ ...f, giorno: Number(e.target.value) }))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none">
                  {GIORNI_LABEL.map((g, i) => { if (i === giornoLibero) return null; return <option key={i} value={i}>{g}</option> })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Ora</label>
                <select value={orarioForm.numeroOra} onChange={(e) => setOrarioForm((f) => ({ ...f, numeroOra: Number(e.target.value) }))} className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none">
                  {oreLezione.map((o) => <option key={o.numero} value={o.numero}>{ORE_ROMAN[o.numero - 1]} ({o.inizio}–{o.fine})</option>)}
                </select>
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
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); if (!orarioForm.classe || !orarioForm.materia || !annoAttivo) return; try { await addOrario({ annoScolastico: annoAttivo, giorno: orarioForm.giorno, oraInizio: orarioForm.oraInizio || '08:00', oraFine: orarioForm.oraFine || '09:00', classe: orarioForm.classe, materia: orarioForm.materia, ore: 1 }); setOrarioForm((f) => ({ ...f, classe: '', materia: '' })); toast.success('Orario aggiunto') } catch (err) { toast.error('Errore nell\'aggiunta dell\'orario') } }} className="flex flex-wrap items-end gap-3 mb-6">
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
        </section>
      )}

      {annoAttivo && (
        <section className="bg-surface rounded-sm border border-edge p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Importa da Excel</h2>
          <p className="text-sm text-fg-muted mb-4">Importa classi, orario, percorsi, ricorrenze e vacanze da un file Excel. I dati vengono <strong>aggiunti</strong> a quelli esistenti (non sostituiti).</p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <a href="/template-importazione.xlsx" download className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-sm hover:bg-accent/80">Scarica template Excel</a>
            <a href="/test-anno-prova.xlsx" download className="px-4 py-2 bg-warn text-white text-sm font-medium rounded-sm hover:bg-warn/80">Scarica dati di prova</a>
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
        <section className="bg-surface rounded-sm border border-danger/30 p-6">
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
    </div>
  )
}
