import { useState } from 'react'

/**
 * Form + elenco delle assegnazioni classe—materia.
 * Componente controllato: i dati arrivano dalle props, le azioni tornano
 * su onAdd(classe, materia) / onDelete(id). Usato da ImpostazioniPage e
 * dal wizard Nuovo Anno (che passa anche i suggerimenti dell'anno prima).
 */
export default function AssegnazioniEditor({ assegnazioni, onAdd, onDelete, suggerimenti = [] }) {
  const [classe, setClasse] = useState('')
  const [materia, setMateria] = useState('')

  const ordinate = [...assegnazioni].sort(
    (a, b) => a.classe.localeCompare(b.classe) || a.materia.localeCompare(b.materia)
  )
  const giaPresenti = new Set(assegnazioni.map((a) => `${a.classe}|${a.materia}`))
  const suggerimentiUtili = suggerimenti.filter((s) => !giaPresenti.has(`${s.classe}|${s.materia}`))

  function handleSubmit(e) {
    e.preventDefault()
    if (!classe.trim() || !materia.trim()) return
    onAdd(classe.trim().toUpperCase(), materia.trim())
    setClasse('')
    setMateria('')
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-fg-muted mb-1">Classe</label>
          <input
            type="text"
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            placeholder="es. 1A"
            className="w-24 px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-fg-muted mb-1">Materia</label>
          <input
            type="text"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="es. Informatica"
            className="w-full px-3 py-2 border border-edge bg-inset text-fg rounded-sm text-sm focus:ring-1 focus:ring-link/40 focus:border-link outline-none"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-link text-white text-sm font-medium rounded-sm hover:bg-link/80">
          Aggiungi
        </button>
      </form>

      {suggerimentiUtili.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-fg-muted mb-2">Dall'anno precedente (click per aggiungere):</p>
          <div className="flex flex-wrap gap-2">
            {suggerimentiUtili.map((s) => (
              <button
                key={`${s.classe}|${s.materia}`}
                type="button"
                onClick={() => onAdd(s.classe, s.materia)}
                className="px-2.5 py-1 text-xs bg-badge-p text-link border border-link/30 rounded-sm hover:bg-link/20 transition-colors"
              >
                + {s.classe} — {s.materia}
              </button>
            ))}
          </div>
        </div>
      )}

      {ordinate.length > 0 ? (
        <div className="space-y-2">
          {ordinate.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-overlay rounded-sm">
              <span className="text-sm text-fg">
                <strong>{a.classe}</strong> — {a.materia}
              </span>
              <button onClick={() => onDelete(a.id)} className="text-danger/60 hover:text-danger text-sm">
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">Nessuna assegnazione ancora.</p>
      )}
    </div>
  )
}
