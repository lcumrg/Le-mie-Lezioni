# Roadmap v2 — "Veloce come Excel"

Obiettivo: rendere l'app piu veloce e diretta di Excel per l'uso quotidiano.
Principio guida: **meno click, meno pagine, piu editing inline**.

Cosa e' gia stato fatto (dalla roadmap precedente):
- OggiPage con vista giornaliera, generazione lezioni, note inline, undo stato
- SettimanaPage con griglia + lista unificate (ex Dashboard + Calendario)
- Feedback visivo P/S/X, toast con undo, StatoLegenda condivisa
- QuickNote, WeekNavigation, GenerateButton, componenti settimana

Cosa resta da fare, riorganizzato per impatto sull'uso quotidiano:

---

## Fase 0 — Reskin "Terminal Mode"

Cambio estetico globale: da "webapp moderna" a stile terminale/nerd minimal.
Si fa come prima cosa perche' ogni componente scritto dopo nascera' gia col nuovo stile.

### Estetica target

- Sfondo scuro, superfici appena piu chiare, bordi sottili
- Font monospace per dati e numeri (JetBrains Mono), sans-serif compatto per UI (Inter)
- Angoli netti (rounded-sm o nessuno) — niente rounded-xl/2xl
- Niente ombre, niente gradienti — piatto e pulito
- Padding ridotto ovunque — densita alta
- Accenti colorati ma contenuti: verde terminale, blu link, rosso errore, ambra warning

### Palette colori (CSS custom properties)

```css
:root {
  /* Superfici */
  --bg-base:     #0d1117;   /* sfondo pagina */
  --bg-surface:  #161b22;   /* card, pannelli, sidebar */
  --bg-overlay:  #1c2128;   /* dropdown, popover, pannelli editing */
  --bg-inset:    #010409;   /* input, textarea, campi editabili */

  /* Bordi */
  --border-default: #30363d;
  --border-muted:   #21262d;
  --border-accent:  #388bfd;

  /* Testo */
  --text-primary:   #e6edf3;
  --text-secondary: #7d8590;
  --text-tertiary:  #484f58;
  --text-link:      #58a6ff;

  /* Accenti funzionali */
  --accent-green:   #3fb950;  /* successo, stato Svolta, conferme */
  --accent-blue:    #58a6ff;  /* stato Pianificata, link, focus */
  --accent-red:     #f85149;  /* stato Saltata, errori, elimina */
  --accent-amber:   #d29922;  /* warning, vacanze, note */
  --accent-purple:  #bc8cff;  /* percorsi collegati */
  --accent-cyan:    #39d2c0;  /* evidenziazione speciale */

  /* Sfumature per badge di stato */
  --badge-blue-bg:   #121d2f;  --badge-blue-text:   #58a6ff;
  --badge-green-bg:  #0d2818;  --badge-green-text:  #3fb950;
  --badge-red-bg:    #2d1215;  --badge-red-text:    #f85149;
  --badge-amber-bg:  #2a1e04;  --badge-amber-text:  #d29922;
  --badge-purple-bg: #1e1533;  --badge-purple-text: #bc8cff;
}
```

### Font

