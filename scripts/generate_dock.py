#!/usr/bin/env python3
"""
A Család Kapitánya — a kikötő-kép (hero-dock.jpg) újragenerálása az új
képstílusban.

A korábbi hero-dock.jpg még a v5 (28 jelenetes) sorozat előtti, más stílusú
képgenerálásból származott. Ez a szkript a már elkészült "kapitány egyedül"
horgonyképre (crew-ferfi-0-0-calm.jpg) hivatkozva generálja újra -- így
ugyanaz a hajótest/vitorlázat/stílus látszódik, csak üresen, kikötve, hogy
illeszkedjen a 28 jelenethez.

Ez a hajó-indulás előtti, kezdőképernyőn megjelenő kép (lásd js/main.js
showDock()) -- egészen addig látszik, amíg a kitöltő meg nem válaszolja a
0. (nem) kérdést.

HASZNÁLAT
---------
    python3 scripts/generate_dock.py

Ugyanazokat a környezeti változókat igényli, mint a generate_scenes.py:
    export GEMINI_API_KEY="ide-jön-a-kulcsod"
(lásd API_KULCS_UTMUTATO.md)

Opcionális kapcsolók:
    --model NEV      más modell használata (alapértelmezett: gemini-nano-banana-2.1)
    --timeout N      hány másodpercig várjunk, mielőtt időtúllépésnek vesszük (alap: 90)
    --no-reference   kikapcsolja a referenciakép csatolását
    --dry-run        csak a promptot írja ki, API hívás nélkül
"""

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_scenes import (  # noqa: E402
    BASE_STYLE,
    DEFAULT_MODEL,
    OUTPUT_DIR,
    REQUEST_TIMEOUT_SECONDS,
    generate_image_with_timeout,
)
import concurrent.futures  # noqa: E402

DOCK_PROMPT = (
    BASE_STYLE
    + " A hajó teljesen üresen áll, senki nincs a fedélzetén -- sem a "
    "kapitány, sem utasok. A hajó egy kikötőben/mólónál van kikötve "
    "(kötelekkel a kikötőbakokhoz rögzítve), nem a nyílt vízen. Napos, "
    "nyugodt időjárás, kék ég, néhány bárányfelhő, csendes víz. Néhány "
    "sirály látható a háttérben. Nyugodt, békés hangulat, mintha az "
    "utazás még nem kezdődött volna el."
)

REFERENCE_FILENAME = "crew-ferfi-0-0-calm.jpg"
OUTPUT_FILENAME = "hero-dock.jpg"


def main():
    parser = argparse.ArgumentParser(description="Kikötő-kép (hero-dock.jpg) generálása")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Gemini modell neve")
    parser.add_argument(
        "--timeout",
        type=int,
        default=REQUEST_TIMEOUT_SECONDS,
        help=f"hány másodpercig várjunk, mielőtt időtúllépésnek vesszük (alap: {REQUEST_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--no-reference", action="store_true", help="kikapcsolja a referenciakép csatolását"
    )
    parser.add_argument("--dry-run", action="store_true", help="csak a prompt kiírása, API hívás nélkül")
    args = parser.parse_args()

    if args.dry_run:
        print(f"--- {OUTPUT_FILENAME} ---")
        print(f"referencia: {REFERENCE_FILENAME if not args.no_reference else 'nincs'}")
        print(DOCK_PROMPT)
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

    client = genai.Client()

    reference_images: list[bytes] = []
    ref_path = OUTPUT_DIR / REFERENCE_FILENAME
    if not args.no_reference:
        if ref_path.exists():
            reference_images.append(ref_path.read_bytes())
        else:
            print(
                f"(figyelem: a referenciakép '{REFERENCE_FILENAME}' nem található, "
                f"referencia nélkül, tisztán szövegből generálok)"
            )

    out_path = OUTPUT_DIR / OUTPUT_FILENAME
    ref_note = f" [{len(reference_images)} referenciaképpel]" if reference_images else ""
    print(f"[GENERÁLÁS] {OUTPUT_FILENAME}{ref_note} ...", flush=True)

    attempt = 0
    while True:
        attempt += 1
        try:
            image_bytes = generate_image_with_timeout(
                client, args.model, DOCK_PROMPT, args.timeout, reference_images
            )
            out_path.write_bytes(image_bytes)
            print(f"-> mentve: {out_path}")
            break
        except concurrent.futures.TimeoutError:
            if attempt <= 2:
                print(f"-> időtúllépés {args.timeout}s után, újrapróbálom (próba {attempt}/2)...", flush=True)
                continue
            print("-> ismételt időtúllépés, próbáld újra futtatni a szkriptet később.")
            sys.exit(1)
        except Exception as exc:  # noqa: BLE001
            message = str(exc)
            is_rate_limit = "429" in message or "rate" in message.lower()
            if is_rate_limit and attempt <= 3:
                wait = 15 * attempt
                print(f"-> rate limit, várakozás {wait} másodpercet (próba {attempt}/3)...", flush=True)
                time.sleep(wait)
                continue
            print(f"-> HIBA: {message}")
            sys.exit(1)


if __name__ == "__main__":
    main()
