# Roadmap Implementazione — Miglioramenti UX "Le Mie Lezioni"

Questa roadmap traduce i 9 problemi e le 7 proposte dell'analisi UX in task implementativi concreti, organizzati in 5 fasi sequenziali. Ogni fase e' autocontenuta e rilasciabile indipendentemente.

---

## Fase 1 — Quick Wins e micro-fix (fondamenta)

Interventi piccoli e isolati che migliorano subito la qualita' percepita senza ristrutturazioni. Preparano anche il terreno per le fasi successive.

### 1.1 Feedback visivo sui bottoni di stato P/S/X

**Problema:** Click su P/S/X e' immediato senza alcun feedback di caricamento. L'utente non sa se il click e' stato registrato.

**File da modificare:**
- `src/pages/DashboardPage.jsx` — funzione `handleStatoChange` e bottoni in `renderCell` (righe 273-286) e nella Vista Oggi (righe 453-469)
- `src/pages/CalendarioPage.jsx` — funzione `handleStatoChange` e bottoni (righe 580-593)

**Implementazione:**
- Aggiungere uno stato `updatingLezione` (Map o Set di lezioneId) per tracciare quali lezioni sono in aggiornamento
- Disabilitare i bottoni P/S/X della lezione in aggiornamento e mostrare un micro-spinner o un'opacita' ridotta
- Ripristinare dopo la Promise resolve/reject

### 1.2 Undo per cambi di stato lezione

**Problema:** Un click accidentale su X (saltata) e' irreversibile. Nessun modo di tornare indietro se non ri-cliccare manualmente.

**File da modificare:**
- `src/contexts/ToastContext.jsx` — Estendere il toast per supportare un'azione "Annulla"
- `src/pages/DashboardPage.jsx` — `handleStatoChange`
- `src/pages/CalendarioPage.jsx` — `handleStatoChange`

**Implementazione:**
- Salvare lo stato precedente prima dell'update: `const prevStato = lezione.stato`
- Dopo l'update mostrare un toast con bottone "Annulla" che richiama `updateLezione(id, { stato: prevStato })`
- Il toast con azione deve avere un timeout piu' lungo (~5 secondi) rispetto ai toast normali
- Aggiungere al ToastContext un tipo `action` con callback: `toast.action('Stato aggiornato', { label: 'Annulla', onClick: () => ... })`

### 1.3 Celle della griglia Dashboard cliccabili

**Problema:** Nella griglia settimanale della Dashboard, le celle non sono interattive. L'utente non puo' aprire il dettaglio di una lezione.

**File da modificare:**
- `src/pages/DashboardPage.jsx` — cella `<td>` nella griglia (righe 536-549)

**Implementazione:**
- Aggiungere `onClick` sulla cella che naviga al Calendario nella settimana corrente: `navigate('/calendario')` (o nella Fase 2, apre un pannello inline)
- Usare `cursor-pointer` e `hover:ring-2 hover:ring-blue-300` come feedback visivo
- Come soluzione intermedia prima della Fase 2: navigare a `/calendario` con un hash o query param per evidenziare la lezione specifica

### 1.4 Link contestuali tra sezioni Dashboard

**Problema:** "Ore rimanenti" e "Percorsi attivi" nella Dashboard sono pannelli informativi senza link di navigazione.

**File da modificare:**
- `src/pages/DashboardPage.jsx` — sezioni "Ore rimanenti" (righe 663-690) e "Percorsi attivi" (righe 701-733)

**Implementazione:**
- Wrap ogni card "Ore rimanenti" con un `<Link to="/programmazione">` (o un `onClick` che naviga e pre-seleziona la classe)
- Aggiungere `cursor-pointer hover:border-blue-300` come feedback
- Wrap ogni card "Percorsi attivi" con `<Link to="/percorsi">`
- Per la pre-selezione classe: usare query params (`/programmazione?classe=3A&materia=Informatica`) e leggere i params in `ProgrammazionePage`

### 1.5 Legenda stati unificata come componente condiviso

**Problema:** La legenda P/S/X e' duplicata tra Dashboard (righe 559-577) e Calendario (righe 704-716) con stili diversi.

**File da creare:**
- `src/components/common/StatoLegenda.jsx`

**File da modificare:**
- `src/pages/DashboardPage.jsx` — sostituire legenda inline
- `src/pages/CalendarioPage.jsx` — sostituire legenda inline

