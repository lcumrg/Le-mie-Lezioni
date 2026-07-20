// Logica pura del calendario scolastico: giorni di scuola, ore disponibili,
// settimane della timeline e generazione lezioni dall'orario.
// Nessuna dipendenza da Firestore o React: tutto testabile (calendario.test.js).
//
// Convenzioni sui dati (le stesse del resto dell'app):
// - giorno: indice 0=lunedì … 5=sabato (6=domenica, mai scolastico)
// - vacanze: [{ dataInizio: 'YYYY-MM-DD', dataFine: 'YYYY-MM-DD', nome?, tipo? }]
// - orari: [{ giorno, classe, materia, numeroOra, oraInizio, oraFine, ore }]
// - i giorni viaggiano come stringhe 'YYYY-MM-DD' dove possibile: i confronti
//   lessicografici coincidono con quelli cronologici e ignorano i fusi orari

import { addDays, format, startOfDay, startOfWeek } from 'date-fns'
import { STATO_LEZIONE } from './costanti'

export function toDayStr(date) {
  return format(date, 'yyyy-MM-dd')
}

/** Indice giorno dell'app: lunedì=0 … sabato=5, domenica=6 */
export function giornoIndex(date) {
  return (date.getDay() + 6) % 7
}

/** La vacanza che copre il giorno ('YYYY-MM-DD'), o null */
export function vacanzaDelGiorno(dayStr, vacanze = []) {
  return vacanze.find((v) => dayStr >= v.dataInizio && dayStr <= v.dataFine) || null
}

/** true se è un giorno di scuola: lun-sab, non giorno libero, non vacanza */
export function isGiornoScolastico(date, { giornoLibero = null, vacanze = [] } = {}) {
  const idx = giornoIndex(date)
  if (idx === 6) return false
  if (idx === giornoLibero) return false
  return !vacanzaDelGiorno(toDayStr(date), vacanze)
}

/** Giorni scolastici nell'intervallo [da, a], estremi inclusi */
export function giorniScolastici(da, a, opts = {}) {
  const result = []
  const aStr = toDayStr(a)
  for (let day = startOfDay(da); toDayStr(day) <= aStr; day = addDays(day, 1)) {
    if (isGiornoScolastico(day, opts)) result.push(day)
  }
  return result
}

function sommaOre(slots) {
  return slots.reduce((s, o) => s + (o.ore || 1), 0)
}

/**
 * Ore di lezione disponibili nei giorni scolastici di [da, a] (estremi inclusi).
 * `classe`/`materia` filtrano gli slot orario; omessi contano tutto.
 * Per le "ore rimanenti" passare `da = oggi`: i giorni già trascorsi
 * della settimana corrente non contano.
 */
export function oreDisponibili(orari, { da, a, giornoLibero = null, vacanze = [], classe = null, materia = null }) {
  const rilevanti = orari.filter(
    (o) => (classe == null || o.classe === classe) && (materia == null || o.materia === materia)
  )
  let ore = 0
  for (const day of giorniScolastici(da, a, { giornoLibero, vacanze })) {
    const idx = giornoIndex(day)
    ore += sommaOre(rilevanti.filter((o) => o.giorno === idx))
  }
  return ore
}

/** Come oreDisponibili, ma per tutte le assegnazioni: { 'classe|materia': ore } */
export function oreDisponibiliPerAssegnazione(orari, { da, a, giornoLibero = null, vacanze = [] }) {
  const result = {}
  for (const day of giorniScolastici(da, a, { giornoLibero, vacanze })) {
    const idx = giornoIndex(day)
    for (const o of orari) {
      if (o.giorno !== idx) continue
      const key = `${o.classe}|${o.materia}`
      result[key] = (result[key] || 0) + (o.ore || 1)
    }
  }
  return result
}

/**
 * Settimane per la timeline: dalla settimana di `da` a quella di `a`, incluse.
 * La prima settimana parte comunque dal suo lunedì (i giorni già trascorsi
 * restano visibili in timeline); l'ultima è troncata ad `a`: i giorni dopo
 * l'ultimo giorno di scuola non esistono. Se `a` cade di lunedì, la sua
 * settimana è inclusa con quel solo giorno.
 * Ritorna [{ start, startStr, giorni: Date[] (solo scolastici), vacanzaGiorni, vacanzaNome }]
 */