Aggiungere JetBrains Mono (Google Fonts, solo weight 400 + 700, ~12KB):
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
```

Regola: `font-mono` = JetBrains Mono per dati, orari, numeri, stato.
Il body resta con il sans-serif di sistema per il testo di interfaccia.

### Strategia di implementazione

L'approccio e' **Tailwind v4 @theme + utilita custom** — non serve riscrivere ogni className a mano:

1. **`index.css`**: definire le variabili CSS e sovrascrivere i colori Tailwind via `@theme`
2. **`index.css`**: aggiungere classi utility custom per i pattern piu comuni:
   - `.card` = bg-surface + border + no-shadow
   - `.btn-primary` = accento verde, bordo, no-shadow
   - `.input-field` = bg-inset + border + text-primary
   - `.badge-stato-P/S/X` = i badge colorati
3. **Componenti globali** (AppLayout, Sidebar, Toast, LoadingSpinner): adattare direttamente le classi Tailwind ai nuovi colori
4. **Pagine**: aggiornare una per volta. Ogni pagina toccata per le Fasi 1-5 viene anche allineata al nuovo stile

### File da modificare (Fase 0)

| File | Cosa cambia |
|------|-------------|
| `index.html` | Aggiungere font JetBrains Mono |
| `src/index.css` | CSS variables, @theme, utility classes |
| `src/components/layout/AppLayout.jsx` | bg-base, bordi, rimuovere ombre |
| `src/components/layout/Sidebar.jsx` | bg-surface, testo chiaro, nav items |
| `src/contexts/ToastContext.jsx` | Toast scuri con accenti colorati |
| `src/components/common/LoadingSpinner.jsx` | Spinner con accento verde/ciano |
| `src/components/common/ConfirmDialog.jsx` | Dialog scuro |
| `src/components/common/GlobalSearch.jsx` | Input scuro |
| `src/pages/LoginPage.jsx` | Sfondo scuro, bottone minimal |

### Dettaglio stile per componente

**Sidebar:**
- Sfondo: bg-surface
- Nav items: testo secondario, hover bg-overlay, attivo con bordo sinistro accent-green
- Logo: semplice, monocromo verde/ciano, niente gradiente

**Card/pannelli:**
- Sfondo: bg-surface
- Bordo: 1px border-default
- Niente shadow, niente rounded-lg → rounded-sm o rounded

**Bottoni:**
- Primario: bg trasparente, bordo accent-green, testo accent-green. Hover: bg accent-green/10
- Secondario: bordo border-default, testo secondary. Hover: bg-overlay
- Stato P/S/X: sfondo scuro del colore (badge-*-bg), testo del colore (badge-*-text)
- Attivo: ring sottile del colore

**Input/textarea:**
- Sfondo: bg-inset
- Bordo: border-default, focus: border-accent
- Testo: text-primary
- Placeholder: text-tertiary

**Tabelle:**
- Header: bg-overlay, testo secondary, font-mono
- Righe: bg-surface, bordo-bottom border-muted
- Hover: bg-overlay
- Celle dati: font-mono

**Toast:**
- Sfondo: bg-overlay con bordo sinistro del colore del tipo (verde/rosso/ambra/blu)
- Testo: text-primary

**Login page:**
- Sfondo: bg-base pieno
- Un terminale ASCII stilizzato come decorazione:
  ```
  > le-mie-lezioni --login
  [waiting for auth...]
  ```
- Bottone Google con bordo e stile minimal

### Regola fondamentale: app scura, stampe chiare

Lo stile terminale si applica SOLO all'interfaccia dell'app (quello che vedi a schermo).
Tutto cio' che viene stampato o esportato come documento mantiene lo stile chiaro,
professionale e accattivante attuale:

- **Finestra di stampa orario** (`handlePrintOrario`): ha gia i suoi CSS dedicati
  nella finestra popup — sfondo bianco, font sans-serif, colori vivaci. Non toccare.
- **Export testo** (.txt): e' plain text, nessuno stile coinvolto.
- **Anteprime nell'app** (`<pre>` e tabella orario nella ExportPage): queste SI
  diventano scure perche' fanno parte dell'interfaccia. Ma il bottone "Stampa/Salva PDF"
  continua ad aprire una finestra chiara e pulita.

In futuro, se aggiungeremo export PDF diretto o report HTML, seguiranno la stessa regola:
il documento generato e' sempre chiaro e stampabile, l'anteprima nell'app e' scura.

### Effetti "nerd" opzionali (low priority, da valutare)

- Cursore lampeggiante `_` accanto al titolo "Oggi" o in campi vuoti
- Prompt `>` prima dei titoli di sezione
- Numeri e orari in font-mono verde/ciano
- Transizioni minime (50-100ms) — niente animazioni appariscenti
- Status bar in fondo alla sidebar tipo terminale: `v1.0.0 | deploy 05-mar-2026 | 3 classi`

---

## Fase 1 — Percorsi in modalita "foglio di calcolo"

Il collo di bottiglia piu grande. Oggi creare un percorso con 5 unita richiede ~15 click
e 3 form separati. Deve diventare: scrivi, Tab, scrivi, Enter, avanti.

### 1.1 Creazione rapida percorso (inline)

**Problema:** Per creare un percorso serve aprire un form con 5 campi, compilarlo, premere "Crea".
**Soluzione:** Una riga inline in cima alla lista: selezioni classe/materia, scrivi il titolo, premi Enter. Il percorso e' creato. Descrizione e note si aggiungono dopo, cliccando sul percorso.

**File da modificare:**
- `src/pages/PercorsiPage.jsx` — sostituire il form modale con una riga inline sempre visibile

**Comportamento:**
- Riga fissa in cima: `[dropdown classe-materia] [input titolo] [Enter per creare]`
- Dopo il Enter: il percorso appare nella lista, si espande automaticamente, il cursore va su "Aggiungi unita"
- Descrizione e note editabili inline cliccando sul percorso (gia parzialmente implementato per le note)

### 1.2 Unita in formato tabella editabile

**Problema:** Ogni unita richiede aprire un form, compilare titolo + ore + descrizione, premere "Aggiungi". Per 5 unita = 5 volte la stessa procedural.
**Soluzione:** Lista di unita come righe di una tabella. Ogni campo e' cliccabile e modificabile direttamente. In fondo alla lista, una riga vuota per aggiungerne una nuova.

**File da modificare:**
- `src/components/percorsi/UnitaPanel.jsx` — riscrittura sostanziale

**Comportamento:**
```
  #   Titolo                    Ore   Stato         Azioni
  1   Intro alla programmazione  4h   [Da fare v]   [su][giu][x]
  2   Variabili e tipi           3h   [In corso v]  [su][giu][x]
  3   |                         |    |              |
      ^ riga vuota: scrivi qui per aggiungere
