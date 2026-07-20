import { useState } from 'react'
import { GIORNI_LABEL, ORE_ROMAN } from '../../lib/costanti'

/**
 * Form rapido + elenco per giorno dell'orario settimanale.
 * Richiede le ore scolastiche configurate (oreLezione non vuoto).
 * Componente controllato: onAdd({ giorno, numeroOra, classe, materia }),
 * onDelete(id). Usato da ImpostazioniPage e dal wizard Nuovo Anno.
 */
export default function OrarioEditor({ orari, oreLezione, giornoLibero, assegnazioni, onAdd, onDelete }) {
  const [form, setForm] = useState({ giorno: 0, numeroOra: 1, classe: '', materia: '' })

  // Se il giorno selezionato coincide col giorno libero (es. cambiato dopo),
  // ripiega sul primo giorno valido — derivato, senza effect
  const giornoForm = form.giorno === giornoLibero
    ? [0, 1, 2, 3, 4, 5].find((g) => g !== giornoLibero) ?? 0
    : form.giorno

  const assegnazioniOrdinate = [...assegnazioni].sort(
    (a, b) => a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)
  )

  const orariOrdinati = [...orari].sort(
    (a, b) => a.giorno - b.giorno || (a.numeroOra || 0) - (b.numeroOra || 0) || a.oraInizio.localeCompare(b.oraInizio)
  )
  const orariPerGiorno = {}
  for (let g = 0; g < 6; g++) orariPerGiorno[g] = []
  for (const o of orariOrdinati) {
    if (orariPerGiorno[o.giorno]) orariPerGiorno[o.giorno].push(o)
  }

  function handleAssegnazioneChange(value) {
    const [classe, materia] = value.split('||')
    setForm((f) => ({ ...f, classe: classe || '', materia: materia || '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.classe || !form.materia) return
    onAdd({ giorno: giornoForm, numeroOra: form.numeroOra, classe: form.classe, materia: form.materia })
    setForm((f) => ({ ...f, classe: '', materia: '' }))
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-1">Giorno</label>
          <select
            value={giornoForm}
            onChange={(e) => setForm((f) => ({ ...f, giorno: Number(e.target.value) }))}
            className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          >
            {GIORNI_LABEL.map((g, i) => {
              if (i === giornoLibero) return null
              return <option key={i} value={i}>{g}</option>
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-1">Ora</label>
          <select
            value={form.numeroOra}
            onChange={(e) => setForm((f) => ({ ...f, numeroOra: Number(e.target.value) }))}
            className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          >
            {oreLezione.map((o) => (
              <option key={o.numero} value={o.numero}>
                {ORE_ROMAN[o.numero - 1]} ({o.inizio}–{o.fine})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-1">Classe — Materia</label>
          <select
            value={form.classe ? `${form.classe}||${form.materia}` : ''}
            onChange={(e) => handleAssegnazioneChange(e.target.value)}
            className="px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          >
            <option value="">—</option>
            {assegnazioniOrdinate.map((a) => (
              <option key={`${a.classe}||${a.materia}`} value={`${a.classe}||${a.materia}`}>
                {a.classe} — {a.materia}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!form.classe}
          className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80 disabled:opacity-50"
        >
          Aggiungi
        </button>
      </form>

      <div className="space-y-4">
        {GIORNI_LABEL.map((giornoLabel, gi) => {
          if (gi === giornoLibero) return null
          const slots = orariPerGiorno[gi] || []
          if (slots.length === 0) return null
          return (
            <div key={gi}>
              <h3 className="text-sm font-semibold text-fg-muted mb-2">{giornoLabel}</h3>
              <div className="space-y-1">
                {slots.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm text-sm">
                    <span className="font-semibold text-link w-10 shrink-0">
                      {o.numeroOra ? ORE_ROMAN[o.numeroOra - 1] : '—'}
                    </span>
                    <span className="font-mono text-fg-subtle w-28 shrink-0 text-xs">
                      {o.oraInizio} – {o.oraFine}
                    </span>
                    <span className="font-semibold text-fg w-12">{o.classe}</span>
                    <span className="text-fg-muted flex-1">{o.materia}</span>
                    <button onClick={() => onDelete(o.id)} className="text-danger/60 hover:text-danger ml-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {giornoLibero !== null && (
          <div className="px-3 py-2 bg-overlay rounded-sm text-sm text-fg-subtle italic">
            {GIORNI_LABEL[giornoLibero]} — giorno libero
          </div>
        )}
        {orari.length === 0 && (
          <p className="text-sm text-fg-subtle">Nessun orario definito. Aggiungi i tuoi slot settimanali sopra.</p>
        )}
      </div>
    </div>
  )
}