export function settimaneScolastiche({ da, a, giornoLibero = null, vacanze = [] }) {
  const result = []
  const aStr = toDayStr(a)
  let current = startOfWeek(startOfDay(da), { weekStartsOn: 1 })
  while (toDayStr(current) <= aStr) {
    const giorni = []
    let vacanzaGiorni = 0
    let vacanzaNome = null
    for (let d = 0; d < 6; d++) {
      const day = addDays(current, d)
      const dayStr = toDayStr(day)
      if (dayStr > aStr) break
      if (d === giornoLibero) continue
      const vac = vacanzaDelGiorno(dayStr, vacanze)
      if (vac) {
        vacanzaGiorni++
        if (!vacanzaNome && vac.nome) vacanzaNome = vac.nome
        continue
      }
      giorni.push(day)
    }
    result.push({ start: current, startStr: toDayStr(current), giorni, vacanzaGiorni, vacanzaNome })
    current = addDays(current, 7)
  }
  return result
}

/** Chiave di dedup di una lezione (stessa dello storico dell'app) */
export function chiaveLezione(dayStr, oraInizio, classe) {
  return `${dayStr}_${oraInizio}_${classe}`
}

/**
 * Costruisce i dati delle lezioni da generare per i giorni scolastici in [da, a].
 *
 * Curriculum: `distribuzioni` e `ricorrenze` sono mappe annidate
 * { [classe]: { [materia]: { chiaveSlot: {...} } } } (un doc per anno, vedi
 * firestore.js). Le distribuzioni (chiave `${dayStr}_${numeroOra||0}`)
 * vincono sulle ricorrenze (chiave `${giornoIdx}-${numeroOra||0}`)
 * perché portano sia il percorso sia l'unità pianificata nella timeline.
 *
 * `existingKeys` (Set di chiaveLezione) evita i duplicati e viene esteso con
 * le chiavi create, così chiamate successive nella stessa esecuzione non
 * ricreano le stesse lezioni.
 *
 * `data` è un Date a mezzanotte locale: il chiamante lo converte per Firestore
 * (Timestamp.fromDate). Ritorna { lezioni, giorniSaltati } dove giorniSaltati
 * conta i giorni di vacanza incontrati (il giorno libero non conta).
 */
export function costruisciLezioniDaOrario({
  da,
  a,
  annoScolastico,
  orari,
  vacanze = [],
  giornoLibero = null,
  ricorrenze = {},
  distribuzioni = {},
  existingKeys = new Set(),
}) {
  const lezioni = []
  let giorniSaltati = 0
  const aStr = toDayStr(a)

  for (let day = startOfDay(da); toDayStr(day) <= aStr; day = addDays(day, 1)) {
    const idx = giornoIndex(day)
    if (idx === 6 || idx === giornoLibero) continue
    const dayStr = toDayStr(day)
    if (vacanzaDelGiorno(dayStr, vacanze)) {
      giorniSaltati++
      continue
    }

    for (const slot of orari.filter((o) => o.giorno === idx)) {
      const key = chiaveLezione(dayStr, slot.oraInizio, slot.classe)
      if (existingKeys.has(key)) continue
      existingKeys.add(key)

      const dist = distribuzioni[slot.classe]?.[slot.materia]?.[`${dayStr}_${slot.numeroOra || 0}`]
      const ric = ricorrenze[slot.classe]?.[slot.materia]?.[`${idx}-${slot.numeroOra || 0}`]

      const percorsoId = dist?.percorsoId || ric?.percorsoId || null
      const unitaId = dist?.unitaId || null

      lezioni.push({
        annoScolastico,
        data: day,
        giorno: idx,
        numeroOra: slot.numeroOra || null,
        oraInizio: slot.oraInizio,
        oraFine: slot.oraFine,
        classe: slot.classe,
        materia: slot.materia,
        ore: slot.ore ?? 1,
        stato: STATO_LEZIONE.PIANIFICATA,
        note: '',
        titoloOverride: '',
        ...(percorsoId ? { percorsoId } : {}),
        ...(unitaId ? { unitaId } : {}),
      })
    }
  }

  return { lezioni, giorniSaltati }
}
