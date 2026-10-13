#!/usr/bin/env python3
"""
A Család Kapitánya — jelenetgeneráló szkript (v5, 44 kép)

Legenerálja mind a 44 hajós jelenetet a Gemini API-n keresztül, és elmenti
őket a megfelelő fájlnévvel az images/scenes/ mappába. A 44 kép a (nem) ×
(van-e társ) × (nincs gyerek / kisbaba úton / van(nak) már gyereke(i)) ×
(időjárás) kombinációkból áll össze -- a "kisbaba" egy 2026 októberi
bővítés, külön jelenet (csecsemő egy kosárban), ami kölcsönösen kizárja a
"már van gyereke(i)" jelenetet (3 nagyobb gyerek).

KARAKTEREK KONZISZTENCIÁJA (arcok, ruhák)
------------------------------------------
Ahhoz, hogy a kapitány, a házastárs, a gyerekek és a kisbaba kinézete ne
változzon képről képre, a szkript NEM egymástól függetlenül generálja a
képeket, hanem egy FÜGGŐSÉGI SORRENDBEN (lásd build_generation_plan):

1. fázis -- "horgonyképek": minden (nem, társ, "dependent" állapot: nincs
   gyerek / kisbaba / gyerekek) kombóhoz legenerál egy "calm" (napos)
   verziót, mindig a korábban már elkészült, legközelebbi horgonyképet
   referenciaként csatolva a kéréshez (pl. a "kapitány + társ" horgonykép a
   "kapitány egyedül" horgonyképre hivatkozik, hogy ugyanaz az arc maradjon;
   a "kapitány + kisbaba" horgonykép szintén a "kapitány egyedül" képre).
2. fázis -- időjárás-variánsok: ugyanannak a kombónak a többi időjárását
   (cloudy/storm/tempest) a SAJÁT "calm" horgonyképére hivatkozva generálja,
   hiszen az már tartalmazza az összes odavaló szereplőt a helyes kinézettel.

Így a 44 képből csak 2 (a két "kapitány egyedül" horgonykép, nemenként egy)
készül referenciakép nélkül, tisztán szövegből -- a többi mind egy már
elkészült képre épül. Ha egy referenciakép valamiért hiányzik (pl. törölted,
vagy egy korábbi futás kihagyta hiba miatt), a szkript figyelmeztetést ír ki,
és referenciakép nélkül, tisztán szövegből generál helyette.

A szkript a már meglévő fájlokat alapértelmezésben kihagyja -- tehát ha a
28 eredeti kép már elkészült egy korábbi futásnál, egy újrafuttatás csak az
új 16 "kisbaba" képet fogja legenerálni, a meglévő 28-at nem érinti.

HASZNÁLAT
---------
1. Telepítsd a Google GenAI SDK-t:
       pip install -U google-genai

2. Állítsd be az API-kulcsot környezeti változóként (SOHA ne írd bele a kódba):
       export GEMINI_API_KEY="ide-jön-a-kulcsod"

   (A kulcs beszerzésének menetét lásd az API_KULCS_UTMUTATO.md fájlban.)

3. Futtasd a szkriptet a site gyökeréből vagy bárhonnan:
       python3 scripts/generate_scenes.py

   A szkript újra futtatható: a már meglévő fájlokat kihagyja, tehát ha
   félbeszakad vagy csak néhány képet akarsz újragenerálni, egyszerűen töröld
   azokat a images/scenes/ mappából, és futtasd újra. FONTOS: a függőségi
   sorrend miatt érdemes a szkriptet elejétől a végéig, megszakítás nélkül
   lefuttatni legalább egyszer, hogy minden horgonykép elkészüljön, mielőtt a
   rájuk épülő képeket generáljuk.

Opcionális kapcsolók:
    --force          minden képet újragenerál, még ha már létezik is
    --only crew-ferfi-1-3-storm   csak egy adott fájlnevet (kiterjesztés nélkül) generál
    --model NEV      más modell használata (alapértelmezett: gemini-nano-banana-2.1)
    --timeout N      hány másodpercig várjunk képenként (alapértelmezett: 90)
    --no-reference   kikapcsolja a referenciaképek csatolását (tiszta szöveges generálás)
    --dry-run        csak kiírja a promptokat, fájlneveket és referenciákat, API hívás nélkül

GYORS DIAGNOSZTIKA, ha egy kép sokáig "dolgozik" anélkül, hogy elkészülne:
    próbáld ki egy gyorsabb, kisebb modellel, hogy kiderüljön, a modell
    lassú-e jelenleg, vagy valami más (hálózat, proxy) akad el:

        python3 scripts/generate_scenes.py --only crew-ferfi-0-0-calm \\
            --model gemini-3.1-flash-lite-image --force
"""

