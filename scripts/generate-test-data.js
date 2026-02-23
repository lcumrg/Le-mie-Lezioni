#!/usr/bin/env node
/**
 * Generates a fake test year Excel file for testing the import functionality.
 * Run: node scripts/generate-test-data.js
 * Output: public/test-anno-prova.xlsx
 */
import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Classi e Materie ──
const classi = [
  { Classe: '1A', Materia: 'Informatica' },
  { Classe: '2A', Materia: 'Informatica' },
  { Classe: '3B', Materia: 'Tecnologia' },
  { Classe: '4C', Materia: 'Sistemi e Reti' },
]

// ── Orario settimanale ──
// Giorno: Lunedì=0, Martedì=1, Mercoledì=2, Giovedì=3, Venerdì=4
const orario = [
  // 1A - 4 ore/settimana
  { Giorno: 'Lunedì', Ora: 1, Inizio: '08:00', Fine: '09:00', Classe: '1A' },
  { Giorno: 'Lunedì', Ora: 2, Inizio: '09:00', Fine: '10:00', Classe: '1A' },
  { Giorno: 'Mercoledì', Ora: 3, Inizio: '10:00', Fine: '11:00', Classe: '1A' },
  { Giorno: 'Venerdì', Ora: 1, Inizio: '08:00', Fine: '09:00', Classe: '1A' },
  // 2A - 3 ore/settimana
  { Giorno: 'Martedì', Ora: 1, Inizio: '08:00', Fine: '09:00', Classe: '2A' },
  { Giorno: 'Martedì', Ora: 2, Inizio: '09:00', Fine: '10:00', Classe: '2A' },
  { Giorno: 'Giovedì', Ora: 4, Inizio: '11:00', Fine: '12:00', Classe: '2A' },
  // 3B - 3 ore/settimana
  { Giorno: 'Lunedì', Ora: 4, Inizio: '11:00', Fine: '12:00', Classe: '3B' },
  { Giorno: 'Mercoledì', Ora: 1, Inizio: '08:00', Fine: '09:00', Classe: '3B' },
  { Giorno: 'Venerdì', Ora: 3, Inizio: '10:00', Fine: '11:00', Classe: '3B' },
  // 4C - 4 ore/settimana
  { Giorno: 'Martedì', Ora: 3, Inizio: '10:00', Fine: '11:00', Classe: '4C' },
  { Giorno: 'Martedì', Ora: 4, Inizio: '11:00', Fine: '12:00', Classe: '4C' },
  { Giorno: 'Giovedì', Ora: 1, Inizio: '08:00', Fine: '09:00', Classe: '4C' },
  { Giorno: 'Giovedì', Ora: 2, Inizio: '09:00', Fine: '10:00', Classe: '4C' },
]

// ── Percorsi e Unità ──
const percorsi = [
  // 1A - Informatica
  { Classe: '1A', Percorso: 'Fondamenti di Informatica', 'Unità': 'Introduzione al PC', Ordine: 1, 'Ore Previste': 4 },
  { Classe: '1A', Percorso: 'Fondamenti di Informatica', 'Unità': 'Sistema operativo', Ordine: 2, 'Ore Previste': 6 },
  { Classe: '1A', Percorso: 'Fondamenti di Informatica', 'Unità': 'File e cartelle', Ordine: 3, 'Ore Previste': 4 },
  { Classe: '1A', Percorso: 'Programmazione Base', 'Unità': 'Algoritmi e flowchart', Ordine: 1, 'Ore Previste': 8 },
  { Classe: '1A', Percorso: 'Programmazione Base', 'Unità': 'Scratch: primi programmi', Ordine: 2, 'Ore Previste': 10 },
  { Classe: '1A', Percorso: 'Programmazione Base', 'Unità': 'Variabili e cicli', Ordine: 3, 'Ore Previste': 8 },
  // 2A - Informatica
  { Classe: '2A', Percorso: 'Web Design', 'Unità': 'HTML base', Ordine: 1, 'Ore Previste': 6 },
  { Classe: '2A', Percorso: 'Web Design', 'Unità': 'CSS e styling', Ordine: 2, 'Ore Previste': 8 },
  { Classe: '2A', Percorso: 'Web Design', 'Unità': 'Progetto sito web', Ordine: 3, 'Ore Previste': 10 },
  { Classe: '2A', Percorso: 'Database', 'Unità': 'Introduzione ai database', Ordine: 1, 'Ore Previste': 4 },
  { Classe: '2A', Percorso: 'Database', 'Unità': 'SQL base', Ordine: 2, 'Ore Previste': 6 },
  // 3B - Tecnologia
  { Classe: '3B', Percorso: 'Energia e Ambiente', 'Unità': 'Fonti energetiche', Ordine: 1, 'Ore Previste': 6 },
  { Classe: '3B', Percorso: 'Energia e Ambiente', 'Unità': 'Energie rinnovabili', Ordine: 2, 'Ore Previste': 8 },
  { Classe: '3B', Percorso: 'Energia e Ambiente', 'Unità': 'Impatto ambientale', Ordine: 3, 'Ore Previste': 4 },
  { Classe: '3B', Percorso: 'Materiali', 'Unità': 'Metalli e leghe', Ordine: 1, 'Ore Previste': 5 },
  { Classe: '3B', Percorso: 'Materiali', 'Unità': 'Plastica e polimeri', Ordine: 2, 'Ore Previste': 5 },
  // 4C - Sistemi e Reti
  { Classe: '4C', Percorso: 'Reti di Computer', 'Unità': 'Modello OSI e TCP/IP', Ordine: 1, 'Ore Previste': 8 },
  { Classe: '4C', Percorso: 'Reti di Computer', 'Unità': 'Indirizzamento IP', Ordine: 2, 'Ore Previste': 10 },
  { Classe: '4C', Percorso: 'Reti di Computer', 'Unità': 'Subnetting', Ordine: 3, 'Ore Previste': 8 },
  { Classe: '4C', Percorso: 'Sicurezza Informatica', 'Unità': 'Crittografia base', Ordine: 1, 'Ore Previste': 6 },
  { Classe: '4C', Percorso: 'Sicurezza Informatica', 'Unità': 'Firewall e VPN', Ordine: 2, 'Ore Previste': 8 },
  { Classe: '4C', Percorso: 'Sicurezza Informatica', 'Unità': 'Sicurezza delle reti wireless', Ordine: 3, 'Ore Previste': 6 },
]

