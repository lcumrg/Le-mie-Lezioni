import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import {
  getPercorsi,
  getUnita,
  getLezioni,
  getAssegnazioni,
  clonePercorsiToAnno,
} from '../lib/firestore'
import {
  STATO_LEZIONE,
  STATO_UNITA,
  STATO_UNITA_LABEL,
} from '../lib/costanti'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function ArchivioPage() {
  const { config, annoAttivo, loading: configLoading } = useApp()
  const toast = useToast()

  const [selectedAnno, setSelectedAnno] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [cloneConfirm, setCloneConfirm] = useState(null) // anno to clone from

  // Data for the selected archive year
  const [percorsi, setPercorsi] = useState([])
  const [unitaMap, setUnitaMap] = useState({}) // percorsoId -> unita[]
  const [lezioni, setLezioni] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [expandedPercorso, setExpandedPercorso] = useState(null)

  // Get all anni except the current active one
  const anniScolastici = config?.anniScolastici
    ? Object.keys(config.anniScolastici).sort().reverse()
    : []
  const anniArchivio = anniScolastici.filter((a) => a !== annoAttivo)

  // Load archive data when an anno is selected
  useEffect(() => {
    if (!selectedAnno) {
      setPercorsi([])
      setUnitaMap({})
      setLezioni([])
      setAssegnazioni([])
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const [perc, lez, asseg] = await Promise.all([
          getPercorsi(selectedAnno),
          getLezioni(selectedAnno),
          getAssegnazioni(selectedAnno),
        ])

        if (cancelled) return
        setPercorsi(perc)
        setLezioni(lez)
        setAssegnazioni(asseg)

        // Load unita for all percorsi
        const uMap = {}
        await Promise.all(
          perc.map(async (p) => {
            uMap[p.id] = await getUnita(p.id)
          })
        )
        if (!cancelled) setUnitaMap(uMap)
      } catch (err) {
        if (!cancelled) toast.error('Errore nel caricamento dell\'archivio')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedAnno])

  // Clone percorsi to current anno
  async function handleClone() {
    if (!cloneConfirm || !annoAttivo) return
    setCloneConfirm(null)
    setCloning(true)

    try {
      const count = await clonePercorsiToAnno(cloneConfirm, annoAttivo)
      toast.success(`${count} percorsi clonati nell'anno ${annoAttivo}`)
    } catch (err) {
      toast.error('Errore durante la clonazione dei percorsi')
    } finally {
      setCloning(false)
    }
  }

  // Stats helpers
  function getPercorsoStats(percorsoId) {
    const unita = unitaMap[percorsoId] || []
    const percLezioni = lezioni.filter((l) => l.percorsoId === percorsoId)
    const orePreviste = unita.reduce((s, u) => s + (u.orePreviste || 0), 0)
    const oreSvolte = percLezioni
      .filter((l) => l.stato === STATO_LEZIONE.SVOLTA)
      .reduce((s, l) => s + (l.ore || 1), 0)
    const unitaCompletate = unita.filter((u) => u.stato === STATO_UNITA.COMPLETATA).length

    return { unita, orePreviste, oreSvolte, unitaCompletate, totaleUnita: unita.length }
  }

  function getAnnoStats(anno) {
    if (anno !== selectedAnno) return null
    const totPercorsi = percorsi.length
    const totLezioni = lezioni.length
    const lezioniSvolte = lezioni.filter((l) => l.stato === STATO_LEZIONE.SVOLTA).length
    const lezioniSaltate = lezioni.filter((l) => l.stato === STATO_LEZIONE.SALTATA).length
    const classi = [...new Set(assegnazioni.map((a) => a.classe))].length

    return { totPercorsi, totLezioni, lezioniSvolte, lezioniSaltate, classi }
  }

  // Group percorsi by classe
  const percorsiPerClasse = {}
  for (const p of percorsi) {
    if (!percorsiPerClasse[p.classe]) percorsiPerClasse[p.classe] = []
    percorsiPerClasse[p.classe].push(p)
  }
  for (const arr of Object.values(percorsiPerClasse)) {
    arr.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || ''))
  }

  if (configLoading) return <LoadingSpinner />

  if (!annoAttivo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-fg mb-2">Archivio</h2>
        <p className="text-fg-muted">
          Configura l'anno scolastico nelle Impostazioni per iniziare.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-6">Archivio</h1>

      <ConfirmDialog
        open={cloneConfirm !== null}
        title="Clona percorsi"
        message={`Vuoi clonare tutti i percorsi dall'anno ${cloneConfirm} nell'anno corrente (${annoAttivo})? Le unita verranno copiate con stato "Da fare".`}
        confirmText="Clona"
        onConfirm={handleClone}
        onCancel={() => setCloneConfirm(null)}
      />

      {anniArchivio.length === 0 && !selectedAnno ? (
        <div className="bg-surface rounded-sm border border-edge p-8 text-center">
          <svg className="w-12 h-12 text-fg-subtle mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="text-fg-muted mb-2">Nessun anno archiviato</p>
          <p className="text-sm text-fg-subtle">
            Quando creerai un nuovo anno scolastico, quelli precedenti appariranno qui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Anno selector */}
          <div className="flex flex-wrap gap-2">
            {anniArchivio.map((anno) => (
              <button
                key={anno}
                onClick={() => setSelectedAnno(selectedAnno === anno ? null : anno)}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  selectedAnno === anno
                    ? 'bg-link text-white'
                    : 'bg-surface border border-edge text-fg hover:bg-overlay'
                }`}
              >
                {anno}
              </button>
            ))}
          </div>

          {/* Current anno card (always show as info) */}
          <div className="bg-badge-s border border-accent/30 rounded-sm px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-accent">Anno corrente: </span>
              <span className="text-sm font-bold text-accent">{annoAttivo}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-accent/20 text-accent rounded-full font-medium">
              Attivo
            </span>
          </div>

          {/* Loading */}
          {loading && <LoadingSpinner />}

          {/* Archive data */}
          {selectedAnno && !loading && (
            <div className="space-y-6">
              {/* Stats banner */}
              {(() => {
                const stats = getAnnoStats(selectedAnno)
                if (!stats) return null
                return (
                  <div className="bg-surface rounded-sm border border-edge p-4">
                    <h2 className="text-sm font-semibold text-fg-muted mb-3">
                      Riepilogo {selectedAnno}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-fg">{stats.classi}</p>
                        <p className="text-xs text-fg-muted">Classi</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-fg">{stats.totPercorsi}</p>
                        <p className="text-xs text-fg-muted">Percorsi</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-fg">{stats.totLezioni}</p>
                        <p className="text-xs text-fg-muted">Lezioni totali</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-accent">{stats.lezioniSvolte}</p>
                        <p className="text-xs text-fg-muted">Svolte</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-danger">{stats.lezioniSaltate}</p>
                        <p className="text-xs text-fg-muted">Saltate</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Clone action */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCloneConfirm(selectedAnno)}
                  disabled={cloning || percorsi.length === 0}
                  className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
                >
                  {cloning ? 'Clonazione...' : `Clona percorsi in ${annoAttivo}`}
                </button>
                <span className="text-xs text-fg-subtle">
                  Copia tutti i percorsi e le unita nell'anno corrente (senza lezioni)
                </span>
              </div>

              {/* Percorsi per classe */}
              {Object.keys(percorsiPerClasse).length === 0 ? (
                <div className="bg-surface rounded-sm border border-edge p-6 text-center">
                  <p className="text-sm text-fg-subtle">Nessun percorso in questo anno scolastico.</p>
                </div>
              ) : (
                Object.entries(percorsiPerClasse)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([classe, classPercorsi]) => (
                    <div key={classe}>
                      <h3 className="text-sm font-semibold text-fg-muted mb-2 flex items-center gap-2">
                        <span className="bg-edge text-fg px-2 py-0.5 rounded text-xs font-bold">
                          {classe}
                        </span>
                        {assegnazioni.find((a) => a.classe === classe)?.materia && (
                          <span className="text-xs font-normal text-fg-subtle">
                            {assegnazioni.find((a) => a.classe === classe).materia}
                          </span>
                        )}
                      </h3>

                      <div className="space-y-2">
                        {classPercorsi.map((p) => {
                          const stats = getPercorsoStats(p.id)
                          const isExpanded = expandedPercorso === p.id
                          const pct = stats.totaleUnita > 0
                            ? Math.round((stats.unitaCompletate / stats.totaleUnita) * 100)
                            : 0

                          return (
                            <div
                              key={p.id}
                              className="bg-surface rounded-sm border border-edge overflow-hidden"
                            >
                              {/* Header */}
                              <div
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-overlay"
                                onClick={() => setExpandedPercorso(isExpanded ? null : p.id)}
                              >
                                <svg
                                  className={`w-4 h-4 text-fg-subtle transition-transform shrink-0 ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>

                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-fg">{p.titolo}</h4>
                                  {p.descrizione && (
                                    <p className="text-xs text-fg-muted truncate">{p.descrizione}</p>
                                  )}
                                </div>

                                {/* Mini stats */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs text-fg-subtle">
                                    {stats.unitaCompletate}/{stats.totaleUnita} unita
                                  </span>
                                  <span className="text-xs text-fg-subtle">
                                    {stats.oreSvolte}/{stats.orePreviste}h
                                  </span>
                                  {/* Mini progress */}
                                  <div className="w-16 bg-edge rounded-full h-1.5">
                                    <div
                                      className="bg-accent h-1.5 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Expanded unita */}
                              {isExpanded && stats.unita.length > 0 && (
                                <div className="border-t border-edge-muted px-4 py-3">
                                  <div className="space-y-1.5">
                                    {stats.unita.map((u, idx) => {
                                      const unitLezioni = lezioni.filter(
                                        (l) => l.unitaId === u.id && l.stato === STATO_LEZIONE.SVOLTA
                                      )
                                      const unitOre = unitLezioni.reduce((s, l) => s + (l.ore || 1), 0)

                                      return (
                                        <div key={u.id} className="flex items-center gap-2 text-xs">
                                          <span className="text-fg-subtle font-mono w-6 shrink-0">
                                            {idx + 1}.
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                              u.stato === STATO_UNITA.COMPLETATA
                                                ? 'bg-badge-s text-accent'
                                                : u.stato === STATO_UNITA.IN_CORSO
                                                  ? 'bg-badge-warn text-warn'
                                                  : 'bg-overlay text-fg-muted'
                                            }`}
                                          >
                                            {STATO_UNITA_LABEL[u.stato] || 'Da fare'}
                                          </span>
                                          <span className={`flex-1 ${
                                            u.stato === STATO_UNITA.COMPLETATA
                                              ? 'text-fg-subtle line-through'
                                              : 'text-fg'
                                          }`}>
                                            {u.titolo}
                                          </span>
                                          <span className="text-fg-subtle shrink-0">
                                            {unitOre > 0 && (
                                              <span className="text-accent">{unitOre}/</span>
                                            )}
                                            {u.orePreviste || 0}h
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
