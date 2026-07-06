# Analisi dello Stato dell'Applicazione — Luglio 2026

Analisi completa del codice in vista della ripresa dei lavori per l'anno scolastico 2026-2027.
Ultimo commit precedente: `38965e3` del 23 marzo 2026. Progetto nato il 20 febbraio 2026 (53 commit in ~1 mese di sviluppo intenso).

---

## Quadro generale

**L'app è in salute e molto più avanti di quanto dica la sua documentazione.**

- ✅ La build funziona (4,5s), con lazy loading di tutte le pagine e code-splitting già configurato (`vite.config.js`). Nessun chunk critico sopra 500KB: xlsx (429KB) è caricato on-demand solo per l'import Excel.
- ✅ Le dipendenze sono quasi aggiornate (solo minor update disponibili; major non urgenti: Vite 8, ESLint 10).
- ⚠️ Il lint segnala 44 errori e 26 warning — tutti cosmetici (variabili `err` inutilizzate, dipendenze mancanti negli hook), nessuno bloccante.
- ⚠️ La documentazione è fortemente disallineata dal codice (vedi sotto).

### Documentazione vs realtà

| Documento | Stato |
|---|---|
| `SINTESI_PROGETTO.md` | **Molto obsoleto**: 7 degli 8 "Problemi rilevati" sono già RISOLTI (conferme cancellazione, stati a costanti in `costanti.js`, toast errori, bundle, filtro `annoScolastico` server-side, materiali). Dichiara l'Archivio "da implementare" ma `ArchivioPage.jsx` (398 righe) è completo e funzionante. La struttura file descritta non esiste più (Dashboard/Calendario rimossi, ~15 file nuovi assenti). |
| `ROADMAP.md` | Accurato sulle fasi ✅, ma fermo a ~10 commit fa: mancano AssenzePage, drag&drop timeline e settimana, Rigenera, primo giorno di scuola, reskin ADHD-friendly. |
| `ANALISI-UX.md` | Quasi interamente superato: le idee B, C, D, E, F, G sono tutte implementate. Resta aperta solo l'idea A (wizard onboarding). |
| `README.md` | Ancora boilerplate Vite, non documenta l'app. |

### Cosa c'è davvero (8 pagine funzionanti)

Oggi (entry point con auto-generazione, stati P/S/½/X con undo, note rapide, widget fine anno), Settimana (griglia/lista, generazione singola/multi/fino a fine scuola, drag&drop scambio lezioni, tastiera, Rigenera), Percorsi (CRUD, duplicazione tra classi, catchup mode), Programmazione (timeline slot per ora, ricorrenze, distribuzione automatica, consuntivo, panoramica multi-classe), Assenze (calendario a pennello), Export (txt programmazione iniziale/svolta + stampa orario), **Archivio (consultazione anni passati + clonazione percorsi)**, Impostazioni (incluso import Excel a 5 fogli).

---

## Il punto chiave: transizione all'anno 2026-2027

### Cosa funziona già

- Tutte le collezioni piatte (percorsi, lezioni, orari, vacanze, assegnazioni) sono filtrate per `annoScolastico` **server-side** con `where` — cambiando anno l'app "si svuota" correttamente.
- `ArchivioPage` è funzionante: il 2025-2026 resterà consultabile con statistiche, e il bottone "Clona percorsi" copia percorsi+unità (stati resettati a `da_fare`) nell'anno nuovo.
- Il selettore anno in sidebar permette di passare da un anno all'altro.

### Il problema n.1 (CRITICO, confermato)

**`config/ricorrenze` e `config/distribuzioni` sono documenti globali con chiave solo per classe, senza anno** (`src/lib/firestore.js:192-224`). Conseguenze concrete al passaggio al 2026-2027:

1. La classe "1A" del nuovo anno eredita le ricorrenze della "1A" 2025-2026, che puntano a `percorsoId` dell'anno vecchio → le lezioni auto-generate da OggiPage/SettimanaPage nascono collegate a percorsi fantasma.
2. `resetAnnoScolastico` (`firestore.js:359-384`) svuota ricorrenze/distribuzioni di **tutti** gli anni indiscriminatamente: usarlo per "chiudere" il 2025-2026 distruggerebbe anche la pianificazione del nuovo anno.
3. `onLezioniByPercorso` (`firestore.js:226-231`) non filtra per anno: i conteggi ore di un percorso vecchio assorbirebbero lezioni nuove.

### Altri buchi nella transizione