// ── Ricorrenze ──
const ricorrenze = [
  { Classe: '1A', Giorno: 'Lunedì', Ora: 1, Percorso: 'Fondamenti di Informatica' },
  { Classe: '1A', Giorno: 'Lunedì', Ora: 2, Percorso: 'Fondamenti di Informatica' },
  { Classe: '1A', Giorno: 'Mercoledì', Ora: 3, Percorso: 'Programmazione Base' },
  { Classe: '1A', Giorno: 'Venerdì', Ora: 1, Percorso: 'Programmazione Base' },
  { Classe: '2A', Giorno: 'Martedì', Ora: 1, Percorso: 'Web Design' },
  { Classe: '2A', Giorno: 'Martedì', Ora: 2, Percorso: 'Web Design' },
  { Classe: '2A', Giorno: 'Giovedì', Ora: 4, Percorso: 'Database' },
  { Classe: '4C', Giorno: 'Martedì', Ora: 3, Percorso: 'Reti di Computer' },
  { Classe: '4C', Giorno: 'Martedì', Ora: 4, Percorso: 'Reti di Computer' },
  { Classe: '4C', Giorno: 'Giovedì', Ora: 1, Percorso: 'Sicurezza Informatica' },
  { Classe: '4C', Giorno: 'Giovedì', Ora: 2, Percorso: 'Sicurezza Informatica' },
]

// ── Vacanze (Feb 2026 – Giugno 2026) ──
// Uses multiple date formats on purpose to test the parser
const vacanze = [
  { Nome: 'Carnevale', 'Data Inizio': '2026-02-16', 'Data Fine': '2026-02-17', Tipo: 'vacanza' },
  { Nome: 'Vacanze di Pasqua', 'Data Inizio': '2026-03-29', 'Data Fine': '2026-04-07', Tipo: 'vacanza' },
  { Nome: 'Ponte 25 Aprile', 'Data Inizio': '2026-04-25', 'Data Fine': '2026-04-26', Tipo: 'vacanza' },
  { Nome: 'Festa dei Lavoratori', 'Data Inizio': '2026-05-01', 'Data Fine': '2026-05-01', Tipo: 'chiusura' },
  { Nome: 'Festa della Repubblica', 'Data Inizio': '2026-06-02', 'Data Fine': '2026-06-02', Tipo: 'chiusura' },
  { Nome: 'Assenza formazione docenti', 'Data Inizio': '2026-03-12', 'Data Fine': '2026-03-12', Tipo: 'assenza' },
  { Nome: 'Assemblea istituto', 'Data Inizio': '2026-04-15', 'Data Fine': '2026-04-15', Tipo: 'chiusura' },
  { Nome: 'Gita scolastica', 'Data Inizio': '2026-05-14', 'Data Fine': '2026-05-15', Tipo: 'assenza' },
]

// ── Build workbook ──
const wb = XLSX.utils.book_new()

const wsClassi = XLSX.utils.json_to_sheet(classi)
XLSX.utils.book_append_sheet(wb, wsClassi, 'Classi e Materie')

const wsOrario = XLSX.utils.json_to_sheet(orario)
XLSX.utils.book_append_sheet(wb, wsOrario, 'Orario')

const wsPercorsi = XLSX.utils.json_to_sheet(percorsi)
XLSX.utils.book_append_sheet(wb, wsPercorsi, 'Percorsi e Unità')

const wsRic = XLSX.utils.json_to_sheet(ricorrenze)
XLSX.utils.book_append_sheet(wb, wsRic, 'Ricorrenze')

const wsVac = XLSX.utils.json_to_sheet(vacanze)
XLSX.utils.book_append_sheet(wb, wsVac, 'Vacanze')

const outPath = join(__dirname, '..', 'public', 'test-anno-prova.xlsx')
XLSX.writeFile(wb, outPath)
console.log(`File di test generato: ${outPath}`)
console.log(`\nContenuto:`)
console.log(`  - ${classi.length} classi`)
console.log(`  - ${orario.length} slot orario`)
console.log(`  - ${percorsi.length} unita in ${[...new Set(percorsi.map(p => p.Percorso))].length} percorsi`)
console.log(`  - ${ricorrenze.length} ricorrenze`)
console.log(`  - ${vacanze.length} vacanze/assenze`)
console.log(`\nAnno consigliato: 2025-2026`)
console.log(`Data fine scuola consigliata: 2026-06-10`)
