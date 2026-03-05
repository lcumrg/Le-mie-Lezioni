import { useState } from 'react'
import { format, startOfDay } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { addLezione } from '../../lib/firestore'
import { STATO_LEZIONE } from '../../lib/costanti'

export default function ExtraLessonForm({ annoAttivo, assegnazioni, onClose, onSuccess }) {
  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    oraInizio: '08:00',
    oraFine: '09:00',
    classeId: '',
    materia: '',
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)

  function handleClasseChange(classe) {
    const assegnazione = assegnazioni.find((a) => a.classe === classe)
    setForm((prev) => ({
      ...prev,
      classeId: classe,
      materia: assegnazione ? assegnazione.materia : '',
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.classeId || !form.materia || !annoAttivo) return
    setSubmitting(true)
    try {
      const dateObj = new Date(form.data + 'T00:00:00')
      const giorno = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1
      await addLezione({
        annoScolastico: annoAttivo,
        data: Timestamp.fromDate(startOfDay(dateObj)),
        giorno,
        numeroOra: null,
        oraInizio: form.oraInizio,
        oraFine: form.oraFine,
        classe: form.classeId,
        materia: form.materia,
        ore: 1,
        stato: STATO_LEZIONE.PIANIFICATA,
        note: form.note,
        titoloOverride: '',
        extra: true,
      })
      onSuccess()
      onClose()
    } catch {
      // error handled by parent via toast
    }
    setSubmitting(false)
  }

  return (
    <div className="mb-6 p-4 bg-badge-special border border-special/30 rounded-sm">
      <h3 className="text-sm font-semibold text-special mb-3">
        Aggiungi lezione extra (supplenza, recupero, attivita extra...)
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Ora inizio</label>
          <input
            type="time"
            value={form.oraInizio}
            onChange={(e) => setForm((f) => ({ ...f, oraInizio: e.target.value }))}
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface font-mono focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Ora fine</label>
          <input
            type="time"
            value={form.oraFine}
            onChange={(e) => setForm((f) => ({ ...f, oraFine: e.target.value }))}
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface font-mono focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Classe</label>
          <select
            value={form.classeId}
            onChange={(e) => handleClasseChange(e.target.value)}
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
            required
          >
            <option value="">Seleziona classe...</option>
            {[...new Set(assegnazioni.map((a) => a.classe))].sort().map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Materia</label>
          <input
            type="text"
            value={form.materia}
            onChange={(e) => setForm((f) => ({ ...f, materia: e.target.value }))}
            placeholder="Materia"
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-inset focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Note (opzionale)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Supplenza, recupero..."
            className="w-full px-3 py-1.5 border border-edge rounded-sm text-sm text-fg bg-surface focus:ring-1 focus:ring-special/40 focus:border-special outline-none"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 bg-special text-canvas text-sm font-medium rounded-sm hover:bg-special/80 disabled:opacity-50"
          >
            {submitting ? 'Aggiunta...' : 'Aggiungi'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-overlay text-fg text-sm font-medium rounded-sm hover:bg-edge-muted"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
