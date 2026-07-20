#!/usr/bin/env node
/**
 * Genera il template Excel per l'importazione dati.
 * Uso: node scripts/genera-template.cjs
 * Output: public/template-importazione.xlsx
 */

const XLSX = require('xlsx')
const path = require('path')

const wb = XLSX.utils.book_new()

// ═══════════════════════════════════════
// FOGLIO 1: Classi e Materie
// ═══════════════════════════════════════
const classiData = [
  ['Classe', 'Materia'],
  ['1A', 'Italiano'],
  ['2A', 'Italiano'],
  ['3A', 'Italiano'],
]
const wsClassi = XLSX.utils.aoa_to_sheet(classiData)
wsClassi['!cols'] = [{ wch: 12 }, { wch: 20 }]
XLSX.utils.book_append_sheet(wb, wsClassi, 'Classi e Materie')

// ═══════════════════════════════════════
// FOGLIO 2: Orario Settimanale
// ═══════════════════════════════════════
const orarioData = [
  ['Giorno', 'Ora', 'Inizio', 'Fine', 'Classe'],
  ['Lunedì', 1, '08:00', '09:00', '1A'],
  ['Lunedì', 2, '09:00', '10:00', '1A'],
  ['Martedì', 1, '08:00', '09:00', '2A'],
  ['Martedì', 3, '10:00', '11:00', '1A'],
  ['Mercoledì', 2, '09:00', '10:00', '3A'],
]
const wsOrario = XLSX.utils.aoa_to_sheet(orarioData)
wsOrario['!cols'] = [{ wch: 14 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
XLSX.utils.book_append_sheet(wb, wsOrario, 'Orario')

// ═══════════════════════════════════════
// FOGLIO 3: Percorsi e Unità
// ═══════════════════════════════════════
const percorsiData = [
  ['Classe', 'Percorso', 'Unità', 'Ordine', 'Ore Previste'],
  ['1A', 'Caviardage', 'Introduzione al caviardage', 1, 3],
  ['1A', 'Caviardage', 'Pratica guidata', 2, 4],
  ['1A', 'Caviardage', 'Produzione autonoma', 3, 3],
  ['1A', 'Racconto realistico', 'Leggere un racconto', 1, 2],
  ['1A', 'Racconto realistico', 'Analisi struttura', 2, 3],
  ['1A', 'Racconto realistico', 'Scrivere un racconto', 3, 5],
  ['2A', 'Poesia', 'Metrica e figure retoriche', 1, 4],
  ['2A', 'Poesia', 'Analisi di testi', 2, 3],
  ['2A', 'Poesia', 'Produzione poetica', 3, 3],
]
const wsPercorsi = XLSX.utils.aoa_to_sheet(percorsiData)
wsPercorsi['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 14 }]
XLSX.utils.book_append_sheet(wb, wsPercorsi, 'Percorsi e Unità')

// ═══════════════════════════════════════
// FOGLIO 4: Ricorrenze (opzionale)
// ═══════════════════════════════════════
const ricorrenzeData = [
  ['Classe', 'Giorno', 'Ora', 'Percorso'],
  ['1A', 'Lunedì', 1, 'Caviardage'],
  ['1A', 'Martedì', 3, 'Racconto realistico'],
]
const wsRicorrenze = XLSX.utils.aoa_to_sheet(ricorrenzeData)
wsRicorrenze['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 6 }, { wch: 25 }]
XLSX.utils.book_append_sheet(wb, wsRicorrenze, 'Ricorrenze')

// ═══════════════════════════════════════
// FOGLIO 5: Vacanze (opzionale)
// ═══════════════════════════════════════
const vacanzeData = [
  ['Nome', 'Data Inizio', 'Data Fine', 'Tipo'],
  ['Vacanze di Natale', '2025-12-23', '2026-01-06', 'vacanza'],
  ['Vacanze di Pasqua', '2026-04-02', '2026-04-07', 'vacanza'],
  ['Ponte 25 aprile', '2026-04-25', '2026-04-25', 'vacanza'],
]
const wsVacanze = XLSX.utils.aoa_to_sheet(vacanzeData)
wsVacanze['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
XLSX.utils.book_append_sheet(wb, wsVacanze, 'Vacanze')

// ═══════════════════════════════════════
// FOGLIO 6: Istruzioni
// ═══════════════════════════════════════
const istruzioniData = [
  ['ISTRUZIONI PER LA COMPILAZIONE'],
  [''],
  ['Compila i fogli di questo file con i tuoi dati, poi importalo dall\'app.'],
  ['I dati di esempio possono essere cancellati o sovrascritti.'],
  [''],
  ['── FOGLIO "Classi e Materie" ──'],
  ['Classe: nome della classe (es. 1A, 2B, 3C)'],
  ['Materia: la materia che insegni in quella classe'],
  [''],
  ['── FOGLIO "Orario" ──'],
  ['Giorno: Lunedì, Martedì, Mercoledì, Giovedì, Venerdì, Sabato'],
  ['Ora: numero dell\'ora (1, 2, 3, 4, 5, 6, 7, 8)'],
  ['Inizio/Fine: orario nel formato HH:MM (es. 08:00, 09:00)'],
  ['Classe: deve corrispondere a una classe dal foglio "Classi e Materie"'],
  [''],
  ['── FOGLIO "Percorsi e Unità" ──'],
  ['Classe: la classe a cui appartiene il percorso'],
  ['Percorso: nome del percorso didattico (es. "Caviardage", "Poesia")'],
  ['Unità: titolo dell\'unità didattica all\'interno del percorso'],
  ['Ordine: numero progressivo (1, 2, 3...) per ordinare le unità nel percorso'],
  ['Ore Previste: quante ore servono per completare questa unità'],
  [''],
  ['── FOGLIO "Ricorrenze" (opzionale) ──'],
  ['Associa uno slot orario fisso a un percorso ricorrente.'],
  ['Classe: la classe'],
  ['Giorno: Lunedì, Martedì, ecc.'],
  ['Ora: numero dell\'ora'],
  ['Percorso: deve corrispondere al nome di un percorso dal foglio "Percorsi e Unità"'],
  [''],
  ['── FOGLIO "Vacanze" (opzionale) ──'],
  ['Nome: nome della vacanza/chiusura'],
  ['Data Inizio / Data Fine: formato AAAA-MM-GG (es. 2025-12-23)'],
  ['Tipo: vacanza | congedo | malattia'],
]
const wsIstruzioni = XLSX.utils.aoa_to_sheet(istruzioniData)
wsIstruzioni['!cols'] = [{ wch: 80 }]
XLSX.utils.book_append_sheet(wb, wsIstruzioni, 'Istruzioni')

// ── Salva ──
const outPath = path.join(__dirname, '..', 'public', 'template-importazione.xlsx')
XLSX.writeFile(wb, outPath)
console.log(`Template generato: ${outPath}`)
