# Le Mie Lezioni — Sintesi del Progetto

## Cos'e

Web app per insegnanti italiani che gestisce l'intero flusso di lavoro didattico: dalla programmazione annuale dei percorsi alla gestione quotidiana delle lezioni, passando per la pianificazione settimanale e il monitoraggio delle ore.

## Stack tecnologico

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4
- **Backend**: Firebase (Authentication con Google + Firestore)
- **Dati real-time**: tutte le query usano `onSnapshot` per aggiornamenti istantanei

---

## Struttura dell'app

### Pagine

| Pagina | Descrizione |
|---|---|
| **Dashboard** | Griglia orario settimanale classica (giorni x ore). Celle interattive con stato P/S/X, percorso/unita collegati, ore rimanenti per classe |
| **Calendario** | Vista dettagliata settimana per settimana. Generazione lezioni da orario, editing singola lezione, collegamento a percorso/unita |
| **Percorsi** | Gestione percorsi didattici raggruppati per classe. Ogni percorso contiene unita ordinate con ore previste e stato |
| **Programmazione** | Pianificazione a lungo termine: pannello percorsi + timeline settimanale con distribuzione automatica e manuale delle unita |
| **Archivio** | (Da implementare) Archiviazione anni scolastici precedenti |
| **Impostazioni** | Anno scolastico, classi/materie, ore scolastiche (I-VIII), giorno libero, data fine scuola, vacanze/assenze, orario settimanale |

### Modello dati (Firestore)

```
config/anno_scolastico     → annoAttivo, anniScolastici.{anno}.{oreLezione, giornoLibero, dataFineScuola}
config/distribuzioni       → {classe: {settimanaStr: {percorsoId, unitaId, ...}}}
percorsi/{id}              → titolo, classe, materia, annoScolastico, descrizione
percorsi/{id}/unita/{id}   → titolo, ordine, orePreviste, stato, descrizione
percorsi/{id}/materiali/   → (subcollection presente ma non usata attivamente)
assegnazioni/{id}          → annoScolastico, classe, materia, attiva, archiviata
orari/{id}                 → annoScolastico, giorno, numeroOra, oraInizio, oraFine, classe, materia, ore
lezioni/{id}               → annoScolastico, data, giorno, numeroOra, oraInizio, oraFine, classe, materia, stato, note, titoloOverride, percorsoId, unitaId
vacanze/{id}               → annoScolastico, nome, dataInizio, dataFine, tipo (vacanza|chiusura|assenza)
```

### Separazione dati annuali vs. contenuti

- **Associati all'anno scolastico**: orario, vacanze, assegnazioni, config ore, lezioni
- **Contenuti didattici (per archivio)**: percorsi, unita, materiali

---

## Flusso di lavoro dell'insegnante

### 1. Setup iniziale (Impostazioni)
1. Imposta anno scolastico (es. "2025-2026")
2. Aggiungi classi e materie (es. 1A - Informatica)
3. Configura ore scolastiche (I-VIII con orari inizio/fine)
4. Indica giorno libero e ultimo giorno di scuola
5. Inserisci vacanze, chiusure e assenze previste
6. Compila l'orario settimanale (giorno + ora + classe)

### 2. Programmazione annuale (Percorsi + Programmazione)
1. Crea percorsi didattici per ogni classe
2. Struttura ogni percorso in unita con ore previste
3. Nella pagina Programmazione, verifica il bilancio ore (disponibili vs. pianificate)
4. Usa la distribuzione automatica o manuale per collocare le unita nella timeline settimanale

### 3. Gestione quotidiana (Calendario + Dashboard)
1. Genera lezioni settimanali dall'orario (un click)
2. Collega ogni lezione al percorso/unita corrispondente
3. Segna lo stato: Pianificata (P), Svolta (S), Saltata (X)
4. La Dashboard mostra la settimana in formato griglia orario con stato visivo immediato

---

## Problemi rilevati

### Critici
1. **Nessun dialogo di conferma per cancellazioni** — Un click accidentale su "Rimuovi" o "X" elimina dati senza possibilita di annullare
2. **Nessuna validazione form robusta** — Campi vuoti o dati inconsistenti non vengono intercettati a sufficienza
3. **Subcollection `materiali` inutilizzata** — Presente nel codice ma mai usata nell'interfaccia, genera confusione

### Importanti
4. **Stringhe di stato hardcoded** — "pianificata", "svolta", "saltata" sono stringhe sparse nel codice; un refactoring a costanti eviterebbe errori silenziosi
5. **Nessun feedback visivo per errori di rete** — Le operazioni Firestore falliscono silenziosamente senza notificare l'utente
6. **Chunk bundle >500KB** — Firebase gonfia il bundle; risolvibile con lazy loading delle pagine e tree-shaking

### Migliorabili
7. **Percorso filtrato per `annoScolastico` lato client** — La query `onPercorsi` carica tutti i percorsi e filtra in JS; meglio filtrare con `where` su Firestore
8. **Nessun indice composito Firestore** — Alcune query (lezioni per settimana + anno) necessitano indici per funzionare in produzione

---

## Roadmap

### Fase 1 — Setup progetto ✅
- [x] React + Vite + Tailwind + Firebase
- [x] Autenticazione Google
- [x] Struttura pagine e navigazione

### Fase 2 — Funzionalita base ✅
- [x] Impostazioni: anno scolastico, classi/materie
- [x] Calendario: generazione lezioni da orario
- [x] Gestione stato lezioni (P/S/X)

### Fase 3 — Percorsi didattici ✅
- [x] CRUD percorsi con unita ordinate
- [x] Collegamento bidirezionale lezioni ↔ percorso/unita
- [x] Vista ricca inline nel pannello unita

