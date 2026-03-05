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

const STATO_BADGE = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p text-link ring-1 ring-link/40',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s text-accent ring-1 ring-accent/40',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x text-danger ring-1 ring-danger/40',
}

const STATO_CELL = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-badge-p/60',
  [STATO_LEZIONE.SVOLTA]: 'bg-badge-s/60',
  [STATO_LEZIONE.SALTATA]: 'bg-badge-x/60',
}

const STATO_CELL_BORDER = {
  [STATO_LEZIONE.PIANIFICATA]: 'border-l-link',
  [STATO_LEZIONE.SVOLTA]: 'border-l-accent',
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
  onCellClick,
  giornoLibero,
}) {
  function renderCell(lez) {
    const percorso = lez.percorsoId ? percorsoMap[lez.percorsoId] : null
    const unita = lez.unitaId ? unitaMap[lez.unitaId] : null

    return (
      <div className={`h-full flex flex-col border-l-3 rounded-sm px-1.5 py-1 ${STATO_CELL[lez.stato] || ''} ${STATO_CELL_BORDER[lez.stato] || 'border-l-edge'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-fg leading-none">
            {lez.classe}
          </span>
          <div className="flex gap-0.5">
            {STATI_LEZIONE.map((s) => {
              const isUpdating = updatingLezioni.has(lez.id)
              return (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onStatoChange(lez.id, s) }}
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
            <div className="text-[10px] leading-tight text-special font-semibold truncate">
              {percorso.titolo}
            </div>
            {unita && (
              <div className="text-[10px] leading-tight text-special/70 truncate">
                {unita.titolo}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-sm border border-edge overflow-hidden mb-6">
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
                      day.vacanza ? 'bg-badge-warn text-warn' : today ? 'bg-badge-s text-accent' : 'bg-canvas text-fg-muted'
                    }`}
                  >
                    <div className="font-semibold">{day.short}</div>
                    <div className={`text-[11px] ${day.vacanza ? 'text-warn/70' : today ? 'text-accent/70' : 'text-fg-subtle'}`}>
                      {format(day.date, 'd MMM', { locale: it })}
                    </div>
                    {day.vacanza && (
                      <div className="text-[9px] text-warn/70 truncate max-w-[5rem] mx-auto" title={`${TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scolastico'}${day.vacanza.nome ? ': ' + day.vacanza.nome : ''}`}>
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
                  <div className="font-semibold text-sm text-fg font-mono">
                    {ORE_ROMAN[ora.numero - 1]}
                  </div>
                  <div className="text-[10px] text-fg-subtle leading-tight font-mono">
                    {ora.inizio}
                  </div>
                </td>

                {days.map((day) => {
                  if (day.isFree) return null
                  const key = `${day.index}_${ora.numero}`
                  const lez = lessonGrid[key]
                  const today = isToday(day.date)

                  return (
                    <td
                      key={day.index}
                      onClick={lez ? () => onCellClick(lez) : undefined}
                      className={`border-b border-r border-edge last:border-r-0 p-0.5 align-top ${
                        day.vacanza ? 'bg-badge-warn/30' : today && !lez ? 'bg-badge-s/20' : ''
                      } ${lez ? 'cursor-pointer hover:ring-2 hover:ring-link/40 hover:ring-inset' : ''}`}
                      style={{ height: '5.5rem' }}
                    >
                      {lez ? (
                        <div className={day.vacanza ? 'opacity-40 line-through' : ''}>
                          {renderCell(lez)}
                        </div>
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
        extra={giornoLibero !== null ? (
          <span className="ml-auto text-fg-subtle italic">
            {GIORNI_LABEL[giornoLibero]}: giorno libero
          </span>
        ) : null}
      />
    </div>
  )
}
