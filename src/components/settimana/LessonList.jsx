import { isToday, isBefore } from 'date-fns'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
  STATI_LEZIONE,
  TIPO_VACANZA_LABEL,
} from '../../lib/costanti'
import StatoLegenda from '../common/StatoLegenda'
import LessonEditPanel from './LessonEditPanel'

const STATO_COLORS = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p border-link/30',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s border-accent/30',
  [STATO_LEZIONE.PARZIALE]: 'bg-badge-h border-warn/30',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x border-danger/30',
}

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p text-link ring-1 ring-link/40',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s text-accent ring-1 ring-accent/40',
  [STATO_LEZIONE.PARZIALE]: 'bg-badge-h text-warn ring-1 ring-warn/40',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x text-danger ring-1 ring-danger/40',
}

export default function LessonList({
  giorniSettimana,
  percorsi,
  updatingLezioni,
  editingLezione,
  setEditingLezione,
  onStatoChange,
  onSaveEdit,
  onDeleteLezione,
  onMarkDaySvolte,
}) {
  return (
    <>
      <div className="space-y-4">
        {giorniSettimana.map(({ index, date, label, lezioni: dayLezioni, expectedSlots, vacanza }) => (
          <div key={index}>
            <div className="flex items-center gap-2 mb-2">
              <h3
                className={`text-sm font-semibold ${
                  vacanza ? 'text-warn' : isToday(date) ? 'text-accent' : 'text-fg-muted'
                }`}
              >
                {label} {format(date, 'd MMM', { locale: it })}
                {isToday(date) && (
                  <span className="ml-2 px-2 py-0.5 bg-badge-s text-accent text-xs rounded-sm">
                    Oggi
                  </span>
                )}
                {vacanza && (
                  <span className="ml-2 px-2 py-0.5 bg-badge-warn text-warn text-xs rounded-sm">
                    {TIPO_VACANZA_LABEL[vacanza.tipo] || 'Non scolastico'}{vacanza.nome ? ` — ${vacanza.nome}` : ''}
                  </span>
                )}
              </h3>
            </div>

            {vacanza && dayLezioni.length === 0 ? (
              <p className="text-sm text-warn/70 pl-2 italic">Nessuna lezione (giorno non scolastico)</p>
            ) : dayLezioni.length === 0 && expectedSlots.length === 0 ? (
              <p className="text-sm text-fg-subtle pl-2">Nessuna lezione</p>
            ) : dayLezioni.length === 0 && expectedSlots.length > 0 ? (
              <p className="text-sm text-fg-subtle pl-2 italic">
                {expectedSlots.length} slot dall'orario — clicca "Genera lezioni" per crearle
              </p>
            ) : (
              <div className="space-y-2">
                {vacanza && dayLezioni.length > 0 && (
                  <p className="text-xs text-warn bg-badge-warn border border-warn/30 rounded px-2 py-1 italic">
                    Giorno non scolastico — le lezioni sotto non sono da considerare
                  </p>
                )}
                {dayLezioni.map((lez) => (
                  <div
                    key={lez.id}
                    className={`p-3 rounded-sm border ${
                      vacanza
                        ? 'bg-overlay border-edge opacity-50'
                        : STATO_COLORS[lez.stato] || 'bg-surface border-edge'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-mono w-24 shrink-0 ${vacanza ? 'text-fg-subtle line-through' : 'text-fg-muted'}`}>
                        {lez.oraInizio} – {lez.oraFine}
                      </span>
                      <span className={`text-sm font-bold w-12 shrink-0 ${vacanza ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                        {lez.classe}
                      </span>
                      <span className={`text-sm flex-1 min-w-0 ${vacanza ? 'text-fg-subtle line-through' : 'text-fg-muted'}`}>
                        <span className="truncate block">
                          {lez.titoloOverride || lez.materia}
                        </span>
                        {lez.percorsoId && (
                          <span className="text-[10px] text-special bg-badge-special px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                            {percorsi.find((p) => p.id === lez.percorsoId)?.titolo || 'Percorso'}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-fg-subtle font-mono">{lez.ore}h</span>
                      {lez.extra && (
                        <span className="text-[10px] font-semibold text-special bg-badge-special px-1.5 py-0.5 rounded-sm">
                          Extra
                        </span>
                      )}

                      {/* Quick status buttons */}
                      <div className="flex items-center gap-1.5">
                        {STATI_LEZIONE.map((s) => {
                          const isUpdating = updatingLezioni.has(lez.id)
                          return (
                            <button
                              key={s}
                              onClick={() => onStatoChange(lez.id, s)}
                              disabled={isUpdating}
                              className={`text-xs px-3 py-1.5 rounded-sm font-semibold transition-colors min-w-[2rem] ${
                                lez.stato === s
                                  ? STATO_BADGE[s]
                                  : 'bg-overlay text-fg-subtle hover:bg-surface hover:text-fg-muted'
                              } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {STATO_LEZIONE_SHORT[s]}
                            </button>
                          )
                        })}
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={() =>
                          setEditingLezione(
                            editingLezione?.id === lez.id
                              ? null
                              : {
                                  id: lez.id,
                                  note: lez.note || '',
                                  titoloOverride: lez.titoloOverride || '',
                                  stato: lez.stato,
                                  percorsoId: lez.percorsoId || null,
                                  unitaId: lez.unitaId || null,
                                  classe: lez.classe,
                                }
                          )
                        }
                        className="text-fg-subtle hover:text-fg-muted"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>

                    {/* Note preview */}
                    {lez.note && editingLezione?.id !== lez.id && (
                      <p className="mt-1 text-xs text-fg-muted pl-24 italic">{lez.note}</p>
                    )}

                    {/* Edit panel */}
                    {editingLezione?.id === lez.id && (
                      <LessonEditPanel
                        editingLezione={editingLezione}
                        setEditingLezione={setEditingLezione}
                        lez={lez}
                        percorsi={percorsi}
                        onSave={onSaveEdit}
                        onDelete={onDeleteLezione}
                      />
                    )}
                  </div>
                ))}
                {/* Segna tutte svolte */}
                {!vacanza && (isToday(date) || isBefore(date, new Date())) && dayLezioni.some((l) => l.stato === STATO_LEZIONE.PIANIFICATA) && (
                  <button
                    onClick={() => onMarkDaySvolte(dayLezioni)}
                    className="w-full py-2 bg-badge-s border border-accent/30 text-accent rounded-sm font-medium text-sm hover:bg-badge-s/80 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Segna tutte svolte
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <StatoLegenda />
      </div>
    </>
  )
}
