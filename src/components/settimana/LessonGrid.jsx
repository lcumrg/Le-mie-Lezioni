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
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-100 text-blue-700',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-100 text-green-700',
  [STATO_LEZIONE.SALTATA]: 'bg-red-100 text-red-700',
}

const STATO_CELL = {
  [STATO_LEZIONE.PIANIFICATA]: 'bg-blue-50/70',
  [STATO_LEZIONE.SVOLTA]: 'bg-green-50/70',
  [STATO_LEZIONE.SALTATA]: 'bg-red-50/60',
}

const STATO_CELL_BORDER = {
  [STATO_LEZIONE.PIANIFICATA]: 'border-l-blue-400',
  [STATO_LEZIONE.SVOLTA]: 'border-l-green-500',
  [STATO_LEZIONE.SALTATA]: 'border-l-red-400',
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
      <div className={`h-full flex flex-col border-l-3 rounded-sm px-1.5 py-1 ${STATO_CELL[lez.stato] || ''} ${STATO_CELL_BORDER[lez.stato] || 'border-l-gray-300'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-gray-800 leading-none">
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
                      : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500'
                  } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                  title={STATO_LEZIONE_LABEL[s]}
                >
                  {STATO_LEZIONE_SHORT[s]}
                </button>
              )
            })}
          </div>
        </div>

        <span className="text-[11px] text-gray-600 leading-tight truncate mt-0.5">
          {lez.titoloOverride || lez.materia}
        </span>

        {percorso && (
          <div className="mt-auto pt-0.5">
            <div className="text-[10px] leading-tight text-purple-700 font-semibold truncate">
              {percorso.titolo}
            </div>
            {unita && (
              <div className="text-[10px] leading-tight text-purple-500 truncate">
                {unita.titolo}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '640px' }}>
          <thead>
            <tr>
              <th className="w-14 px-1 py-3 bg-gray-50 border-b border-r border-gray-200 text-xs text-gray-500 font-medium">
                Ora
              </th>
              {days.map((day) => {
                if (day.isFree) return null
                const today = isToday(day.date)
                return (
                  <th
                    key={day.index}
                    className={`px-1 py-3 border-b border-r border-gray-200 text-center text-xs font-medium last:border-r-0 ${
                      day.vacanza ? 'bg-amber-50 text-amber-600' : today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{day.short}</div>
                    <div className={`text-[11px] ${day.vacanza ? 'text-amber-500' : today ? 'text-blue-500' : 'text-gray-400'}`}>
                      {format(day.date, 'd MMM', { locale: it })}
                    </div>
                    {day.vacanza && (
                      <div className="text-[9px] text-amber-500 truncate max-w-[5rem] mx-auto" title={`${TIPO_VACANZA_LABEL[day.vacanza.tipo] || 'Non scolastico'}${day.vacanza.nome ? ': ' + day.vacanza.nome : ''}`}>
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
                <td className="px-1 py-0.5 border-b border-r border-gray-200 bg-gray-50 text-center align-middle">
                  <div className="font-semibold text-sm text-gray-700">
                    {ORE_ROMAN[ora.numero - 1]}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-tight">
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
                      className={`border-b border-r border-gray-200 last:border-r-0 p-0.5 align-top ${
                        day.vacanza ? 'bg-amber-50/30' : today && !lez ? 'bg-blue-50/20' : ''
                      } ${lez ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-inset' : ''}`}
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
          <span className="ml-auto text-gray-400 italic">
            {GIORNI_LABEL[giornoLibero]}: giorno libero
          </span>
        ) : null}
      />
    </div>
  )
}