import argparse
import concurrent.futures
import os
import sys
import time
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = SITE_ROOT / "images" / "scenes"

DEFAULT_MODEL = "gemini-nano-banana-2.1"

# Ha egy kép generálása ennyi másodpercnél tovább tart válasz nélkül,
# időtúllépésnek vesszük (elakadt kapcsolat, túlterhelt szerver stb.),
# hogy a szkript sose ragadjon be örökre egy válasz nélkül maradt hívásnál.
# Ez TÉNYLEGESEN megszakítja a kérést (lásd generate_image), nem csak a
# szkript belső várakozását -- ezért nem kell túl nagyra venni.
REQUEST_TIMEOUT_SECONDS = 90
# Ilyen gyakran írjuk ki, hogy "még dolgozik", amíg várunk a válaszra.
HEARTBEAT_SECONDS = 15

# Egyetlen háttérszálon futtatjuk a (blokkoló) API hívásokat, hogy a
# concurrent.futures.TimeoutError-ral meg lehessen szakítani a várakozást
# a fő szálon, anélkül, hogy a szkript végén meg kellene várni egy esetleg
# soha nem befejeződő kérést.
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

# ---------------------------------------------------------------------------
# Prompt-építőkockák (a claude/kepgeneralas-promptok-v5.md projektdokumentum
# alapján, szóról szóra)
# ---------------------------------------------------------------------------

BASE_STYLE = (
    "Festői, enyhén stilizált, realisztikus digitális illusztráció stílusban, ugyanaz "
    "a fából készült, háromárbócos vitorlás hajó látható, mint a korábbi képeken "
    "(ugyanaz a hajótest, vitorlázat, kötélzet, dísztornác). A kamera a hajó orrától "
    "kissé oldalról és alulról nézi a fedélzetet, a horizont a kép felső harmadában. "
    "Fekvő (16:9), nagy felbontású kép, filmszerű megvilágítás. Az emberi alakok "
    "élethű arányúak, nem karikatúraszerűek."
)

CAPTAIN = {
    "ferfi": (
        "A kormánykeréknél egy kb. 30-as éveiben járó férfi áll kapitányként: rövid "
        "sötétbarna haj, enyhe borosta, kék gombos ing feltűrt ujjakkal, magabiztos "
        "testtartás."
    ),
    "no": (
        "A kormánykeréknél egy kb. 30-as éveiben járó nő áll kapitányként: hosszú "
        "barna haj laza kontyba fogva, világos blúz, magabiztos testtartás."
    ),
}

# A kapitány párja -- a kapitány NEMÉTŐL függ (férfi kapitánynak felesége,
# nő kapitánynak férje van), nem a kitöltő saját nemétől.
SPOUSE_OF = {
    "ferfi": (
        "Mellette áll a felesége: hosszú barna haj, világos blúz, szeretetteljes "
        "testtartással a kapitány felé fordulva."
    ),
    "no": (
        "Mellette áll a férje: rövid sötétbarna haj, kék gombos ing, szeretetteljes "
        "testtartással a kapitány felé fordulva."
    ),
}

KIDS = (
    "A fedélzeten három gyerek: egy kb. 12 éves lány mustársárga pólóban, aki "
    "kitárt karral áll a hajóorrnál; egy kb. 8 éves fiú zöld galléros pólóban, aki "
    "a korlátba kapaszkodik; és egy kb. 4 éves copfos kislány világos ruhában, aki "
    "a szülők közelében áll."
)

