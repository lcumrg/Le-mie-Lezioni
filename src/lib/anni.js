// Helper puri su anni scolastici e classi (testati in anni.test.js)

const ANNO_PATTERN = /^(\d{4})-(\d{4})$/

/** true se 'YYYY-YYYY' con anni consecutivi (es. '2026-2027') */
export function isAnnoValido(value) {
  const m = ANNO_PATTERN.exec(value || '')
  if (!m) return false
  return Number(m[2]) === Number(m[1]) + 1
}

/** '2025-2026' → '2026-2027'; null se il formato non è valido */
export function annoSuccessivo(anno) {
  const m = ANNO_PATTERN.exec(anno || '')
  if (!m) return null
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`
}

/** '2026-2027' → '2025-2026'; null se il formato non è valido */
export function annoPrecedente(anno) {
  const m = ANNO_PATTERN.exec(anno || '')
  if (!m) return null
  return `${Number(m[1]) - 1}-${Number(m[2]) - 1}`
}

/**
 * La classe dell'anno dopo per chi segue gli stessi studenti: '1A' → '2A'.
 * null per l'ultimo anno di corso ('5A') o per nomi non standard: in quei
 * casi non c'è un suggerimento sensato.
 */
export function classeSuccessiva(classe) {
  const m = /^([1-9])(.*)$/.exec((classe || '').trim())
  if (!m) return null
  const anno = Number(m[1])
  if (anno >= 5) return null
  return `${anno + 1}${m[2]}`
}
