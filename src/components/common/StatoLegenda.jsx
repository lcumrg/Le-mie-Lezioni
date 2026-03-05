import {
  STATO_LEZIONE,
  STATO_LEZIONE_SHORT,
  STATO_LEZIONE_LABEL,
} from '../../lib/costanti'

const LEGEND_ITEMS = [
  { stato: STATO_LEZIONE.PIANIFICATA, bg: 'bg-badge-p', border: 'border-link/30' },
  { stato: STATO_LEZIONE.SVOLTA, bg: 'bg-badge-s', border: 'border-accent/30' },
  { stato: STATO_LEZIONE.SALTATA, bg: 'bg-badge-x', border: 'border-danger/30' },
]

export default function StatoLegenda({ extra }) {
  return (
    <div className="px-4 py-2 bg-canvas border-t border-edge flex flex-wrap items-center gap-4 text-[11px] text-fg-muted">
      {LEGEND_ITEMS.map(({ stato, bg, border }) => (
        <span key={stato} className="flex items-center gap-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-sm ${bg} border ${border}`} />
          {STATO_LEZIONE_SHORT[stato]} = {STATO_LEZIONE_LABEL[stato]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block w-1 h-2.5 rounded-sm bg-special" /> = Percorso collegato
      </span>
      {extra}
    </div>
  )
}
