import { useEffect, useState, useMemo, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { STATO_UNITA, STATO_UNITA_LABEL, STATO_LEZIONE, GIORNI_LABEL, ORE_ROMAN } from '../lib/costanti'
import {
  onAssegnazioni,
  onOrari,
  onPercorsi,
  onUnita,
  onLezioni,
} from '../lib/firestore'
import { getWeekRange } from '../lib/settimane'
import { format, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import LoadingSpinner from '../components/common/LoadingSpinner'

export default function ExportPage() {
  const { annoAttivo, annoConfig, loading: configLoading } = useApp()
  const toast = useToast()

  const [assegnazioni, setAssegnazioni] = useState([])
  const [orari, setOrari] = useState([])
  const [allPercorsi, setAllPercorsi] = useState([])
  const [unitaByPercorso, setUnitaByPercorso] = useState({})
  const [lezioni, setLezioni] = useState([])
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('iniziale')
  const [weekOffset, setWeekOffset] = useState(0)

  const giornoLibero = annoConfig?.giornoLibero ?? null
  const { start: weekStart, end: weekEnd } = getWeekRange(weekOffset)

  // ── Load data ──
  useEffect(() => {
    if (!annoAttivo) { setLoading(false); return }
    setLoading(true)
    const unsubs = []
    unsubs.push(onAssegnazioni(annoAttivo, (data) => {
      const active = data.filter((a) => a.attiva && !a.archiviata)
      setAssegnazioni(active)
      if (!selectedClasse && active.length > 0) setSelectedClasse(active[0].classe)
      setLoading(false)
    }))
    unsubs.push(onOrari(annoAttivo, setOrari))
    unsubs.push(onPercorsi(annoAttivo, (all) => setAllPercorsi(all)))
    unsubs.push(onLezioni(annoAttivo, setLezioni))
    return () => unsubs.forEach((u) => u())
  }, [annoAttivo])

  // Load unita for ALL percorsi (needed for global orario export)
  useEffect(() => {
    if (allPercorsi.length === 0) return
    const unsubs = []
    for (const p of allPercorsi) {
      unsubs.push(onUnita(p.id, (units) => {
        setUnitaByPercorso((prev) => ({ ...prev, [p.id]: units }))
      }))
    }
    return () => unsubs.forEach((u) => u())
  }, [allPercorsi.map((p) => p.id).join(',')])

  const classePercorsi = useMemo(
    () => allPercorsi.filter((p) => p.classe === selectedClasse),
    [allPercorsi, selectedClasse]
  )

  const classi = useMemo(
    () => [...new Set(assegnazioni.map((a) => a.classe))].sort(),
    [assegnazioni]
  )

  const materia = useMemo(() => {
    const a = assegnazioni.find((a) => a.classe === selectedClasse)
    return a?.materia || ''
  }, [assegnazioni, selectedClasse])

  const classeLezioni = useMemo(
    () => lezioni.filter((l) => l.classe === selectedClasse),
    [lezioni, selectedClasse]
  )

  // ── Testo: Programmazione Iniziale ──
  const testoIniziale = useMemo(() => {
    if (!selectedClasse || classePercorsi.length === 0) return ''

    const lines = []
    lines.push('PROGRAMMAZIONE ANNUALE')
    lines.push(`Classe ${selectedClasse}${materia ? ` — ${materia}` : ''}`)
    lines.push(`Anno Scolastico ${annoAttivo}`)
    lines.push('')
    lines.push('══════════════════════════════════════════════════')

    let oreTotali = 0

    classePercorsi.forEach((p, pi) => {
      const units = (unitaByPercorso[p.id] || [])
        .slice()
        .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      const orePercorso = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
      oreTotali += orePercorso

      lines.push('')
      lines.push(`PERCORSO ${pi + 1}: ${p.titolo}${orePercorso ? ` (${orePercorso} ore)` : ''}`)
      if (p.descrizione) lines.push(`  ${p.descrizione}`)
      lines.push('────────────────────────────────────────')

      if (units.length === 0) {
        lines.push('  Nessuna unita definita')
      } else {
        units.forEach((u) => {
          lines.push(`  ${u.ordine || '-'}) ${u.titolo}${u.orePreviste ? ` — ${u.orePreviste} ore` : ''}`)
          if (u.descrizione) lines.push(`     ${u.descrizione}`)
        })
      }
    })

    lines.push('')
    lines.push('══════════════════════════════════════════════════')
    lines.push('RIEPILOGO')
    lines.push(`  Percorsi totali: ${classePercorsi.length}`)
    lines.push(`  Ore totali pianificate: ${oreTotali}`)

    return lines.join('\n')
  }, [selectedClasse, classePercorsi, unitaByPercorso, materia, annoAttivo])

  // ── Testo: Programmazione Svolta ──
  const testoSvolta = useMemo(() => {
    if (!selectedClasse || classePercorsi.length === 0) return ''

    const orePerUnita = {}
    const lezioniPerPercorso = {}
    for (const l of classeLezioni) {
      if (l.stato === STATO_LEZIONE.SVOLTA) {
        if (l.unitaId) {
          orePerUnita[l.unitaId] = (orePerUnita[l.unitaId] || 0) + (l.ore || 1)
        }
        if (l.percorsoId) {
          lezioniPerPercorso[l.percorsoId] = (lezioniPerPercorso[l.percorsoId] || 0) + (l.ore || 1)
        }
      }
    }

    const lezioniSvolte = classeLezioni.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).length
    const lezioniSaltate = classeLezioni.filter((l) => l.stato === STATO_LEZIONE.SALTATA).length

    const lines = []
    lines.push('RELAZIONE FINALE — PROGRAMMAZIONE SVOLTA')
    lines.push(`Classe ${selectedClasse}${materia ? ` — ${materia}` : ''}`)
    lines.push(`Anno Scolastico ${annoAttivo}`)
    lines.push('')
    lines.push('══════════════════════════════════════════════════')

    let orePrevisteTotali = 0
    let oreSvolteTotali = 0

    classePercorsi.forEach((p, pi) => {
      const units = (unitaByPercorso[p.id] || [])
        .slice()
        .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      const orePercorsoPreviste = units.reduce((s, u) => s + (u.orePreviste || 0), 0)
      const orePercorsoSvolte = lezioniPerPercorso[p.id] || 0
      orePrevisteTotali += orePercorsoPreviste
      oreSvolteTotali += orePercorsoSvolte

      lines.push('')
      lines.push(`PERCORSO ${pi + 1}: ${p.titolo}`)
      lines.push(`  Ore previste: ${orePercorsoPreviste} | Ore effettuate: ${orePercorsoSvolte}`)
      if (p.descrizione) lines.push(`  ${p.descrizione}`)
      lines.push('────────────────────────────────────────')

      if (units.length === 0) {
        lines.push('  Nessuna unita definita')
      } else {
        units.forEach((u) => {
          const oreSvolteU = orePerUnita[u.id] || 0
          const statoLabel = STATO_UNITA_LABEL[u.stato] || u.stato
          lines.push(`  ${u.ordine || '-'}) ${u.titolo} — ${statoLabel.toUpperCase()}`)
          lines.push(`     Ore previste: ${u.orePreviste || 0} | Ore effettuate: ${oreSvolteU}`)
          if (u.descrizione) lines.push(`     ${u.descrizione}`)
        })
      }
    })

    lines.push('')
    lines.push('══════════════════════════════════════════════════')
    lines.push('RIEPILOGO GENERALE')
    lines.push(`  Ore totali previste: ${orePrevisteTotali}`)
    lines.push(`  Ore totali effettuate: ${oreSvolteTotali}`)
    lines.push(`  Lezioni svolte: ${lezioniSvolte}`)
    lines.push(`  Lezioni saltate: ${lezioniSaltate}`)
    if (orePrevisteTotali > 0) {
      const percentuale = Math.round((oreSvolteTotali / orePrevisteTotali) * 100)
      lines.push(`  Completamento: ${percentuale}%`)
    }

    return lines.join('\n')
  }, [selectedClasse, classePercorsi, unitaByPercorso, classeLezioni, materia, annoAttivo])

  // ── Orario GLOBALE grid data ──
  const allGiorni = [0, 1, 2, 3, 4, 5].filter((g) => g !== giornoLibero)

  const globalOrarioRows = useMemo(() => {
    const allOrari = orari.filter((o) => o.giorno !== giornoLibero)
    const maxOra = Math.max(0, ...allOrari.map((o) => o.numeroOra || 0))
    const rows = []
    for (let ora = 1; ora <= maxOra; ora++) {
      const row = { ora }
      for (const g of allGiorni) {
        // All slots for this (giorno, ora), sorted by classe
        row[g] = allOrari
          .filter((o) => o.giorno === g && o.numeroOra === ora)
          .sort((a, b) => (a.classe || '').localeCompare(b.classe || ''))
      }
      rows.push(row)
    }
    return rows
  }, [orari, giornoLibero])

  // ── Fallback per classe: percorso + unita "in corso" (o prima "da fare") ──
  const classeFallback = useMemo(() => {
    const map = {} // key: classe → { percorso, unita }
    for (const p of allPercorsi) {
      if (map[p.classe]) continue // usa il primo percorso trovato per classe
      const units = (unitaByPercorso[p.id] || [])
        .slice()
        .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      // Cerca prima un'unita "in_corso", poi la prima "da_fare"
      const inCorso = units.find((u) => u.stato === STATO_UNITA.IN_CORSO)
      const daFare = units.find((u) => u.stato === STATO_UNITA.DA_FARE)
      const unitaAttiva = inCorso || daFare
      map[p.classe] = {
        percorso: p.titolo,
        unita: unitaAttiva?.titolo || null,
      }
    }
    return map
  }, [allPercorsi, unitaByPercorso])

  // ── Slot → Percorso/Unita lookup filtrato per settimana selezionata ──
  const weekSlotContent = useMemo(() => {
    const map = {} // key: "classe-giorno-ora" → { percorso, unita }
    for (const l of lezioni) {
      if (!l.percorsoId || l.giorno == null || !l.numeroOra) continue
      const d = l.data?.toDate ? l.data.toDate() : new Date(l.data)
      if (d < weekStart || d > weekEnd) continue
      const key = `${l.classe}-${l.giorno}-${l.numeroOra}`
      const percorso = allPercorsi.find((p) => p.id === l.percorsoId)
      if (!percorso) continue
      const unita = l.unitaId
        ? (unitaByPercorso[l.percorsoId] || []).find((u) => u.id === l.unitaId)
        : null
      map[key] = {
        percorso: percorso.titolo,
        unita: unita?.titolo || null,
        stato: l.stato,
      }
    }
    return map
  }, [lezioni, allPercorsi, unitaByPercorso, weekStart, weekEnd])

  // Funzione per ottenere info slot (settimana selezionata, con fallback)
  function getSlotInfo(classe, giorno, ora) {
    return weekSlotContent[`${classe}-${giorno}-${ora}`] || classeFallback[classe] || null
  }

  // ── Helpers ──
  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Testo copiato negli appunti!')
    } catch {
      toast.error('Impossibile copiare. Prova a selezionare e copiare manualmente.')
    }
  }

  function handleDownload(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const orarioPrintRef = useRef(null)

  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} – ${format(weekEnd, 'd MMM yyyy', { locale: it })}`

  function handlePrintOrario() {
    const content = orarioPrintRef.current
    if (!content) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Il browser ha bloccato la finestra. Consenti i popup per questa pagina.')
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Orario Settimanale - ${weekLabel}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: normal; color: #666; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: center; font-size: 12px; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 600; }
  .slot { margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px dotted #ddd; }
  .slot:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .classe { font-weight: 700; font-size: 12px; }
  .materia { font-size: 11px; color: #444; }
  .percorso { font-size: 10px; color: #2563eb; font-weight: 600; margin-top: 1px; }
  .unita { font-size: 9px; color: #666; }
  @media print { body { margin: 10px; } @page { size: landscape; } }
</style></head><body>
  <h1>Orario Settimanale</h1>
  <h2>${weekLabel} — Anno Scolastico ${annoAttivo}</h2>
  ${content.innerHTML}
  <script>window.print(); window.onafterprint = function() { window.close(); }<\/script>
</body></html>`)
    printWindow.document.close()
  }

  if (configLoading || loading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Export</h2>
        <p className="text-gray-500">Configura l'anno scolastico nelle Impostazioni per iniziare.</p>
      </div>
    )
  }

  if (classi.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Export</h2>
        <p className="text-gray-500">Aggiungi le classi nelle Impostazioni per poter esportare.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + class selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Export</h1>
        <div className="flex gap-1">
          {classi.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedClasse(c)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedClasse === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'iniziale', label: 'Programmazione Iniziale' },
          { id: 'svolta', label: 'Programmazione Svolta' },
          { id: 'orario', label: 'Orario Settimanale' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Programmazione Iniziale ── */}
      {activeTab === 'iniziale' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-gray-500">
              Testo strutturato dei percorsi pianificati, da copiare nei documenti scolastici.
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleCopy(testoIniziale)}
                disabled={!testoIniziale}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copia
              </button>
              <button
                onClick={() => handleDownload(testoIniziale, `programmazione_iniziale_${selectedClasse}_${annoAttivo}.txt`)}
                disabled={!testoIniziale}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Scarica .txt
              </button>
            </div>
          </div>
          {testoIniziale ? (
            <pre className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto">
              {testoIniziale}
            </pre>
          ) : (
            <div className="p-8 bg-white rounded-lg border border-gray-200 text-center text-sm text-gray-400">
              Nessun percorso definito per {selectedClasse}. Creane uno nella pagina Percorsi.
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Programmazione Svolta ── */}
      {activeTab === 'svolta' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-gray-500">
              Consuntivo di quanto effettivamente svolto, per i documenti di fine anno.
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleCopy(testoSvolta)}
                disabled={!testoSvolta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copia
              </button>
              <button
                onClick={() => handleDownload(testoSvolta, `programmazione_svolta_${selectedClasse}_${annoAttivo}.txt`)}
                disabled={!testoSvolta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Scarica .txt
              </button>
            </div>
          </div>
          {testoSvolta ? (
            <pre className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto">
              {testoSvolta}
            </pre>
          ) : (
            <div className="p-8 bg-white rounded-lg border border-gray-200 text-center text-sm text-gray-400">
              Nessun percorso definito per {selectedClasse}. Creane uno nella pagina Percorsi.
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Orario Settimanale (GLOBALE) ── */}
      {activeTab === 'orario' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-gray-200 text-gray-700"
              >
                Oggi
              </button>
              <span className="text-sm font-medium text-gray-600 min-w-[170px] text-center">
                {format(weekStart, 'd MMM', { locale: it })} – {format(weekEnd, 'd MMM yyyy', { locale: it })}
              </span>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={handlePrintOrario}
              disabled={globalOrarioRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Stampa / Salva PDF
            </button>
          </div>

          <div ref={orarioPrintRef}>
            {globalOrarioRows.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 w-16">Ora</th>
                      {allGiorni.map((g) => (
                        <th key={g} className="border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600">
                          <div>{GIORNI_LABEL[g]}</div>
                          <div className="font-normal text-gray-400">{format(addDays(weekStart, g), 'd MMM', { locale: it })}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalOrarioRows.map((row) => {
                      const anySlot = allGiorni.flatMap((g) => row[g]).find(Boolean)
                      const hasAny = allGiorni.some((g) => row[g].length > 0)
                      if (!hasAny) return null
                      return (
                        <tr key={row.ora}>
                          <td className="border border-gray-200 px-2 py-2 text-center font-semibold text-blue-600 bg-gray-50 align-top">
                            <div>{ORE_ROMAN[row.ora - 1] || row.ora}</div>
                            {anySlot && (
                              <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                {anySlot.oraInizio}–{anySlot.oraFine}
                              </div>
                            )}
                          </td>
                          {allGiorni.map((g) => {
                            const slots = row[g]
                            return (
                              <td key={g} className={`border border-gray-200 px-1.5 py-1.5 align-top ${slots.length > 0 ? 'text-gray-800' : 'text-gray-300 text-center'}`}>
                                {slots.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {slots.map((slot) => {
                                      const info = getSlotInfo(slot.classe, g, row.ora)
                                      return (
                                        <div key={slot.classe} className={`${slots.length > 1 ? 'pb-1.5 border-b border-dotted border-gray-200 last:border-b-0 last:pb-0' : ''}`}>
                                          <div className="font-bold text-xs text-gray-900">{slot.classe}</div>
                                          <div className="text-[11px] text-gray-600">{slot.materia}</div>
                                          {info && (
                                            <div className="mt-0.5">
                                              <div className="text-[10px] text-blue-600 font-semibold leading-tight">{info.percorso}</div>
                                              {info.unita && (
                                                <div className="text-[9px] text-gray-500 leading-tight">{info.unita}</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 bg-white rounded-lg border border-gray-200 text-center text-sm text-gray-400">
                Nessun orario definito. Configura l'orario nelle Impostazioni.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
