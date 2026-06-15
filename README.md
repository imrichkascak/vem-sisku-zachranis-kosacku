# Vem šišku, zachrániš sekačku 🌲🧺

Pokojná záhradná webová simulácia. Pod ihličnatým stromom je samá šiška a
robotická sekačka sa kvôli nim nepohne. Pozbieraj všetky šišky – a pusti
sekačku, nech pokosí trávnik. Vladimírov každodenný rituál v prehliadači.

Inšpirované [screen.toys/firewood](https://screen.toys/firewood/), ale namiesto
sekania dreva tu **zbieraš šišky zo záhrady**.

## Ako sa hrá

- Pred štartom si vyber **úroveň obtiažnosti**, ktorá určuje, ako rýchlo sa sekačka plíži za šiškami:
  1. **Začiatočník** – sekačka sa sotva vlečie,
  2. **Pokročilý** – sekačka si to mieri rovno k šiškám,
  3. **Expert (Vladimír)** – sekačka loví ako o život.
- **Klikni** na šišku alebo **prejdi prstom / ťahaj myšou** po šiškách a pozbieraj ich.
- Pozor: robotická sekačka sa **pomaly plíži po trávniku** a snaží sa k šiškám dostať skôr ako ty.
- Keď sekačka prejde cez šišku, **rozdrví ju a poškodí sa**. Po **troch** rozdrvených šiškách sa
  pokazí a je **koniec hry**. Stav sekačky vidíš ako tri bodky v HUD-e.
- Stihni pozbierať všetky šišky, kým je trávnik čistý – vtedy sa sekačka rozbehne a pokosí ho.
- Začne nový deň – spod stromu napadá ďalšia (väčšia) dávka šišiek a sekačka je rýchlejšia. 🌿

## Vlastnosti

- Čisté HTML5 `<canvas>` – **bez závislostí**, žiadny build krok.
- Plne responzívne (mobil aj desktop), podpora dotyku aj myši.
- Plynulá grafika: ráno v záhrade, hojdajúci sa strom, oblaky, čiastočky svetla,
  „roztomilá“ robotická sekačka a uspokojivé zbieranie s časticami a zvukom.
- Rešpektuje `prefers-reduced-motion` a pozastaví sa na neaktívnej karte.

## Lokálny vývoj

Žiadne závislosti. Stačí naservírovať statické súbory:

```bash
npx serve .
# alebo
python3 -m http.server 5173
```

Potom otvor `http://localhost:5173`.

## Štruktúra

| Súbor | Popis |
| --- | --- |
| `index.html` | Štruktúra stránky, HUD, úvodná obrazovka |
| `style.css` | Štýly, fonty (Fraunces + Nunito), responzivita |
| `game.js` | Herný engine: scéna, fyzika, vstup, zvuk, slučka |

## Nasadenie

Statická stránka, nasaditeľná na Vercel bez konfigurácie:

```bash
vercel --prod
```

Žije na <https://vem-sisku-zachranis-sekacku.vercel.app>.