# A "kisbaba" (2. kérdés "Nincs, de szeretnék" válasza) külön jelenet: egy
# csecsemő egy kosárban, NEM a már meglévő 3 nagyobb gyerek (KIDS) helyett
# generálva, hanem azzal kölcsönösen kizáró, önálló "dependent" állapotként.
BABY = (
    "A fedélzeten egy csecsemő fekszik egy fonott mózeskosárban, puha, világos "
    "takaróval betakarva, biztonságos helyen, a felnőtt(ek) közelében elhelyezve. "
    "Nincs más gyerek a fedélzeten, csak ez az egy csecsemő a kosárban."
)

WEATHER = {
    "calm": (
        "Napos, nyugodt időjárás: kék ég, szétszórt bárányfelhők, nyugodt, "
        "csillogó víz, a hajó egyenesen, stabilan áll."
    ),
    "cloudy": (
        "Felhős, enyhén szeles idő: szürkés-kékes ég, sűrűsödő felhők, kissé "
        "hullámzóbb víz, a hajó enyhén megdől."
    ),
    "storm": (
        "Viharos idő: sötét, viharfelhős ég, erős hullámok, szakadó eső, a hajó "
        "oldalra dől, a vitorlák megfeszülnek a szélben."
    ),
    "tempest": (
        "Pusztító vihar: koromsötét égbolt, villámlás, hatalmas hullámok csapnak "
        "át a fedélzeten, heves eső, a hajó veszélyesen megdől, drámai, feszült "
        "hangulat."
    ),
}

GENDERS = ["ferfi", "no"]
WEATHERS_FULL = ["calm", "cloudy", "storm", "tempest"]
WEATHERS_ALONE = ["calm", "cloudy"]  # egyedülálló, gyerek nélküli kombónál ennyi elég

# Ezt a mondatot fűzzük a prompt elé, amikor van csatolt referenciakép, hogy a
# modellt kifejezetten a szereplők kinézetének megtartására utasítsuk.
REFERENCE_INSTRUCTION = (
    "FONTOS: a mellékelt referenciakép(ek)en látható szereplő(k) kinézetét "
    "(arc, frizura, ruházat) PONTOSAN ugyanúgy, változtatás nélkül tartsd meg "
    "ezen az új képen is -- ugyanazok a személyek, csak az alábbiak szerint "
    "megváltozott jelenetben/időjárásban. Ne rajzolj más arcú vagy más ruhájú "
    "szereplőket."
)


def dependent_code(dependent: str) -> str:
    """A 'dependent' ("none"/"baby"/"kids") állapotot a fájlnévben használt
    kódra fordítja -- ugyanaz a séma, mint a js/main.js sceneFilename()-je."""
    return {"none": "0", "baby": "baby", "kids": "3"}[dependent]


def build_prompt(gender: str, spouse: bool, dependent: str, weather: str) -> str:
    """Összerakja a teljes promptot a doksiban rögzített minta szerint.

    A 'dependent' egyike: "none" (nincs gyerek/kisbaba), "baby" (kisbaba
    kosárban a fedélzeten -- a 2. kérdés "Nincs, de szeretnék" válasza) vagy
    "kids" (3 nagyobb gyerek -- a 2. kérdés "Egy vagy több" válasza). A kettő
    egymást kölcsönösen kizárja.
    """
    parts = [BASE_STYLE]

    if not spouse and dependent == "none":
        parts.append("A fedélzeten egyedül áll a kapitány.")
        parts.append(CAPTAIN[gender])
        parts.append("Senki más nincs a fedélzeten.")
    else:
        parts.append(CAPTAIN[gender])
        if spouse:
            parts.append(SPOUSE_OF[gender])
        else:
            parts.append("Nincs házastárs/élettárs a fedélzeten.")
        if dependent == "kids":
            parts.append(KIDS)
        elif dependent == "baby":
            parts.append(BABY)
        else:
            parts.append("Nincs gyerek a fedélzeten.")

    parts.append(WEATHER[weather])
    return " ".join(parts)


