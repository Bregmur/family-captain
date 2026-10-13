# Gemini API-kulcs igénylése — lépésről lépésre

Ez a kulcs kell ahhoz, hogy a `generate_scenes.py` szkript helyetted le tudja
generálni mind a 28 képet. **A kulcsot soha ne írd bele kódba vagy ne oszd meg
nyilvánosan** — csak a saját gépeden, környezeti változóként tárold.

## 1. Nyisd meg az AI Studio kulcskezelő oldalát

Menj a `https://aistudio.google.com/apikey` címre, és jelentkezz be a Google
fiókoddal (ugyanazzal, amivel eddig a Gemini appot használtad).

## 2. Fogadd el a feltételeket

Első belépéskor el kell fogadnod a Gemini API használati feltételeit.

## 3. Projekt létrehozása / importálása

- Ha ez az első API-kulcsod: az AI Studio automatikusan létrehoz neked egy
  alapértelmezett Google Cloud projektet, nincs több teendő.
- Ha már van Google Cloud projekted, és azt szeretnéd használni: a
  "Projektek importálása" (Import projects) menüponttal kapcsold össze a
  meglévő projektedet, mielőtt kulcsot hoznál létre.

## 4. Kulcs létrehozása

Kattints a **"Create API key"** (Kulcs létrehozása) gombra. A megjelenő
kulcsot (egy hosszú, `AIza`-val kezdődő karaktersor) másold ki.

> Ha a gomb inaktív: valószínűleg nincs elég jogosultságod ("Editor" szerepkör
> szükséges) a kiválasztott Google Cloud projekten. Válassz egy másik, saját
> tulajdonú (nem céges/szervezeti) projektet, vagy hozz létre egy újat.

## 5. Mentsd el környezeti változóként

**Ne** illeszd be a kulcsot közvetlenül a szkriptbe. Ehelyett a terminálban
(a gép, amin futtatni fogod a szkriptet) add ki ezt a parancsot:

```bash
export GEMINI_API_KEY="ide-másold-a-kulcsot"
```

Ez csak az adott terminál-munkamenetre érvényes. Ha azt szeretnéd, hogy minden
új terminálban elérhető legyen, add hozzá a `~/.zshrc` (Mac) vagy `~/.bashrc`
fájlodhoz ugyanezt a sort, majd nyiss új terminált.

## 6. Telepítsd a szükséges Python csomagot

```bash
pip install -U google-genai
```

## 7. Futtasd a szkriptet

```bash
cd family-captain   # vagy ahova a repót klónoztad
python3 scripts/generate_scenes.py
```

A szkript a `images/scenes/` mappába menti a 28 képet, a megfelelő
fájlnevekkel (`crew-ferfi-1-3-storm.jpg` stb.), és a már meglévő fájlokat nem
írja felül — tehát bármikor biztonságosan újrafuttatható.

### Hasznos kapcsolók

```bash
# Csak kiírja a 28 promptot, API hívás nélkül (ellenőrzéshez):
python3 scripts/generate_scenes.py --dry-run

# Csak egy adott képet generál újra:
python3 scripts/generate_scenes.py --only crew-no-1-3-tempest --force

# Minden képet újragenerál, még a meglévőket is felülírva:
python3 scripts/generate_scenes.py --force
```

## Költség és mennyiség

28 kép egyszeri legenerálása képmodellenként általában pár dolláros
nagyságrendű költség (a pontos ár a kiválasztott modelltől függ — az AI
Studio / Gemini API árazási oldala mutatja az aktuális díjakat). Ha csak
néhány képet akarsz kipróbálni előbb, használd a `--only` kapcsolót.

## Batch Mode (ha a jövőben sokkal több képet akarnál generálni)

A Gemini API-nak van egy formális, aszinkron **Batch Mode** funkciója is,
ami nagy mennyiségű (több száz/ezer) kérés esetén kb. feleannyiba kerül, de
akár 24 órát is igénybe vehet, amíg elkészül. 28 képhez ez felesleges
bonyodalom — a fenti egyszerű, soros szkript bőven elég és percek alatt
végez. Ha később (pl. több nyelvi verzióhoz vagy több karaktervariánshoz)
százasával kellene kép, szólj, és megírom a Batch Mode-ra épülő verziót is.