**Implementazione:**
- Estrarre la legenda in un componente riutilizzabile che accetta opzionalmente `extra` props (es. "giorno libero" mostrato solo nella Dashboard)
- Usare le costanti da `costanti.js` per label e colori

### 1.6 Bottone "Segna tutte svolte" piu' visibile

**Problema:** Il bottone nel Calendario e' un pill piccolo accanto al titolo del giorno, facile da non notare.

**File da modificare:**
- `src/pages/CalendarioPage.jsx` — bottone "Segna tutte svolte" (righe 521-528)

**Implementazione:**
- Spostare il bottone sotto l'ultimo lesson-card del giorno, full-width, con sfondo verde chiaro e icona checkmark
- Mostrarlo solo per i giorni passati o per oggi (non per giorni futuri)
- Aggiungere `isToday(date) || isBefore(date, new Date())` come condizione

---

## Fase 2 — Vista Oggi come entry point principale

La modifica piu' impattante sull'uso quotidiano. Trasforma il punto di ingresso dell'app da "griglia settimanale" a "cosa devo fare oggi".

### 2.1 Nuova pagina OggiPage come route principale

**File da creare:**
- `src/pages/OggiPage.jsx`

**File da modificare:**
- `src/App.jsx` — Cambiare la route `/` per puntare a `OggiPage`, spostare la vecchia Dashboard su `/settimana`
- `src/components/layout/Sidebar.jsx` — Aggiornare navigazione: "Oggi" come primo item, "Settimana" al posto di "Dashboard"

**Implementazione della OggiPage:**
- **Barra di navigazione giorni** in alto: `< Ieri | [Oggi evidenziato] | Domani >` con possibilita' di scegliere qualsiasi giorno
- Lo stato `dayOffset` (default 0 = oggi) controlla il giorno visualizzato
- **Dati necessari:** stesso pattern di loading della Dashboard ma filtrato su un solo giorno
  - `onLezioniSettimana` con range di un solo giorno (start=giorno, end=giorno)
  - `onOrari`, `onPercorsi`, `onUnita`, `onVacanze`, `onAssegnazioni`

**UI della lista lezioni (per ogni lezione):**
```
┌────────────────────────────────────────────────────────┐
│  08:00-09:00   │  3A — Informatica            [P][S][X]│
│                │  Percorso: Intro Python / Unita 3     │
│                │  Note: (inline editabile)              │
│  [modifica percorso/unita]  [nota rapida]              │
└────────────────────────────────────────────────────────┘
```

- Ogni lezione mostra: orario, classe, materia, stato, percorso/unita collegati, note
- **Indicatore "lezione in corso"**: bordo sinistro animato (pulse) se l'ora attuale cade tra oraInizio e oraFine
- **Editing inline:** Click su note apre un textarea inline (save on blur, come le note dei percorsi)
- **Cambio percorso/unita inline:** Click su "modifica percorso" apre il `PercorsoSelector` direttamente sotto la lezione
- **Cambio stato con swipe** (opzionale, mobile-friendly): swipe destro = svolta, swipe sinistro = saltata

### 2.2 Generazione automatica lezioni del giorno

**File da modificare:**
- `src/pages/OggiPage.jsx` (nella nuova pagina)