def build_generation_plan():
    """Visszaadja mind a 44 kép tervét FÜGGŐSÉGI SORRENDBEN (28 eredeti +
    16 új "kisbaba" jelenet).

    Minden elem: (gender, spouse, dependent, weather, filename, reference_filenames)
    ahol a reference_filenames egy lista a MÁR (korábban a listában) elkészült
    képek fájlneveiből, amiket referenciaként kell csatolni a kéréshez, hogy a
    szereplők kinézete konzisztens maradjon. Mivel a szkript a már meglévő
    fájlokat alapértelmezésben kihagyja (lásd main()), egy korábbi futás 28
    kész képe mind megmarad, és csak az új 16 "baby" kép generálódik le --
    azok pedig a MÁR KÉSZ "egyedül" / "+ társ" horgonyképekre hivatkoznak,
    tehát ugyanaz az arc kerül rájuk, mint a többi 28 képre.
    """
    plan = []
    for gender in GENDERS:
        def fname(spouse: bool, dependent: str, weather: str, gender=gender) -> str:
            s = 1 if spouse else 0
            return f"crew-{gender}-{s}-{dependent_code(dependent)}-{weather}.jpg"

        anchor_alone = fname(False, "none", "calm")
        anchor_spouse = fname(True, "none", "calm")
        anchor_kids_solo = fname(False, "kids", "calm")
        anchor_family = fname(True, "kids", "calm")
        anchor_baby_solo = fname(False, "baby", "calm")
        anchor_baby_family = fname(True, "baby", "calm")

        # 1. fázis -- horgonyképek (mindig "calm"), egymásra épülő
        # referenciákkal, hogy a kapitány/társ/gyerekek/kisbaba kinézete
        # átöröklődjön:
        #   egyedül (nincs referencia -- ez rögzíti a kapitány "mesterarcát")
        #   -> + társ (a "egyedül" képre hivatkozva)
        #   -> + gyerekek, társ nélkül (az "egyedül" képre hivatkozva)
        #   -> + társ ÉS gyerekek (a "+ társ" képre hivatkozva, ahhoz ad gyerekeket)
        #   -> + kisbaba, társ nélkül (az "egyedül" képre hivatkozva)
        #   -> + társ ÉS kisbaba (a "+ társ" képre hivatkozva, ahhoz ad kisbabát)
        plan.append((gender, False, "none", "calm", anchor_alone, []))
        plan.append((gender, True, "none", "calm", anchor_spouse, [anchor_alone]))
        plan.append((gender, False, "kids", "calm", anchor_kids_solo, [anchor_alone]))
        plan.append((gender, True, "kids", "calm", anchor_family, [anchor_spouse]))
        plan.append((gender, False, "baby", "calm", anchor_baby_solo, [anchor_alone]))
        plan.append((gender, True, "baby", "calm", anchor_baby_family, [anchor_spouse]))

        # 2. fázis -- ugyanazon kombók többi időjárása, mindig a SAJÁT "calm"
        # horgonyképükre hivatkozva (az már tartalmazza az összes odavaló
        # szereplőt a helyes kinézettel):
        combos = [
            (False, "none", anchor_alone),
            (True, "none", anchor_spouse),
            (False, "kids", anchor_kids_solo),
            (True, "kids", anchor_family),
            (False, "baby", anchor_baby_solo),
            (True, "baby", anchor_baby_family),
        ]
        for spouse, dependent, anchor in combos:
            weathers = WEATHERS_FULL if (spouse or dependent != "none") else WEATHERS_ALONE
            for weather in weathers:
                if weather == "calm":
                    continue  # ez már megvan az 1. fázisban
                filename = fname(spouse, dependent, weather)
                plan.append((gender, spouse, dependent, weather, filename, [anchor]))
    return plan


def build_contents(prompt: str, reference_images: list[bytes]):
    """Összeállítja a generate_content hívás 'contents' paraméterét. Ha vannak
    referenciaképek, azokat is csatolja, és egy kiegészítő instrukciót fűz a
    prompt elé, hogy a modell megtartsa a szereplők kinézetét."""
    if not reference_images:
        return [prompt]

    from google.genai import types

    contents = [REFERENCE_INSTRUCTION]
    for ref_bytes in reference_images:
        contents.append(types.Part.from_bytes(data=ref_bytes, mime_type="image/jpeg"))
    contents.append(prompt)
    return contents


