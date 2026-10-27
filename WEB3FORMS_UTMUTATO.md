# Web3Forms access key igénylése — lépésről lépésre

A `contact.html` konzultációs űrlapja már elő van készítve a **Web3Forms**
ingyenes szolgáltatásra — ez küldi el emailben a beérkező kéréseket, nincs
szükség saját szerverre/backendre. Csak egy hiányzó darab van: az
**access key**, amit a te email címedhez kötve kell létrehozni.

## 1. Nyisd meg a Web3Forms oldalát

Menj a `https://web3forms.com` címre.

## 2. Add meg az email címed

A főoldalon található mezőbe írd be azt az email címet, ahova a beérkező
konzultációs kéréseket (név, email, telefonszám, üzenet) szeretnéd kapni.

## 3. Kérd ki a kulcsot

Kattints a **"Create Access Key"** (vagy "Get Access Key") gombra. A
rendszer egy visszaigazoló emailt küld — nyisd meg, és ha kéri, erősítsd
meg az email címet.

## 4. Másold ki az access key-t

Egy hosszú, egyedi karakterlánc jelenik meg, UUID-szerű formátumban (pl.
`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Ezt a kulcsot kell majd a
`contact.html`-be beilleszteni.

> A kulcs nem igazi "titok" abban az értelemben, hogy statikus weboldalaknál
> eleve a böngészőben, a HTML forráskódban van — pont ezért van kitalálva
> erre a célra (a Web3Forms szerverei ellenőrzik, hova mehet az adat). Nem
> kell külön rejtegetni, de nyilvánosan sem kell kitenni feleslegesen (pl.
> fórumba, közösségi médiába).

## 5. Add meg nekem a kulcsot

Amint megvan, írd be ide a chatbe (vagy küldd el bármilyen formában), és én
rögtön:
- beillesztem a `contact.html` `access_key` mezőjébe (a jelenlegi
  `YOUR_ACCESS_KEY_HERE` helyére),
- elküldöm neked a frissített fájlt, és
- átmásolom a gépedre a `family-captain` mappába, hogy a következő `git
  push`-nál már élesben is működjön a form.

## Költség és limitek

A Web3Forms ingyenes csomagja jelenleg havi 250 beküldést tesz lehetővé
(ez bőven elég egy induló konzultációs formhoz) — ha ennél többre lenne
szükség később, fizetős csomagjaik is vannak, de ezzel most nem kell
foglalkozni.