### Fase 3b — Griglia orario e interattivita ✅
- [x] Configurazione ore scolastiche (I-VIII)
- [x] Dashboard a griglia classica (giorni x ore)
- [x] Pulsanti stato P/S/X direttamente nelle celle
- [x] Percorso/unita visibili nelle celle della griglia
- [x] Giorno libero configurabile
- [x] Calcolo ore rimanenti preciso (esclude vacanze giorno per giorno)

### Fase 3c — Vacanze e Programmazione ✅
- [x] CRUD vacanze/chiusure/assenze
- [x] Pagina Programmazione con selezione classe
- [x] Banner bilancio ore (disponibili / pianificate / margine)
- [x] Timeline settimanale con distribuzione automatica
- [x] Assegnazione manuale unita per settimana
- [x] Pannello percorsi con CRUD inline

### Fase 4 — Correzione problemi (da fare)
- [ ] Aggiungere dialoghi di conferma per tutte le cancellazioni
- [ ] Validazione form: campi obbligatori, formati date, coerenza dati
- [ ] Refactoring stati a costanti (`STATO_LEZIONE = { PIANIFICATA: 'pianificata', ... }`)
- [ ] Gestione errori di rete con notifiche utente (toast/banner)
- [ ] Rimuovere subcollection `materiali` inutilizzata o integrarla
- [ ] Ottimizzare query `onPercorsi` con filtro `where('annoScolastico', '==', ...)` su Firestore
- [ ] Code splitting / lazy loading pagine per ridurre bundle
- [ ] Creare indici compositi Firestore necessari

### Fase 5 — Archivio
- [ ] Archiviare anno scolastico con tutti i dati associati
- [ ] Clonare percorsi per nuovo anno (senza lezioni)
- [ ] Vista archivio anni precedenti in sola lettura

### Fase 6 — Miglioramenti funzionali
- [ ] **Lezioni extra**: aggiungere lezioni non previste dall'orario (supplenze, recuperi, attivita extra)
- [ ] **Note per unita e percorsi**: campo note/appunti sia nelle unita che nei percorsi per annotazioni didattiche
- [ ] **Statistiche fine percorso**: riepilogo ore svolte vs. previste, unita completate, percentuale avanzamento per ogni percorso
- [ ] **Vista Oggi**: dashboard focalizzata sulla giornata corrente con le lezioni del giorno, prossime attivita e stato
- [ ] **Ricerca globale**: barra di ricerca che cerca in percorsi, unita, lezioni, note — per ritrovare rapidamente qualsiasi contenuto
- [ ] **Duplicazione percorsi tra classi**: assegnare lo stesso percorso a piu classi o duplicarlo con possibilita di personalizzare tempistiche diverse
- [ ] **Separazione pagine Percorsi/Timeline**: valutare una pagina dedicata alla strutturazione dettagliata dei percorsi (contenuti, unita, descrizioni) separata dalla pagina di programmazione temporale (timeline distribuzione)

### Fase 7 — Export e documenti
- [ ] **Export testo formattato (programmazione iniziale)**: generare testo strutturato dei percorsi pianificati da copiare/incollare nei documenti scolastici per la programmazione annuale
- [ ] **Export testo formattato (programmazione svolta)**: generare testo con il consuntivo di quanto effettivamente svolto per i documenti di fine anno
- [ ] **Export PDF orario settimanale**: generare un PDF dell'orario griglia da stampare o condividere

### Fase 8 — UX e rifinitura
- [ ] Migliorare responsive per mobile
- [ ] Animazioni e transizioni
- [ ] Ordinamento drag-and-drop unita
- [ ] Tema scuro (opzionale)
- [ ] PWA per uso offline base

---

## Struttura file progetto

```
src/
├── App.jsx                          # Router e layout protetti
├── contexts/
│   ├── AuthContext.jsx              # Autenticazione Firebase
│   └── AppContext.jsx               # Config anno scolastico globale
├── lib/
│   ├── firebase.js                  # Init Firebase app
│   ├── firestore.js                 # Tutte le operazioni Firestore (CRUD + realtime)
│   └── settimane.js                 # Helper calcolo settimane
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx            # Layout con sidebar + outlet
│   │   └── Sidebar.jsx              # Navigazione laterale
│   ├── common/
│   │   └── LoadingSpinner.jsx       # Spinner di caricamento
│   ├── calendario/
│   │   └── PercorsoSelector.jsx     # Dropdown percorso/unita per lezioni
│   └── percorsi/
│       └── UnitaPanel.jsx           # Pannello gestione unita di un percorso
└── pages/
    ├── LoginPage.jsx                # Login con Google
    ├── DashboardPage.jsx            # Griglia orario interattiva + ore rimanenti
    ├── CalendarioPage.jsx           # Calendario lezioni settimanale
    ├── PercorsiPage.jsx             # Gestione percorsi didattici
    ├── ProgrammazionePage.jsx       # Pianificazione annuale con timeline
    ├── ArchivioPage.jsx             # (Da implementare)
    └── ImpostazioniPage.jsx         # Tutte le configurazioni
```

---

## Note tecniche

- **Firestore `merge: true`**: usato per aggiornare config senza sovrascrivere campi esistenti
- **`onSnapshot` ovunque**: tutti i dati sono in tempo reale, nessun polling
- **Backward compatibility `numeroOra`**: le lezioni vecchie senza campo `numeroOra` vengono mappate nella griglia tramite fallback su `oraInizio`
- **Calcolo ore rimanenti**: cammina giorno per giorno da oggi a fine scuola, controlla ogni giorno contro le vacanze, conta le ore effettive per classe/materia
- **Distribuzioni**: documento singolo `config/distribuzioni` con mappa per classe; ogni entry settimanale referenzia percorsoId e unitaId
