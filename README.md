# Vem šišku, zachrániš kosačku 🌲🧺

Pokojná záhradná webová simulácia. Pod ihličnatým stromom je samá šiška a
robotická kosačka sa kvôli nim nepohne. Pozbieraj všetky šišky – a pusti
kosačku, nech pokosí trávnik. Kmotrov každodenný rituál v prehliadači.

Inšpirované [screen.toys/firewood](https://screen.toys/firewood/), ale namiesto
sekania dreva tu **zbieraš šišky zo záhrady**.

## Ako sa hrá

- **Klikni** na šišku alebo **prejdi prstom / ťahaj myšou** po šiškách a pozbieraj ich.
- Keď je trávnik čistý, robotická kosačka sa rozbehne a pokosí ho.
- Začne nový deň – spod stromu napadá ďalšia dávka šišiek. 🌿

## Vlastnosti

- Čisté HTML5 `<canvas>` – **bez závislostí**, žiadny build krok.
- Plne responzívne (mobil aj desktop), podpora dotyku aj myši.
- Plynulá grafika: ráno v záhrade, hojdajúci sa strom, oblaky, čiastočky svetla,
  „roztomilá“ robotická kosačka a uspokojivé zbieranie s časticami a zvukom.
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

Žije na <https://vem-sisku-zachranis-kosacku.vercel.app>.
