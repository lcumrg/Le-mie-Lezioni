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
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-50 border-blue-200',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-50 border-green-200',
  [STATO_LEZIONE.SALTATA]: 'bg-red-50 border-red-200',
}

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-100 text-blue-700',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-100 text-green-700',
  [STATO_LEZIONE.SALTATA]: 'bg-red-100 text-red-700',
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
                  vacanza ? 'text-amber-600' : isToday(date) ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {label} {format(date, 'd MMM', { locale: it })}
                {isToday(date) && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Oggi
                  </span>
                )}
                {vacanza && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {TIPO_VACANZA_LABEL[vacanza.tipo] || 'Non scolastico'}{vacanza.nome ? ` — ${vacanza.nome}` : ''}
                  </span>
                )}
              </h3>
            </div>

            {vacanza && dayLezioni.length === 0 ? (
              <p className="text-sm text-amber-500 pl-2 italic">Nessuna lezione (giorno non scolastico)</p>
            ) : dayLezioni.length === 0 && expectedSlots.length === 0 ? (
              <p className="text-sm text-gray-400 pl-2">Nessuna lezione</p>
            ) : dayLezioni.length === 0 && expectedSlots.length > 0 ? (
              <p className="text-sm text-gray-400 pl-2 italic">
                {expectedSlots.length} slot dall'orario — clicca "Genera lezioni" per crearle
              </p>
            ) : (
              <div className="space-y-2">
                {vacanza && dayLezioni.length > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 italic">
                    Giorno non scolastico — le lezioni sotto non sono da considerare
                  </p>
                )}
                {dayLezioni.map((lez) => (
                  <div
                    key={lez.id}
                    className={`p-3 rounded-lg border ${
                      vacanza
                        ? 'bg-gray-50 border-gray-200 opacity-50'
                        : STATO_COLORS[lez.stato] || 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-mono w-24 shrink-0 ${vacanza ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                        {lez.oraInizio} – {lez.oraFine}
                      </span>
                      <span className={`text-sm font-bold w-12 shrink-0 ${vacanza ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {lez.classe}
                      </span>
                      <span className={`text-sm flex-1 min-w-0 ${vacanza ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                        <span className="truncate block">
                          {lez.titoloOverride || lez.materia}
                        </span>
                        {lez.percorsoId && (
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                            {percorsi.find((p) => p.id === lez.percorsoId)?.titolo || 'Percorso'}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">{lez.ore}h</span>
                      {lez.extra && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
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
                              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors min-w-[2rem] ${
                                lez.stato === s
                                  ? STATO_BADGE[s]
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>

                    {/* Note preview */}
                    {lez.note && editingLezione?.id !== lez.id && (
                      <p className="mt-1 text-xs text-gray-500 pl-24 italic">{lez.note}</p>
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
                    className="w-full py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium text-sm hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
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
