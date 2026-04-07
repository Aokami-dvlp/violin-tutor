# Violin Pitch Tutor

Web app standalone per allenamento intonazione violino in tempo reale, costruita con Vite + Vanilla JS + Web Audio API + AudioWorklet + aubio.js (WASM).

## Setup

```bash
npm install
npm run dev
```

Apri l'URL locale mostrato da Vite (di solito `http://localhost:5173`).

## Deploy su GitHub Pages

- Il workflow e' in `.github/workflows/deploy-pages.yml`.
- Fa deploy automatico su ogni push nel branch `main`.
- In GitHub: `Settings -> Pages -> Build and deployment -> Source: GitHub Actions`.
- URL finale: `https://<account>.github.io/<repo>/`

## Permessi Microfono

- Usa browser Chromium recente (Chrome/Edge consigliati) per pieno supporto `AudioWorklet`.
- Alla prima apertura, il browser richiede il permesso microfono: concedilo, altrimenti i label device non saranno leggibili.
- Seleziona Audient ID4 MkII dal menu input e premi `Connect`.

## Come funziona la rilevazione pitch

- Catena audio: `getUserMedia` (44100 Hz mono, filtri disabilitati) -> `AudioWorkletProcessor`.
- Nel worklet, i frame PCM vengono accumulati e analizzati da `aubiojs` con metodo `yin`, buffer `4096`, hop `512`.
- Ogni hop invia `{ frequency, confidence }` al thread UI.
- Il main thread converte Hz in nota temperata con formula MIDI standard, applica range violino (175-3136 Hz), filtra confidence (dinamica sulle note gravi), poi smoothing:
  - mediana mobile (5) su `midiNumber`
  - EMA (`alpha = 0.3`) su cents.

## YIN vs alternative

`yin` e' stato scelto perche' su segnali monofonici musicali (come singola nota di violino) tende a dare maggiore stabilita' e accuratezza rispetto a metodi piu' veloci ma meno robusti al timbro armonico complesso. Metodi come `yinfft` possono essere piu' efficienti, ma qui la priorita' e' precisione percepita in pratica strumentale.

## Modalita'

- **Free Tuner**: mostra qualsiasi nota rilevata.
- **Note Trainer**: segue sequenza note prima posizione (E4-F4-F#4-G4-A4-B4-C5-D5-E5), avanza quando la nota target e' mantenuta entro `+-15 cents` per `1.5 s`.

## Calibrazione

- Notazione di default: **italiana** (`Do Re Mi`), con toggle `INT/ITA`.
- `A4`: regolabile tra `430` e `450 Hz`.
- `Calib ¢`: offset globale tra `-20` e `+20 cents` per allineamento a un accordatore di riferimento.
- Le preferenze vengono salvate in `localStorage`.