- **Config anno nuovo vuota**: creando "2026-2027" non vengono copiati ore scolastiche, giorno libero, date — tutto da reinserire a mano.
- **Clonazione percorsi limitata**: non rimappa le classi (la 1A 2025-26 diventa "1A" 2026-27, ma quegli studenti sono in 2A), non copia il campo `note`, non è batched (clone parziale se fallisce a metà), e il bottone è ricliccabile → duplicati (`ArchivioPage.jsx:250-262`).
- **Ricorrenze non rigenerabili**: i percorsi clonati hanno ID nuovi, quindi le ricorrenze vanno comunque rifatte a mano in Programmazione.
- **`dataInizioScuola` scritta ma mai letta**: la timeline di Programmazione parte da "oggi" (`ProgrammazionePage.jsx:196-200`) — pianificando in estate conterebbe le settimane estive come disponibili.
- **Anni archiviati modificabili**: nessun blocco readonly; il flag `archiviata` sulle assegnazioni non è mai letto. Nessun modo di eliminare un anno creato per errore.
- **Fase 4 (wizard onboarding) congelata "fino a fine anno 25-26"** — è esattamente ora il momento di riprenderla. Stima onerosità: moderata (2-4 sessioni), perché il 100% delle scritture Firestore esiste già; il lavoro è quasi solo UI (estrarre i form da ImpostazioniPage, shell StepWizard, riuso calendario Assenze).

---

## Bug confermati (verifica adversariale, 2 verificatori indipendenti per finding)

### Critici

1. **"Annulla" dopo eliminazione lezione fallisce sempre** — `SettimanaPage.jsx:510` fa `addLezione({ ...lez, id: undefined })`; Firestore rifiuta `undefined` (manca `ignoreUndefinedProperties`), la promise non è gestita → la lezione è persa per sempre, in silenzio.
2. **Generazione multi-settimana duplica le lezioni** — `SettimanaPage.jsx:324-334`: la dedup usa lo stato `lezioni` che contiene solo la settimana visualizzata; rilanciare "Prossime 2/4 settimane" o "Fino a fine scuola" duplica tutte le settimane successive.
3. **Contaminazione ricorrenze/distribuzioni tra anni** (vedi sopra).

### Importanti

4. **OggiPage genera ignorando le distribuzioni** (`OggiPage.jsx:229-248`): usa solo le ricorrenze e non imposta mai `unitaId` — generare dal giorno perde le unità pianificate in timeline (SettimanaPage invece le usa).
5. **"Rigenera" senza conferma** (`SettimanaPage.jsx:154-231`): distrugge stati P/S/½/X e note della settimana senza ConfirmDialog né undo.
6. **Ore contate oltre l'ultimo giorno di scuola**: la timeline include i giorni dopo `dataFineScuola` nell'ultima settimana (`ProgrammazionePage.jsx:200-243`), mentre `computeOreRimaste` in Panoramica fa il check opposto e perde l'ultima settimana se fine scuola cade di lunedì → i due calcoli divergono.
7. **Distribuzioni per sola classe, non classe+materia** (`ProgrammazionePage.jsx:454`): con due materie nella stessa classe, "Distribuisci tutto" di una materia cancella le assegnazioni dell'altra.
8. **Panoramica multi-classe con dati a zero** per classi mai aperte in dettaglio (`unitaByPercorso` popolato solo per la classe selezionata → margine gonfiato).
9. **"Ore rimanenti" calcolate dal lunedì della settimana corrente** (conteggia ore già trascorse), con 4 implementazioni duplicate e divergenti tra OggiPage/SettimanaPage/ProgrammazionePage.
10. **Race condition nell'auto-generazione** (`OggiPage.jsx:156`): può scattare prima che vacanze/ricorrenze/distribuzioni siano caricate (aggravata dalla cache offline: il primo snapshot può essere vuoto-da-cache); inoltre genera lezioni retroattive navigando giorni passati vuoti.

### Minori degni di nota