```

- Click su titolo → diventa input editabile, save on blur/Enter
- Click su ore → diventa input numerico, save on blur/Enter
- Click su stato → cicla al prossimo (come gia funziona)
- Tab per spostarsi tra i campi nella stessa riga
- Ultima riga vuota: scrivi il titolo e premi Enter → nuova unita creata con ore=1 di default
- Enter nella riga vuota dopo aver creato → il cursore resta sulla nuova riga vuota (per aggiungere in serie)

### 1.3 Descrizione unita espandibile inline

**Problema:** La descrizione unita oggi e' un campo del form. Non si vede nella lista.
**Soluzione:** Click sulla riga dell'unita espande una riga sotto con la descrizione editabile (come gia funziona per i materiali). Non un form separato.

**File da modificare:**
- `src/components/percorsi/UnitaPanel.jsx` — la sezione espansa diventa piu leggera, solo descrizione + materiali

### 1.4 Drag-and-drop per riordinare unita

**Problema:** I bottoni freccia su/giu funzionano ma sono lenti per riordinamenti grandi.
**Soluzione:** Aggiungere drag-and-drop come alternativa. Le frecce restano come fallback.

**Libreria:** `@dnd-kit/core` + `@dnd-kit/sortable` (leggera, ~8KB gzipped)

**File da modificare:**
- `src/components/percorsi/UnitaPanel.jsx` — wrap della lista con DndContext + SortableContext

---

## Fase 2 — Percorsi dentro la Programmazione

Oggi nella ProgrammazionePage i percorsi sono in sola lettura con un link "Gestisci in Percorsi"
che ti butta fuori. L'insegnante deve poter creare e modificare percorsi senza uscire dalla Programmazione.

### 2.1 Pannello laterale percorsi

**File da creare:**
- `src/components/common/SlidePanel.jsx` — pannello che scorre da destra, riutilizzabile

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx` — sostituire il link "Gestisci in Percorsi" con un bottone "Modifica percorsi" che apre lo SlidePanel