def generate_image(
    client, model: str, prompt: str, timeout_seconds: int, reference_images: list[bytes]
) -> bytes:
    """Lefuttatja a Gemini API hívást, és visszaadja a kép nyers bájtjait.

    MEGJEGYZÉS: korábban az újabb "Interactions API"-t (client.interactions.create)
    használtuk, de az konzisztensen percekig lógott ezen a hálózaton, miközben a
    sima REST végpontok (pl. modellek listázása) másodtöredék alatt válaszoltak.
    Mivel az Interactions API vadonatúj, és nem lehetett kideríteni, hogy a
    lassúság a szolgáltatás oldalán van-e, átálltunk a sokkal régebb óta éles,
    szélesebb körben használt és jobban dokumentált client.models.generate_content()
    hívásra, ugyanazokkal a képmodellekkel.
    """
    from google.genai import types

    contents = build_contents(prompt, reference_images)

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="16:9"),
            # A timeout itt ms-ben kell -- ez a hívás-szintű HTTP timeout,
            # ami tényleg megszakítja a kérést, ha nem jön válasz időben.
            http_options=types.HttpOptions(timeout=timeout_seconds * 1000),
        ),
    )

    for part in response.parts:
        if part.inline_data is not None and part.inline_data.data:
            return part.inline_data.data

    raise RuntimeError(
        "A válasz nem tartalmazott képet (lehet, hogy a modell szöveges "
        "választ vagy biztonsági elutasítást adott vissza helyette)."
    )


def generate_image_with_timeout(
    client, model: str, prompt: str, timeout_seconds: int, reference_images: list[bytes]
) -> bytes:
    """Ugyanaz, mint generate_image, de közbenső folyamatjelzéssel, hogy sose
    álljon ott a szkript némán percekig anélkül, hogy látnánk, dolgozik-e még
    valami. Az itt átadott timeout_seconds a TÉNYLEGES hálózati időkorlát
    (lásd generate_image) -- ez a wrapper csak a heartbeat-kiírásokért felel,
    nem szab plusz saját korlátot."""
    future = _executor.submit(generate_image, client, model, prompt, timeout_seconds, reference_images)
    waited = 0
    while True:
        try:
            return future.result(timeout=HEARTBEAT_SECONDS)
        except concurrent.futures.TimeoutError:
            waited += HEARTBEAT_SECONDS
            print(f"     ...még dolgozik a szerver ({waited}s telt el)", flush=True)
            # Egy kis ráhagyás (+HEARTBEAT_SECONDS) a tényleges hálózati
            # timeout fölé, hogy annak legyen ideje magától lefutni és egy
            # értelmes hibát visszaadni, mielőtt mi feladnánk a várakozást.
            if waited >= timeout_seconds + HEARTBEAT_SECONDS:
                raise