**Implementazione:**
- Se il giorno visualizzato non ha lezioni ma ha slot nell'orario, mostrare un banner: "Hai N ore oggi non ancora generate. [Genera lezioni]"
- Il bottone genera solo le lezioni per quel giorno specifico (non l'intera settimana)
- Riutilizzare la logica di generazione da `CalendarioPage.handleGenerate` ma con scope ridotto a un giorno

### 2.3 Sommario giornaliero in testa alla pagina

**Implementazione dentro OggiPage:**
- Banner in alto con: `N lezioni | M svolte | K da fare | J saltate`
- Progress bar orizzontale che si riempie man mano che le lezioni vengono segnate come svolte
- Se ci sono vacanze, mostrare un banner colorato (ambra) con il nome della vacanza

### 2.4 Quick-action "nota rapida"

**File da creare:**
- `src/components/common/QuickNote.jsx` — Input inline che appare/scompare con animazione

**Utilizzo in OggiPage:**
- Ogni lezione ha un'icona "nota" che al click espande un campo di testo
- Save automatico su blur o dopo 2 secondi di inattivita' (debounce)
- Chiama `updateLezione(id, { note })` direttamente

---

## Fase 3 — Unificazione Dashboard + Calendario

Risolve il problema della sovrapposizione funzionale fondendo le due viste in una sola pagina con toggle.

### 3.1 Nuova pagina SettimanPage (unione Dashboard + Calendario)

**File da creare:**
- `src/pages/SettimanaPage.jsx`

**File da rimuovere (dopo migrazione):**
- `src/pages/DashboardPage.jsx`
- `src/pages/CalendarioPage.jsx`

**File da modificare:**
- `src/App.jsx` — Route `/settimana` punta a `SettimanaPage`, rimuovere `/calendario`
- `src/components/layout/Sidebar.jsx` — Rimuovere "Calendario", rinominare "Dashboard" in "Settimana"

**Implementazione:**
- Toggle in alto: `[Griglia] [Lista]` — controlla `viewMode` state ('grid' | 'list')
- **Vista Griglia** (dall'attuale Dashboard): griglia giorni x ore, celle compatte con stato e percorso
- **Vista Lista** (dall'attuale Calendario): lista espansa per giorno con editing inline completo

**Unificazione dati:** Entrambe le viste condividono lo stesso state:
```javascript
const [lezioni, setLezioni] = useState([])
const [orari, setOrari] = useState([])
const [percorsi, setPercorsi] = useState([])
const [unitaMap, setUnitaMap] = useState({})
const [vacanze, setVacanze] = useState([])
const [assegnazioni, setAssegnazioni] = useState([])
const [weekOffset, setWeekOffset] = useState(0)
const [viewMode, setViewMode] = useState('grid') // toggle
```

### 3.2 Celle griglia con editing inline

**Implementazione dentro SettimanaPage (vista griglia):**
- Click su una cella apre un pannello sotto la griglia (o un popover) con:
  - Campo note editabile
  - Campo titolo/argomento
  - PercorsoSelector per collegare percorso/unita
  - Bottone "Elimina lezione"
  - Bottoni P/S/X per stato
- ESC o click fuori chiude il pannello
- Save automatico su blur/chiudi

### 3.3 Spostamento funzionalita' specifiche

**Da Calendario a SettimanaPage:**
- Bottone "Genera lezioni da orario"
- Form "Lezione extra"
- Bottone "Segna tutte svolte" per giorno

**Da Dashboard a SettimanaPage:**
- Pannello "Ore rimanenti" — sotto la griglia/lista, collassabile
- Sezione "Percorsi attivi" — sotto le ore rimanenti

### 3.4 Estrarre componenti riutilizzabili dalla fusione

**File da creare:**
- `src/components/settimana/WeekNavigation.jsx` — Navigazione settimana (frecce + "Oggi" + label) condivisa tra OggiPage e SettimanaPage
- `src/components/settimana/LessonCard.jsx` — Card lezione riutilizzabile con stato, classe, materia, percorso, note
- `src/components/settimana/LessonGrid.jsx` — Griglia giorni x ore
- `src/components/settimana/LessonList.jsx` — Lista lezioni per giorno
- `src/components/settimana/LessonEditPanel.jsx` — Pannello editing inline (note, titolo, percorso, stato)
- `src/components/settimana/GenerateButton.jsx` — Bottone genera lezioni + logica
- `src/components/settimana/ExtraLessonForm.jsx` — Form lezione extra

Questo refactoring riduce la duplicazione e rende il codice manutenibile.

---

## Fase 4 — Wizard di Onboarding + Impostazioni ristrutturate

Risolve il problema del setup iniziale opaco con un percorso guidato per i nuovi utenti.

### 4.1 Componente wizard riutilizzabile

**File da creare:**
- `src/components/common/StepWizard.jsx`

**Props del wizard:**
```javascript
steps: [
  { id, title, description, component, isComplete: () => boolean },
  ...
]
onComplete: () => void
```

**UI:**
- Barra di progresso in alto con pallini numerati (step corrente evidenziato)
- Bottoni "Indietro" / "Avanti" / "Completa" in basso
- Validazione: "Avanti" disabilitato se lo step non e' completo
- Layout centrato, max-width md, sfondo chiaro

### 4.2 Pagina OnboardingPage con 6 step

**File da creare:**
- `src/pages/OnboardingPage.jsx`

**File da modificare:**
- `src/App.jsx` — Aggiungere route `/onboarding`
- `src/App.jsx` — Aggiungere redirect: se utente autenticato ma `annoAttivo` e' null, redirect a `/onboarding`

**I 6 step (ognuno e' un sotto-componente):**

**File da creare per ogni step:**
- `src/components/onboarding/StepAnno.jsx`
- `src/components/onboarding/StepClassi.jsx`
- `src/components/onboarding/StepOreScolastiche.jsx`
- `src/components/onboarding/StepOrario.jsx`
- `src/components/onboarding/StepVacanze.jsx`
- `src/components/onboarding/StepFineScuola.jsx`

**Dettaglio di ogni step:**

1. **StepAnno** — Input anno scolastico (es. "2025-2026"). Validazione regex. Spiegazione: "Inserisci l'anno scolastico in formato YYYY-YYYY". Completo quando `annoAttivo` e' settato.
2. **StepClassi** — Lista classi + materie. "Aggiungi le classi a cui insegni e la materia per ciascuna." Form: classe + materia + bottone "Aggiungi". Lista delle assegnazioni gia' aggiunte con bottone rimuovi. Completo quando `assegnazioni.length > 0`.
3. **StepOreScolastiche** — Configurazione ore giornaliere. "Quante ore ha la tua scuola? A che ora inizia la prima?" Slider o input per numero ore (default 6), orario inizio (default 08:00). Preview delle ore generate. Selezione giorno libero. Completo quando `oreLezione.length > 0`.
4. **StepOrario** — Griglia settimanale. "Assegna le tue ore nella settimana." Griglia giorno x ora: ogni cella e' un dropdown con classe/materia dalle assegnazioni dello step 2. Completo quando almeno 1 orario definito.
5. **StepVacanze** — Vacanze e chiusure. "Aggiungi le vacanze e i giorni di chiusura previsti." Form con nome, data inizio, data fine, tipo. Lista vacanze aggiunte. Step opzionale (puo' essere saltato).
6. **StepFineScuola** — Data fine scuola. "Quando finisce la scuola?" Input date. Preview: "Mancano N settimane, circa M ore di lezione." Completo quando `dataFineScuola` e' settata.

**Ogni step riutilizza le funzioni firestore esistenti** (`addAssegnazione`, `setAnnoScolasticoConfig`, `addOrario`, `addVacanza`, ecc.) — nessun nuovo backend necessario.

### 4.3 Refactoring ImpostazioniPage in sezioni collassabili

**File da modificare:**
- `src/pages/ImpostazioniPage.jsx`

**Implementazione:**
- Estrarre ogni sezione in un componente separato:
  - `src/components/impostazioni/SezioneAnno.jsx`
  - `src/components/impostazioni/SezioneClassi.jsx`
  - `src/components/impostazioni/SezioneOreScolastiche.jsx`
  - `src/components/impostazioni/SezioneOrario.jsx`
  - `src/components/impostazioni/SezioneVacanze.jsx`
  - `src/components/impostazioni/SezioneImportExcel.jsx`
  - `src/components/impostazioni/SezioneReset.jsx`
- La pagina Impostazioni diventa un accordion dove ogni sezione e' collassabile
- Aggiungere badge di stato accanto al titolo di ogni sezione: checkmark verde se configurata, warning arancione se mancante
- Es: "Ore Scolastiche [configurato]" vs "Vacanze [0 configurate]"

### 4.4 Banner di configurazione mancante migliorato

**File da modificare:**
- `src/pages/OggiPage.jsx` (nuova)
- `src/pages/SettimanaPage.jsx` (nuova)
- `src/pages/ProgrammazionePage.jsx`

**Implementazione:**
- Sostituire i messaggi generici "Configura X nelle Impostazioni" con un banner specifico che spiega cosa manca e offre un link diretto alla sezione corretta delle Impostazioni
- Es: "L'orario settimanale non e' ancora configurato. [Configura ora →]" con link a `/impostazioni#orario`
- Le Impostazioni con accordion devono supportare scroll-to-section via hash (`#anno`, `#classi`, `#ore`, `#orario`, `#vacanze`)

---

## Fase 5 — Pannello laterale contestuale + Ricorrenze esplicite + Timeline consuntivo

Interventi avanzati che risolvono la frammentazione della navigazione e rendono le funzionalita' meno usate piu' accessibili.

### 5.1 Componente SlidePanel riutilizzabile

**File da creare:**
- `src/components/common/SlidePanel.jsx`

**Props:**
```javascript
open: boolean,
onClose: () => void,
title: string,
width: 'sm' | 'md' | 'lg',  // default 'md'
children: ReactNode
```

**UI:**
- Pannello che scorre da destra con overlay scuro
- Chiusura con click su overlay, ESC, o bottone X
- Animazione smooth (transform translateX + transition)
- Z-index sopra il contenuto ma sotto i dialog modali

### 5.2 Pannello percorsi contestuale nella SettimanaPage

**File da modificare:**
- `src/pages/SettimanaPage.jsx` (Fase 3)
- `src/components/calendario/PercorsoSelector.jsx`

**Implementazione:**
- Quando l'utente clicca "collega percorso" nell'editing di una lezione, invece del solo `PercorsoSelector` inline, mostrare l'opzione di aprire un `SlidePanel` con:
  - Lista percorsi della classe (come in PercorsiPage, ma filtrata)
  - Possibilita' di creare un nuovo percorso al volo (form compatto)
  - Possibilita' di aggiungere/modificare unita (come UnitaPanel, ma compatto)
- Al salvataggio, il pannello si chiude e il percorso/unita viene automaticamente collegato alla lezione in editing

### 5.3 Pannello percorsi nella ProgrammazionePage

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx`

**Implementazione:**
- Sostituire il link "Gestisci in Percorsi" (riga 598-601) con un bottone "Modifica percorsi" che apre lo `SlidePanel`
- Il pannello contiene la lista percorsi+unita della classe selezionata con editing completo (stessa funzionalita' di PercorsiPage ma scoped alla classe)
- Le modifiche si riflettono in tempo reale nella timeline grazie ai listener `onSnapshot`

### 5.4 Ricorrenze con visualizzazione esplicita

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx` — sezione "Ore ricorrenti" (righe 514-589)

**Implementazione:**
- Aggiungere un testo esplicativo sopra la griglia: "Assegna un percorso fisso a ogni ora della settimana. Quando generi le lezioni nel Calendario, verranno automaticamente collegate al percorso assegnato qui."
- Dopo la griglia, mostrare un riepilogo con previsione: per ogni percorso, "Percorso X: Nh/settimana — coprira' le sue N unita in circa M settimane"
  - Calcolo: `settimane = orePrevisteTotali / oreSettimana`
- Colorare le celle della griglia con il colore del percorso (gia' parzialmente implementato, estendere con colori piu' vivaci)
- Aggiungere un tooltip su ogni cella: "Ogni [Lunedi' alla 3a ora] verra' assegnato automaticamente a [Nome Percorso]"

### 5.5 Stato lezione "Parziale"

**File da modificare:**
- `src/lib/costanti.js` — Aggiungere `PARZIALE` a `STATO_LEZIONE`, `STATO_LEZIONE_LABEL`, `STATO_LEZIONE_SHORT`, `STATI_LEZIONE`
- `src/pages/OggiPage.jsx` (nuova)
- `src/pages/SettimanaPage.jsx` (nuova)
- `src/components/percorsi/UnitaPanel.jsx`
- `src/components/calendario/PercorsoSelector.jsx`
- `src/pages/ExportPage.jsx`

**Implementazione:**
- Nuovo stato: `parziale` con label "Parziale", short "½", colore arancione (bg-orange-100, text-orange-700)
- I bottoni di stato diventano 4: `[P] [S] [½] [X]`
- Nella ExportPage il consuntivo deve conteggiare le ore parziali separatamente
- Nel conteggio ore del `PercorsoSelector` e `UnitaPanel`, le lezioni parziali contano come 0.5 ore (o un valore configurabile)

### 5.6 Timeline consuntivo nella ProgrammazionePage

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx`
- `src/lib/firestore.js` — Aggiungere `onLezioniByClasseMateria(annoScolastico, classe, materia, callback)` se non esiste (attualmente manca una query filtrata per classe+materia)

**Implementazione:**
- Per ogni settimana passata nella timeline, mostrare una colonna aggiuntiva "Effettivo" accanto a "Attivita' prevista"
- Caricare le lezioni reali per classe+materia e raggruppare per settimana
- Per ogni settimana: mostrare quante ore sono state svolte e su quale unita
- Colore della riga: verde se il consuntivo corrisponde al piano, arancione se diverso, rosso se nessuna lezione svolta
- Aggiungere un toggle "Mostra consuntivo" per non sovraccaricare l'interfaccia di default

**Nuova query firestore necessaria:**
```javascript
// in firestore.js
export function onLezioniByClasseMateria(annoScolastico, classe, materia, callback) {
  const q = query(
    lezioniRef,
    where('annoScolastico', '==', annoScolastico),
    where('classe', '==', classe),
    where('materia', '==', materia)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  })
}
```
> Nota: questa query richiede un indice composito Firestore su `(annoScolastico, classe, materia)`.

### 5.7 Generazione lezioni multi-settimana

**File da modificare:**
- `src/pages/SettimanaPage.jsx` (nuova, Fase 3)

**Implementazione:**
- Aggiungere al bottone "Genera lezioni" un dropdown: "Genera per: [Questa settimana] [Prossime 2 settimane] [Prossime 4 settimane] [Fino a fine scuola]"
- La logica di generazione viene estratta in un helper condiviso:
  - `src/lib/generaLezioni.js` — funzione `generaLezioni(annoAttivo, orari, ricorrenze, vacanze, giornoLibero, startDate, endDate)`
- Mostrare un dialog di conferma prima della generazione massiva: "Stai per generare circa N lezioni per M settimane. Continuare?"
- Progress feedback durante la generazione (contatore lezioni create)

---

## Riepilogo struttura file

### File nuovi (19)

```
src/pages/
  OggiPage.jsx                          # Fase 2
  OnboardingPage.jsx                    # Fase 4
  SettimanaPage.jsx                     # Fase 3

src/components/common/
  StatoLegenda.jsx                      # Fase 1
  QuickNote.jsx                         # Fase 2
  StepWizard.jsx                        # Fase 4
  SlidePanel.jsx                        # Fase 5

src/components/settimana/
  WeekNavigation.jsx                    # Fase 3
  LessonCard.jsx                        # Fase 3
  LessonGrid.jsx                        # Fase 3
  LessonList.jsx                        # Fase 3
  LessonEditPanel.jsx                   # Fase 3
  GenerateButton.jsx                    # Fase 3
  ExtraLessonForm.jsx                   # Fase 3

src/components/onboarding/
  StepAnno.jsx                          # Fase 4
  StepClassi.jsx                        # Fase 4
  StepOreScolastiche.jsx                # Fase 4
  StepOrario.jsx                        # Fase 4
  StepVacanze.jsx                       # Fase 4
  StepFineScuola.jsx                    # Fase 4

src/components/impostazioni/
  SezioneAnno.jsx                       # Fase 4
  SezioneClassi.jsx                     # Fase 4
  SezioneOreScolastiche.jsx             # Fase 4
  SezioneOrario.jsx                     # Fase 4
  SezioneVacanze.jsx                    # Fase 4
  SezioneImportExcel.jsx                # Fase 4
  SezioneReset.jsx                      # Fase 4

src/lib/
  generaLezioni.js                      # Fase 5
```

### File modificati per fase

| Fase | File modificati |
|------|----------------|
| 1 | DashboardPage, CalendarioPage, ToastContext |
| 2 | App.jsx, Sidebar.jsx |
| 3 | App.jsx, Sidebar.jsx, (rimuovere DashboardPage + CalendarioPage) |
| 4 | App.jsx, ImpostazioniPage, ProgrammazionePage |
| 5 | ProgrammazionePage, costanti.js, firestore.js, ExportPage, PercorsoSelector, UnitaPanel |

### File da rimuovere (Fase 3)

```
src/pages/DashboardPage.jsx            # Sostituito da SettimanaPage
src/pages/CalendarioPage.jsx           # Sostituito da SettimanaPage
```

---

## Mapping problemi → fasi

| # | Problema | Fase |
|---|---------|------|
| 1 | Setup iniziale opaco | Fase 4 (wizard + impostazioni ristrutturate) |
| 2 | Navigazione frammentata | Fase 5 (pannello laterale) + Fase 1 (link contestuali) |
| 3 | Dashboard/Calendario sovrapposti | Fase 3 (unificazione) |
| 4 | Generazione lezioni confusa | Fase 2 (gen. giornaliera) + Fase 5 (multi-settimana) |
| 5 | Ricorrenze oscure | Fase 5 (visualizzazione esplicita) |
| 6 | Nessuna vista Oggi | Fase 2 (OggiPage) |
| 7 | Nessun link vista→azione | Fase 1 (link contestuali) + Fase 3 (celle cliccabili) |
| 8 | Unita in troppe interfacce | Fase 5 (pannello laterale condiviso) |
| 9 | Problemi minori (undo, feedback, legenda) | Fase 1 (quick wins) |

---

## Ordine consigliato di implementazione

```
Fase 1 ──→ Fase 2 ──→ Fase 3 ──→ Fase 4 ──→ Fase 5
(1 sett)    (1 sett)   (2 sett)   (2 sett)   (2 sett)
```

Ogni fase e' rilasciabile indipendentemente. L'app rimane funzionante e migliorata dopo ogni fase.