- Drag&drop non parte su Firefox (manca `dataTransfer.setData`, `LessonGrid.jsx:426`).
- Lezioni extra con orari liberi invisibili in griglia (solo in lista, senza avviso); lezioni di domenica invisibili ovunque.
- `AssenzePage.jsx:289`: etichetta mese `undefined` se fine scuola cade a luglio/agosto; cliccare un giorno di un periodo multi-giorno elimina l'intero periodo.
- ExportPage: reset della classe selezionata a ogni snapshot (stale closure, riga 44); CSS di stampa in gran parte morto (classi che non esistono nell'HTML copiato).
- Widget "Fine anno" di OggiPage resta visibile con "0 settimane rimaste" ad anno concluso.

---

## Sicurezza

1. **CRITICO — Nessun `firestore.rules` nel repo** (né `firebase.json`, né `firestore.indexes.json`): le regole — unico vero confine di sicurezza di un'app Firebase client-only — vivono solo nella console, non versionate né verificabili. Le collezioni sono globali senza campo `uid`.
2. **CRITICO — Autorizzazione solo client-side**: `VITE_AUTHORIZED_EMAIL` è compilata nel bundle pubblico e il check in `AuthContext.jsx:19` è bypassabile chiamando l'SDK Firestore direttamente con qualunque account Google — a meno che le regole in console non replichino il vincolo (`request.auth.token.email == "..."`). Da verificare e versionare subito.
3. **xlsx 0.18.5** ha CVE note (prototype pollution, ReDoS) e processa file caricati dall'utente. Rischio contenuto (app mono-utente), ma la libreria su npm è ferma: valutare il canale ufficiale SheetJS o `exceljs`.
4. **Nessun security header** in `netlify.toml` (CSP, X-Frame-Options, HSTS).
5. Operazioni distruttive di massa (reset anno) eseguibili interamente lato client senza vincoli server.

---

## Qualità e performance

- **GlobalSearch sempre montato** (`AppLayout.jsx:29`): su ogni pagina scarica l'intero anno (tutti i percorsi + tutte le lezioni + un listener `onUnita` per ogni percorso) anche senza aver mai digitato nulla.
- **Nessun layer dati condiviso**: ogni pagina riapre gli stessi 5-7 listener a ogni navigazione; pattern N+1 su `onUnita` replicato in 7 file.
- **Componenti monolitici**: ProgrammazionePage 1185 righe, SettimanaPage 914, OggiPage 745, con logica pura (calendario, distribuzione, ore) intrappolata nei componenti e duplicata 4 volte con esiti divergenti.
- **Zero test automatici e zero tipizzazione**: rischioso rifattorizzare la logica date/ore senza prima una rete di sicurezza.
- Nessun `onSnapshot` registra un error callback: un permission-denied o un indice mancante uccide il listener in silenzio.
- ToastContext: `useCallback` usato male (`ToastContext.jsx:30`), valore del context instabile → re-render di tutti i consumer.

---

## Piano consigliato per l'estate

### Fase A — Fondamenta (subito, prima di ogni altra cosa)
1. **Versionare le regole Firestore**: creare `firestore.rules` + `firebase.json` + `firestore.indexes.json` con vincolo su email/uid, e verificare cosa c'è oggi in console.
2. **Fix dei 2 bug critici puntuali**: undo eliminazione lezione (strip del campo `id`), dedup multi-settimana (query sul DB per range invece dello stato locale).
3. **Estrarre la logica calendario/ore in `lib/`** (settimane residue, ore rimanenti, slot fino a fine scuola) con test unitari — è il prerequisito per tutto il resto e unifica le 4 implementazioni divergenti.

### Fase B — Transizione anno (il cuore della ripresa)
4. **Scoping per anno di ricorrenze e distribuzioni** (es. doc `config/ricorrenze_{anno}` o chiave annidata per anno) + migrazione dei dati esistenti + fix `onLezioniByPercorso`.
5. **Flusso "Nuovo anno scolastico"** (= scongelare la Fase 4, ampliata): wizard che crea l'anno, copia opzionalmente ore/giorno libero dal precedente, chiede date inizio/fine, clona i percorsi **con rimappatura classi** (1A→2A) e selezione, guida orario e vacanze (riusando import Excel e calendario Assenze).
6. **Usare davvero `dataInizioScuola`** nella timeline di Programmazione (oggi parte da "oggi").
7. **Anni archiviati readonly** + possibilità di eliminare un anno errato.

### Fase C — Robustezza quotidiana
8. Conferma su "Rigenera"; allineare la generazione di OggiPage alle distribuzioni; distribuzioni per classe+materia.
9. GlobalSearch lazy (sottoscrizioni solo alla prima digitazione) o layer dati condiviso.
10. Pulizia lint (44 errori), error callback sugli onSnapshot, fix minori (Firefox drag&drop, AssenzePage luglio, ExportPage stale closure).

### Fase D — Documentazione
11. Riscrivere `README.md` (cos'è l'app, setup, deploy) e aggiornare/sfoltire SINTESI_PROGETTO.md, ROADMAP.md, ANALISI-UX.md — oggi descrivono un'app che non esiste più.

---

*Analisi generata il 6 luglio 2026 con verifica adversariale dei finding (ogni problema critico/importante confermato da 2 verificatori indipendenti sul codice reale).*
