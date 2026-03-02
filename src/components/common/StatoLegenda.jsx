import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
} from '../../lib/costanti'

const LEGEND_ITEMS = [
  { stato: STATO_LEZIONE.PIANIFICATA, bg: 'bg-blue-100', border: 'border-blue-200' },
  { stato: STATO_LEZIONE.SVOLTA, bg: 'bg-green-100', border: 'border-green-200' },
  { stato: STATO_LEZIONE.SALTATA, bg: 'bg-red-100', border: 'border-red-200' },
]

export default function StatoLegenda({ extra }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
      {LEGEND_ITEMS.map(({ stato, bg, border }) => (
        <span key={stato} className="flex items-center gap-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-sm ${bg} border ${border}`} />
          {STATO_LEZIONE_SHORT[stato]} = {STATO_LEZIONE_LABEL[stato]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block w-1 h-2.5 rounded-sm bg-purple-400" /> = Percorso collegato
      </span>
      {extra}
    </div>
  )
}
