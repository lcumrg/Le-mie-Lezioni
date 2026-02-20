// ── Stati lezione ──
export const STATO_LEZIONE = {
  PIANIFICATA: 'pianificata',
  SVOLTA: 'svolta',
  SALTATA: 'saltata',
}

export const STATO_LEZIONE_LABEL = {
  [STATO_LEZIONE.PIANIFICATA]: 'Pianificata',
  [STATO_LEZIONE.SVOLTA]: 'Svolta',
  [STATO_LEZIONE.SALTATA]: 'Saltata',
}

export const STATO_LEZIONE_SHORT = {
  [STATO_LEZIONE.PIANIFICATA]: 'P',
  [STATO_LEZIONE.SVOLTA]: 'S',
  [STATO_LEZIONE.SALTATA]: 'X',
}

export const STATI_LEZIONE = [
  STATO_LEZIONE.PIANIFICATA,
  STATO_LEZIONE.SVOLTA,
  STATO_LEZIONE.SALTATA,
]

// ── Stati unita ──
export const STATO_UNITA = {
  DA_FARE: 'da_fare',
  IN_CORSO: 'in_corso',
  COMPLETATA: 'completata',
}

export const STATO_UNITA_LABEL = {
  [STATO_UNITA.DA_FARE]: 'Da fare',
  [STATO_UNITA.IN_CORSO]: 'In corso',
  [STATO_UNITA.COMPLETATA]: 'Completata',
}

export const STATI_UNITA = [
  STATO_UNITA.DA_FARE,
  STATO_UNITA.IN_CORSO,
  STATO_UNITA.COMPLETATA,
]

// Ciclo stati unita (click per avanzare)
export const STATO_UNITA_NEXT = {
  [STATO_UNITA.DA_FARE]: STATO_UNITA.IN_CORSO,
  [STATO_UNITA.IN_CORSO]: STATO_UNITA.COMPLETATA,
  [STATO_UNITA.COMPLETATA]: STATO_UNITA.DA_FARE,
}

// ── Tipi vacanza ──
export const TIPO_VACANZA = {
  VACANZA: 'vacanza',
  CHIUSURA: 'chiusura',
  ASSENZA: 'assenza',
}

export const TIPO_VACANZA_LABEL = {
  [TIPO_VACANZA.VACANZA]: 'Vacanza',
  [TIPO_VACANZA.CHIUSURA]: 'Chiusura',
  [TIPO_VACANZA.ASSENZA]: 'Assenza personale',
}

// ── Giorni ──
export const GIORNI = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato']
export const GIORNI_LABEL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
export const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

// ── Ore ──
export const ORE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
