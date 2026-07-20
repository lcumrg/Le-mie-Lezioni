import { ORE_ROMAN, GIORNI_LABEL } from '../../lib/costanti'

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

/**
 * Editor di ore giornaliere, giorno libero e date inizio/fine anno.
 * Componente controllato: lo stato vive nel chiamante (ImpostazioniPage o
 * wizard Nuovo Anno), che decide quando salvare su Firestore.
 */
export default function OreScolasticheEditor({
  oreLezione,
  giornoLibero,
  dataInizioScuola,
  dataFineScuola,
  onOreChange,
  onGiornoLiberoChange,
  onDataInizioChange,
  onDataFineChange,
}) {
  function handleSetNumeroOre(count) {
    if (oreLezione.length === 0) {
      onOreChange(generateDefaultOre(count))
    } else if (count > oreLezione.length) {
      const last = oreLezione[oreLezione.length - 1]
      const additional = generateDefaultOre(count - oreLezione.length, last.fine)
      const renumbered = additional.map((o, i) => ({ ...o, numero: oreLezione.length + i + 1 }))
      onOreChange([...oreLezione, ...renumbered])
    } else {
      onOreChange(oreLezione.slice(0, count))
    }
  }

  function handleOraChange(index, field, value) {
    onOreChange(oreLezione.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  return (
    <div>
      <div className="mb-5">
        <label className="block text-sm font-medium text-fg-muted mb-2">Ore giornaliere</label>
        <div className="flex gap-2">
          {[4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleSetNumeroOre(n)}
              className={`w-10 h-10 rounded-sm text-sm font-semibold transition-colors ${
                oreLezione.length === n ? 'bg-link text-white' : 'bg-overlay text-fg-muted hover:bg-overlay'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {oreLezione.length > 0 && (
        <div className="mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-fg-muted border-b border-edge">
                <th className="pb-2 w-16">Ora</th>
                <th className="pb-2">Inizio</th>
                <th className="pb-2">Fine</th>
              </tr>
            </thead>
            <tbody>
              {oreLezione.map((ora, i) => (
                <tr key={i} className="border-b border-edge-muted">
                  <td className="py-2 font-semibold text-fg">{ORE_ROMAN[i]}</td>
                  <td className="py-2">
                    <input
                      type="time"
                      value={ora.inizio}
                      onChange={(e) => handleOraChange(i, 'inizio', e.target.value)}
                      className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="time"
                      value={ora.fine}
                      onChange={(e) => handleOraChange(i, 'fine', e.target.value)}
                      className="px-2 py-1 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-fg-muted mb-2">Giorno libero</label>
        <select
          value={giornoLibero ?? ''}
          onChange={(e) => onGiornoLiberoChange(e.target.value === '' ? null : Number(e.target.value))}
          className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
        >
          <option value="">Nessuno</option>
          {GIORNI_LABEL.map((g, i) => (
            <option key={i} value={i}>{g}</option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-fg-muted mb-2">Primo giorno di scuola</label>
        <input
          type="date"
          value={dataInizioScuola}
          onChange={(e) => onDataInizioChange(e.target.value)}
          className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
        />
        <p className="mt-1 text-xs text-fg-subtle">Prima di questa data l'app non genera lezioni e non conta ore.</p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-fg-muted mb-2">Ultimo giorno di scuola</label>
        <input
          type="date"
          value={dataFineScuola}
          onChange={(e) => onDataFineChange(e.target.value)}
          className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
        />
        <p className="mt-1 text-xs text-fg-subtle">Serve per calcolare le ore rimanenti per ogni classe.</p>
      </div>
    </div>
  )
}
