import { useState, useRef, useEffect, useCallback } from 'react'
import { isToday } from 'date-fns'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
  STATI_LEZIONE,
  GIORNI_LABEL,
  ORE_ROMAN,
  TIPO_VACANZA_LABEL,
} from '../../lib/costanti'
import StatoLegenda from '../common/StatoLegenda'
import PercorsoSelector from '../calendario/PercorsoSelector'

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p text-link ring-1 ring-link/40',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s text-accent ring-1 ring-accent/40',
  [STATO_LEZIONE.PARZIALE]: 'bg-badge-h text-warn ring-1 ring-warn/40',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x text-danger ring-1 ring-danger/40',
}

const STATO_CELL = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p/60',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s/60',
  [STATO_LEZIONE.PARZIALE]: 'bg-badge-h/60',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x/60',
}

const STATO_CELL_BORDER = {
  [STATO_LEZIONE.PIANIFICATA]: 'border-l-link',
  [STATO_LEZIONE.SVOLTA]: 'border-l-accent',
  [STATO_LEZIONE.PARZIALE]: 'border-l-warn',
  [STATO_LEZIONE.SALTATA]: 'border-l-danger',
}

export default function LessonGrid({
  days,
  oreLezione,
  lessonGrid,
  percorsoMap,
  unitaMap,
  updatingLezioni,
  onStatoChange,
  onQuickSave,
  onDeleteLezione,
  percorsi,
  giornoLibero,
}) {
  const [selectedKey, setSelectedKey] = useState(null)
  const [editNote, setEditNote] = useState('')
  const [editTitolo, setEditTitolo] = useState('')
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'
  const gridRef = useRef(null)
  const noteDebounceRef = useRef(null)
  const titoloDebounceRef = useRef(null)
  const saveStatusRef = useRef(null)

  const selectedLez = selectedKey ? lessonGrid[selectedKey] : null

  // Valid navigation targets
  const validDays = days.filter((d) => !d.isFree).map((d) => d.index)
  const validOre = oreLezione.map((o) => o.numero)

  // When selection changes, populate edit fields
  useEffect(() => {
    if (selectedLez) {
      setEditNote(selectedLez.note || '')
      setEditTitolo(selectedLez.titoloOverride || '')
    }
  }, [selectedKey])

  // Wrapped save with indicator
  function quickSaveWithIndicator(id, updates) {
    setSaveStatus('saving')
    clearTimeout(saveStatusRef.current)
    onQuickSave(id, updates)
    // Assume success (Firestore is fast enough)
    saveStatusRef.current = setTimeout(() => {
      setSaveStatus('saved')
      saveStatusRef.current = setTimeout(() => setSaveStatus(null), 1500)
    }, 300)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      clearTimeout(noteDebounceRef.current)
      clearTimeout(titoloDebounceRef.current)
      clearTimeout(saveStatusRef.current)
    }
  }, [])

  // Save pending text changes when selection changes away
  const savePendingEdits = useCallback(
    (lez) => {
      if (!lez) return
      clearTimeout(noteDebounceRef.current)
      clearTimeout(titoloDebounceRef.current)
      const updates = {}
      const noteEl = document.getElementById('grid-edit-note')
      const titoloEl = document.getElementById('grid-edit-titolo')
      const currentNote = noteEl ? noteEl.value.trim() : editNote.trim()
      const currentTitolo = titoloEl ? titoloEl.value.trim() : editTitolo.trim()
      if (currentNote !== (lez.note || '').trim()) updates.note = currentNote
      if (currentTitolo !== (lez.titoloOverride || '').trim()) updates.titoloOverride = currentTitolo
      if (Object.keys(updates).length > 0) quickSaveWithIndicator(lez.id, updates)
    },
    [editNote, editTitolo, onQuickSave]
  )

  function handleCellClick(dayIndex, oraNumero) {
    const key = `${dayIndex}_${oraNumero}`
    if (selectedKey === key) {
      savePendingEdits(selectedLez)
      setSelectedKey(null)
    } else {
      savePendingEdits(selectedLez)
      setSelectedKey(key)
    }
  }

  function handleClose() {
    savePendingEdits(selectedLez)
    setSelectedKey(null)
    setSaveStatus(null)
    setTimeout(() => gridRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    // Don't intercept when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return

    if (!selectedKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'Enter')) {
      e.preventDefault()
      if (validDays.length > 0 && validOre.length > 0) {
        setSelectedKey(`${validDays[0]}_${validOre[0]}`)
      }
      return
    }

    if (!selectedKey) return

    const [dayStr, oraStr] = selectedKey.split('_')
    const dayIdx = parseInt(dayStr)
    const oraNum = parseInt(oraStr)

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault()
        const idx = validOre.indexOf(oraNum)
        if (idx > 0) {
          savePendingEdits(selectedLez)
          setSelectedKey(`${dayIdx}_${validOre[idx - 1]}`)
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        const idx = validOre.indexOf(oraNum)
        if (idx < validOre.length - 1) {
          savePendingEdits(selectedLez)
          setSelectedKey(`${dayIdx}_${validOre[idx + 1]}`)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const idx = validDays.indexOf(dayIdx)
        if (idx > 0) {
          savePendingEdits(selectedLez)
          setSelectedKey(`${validDays[idx - 1]}_${oraNum}`)
        }
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        const idx = validDays.indexOf(dayIdx)
        if (idx < validDays.length - 1) {
          savePendingEdits(selectedLez)
          setSelectedKey(`${validDays[idx + 1]}_${oraNum}`)
        }
        break
      }
      case 'Escape':
        handleClose()
        break
      case 's':
      case 'S':
        if (selectedLez) {
          e.preventDefault()
          onStatoChange(selectedLez.id, STATO_LEZIONE.SVOLTA)
        }
        break
      case 'p':
      case 'P':
        if (selectedLez) {
          e.preventDefault()
          onStatoChange(selectedLez.id, STATO_LEZIONE.PIANIFICATA)
        }
        break
      case 'x':
      case 'X':
        if (selectedLez) {
          e.preventDefault()
          onStatoChange(selectedLez.id, STATO_LEZIONE.SALTATA)
        }
        break
      case 'Tab': {
        e.preventDefault()
        const dayIdx2 = parseInt(selectedKey.split('_')[0])
        const oraNum2 = parseInt(selectedKey.split('_')[1])
        const dIdx = validDays.indexOf(dayIdx2)
        const oIdx = validOre.indexOf(oraNum2)
        if (e.shiftKey) {
          // Shift+Tab: previous cell
          if (oIdx > 0) {
            savePendingEdits(selectedLez)
            setSelectedKey(`${dayIdx2}_${validOre[oIdx - 1]}`)
          } else if (dIdx > 0) {
            savePendingEdits(selectedLez)
            setSelectedKey(`${validDays[dIdx - 1]}_${validOre[validOre.length - 1]}`)
          }
        } else {
          // Tab: next cell
          if (oIdx < validOre.length - 1) {
            savePendingEdits(selectedLez)
            setSelectedKey(`${dayIdx2}_${validOre[oIdx + 1]}`)
          } else if (dIdx < validDays.length - 1) {
            savePendingEdits(selectedLez)
            setSelectedKey(`${validDays[dIdx + 1]}_${validOre[0]}`)
          }
        }
        break
      }
    }
  }

  function handleNoteChange(e) {
    const val = e.target.value
    setEditNote(val)
    clearTimeout(noteDebounceRef.current)
    setSaveStatus('saving')
    noteDebounceRef.current = setTimeout(() => {
      if (selectedLez && val.trim() !== (selectedLez.note || '').trim()) {
        quickSaveWithIndicator(selectedLez.id, { note: val.trim() })
      } else {
        setSaveStatus(null)
      }
    }, 1000)
  }

  function handleTitoloChange(e) {
    const val = e.target.value
    setEditTitolo(val)
    clearTimeout(titoloDebounceRef.current)
    setSaveStatus('saving')
    titoloDebounceRef.current = setTimeout(() => {
      if (selectedLez && val.trim() !== (selectedLez.titoloOverride || '').trim()) {
        quickSaveWithIndicator(selectedLez.id, { titoloOverride: val.trim() })
      } else {
        setSaveStatus(null)
      }
    }, 1000)
  }

  function handlePercorsoChange({ percorsoId, unitaId, unitaTitolo }) {
    if (!selectedLez) return
    const updates = { percorsoId: percorsoId || null, unitaId: unitaId || null }
    if (unitaId && !editTitolo) {
      updates.titoloOverride = unitaTitolo || ''
      setEditTitolo(unitaTitolo || '')
    }
    quickSaveWithIndicator(selectedLez.id, updates)
  }

  function renderCell(lez) {
    const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
    const unita = lez.unitaId ? unitaMap[lez.unitaId] : null

    return (
      <div
        className={`h-full flex flex-col border-l-3 rounded-sm px-1.5 py-1 ${STATO_CELL[lez.stato] || ''} ${STATO_CELL_BORDER[lez.stato] || 'border-l-edge'}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-fg leading-none">{lez.classe}</span>
          <div className="flex gap-0.5">
            {STATI_LEZIONE.map((s) => {
              const isUpdating = updatingLezioni.has(lez.id)
              return (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatoChange(lez.id, s)
                  }}
                  disabled={isUpdating}
                  className={`w-6 h-6 rounded text-[11px] font-bold leading-none flex items-center justify-center transition-colors ${
                    lez.stato === s
                      ? STATO_BADGE[s]
                      : 'bg-overlay text-fg-subtle hover:bg-surface hover:text-fg-muted'
                  } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                  title={STATO_LEZIONE_LABEL[s]}
                >
                  {STATO_LEZIONE_SHORT[s]}
                </button>
              )
            })}
          </div>
        </div>

        <span className="text-[11px] text-fg-muted leading-tight truncate mt-0.5">
          {lez.titoloOverride || lez.materia}
        </span>

        {percorso && (
          <div className="mt-auto pt-0.5">
            <div className="text-[10px] leading-tight text-special font-semibold truncate">{percorso.titolo}</div>
            {unita && (
              <div className="text-[10px] leading-tight text-special/70 truncate">{unita.titolo}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Selected lesson details for the edit panel
  const selectedPercorso = selectedLez?.percorsoId ? percorsoMap[selectedLez.percorsoId] : null

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="outline-none mb-6"
    >
      <div className="bg-surface rounded-sm border border-edge overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th className="w-14 px-1 py-3 bg-canvas border-b border-r border-edge text-xs text-fg-muted font-medium">
                  Ora
                </th>
                {days.map((day) => {
                  if (day.isFree) return null
                  const today = isToday(day.date)
                  return (
                    <th
                      key={day.index}
                      className={`px-1 py-3 border-b border-r border-edge text-center text-xs font-medium last:border-r-0 ${
                        day.vacanza
                          ? 'bg-badge-warn text-warn'
                          : today
                            ? 'bg-badge-s text-accent'
                            : 'bg-canvas text-fg-muted'
                      }`}
                    >
                      <div className="font-semibold">{day.short}</div>
                      <div
                        className={`text-[11px] ${day.vacanza ? 'text-warn/70' : today ? 'text-accent/70' : 'text-fg-subtle'}`}
                      >
                        {format(day.date, 'd MMM', { locale: it })}
                      </div>
                      {day.vacanza && (
                        <div
                          className="text-[9px] text-warn/70 truncate max-w-[5rem] mx-auto"
                          title={`${TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scolastico'}${day.vacanza.nome ? ': ' + day.vacanza.nome : ''}`}
                        >
                          {TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scol.'}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {oreLezione.map((ora) => (
                <tr key={ora.numero}>
                  <td className="px-1 py-0.5 border-b border-r border-edge bg-canvas text-center align-middle">
                    <div className="font-semibold text-sm text-fg font-mono">{ORE_ROMAN[ora.numero - 1]}</div>
                    <div className="text-[10px] text-fg-subtle leading-tight font-mono">{ora.inizio}</div>
                  </td>

                  {days.map((day) => {
                    if (day.isFree) return null
                    const key = `${day.index}_${ora.numero}`
                    const lez = lessonGrid[key]
                    const today = isToday(day.date)
                    const isSelected = selectedKey === key

                    return (
                      <td
                        key={day.index}
                        onClick={() => handleCellClick(day.index, ora.numero)}
                        className={`border-b border-r border-edge last:border-r-0 p-0.5 align-top cursor-pointer transition-shadow ${
                          day.vacanza
                            ? 'bg-badge-warn/30'
                            : today && !lez
                              ? 'bg-badge-s/20'
                              : ''
                        } ${
                          isSelected
                            ? 'ring-2 ring-link ring-inset'
                            : lez
                              ? 'hover:ring-2 hover:ring-link/40 hover:ring-inset'
                              : 'hover:bg-overlay/50'
                        }`}
                        style={{ height: '5.5rem' }}
                      >
                        {lez ? (
                          <div className={day.vacanza ? 'opacity-40 line-through' : ''}>{renderCell(lez)}</div>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <StatoLegenda
          extra={
            <span className="ml-auto text-fg-subtle italic text-[11px]">
              {giornoLibero !== null && (
                <span>{GIORNI_LABEL[giornoLibero]}: giorno libero · </span>
              )}
              Frecce: naviga · Tab: prossima · S/P/X: stato · Esc: chiudi
            </span>
          }
        />
      </div>

      {/* ── Editing panel below grid ── */}
      {selectedKey && selectedLez && (
        <div className="mt-3 bg-surface border border-link/40 rounded-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-fg">{selectedLez.classe}</span>
              <span className="text-fg-subtle">&mdash;</span>
              <span className="text-sm text-fg-muted">{selectedLez.materia}</span>
              <span className="text-xs text-fg-subtle font-mono">
                {selectedLez.oraInizio} – {selectedLez.oraFine}
              </span>
              {saveStatus && (
                <span className={`text-[10px] font-medium ml-2 ${
                  saveStatus === 'saving' ? 'text-warn' : 'text-accent'
                }`}>
                  {saveStatus === 'saving' ? 'Salvando...' : 'Salvato'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Status buttons */}
              {STATI_LEZIONE.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatoChange(selectedLez.id, s)}
                  disabled={updatingLezioni.has(selectedLez.id)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-colors ${
                    selectedLez.stato === s
                      ? STATO_BADGE[s]
                      : 'bg-overlay text-fg-subtle hover:bg-surface hover:text-fg-muted'
                  }`}
                >
                  {STATO_LEZIONE_SHORT[s]}
                </button>
              ))}
              <button
                onClick={handleClose}
                className="ml-2 text-fg-subtle hover:text-fg-muted p-1"
                title="Chiudi (Esc)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Titolo/argomento</label>
              <input
                id="grid-edit-titolo"
                type="text"
                value={editTitolo}
                onChange={handleTitoloChange}
                placeholder={selectedLez.materia}
                className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-inset focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Note</label>
              <input
                id="grid-edit-note"
                type="text"
                value={editNote}
                onChange={handleNoteChange}
                placeholder="Appunti sulla lezione..."
                className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-inset focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-fg-muted mb-1">Percorso</label>
              <PercorsoSelector
                percorsi={(percorsi || []).filter(
                  (p) => p.classe === selectedLez.classe && p.materia === selectedLez.materia
                )}
                percorsoId={selectedLez.percorsoId || null}
                unitaId={selectedLez.unitaId || null}
                onChange={handlePercorsoChange}
              />
            </div>
            <button
              onClick={() => {
                handleClose()
                onDeleteLezione(selectedLez.id)
              }}
              className="mt-5 px-3 py-1.5 text-danger text-xs font-medium hover:bg-badge-x rounded-sm shrink-0"
            >
              Elimina
            </button>
          </div>
        </div>
      )}

      {/* Empty selection info */}
      {selectedKey && !selectedLez && (
        <div className="mt-3 bg-surface border border-edge rounded-sm p-4 text-center">
          <p className="text-sm text-fg-subtle">Nessuna lezione in questa cella.</p>
        </div>
      )}
    </div>
  )
}