**Comportamento:**
- Click su "Modifica percorsi" → si apre un pannello laterale a destra
- Il pannello contiene la stessa interfaccia "foglio di calcolo" della Fase 1, ma filtrata per la classe selezionata
- Le modifiche si riflettono in tempo reale nella timeline (grazie a onSnapshot)
- Il pannello si chiude con ESC, click fuori, o bottone X

### 2.2 Creazione percorso rapida dalla timeline

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx` — aggiungere azione rapida nella sezione percorsi

**Comportamento:**
- Se non ci sono percorsi per la classe selezionata, mostrare un input inline:
  "Nessun percorso. Creane uno: [input titolo] [Enter]"
- Dopo la creazione, il pannello laterale si apre automaticamente per aggiungere le unita

### 2.3 Estrarre UnitaPanel come componente condiviso

**File da modificare:**
- `src/components/percorsi/UnitaPanel.jsx` — assicurarsi che funzioni sia dentro PercorsiPage che dentro lo SlidePanel
- Il componente deve essere completamente self-contained (carica i suoi dati via onUnita)

---

## Fase 3 — Griglia settimana interattiva

La griglia della SettimanaPage oggi mostra i dati ma per modificare una lezione
devi passare alla vista Lista. Rendiamola interattiva.

### 3.1 Click su cella → pannello editing sotto la griglia

**File da creare:**
- `src/components/settimana/LessonEditPanel.jsx` — gia previsto ma da implementare completamente

**File da modificare:**
- `src/components/settimana/LessonGrid.jsx` — aggiungere onClick su celle con apertura pannello

**Comportamento:**
- Click su una cella della griglia → sotto la griglia appare un pannello con:
  - Classe, materia, orario (read-only, per contesto)
  - Bottoni P/S/X per lo stato
  - Campo note editabile
  - PercorsoSelector per collegare percorso/unita
  - Bottone "Elimina lezione"
- ESC o click su un'altra cella chiude il pannello e ne apre un altro
- La cella selezionata ha un bordo evidenziato

### 3.2 Navigazione da tastiera nella griglia

**File da modificare:**
- `src/components/settimana/LessonGrid.jsx` — aggiungere onKeyDown handler

**Scorciatoie:**
- Frecce → muoversi tra le celle
- Enter → aprire il pannello editing della cella selezionata
- S/P/X → cambiare stato direttamente (senza aprire il pannello)
- Esc → chiudere il pannello / deselezionare

### 3.3 Generazione lezioni dalla griglia

**File da modificare:**
- `src/pages/SettimanaPage.jsx` — aggiungere bottone "Genera" anche in vista griglia

**Comportamento:**
- Se la griglia e' vuota, mostrare le celle con sfondo tratteggiato e un banner sopra:
  "Settimana senza lezioni. [Genera da orario]"
- Dopo la generazione, la griglia si popola in tempo reale

---

## Fase 4 — Micro-ottimizzazioni per il flusso quotidiano

Piccoli interventi che riducono l'attrito nell'uso di tutti i giorni.

### 4.1 "Segna tutte svolte" piu visibile nella OggiPage

**File da modificare:**
- `src/pages/OggiPage.jsx`

**Miglioramento:**
- Spostare il bottone in alto (sopra la lista lezioni) se ci sono lezioni pianificate
- Renderlo piu evidente con icona + testo + colore verde

### 4.2 Generazione automatica lezioni nella OggiPage

**File da modificare:**
- `src/pages/OggiPage.jsx`

**Comportamento:**
- Se oggi non ha lezioni ma ha slot nell'orario, generarle automaticamente
  (con un toast "Lezioni del giorno generate" e possibilita di annullare)
- L'utente non deve premere un bottone per un'operazione che fa sempre

### 4.3 Salvataggio automatico ovunque (debounce)

**File da creare:**
- `src/hooks/useAutoSave.js` — hook custom con debounce a 1 secondo

**Utilizzo:**
- Note nelle lezioni (OggiPage, SettimanaPage)
- Descrizione e note dei percorsi (PercorsiPage)
- Qualsiasi campo testuale editabile inline

**Comportamento:**
- L'utente scrive, dopo 1 secondo di pausa il dato viene salvato
- Un indicatore discreto "Salvato" appare brevemente
- Nessun bottone "Salva" necessario

### 4.4 Apertura diretta percorso da lezione

**File da modificare:**
- `src/pages/OggiPage.jsx` — il badge percorso/unita nella lezione
- `src/pages/SettimanaPage.jsx` (vista lista)

**Comportamento:**
- Click sul nome del percorso in una lezione → naviga a PercorsiPage con quel percorso gia espanso
- Usare query param: `/percorsi?expand=PERCORSO_ID`
- PercorsiPage legge il param e auto-espande il percorso

---

## Fase 5 — Vista compatta e densita informativa

Per chi viene da Excel: piu dati visibili, meno spazio sprecato.

### 5.1 Toggle "Vista compatta" nella PercorsiPage

**File da modificare:**
- `src/pages/PercorsiPage.jsx`

**Comportamento:**
- Un toggle in alto: [Normale] [Compatta]
- Vista compatta: padding ridotto, font piu piccoli, tutti i percorsi visibili come righe di una tabella unica raggruppata per classe
- Simile a un foglio Excel con raggruppamento

### 5.2 Riepilogo a colpo d'occhio nella ProgrammazionePage

**File da modificare:**
- `src/pages/ProgrammazionePage.jsx`

**Miglioramenti:**
- I percorsi nel pannello sinistro mostrano una barra di avanzamento colorata
- Ogni unita mostra ore svolte/previste direttamente (senza espandere)
- Il bilancio ore in alto diventa piu leggibile: "Hai 15 ore in piu del necessario" vs numeri secchi

### 5.3 Stato "Parziale" per le lezioni

**File da modificare:**
- `src/lib/costanti.js` — aggiungere `PARZIALE` con label "1/2", colore arancione
- Tutti i componenti che mostrano P/S/X

**Utilita:** Quando una lezione e' stata fatta solo in parte (supplenza, interruzione, ecc.)
Le lezioni parziali contano come 0.5 ore nel conteggio.

---

## Riepilogo priorita e impatto

| Fase | Cosa | Impatto | Complessita |
|------|------|---------|-------------|
| 0. Terminal Mode | Reskin scuro + monospace | ALTO (percezione) | Media |
| 1. Percorsi spreadsheet | Editing inline tipo Excel | ALTISSIMO (velocita) | Media |
| 2. Percorsi in Programmazione | SlidePanel, zero navigazione | ALTO (flusso) | Media |
| 3. Griglia interattiva | Click celle, tastiera | MEDIO (efficienza) | Media |
| 4. Micro-ottimizzazioni | Auto-save, auto-genera, link | MEDIO (attrito) | Bassa |
| 5. Vista compatta | Densita informativa | BASSO-MEDIO (comfort) | Bassa |

## Ordine di implementazione consigliato

```
Fase 0 ──→ Fase 1 ──→ Fase 2 ──→ Fase 4 ──→ Fase 3 ──→ Fase 5
```

La Fase 0 (reskin) va per prima cosi ogni componente nuovo nasce gia col look giusto.
La Fase 4 viene prima della 3 perche sono interventi piccoli e veloci.

---

## Principi di design per tutte le fasi

1. **Nessun form modale** — tutto editabile inline dove lo vedi
2. **Enter per creare, Tab per spostarsi, Esc per chiudere** — tastiera first
3. **Salvataggio automatico** — mai un bottone "Salva" per modifiche singole
4. **Zero navigazione forzata** — se l'utente sta lavorando in una pagina, non mandarlo altrove
5. **Feedback immediato** — ogni azione mostra subito il risultato (grazie a onSnapshot e' gia cosi)
6. **Estetica terminale** — scuro, denso, monospace per i dati, niente fronzoli
