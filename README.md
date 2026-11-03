# 🍳 RecipeBox

**Il tuo ricettario in tasca: salva le ricette che ti piacciono e cucinale passo passo, anche con le mani infarinate.**

🇮🇹 Italiano · [🇬🇧 English](README.en.md)

---

## Cos'è

RecipeBox è un'app per il telefono (e per il computer) che raccoglie tutte le tue ricette in un unico posto. Trovi al volo quella giusta, la cucini seguendo i passaggi uno alla volta, e quando manca qualcosa in casa la lista della spesa è già pronta.

Si installa sul telefono come una vera app, senza passare dallo store.

## Cosa sa fare

- 📚 **Ricette di base per tutti, e le tue personali**: l'app parte con una raccolta pronta; le ricette che aggiungi tu le vedi solo tu.
- 📖 **Il tuo archivio di ricette**: antipasti, primi, secondi, contorni, dessert e cocktail, con ricerca e filtri. Con un tocco segni quelle che hai già provato 👍
- 🥕 **"Per ingrediente"**: scegli gli ingredienti che hai in frigo e vedi subito le ricette che li usano. In ogni ricetta, "Cucina con quello che hai" ti fa spuntare cosa hai già in casa.
- 👩‍🍳 **Guida passo passo**: ogni passaggio ha la sua foto, e toccando un ingrediente evidenziato lo segni come usato.
- ⏱️ **Timer di cottura**: parte dal passaggio e ti avvisa con una notifica quando è ora, anche con lo schermo spento.
- ⚖️ **Porzioni a piacere**: cambi il numero di persone e le quantità si ricalcolano da sole.
- ✨ **Aggiungi ricette senza fatica**: scrivile a mano, incolla il link di una ricetta trovata sul web, oppure scatta una foto o carica un file. L'intelligenza artificiale legge il testo e prepara la scheda al posto tuo (vedi [Con e senza intelligenza artificiale](#-con-e-senza-intelligenza-artificiale)).
- 🗓️ **Piano settimanale**: colazione, pranzo e cena di ogni giorno, con la possibilità di duplicare la settimana.
- 🛒 **Lista della spesa**: generata dalle ricette che hai scelto. La spunti mentre fai la spesa, la mandi a Bring! o la condividi su WhatsApp.
- 📄 **Condividi una ricetta** in PDF.
- 🗑️ **Cestino**: una ricetta eliminata per sbaglio si recupera entro 7 giorni.
- 💶 **Occhio ai costi**: una pagina dedicata mostra quanto costano le importazioni con l'intelligenza artificiale.

## ✨ Con e senza intelligenza artificiale

Una parte dell'app usa l'intelligenza artificiale (Claude, di Anthropic), che ha un costo per ogni richiesta. Per questo è tenuta separata dal resto, e si capisce sempre cosa la usa: nei menu quelle voci hanno il simbolo ✨.

| | Senza AI | Con AI |
|---|:---:|:---:|
| Archivio, ricerca, filtri, "Per ingrediente" | ✅ | ✅ |
| Aggiungere ricette **a mano** | ✅ | ✅ |
| Guida passo passo, timer, porzioni | ✅ | ✅ |
| Piano settimanale e lista della spesa | ✅ | ✅ |
| Importare una ricetta da un **link** | – | ✅ |
| Importare una ricetta da una **foto o un PDF** | – | ✅ |

**Come si attiva l'AI**

