# Roadmap — Le Mie Lezioni

Documento vivente. Aggiornato ad ogni sessione di lavoro.

---

## Stato generale

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 1 | Quick Wins e micro-fix | ✅ COMPLETATA |
| 2 | Vista Oggi (OggiPage) | ✅ COMPLETATA |
| 3 | Unificazione Dashboard+Calendario (SettimanaPage) | ✅ COMPLETATA |
| 4 | Wizard Onboarding + Impostazioni ristrutturate | ❄️ CONGELATA (fine anno 25-26) |
| 5 | SlidePanel, Ricorrenze, Consuntivo, Parziale, Multi-week | ✅ COMPLETATA |

---

## Fase 1 — Quick Wins ✅

- ✅ 1.1 Feedback visivo bottoni stato P/S/X (updatingLezioni Set, opacity ridotta)
- ✅ 1.2 Undo per cambi stato (toast.action con "Annulla")
- ✅ 1.3 Celle griglia cliccabili (click apre pannello editing)
- ✅ 1.4 Link contestuali (badge percorso cliccabile, navigate a /percorsi, /programmazione)
- ✅ 1.5 Legenda stati unificata (StatoLegenda.jsx condiviso)
- ✅ 1.6 "Segna tutte svolte" piu visibile + undo

---

## Fase 2 — Vista Oggi ✅

- ✅ 2.1 OggiPage come route principale (/)
- ✅ 2.2 Generazione automatica lezioni del giorno
- ✅ 2.3 Sommario giornaliero (progress bar, conteggio stati)
- ✅ 2.4 QuickNote (editing inline note con debounce)

---

## Fase 3 — Unificazione Dashboard+Calendario ✅

- ✅ 3.1 SettimanaPage con toggle Griglia/Lista
- ✅ 3.2 Celle griglia con editing inline (pannello sotto la griglia)
- ✅ 3.3 Spostamento funzionalita (genera lezioni, lezione extra, segna svolte)
- ✅ 3.4 Componenti estratti: WeekNavigation, LessonGrid, LessonList, LessonCard, GenerateButton, ExtraLessonForm
- ✅ Rimossi DashboardPage e CalendarioPage

---

## Fase 4 — Wizard Onboarding + Impostazioni ❄️ CONGELATA

Da riprendere a fine anno scolastico 2025-2026. Utile per onboarding nuovi utenti o nuovo anno.

### Cosa prevede:
- 4.1 StepWizard component riutilizzabile
- 4.2 OnboardingPage con 6 step guidati (anno, classi, ore, orario, vacanze, data fine)
- 4.3 ImpostazioniPage ristrutturata in accordion con sezioni collassabili + badge stato
- 4.4 Banner configurazione mancante con link diretto alla sezione giusta

---

## Fase 5 — Pannello laterale + Ricorrenze + Consuntivo ✅

- ✅ 5.1 SlidePanel component riutilizzabile (slide da destra, Esc, overlay)
- ✅ 5.2 SlidePanel in SettimanaPage ("Modifica percorso" nell'edit panel griglia)
- ✅ 5.3 SlidePanel in ProgrammazionePage (click su percorso apre UnitaPanel)
- ✅ 5.4 Ricorrenze esplicite (testo, tooltip celle, previsione settimane per percorso)
- ✅ 5.5 Stato "Parziale" (½) con badge arancione, conta 0.5h
- ✅ 5.6 Timeline consuntivo (toggle, colonna "Effettivo" con S/½/X per settimana)
- ✅ 5.7 Generazione multi-settimana (dropdown: 2/4 sett, fino a fine scuola)

---

## Extra implementati (fuori roadmap originale)

- ✅ Catchup mode in PercorsiPage (aggiornamento rapido con pallini)
- ✅ "Completa fino a qui" in UnitaPanel (bulk update stati unita)
- ✅ Navigazione Tab/Shift+Tab nella griglia + indicatore salvataggio "Salvando.../Salvato"
- ✅ "Ridistribuisci da oggi" in ProgrammazionePage (solo settimane future)
- ✅ Undo toast al posto di ConfirmDialog per eliminazione lezioni
- ✅ Toast contestuali ("Lezione X saltata. Controlla la programmazione.")
- ✅ Settimana corrente evidenziata nella timeline (freccia + bordo)
- ✅ Settimane passate attenuate nella timeline
- ✅ Vista compatta in PercorsiPage (toggle Normale/Compatta)
- ✅ Progress bar su percorsi in ProgrammazionePage
- ✅ Terminal Mode reskin

---

## Lavoro in corso

_Nessun lavoro in corso al momento._

<!-- Quando una sessione viene interrotta, qui viene annotato:
- Cosa si stava implementando
- Quali file erano in modifica
- Cosa resta da completare
-->

---

## Idee future / Backlog

- Generazione lezioni con progress feedback (contatore lezioni create)
- Swipe per navigare tra giorni su mobile in OggiPage
- Drag & drop per assegnare percorsi a slot ricorrenze
- Export PDF della programmazione