def main():
    parser = argparse.ArgumentParser(description="A Család Kapitánya jelenetgeneráló")
    parser.add_argument("--force", action="store_true", help="meglévő fájlok felülírása is")
    parser.add_argument("--only", help="csak egy adott fájlnév (kiterjesztés nélkül) legenerálása")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Gemini modell neve")
    parser.add_argument(
        "--timeout",
        type=int,
        default=REQUEST_TIMEOUT_SECONDS,
        help=f"hány másodpercig várjunk képenként, mielőtt időtúllépésnek vesszük (alap: {REQUEST_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--no-reference",
        action="store_true",
        help="kikapcsolja a referenciaképek csatolását (tiszta szöveges generálás, mint korábban)",
    )
    parser.add_argument("--dry-run", action="store_true", help="csak a promptok kiírása, API hívás nélkül")
    args = parser.parse_args()

    plan = build_generation_plan()
    if args.only:
        plan = [p for p in plan if p[4].removesuffix(".jpg") == args.only]
        if not plan:
            print(f"Nincs ilyen nevű kombináció: {args.only}")
            sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        for gender, spouse, dependent, weather, filename, reference_filenames in plan:
            prompt = build_prompt(gender, spouse, dependent, weather)
            print(f"--- {filename} ---")
            if reference_filenames and not args.no_reference:
                print(f"    referencia(k): {', '.join(reference_filenames)}")
            else:
                print("    referencia: nincs")
            print(prompt)
            print()
        print(f"Összesen {len(plan)} kép (dry-run, nincs API hívás).")
        return

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "HIBA: nincs beállítva a GEMINI_API_KEY környezeti változó.\n"
            "Futtasd előtte: export GEMINI_API_KEY=\"ide-jön-a-kulcsod\"\n"
            "(A kulcs beszerzésének menetét lásd az API_KULCS_UTMUTATO.md fájlban.)"
        )
        sys.exit(1)

    try:
        from google import genai
    except ImportError:
        print("HIBA: a google-genai csomag nincs telepítve. Futtasd: pip install -U google-genai")
        sys.exit(1)

    client = genai.Client()  # automatikusan beolvassa a GEMINI_API_KEY-t

    done = 0
    skipped = 0
    failed = []

    for gender, spouse, dependent, weather, filename, reference_filenames in plan:
        out_path = OUTPUT_DIR / filename

        if out_path.exists() and not args.force:
            print(f"[KIHAGYVA, már létezik] {filename}")
            skipped += 1
            continue

        # Referenciaképek beolvasása lemezről (ha vannak, és nincs kikapcsolva).
        reference_images: list[bytes] = []
        if reference_filenames and not args.no_reference:
            for ref_name in reference_filenames:
                ref_path = OUTPUT_DIR / ref_name
                if ref_path.exists():
                    reference_images.append(ref_path.read_bytes())
                else:
                    print(
                        f"  (figyelem: a referenciakép '{ref_name}' még nem létezik, "
                        f"ennél a képnél referencia nélkül, tisztán szövegből generálok)"
                    )

        prompt = build_prompt(gender, spouse, dependent, weather)
        ref_note = f" [{len(reference_images)} referenciaképpel]" if reference_images else ""
        print(f"[GENERÁLÁS] {filename}{ref_note} ...", flush=True)

        attempt = 0
        while True:
            attempt += 1
            try:
                image_bytes = generate_image_with_timeout(
                    client, args.model, prompt, args.timeout, reference_images
                )
                out_path.write_bytes(image_bytes)
                print(f"  -> mentve: {out_path}")
                done += 1
                break
            except concurrent.futures.TimeoutError:
                if attempt <= 2:
                    print(
                        f"  -> időtúllépés {args.timeout}s után, "
                        f"újrapróbálom (próba {attempt}/2)...",
                        flush=True,
                    )
                    continue
                print(
                    f"  -> ismételt időtúllépés, kihagyva ezt a képet "
                    f"(futtasd újra később: --only {filename.removesuffix('.jpg')})"
                )
                failed.append(filename)
                break
            except Exception as exc:  # noqa: BLE001 -- szándékosan tág, hogy a ciklus ne álljon le
                message = str(exc)
                is_rate_limit = "429" in message or "rate" in message.lower()
                if is_rate_limit and attempt <= 3:
                    wait = 15 * attempt
                    print(f"  -> rate limit, várakozás {wait} másodpercet (próba {attempt}/3)...", flush=True)
                    time.sleep(wait)
                    continue
                print(f"  -> HIBA ennél a képnél, kihagyva: {message}")
                failed.append(filename)
                break

        # Udvarias kis szünet a hívások között, hogy ne lépjük túl a rate limitet.
        time.sleep(2)

    print()
    print(f"Kész: {done} legenerálva, {skipped} kihagyva (már létezett), {len(failed)} sikertelen.")
    if failed:
        print("Sikertelen fájlok:")
        for f in failed:
            print(f"  - {f}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(
            "\nMegszakítva. A már elkészült képek megmaradtak — bármikor "
            "futtasd újra a szkriptet, ott folytatja, ahol abbamaradt."
        )
        sys.exit(130)