Nel **Profilo** incolli la tua chiave Anthropic (la crei su [console.anthropic.com](https://console.anthropic.com)). Le importazioni le paghi tu, di solito pochi centesimi l'una. La chiave resta solo sul tuo dispositivo: non viene salvata nel database e va reinserita su ogni dispositivo. L'app non ha una chiave sua: nessuno spende i soldi di qualcun altro.

Senza chiave i pulsanti di importazione non danno errori ma spiegano cosa serve, e tutto il resto dell'app funziona normalmente.

## 📚 Ricette di base e ricette tue

- Le **ricette di base** sono la raccolta con cui l'app parte: sono uguali per tutti e in sola lettura (nell'Archivio hanno l'etichetta "Base").
- Le **ricette che aggiungi tu** sono personali: le vedi solo tu e puoi modificarle o eliminarle.
- Nell'Archivio puoi scegliere **Tutte**, **Le mie** o **Base**.
- "**Già provata**" è personale: ognuno segna le sue, anche sulle ricette di base.
- Solo chi gestisce l'app può aggiungere ricette alla base: un utente non può rendere pubbliche le proprie.

## Un giro nell'app

### Trovare la ricetta giusta

<p align="center">
  <img src="docs/screenshots/home.png" width="240" alt="Home con le categorie di ricette">
  &nbsp;&nbsp;
  <img src="docs/screenshots/archivio.png" width="240" alt="Archivio con ricerca e filtri">
</p>

### Cucinare passo passo

<p align="center">
  <img src="docs/screenshots/ricetta-info.png" width="200" alt="Scheda della ricetta con tempi e difficoltà">
  &nbsp;
  <img src="docs/screenshots/ricetta-ingredienti.png" width="200" alt="Ingredienti con le porzioni regolabili">
  &nbsp;
  <img src="docs/screenshots/ricetta-procedimento.png" width="200" alt="Procedimento con le foto dei passaggi">
</p>

### Organizzare la settimana e fare la spesa

<p align="center">
  <img src="docs/screenshots/piano-settimanale.png" width="240" alt="Piano settimanale dei pasti">
  &nbsp;&nbsp;
  <img src="docs/screenshots/lista-spesa.png" width="240" alt="Lista della spesa con invio a Bring! e WhatsApp">
</p>

> Le foto delle ricette negli screenshot appartengono ai rispettivi autori e sono mostrate solo a titolo di esempio.

## 🚀 Installala e provala

Ti servono tre cose, tutte gratuite: [Node.js](https://nodejs.org) (versione LTS), [Git](https://git-scm.com) e un account su [Supabase](https://supabase.com), il servizio che conserva ricette e utenti. Ci vogliono circa 10 minuti.

**1. Scarica il progetto**

```bash
git clone https://github.com/federico-bettin/RecipeBox.git
cd RecipeBox
npm install
```

**2. Crea il database su Supabase**

1. Su supabase.com crea un nuovo progetto (scegli una password e la regione che preferisci).
2. Quando è pronto, apri **SQL Editor → New query**.
3. Incolla tutto il contenuto del file [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**. Crea le tabelle, le regole di sicurezza e la cartella per le foto.

**3. Collega l'app al tuo database**

In Supabase apri **Project Settings → API** e copia due valori: il *Project URL* e la chiave pubblica (*Publishable key*, oppure la chiave `anon` nella scheda "Legacy"). Poi crea il file `.env.local`:

```bash
# Windows
copy .env.example .env.local
# Mac / Linux
cp .env.example .env.local
```

Aprilo e incolla i due valori:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=la-tua-chiave-pubblica
```

**4. Avvia l'app**

```bash
npm run dev
```

Apri l'indirizzo che compare (di solito <http://localhost:5173>), registrati e inizia ad aggiungere ricette. 🎉

> **Se la registrazione non funziona:** in Supabase, **Authentication → URL Configuration**, imposta *Site URL* su `http://localhost:5173`. Per provare subito senza aspettare l'email di conferma, puoi disattivare *Confirm email* in **Authentication → Sign In / Providers → Email**.

Con questi passi funzionano già archivio, ricerca, guida passo passo, piano settimanale e lista della spesa. Le funzioni extra (**importa da link o foto**, che ogni utente attiva con la propria chiave Anthropic, e **notifiche dei timer**) richiedono di pubblicare le funzioni sul server e qualche passaggio in più: li trovi in [docs/SVILUPPO.md](docs/SVILUPPO.md), insieme a come pubblicare il sito online.

## Per chi vuole smanettare

RecipeBox è fatta con React, Vite e Supabase. Configurazione avanzata, funzioni e pubblicazione sono spiegate in [docs/SVILUPPO.md](docs/SVILUPPO.md).

## Licenza

[MIT](LICENSE): puoi usarla, modificarla e condividerla liberamente.
