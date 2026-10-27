// ============================================================
// A CSALÁD KAPITÁNYA — quiz + realistic scene engine
// v5: bővített, 9-10 lépéses kérdéssor (a doksi szerint), a 0. kérdés a
//     kitöltő nemét kéri el -- eddig az üres, kikötőben álló hajót látjuk
//     --, és minden jelenet (egyedül / társsal / gyerekkel) külön férfi és
//     női főszereplővel készül. A 2/3. kérdés opcionális, csak akkor
//     jelenik meg, ha már van gyermeke a kitöltőnek. Az 5. és a 4. kérdésnél
//     több válasz is kiválasztható (checkbox-szerű gombok + "Tovább" gomb).
//     A 2. kérdés "kisbaba" válasza egy külön ("baby") jelenetet jelenít
//     meg -- csecsemő egy kosárban a fedélzeten --, elkülönítve a "van már
//     gyermekem" (3 nagyobb gyerek) jelenettől.
// ============================================================

// Minden kérdés tartalmazhat egy "flag"-et, ami a hajó legénységét (nem,
// társ, gyerek) állítja be a pontozás mellett -- ezek alapján választja ki
// a motor a megfelelő jelenetképet.
const questions = [
    {
        id: "gender",
        label: "0. kérdés",
        question: "Férfi vagy nő vagy?",
        flag: "gender",
        answers: [
            { text: "Férfi", points: 0, value: "ferfi" },
            { text: "Nő", points: 0, value: "no" }
        ]
    },
    {
        id: "spouse",
        label: "1. kérdés",
        question: "Van-e élettársad, házastársad?",
        flag: "spouse",
        answers: [
            { text: "Van", points: 2, value: true },
            { text: "Nincs", points: 0, value: false }
        ]
    },
    {
        id: "kids",
        label: "2. kérdés",
        question: "Van gyermeked?",
        flag: "kids",
        answers: [
            { text: "Nincs és nem is akarok", points: 0, value: false },
            { text: "Nincs, de szeretnék (kisbaba)", points: 1, value: false, baby: true },
            { text: "Egy vagy több", points: 4, value: true }
        ]
    },
    {
        id: "kidsImportance",
        label: "2/3. kérdés (opcionális)",
        question: "Mennyire fontos neked, hogy a gyermeked jövője biztonságban legyen?",
        // Csak azoknak jelenik meg, akiknek már van gyermekük -- a szöveg
        // meglévő gyermekre utal ("a gyermeked jövője").
        showIf: (state) => state.kids === true,
        answers: [
            { text: "Mindennél fontosabb", points: 3 },
            { text: "Fontos", points: 1 },
            { text: "Nem annyira fontos", points: 0 }
        ]
    },
    {
        id: "home",
        label: "3. kérdés",
        question: "Van-e saját otthonotok?",
        answers: [
            { text: "Igen és tehermentes", points: 0 },
            { text: "Igen, de sajnos hitellel terhelt", points: 3 },
            { text: "Nincs, de tervben van, és kelleni fog a hitel hozzá", points: 3 },
            { text: "Soha nem is lesz, maradunk az albérletnél", points: 2 }
        ]
    },
    {
        id: "loan",
        label: "4. kérdés",
        question: "Milyen más hiteled van jelenleg?",
        hint: "Több válasz is kiválasztható.",
        multi: true,
        answers: [
            { text: "Autóhitel", points: 2 },
            { text: "Személyi hitel", points: 3 },
            { text: "Tartozás valakinek", points: 2 },
            { text: "Nincs", points: 0 },
            { text: "Jelenleg nincs, de tervben van", points: 1 }
        ]
    },
    {
        id: "events",
        label: "5. kérdés",
        question: "Milyen váratlan esemény történhet veled?",
        hint: "Több válasz is kiválasztható.",
        multi: true,
        answers: [
            { text: "Közúti, otthoni vagy munkahelyi baleset", points: 2 },
            { text: "Szívinfarktus (stroke)", points: 3 },
            { text: "Daganatos diagnózis", points: 3 },
            { text: "Egy reggeli rosszullétből komoly diagnózis", points: 3 },
            { text: "Porckorong sérv (beállt derék)", points: 1 },
            { text: "Tervezett műtét utáni komolyabb komplikáció", points: 2 },
            { text: "Gyermekkel vagy közeli hozzátartozóval kapcsolatos krízis", points: 2 }
        ]
    },
    {
        id: "runway",
        label: "6. kérdés",
        question: "Ha holnap kiesne a jövedelmed, a család hány hónapig tudná fenntartani a jelenlegi életszínvonalukat?",
        answers: [
            { text: "Semeddig", points: 5 },
            { text: "1-2 hónap", points: 4 },
            { text: "3-6 hónap", points: 2 },
            { text: "6-12 hónap", points: 1 },
            { text: "Nem okozna problémát, mert van életbiztosításom", points: 0 }
        ]
    },
    {
        id: "horizon",
        label: "7. kérdés",
        question: "Ha a legrosszabb történne meg veled, vagyis hogy nem mész többet haza, mennyi ideig szeretnéd a családod anyagilag biztonságban tudni?",
        answers: [
            { text: "1 év", points: 1 },
            { text: "2 év", points: 2 },
            { text: "3 év", points: 3 },
            { text: "4 év", points: 4 },
            { text: "5 év", points: 5 }
        ]
    },
    {
        id: "safetyNet",
        label: "8. kérdés",
        question: "Van-e a családnak hosszútávú pénzügyi, biztonsági hálója?",
        answers: [
            { text: "Van", points: 0 },
            { text: "Van, de szeretném átnézni, hogy a mai igényeinket is szolgálja-e", points: 1 },
            { text: "Nincs, de szeretnék", points: 3 },
            { text: "Nincs, de jó lenne átbeszélni egy szakértővel", points: 3 },
            { text: "Még nem gondolkodtam rajta", points: 4 }
        ]
    }
];

// A normalizáláshoz (0-100%) használt elméleti maximum -- a többválasztós
// kérdésnél az ÖSSZES opció pontja beleszámít (hiszen mindegyik kiválasztható
// egyszerre), a többinél csak a legmagasabb pontú válasz.
const MAX_POINTS = questions.reduce((sum, q) => {
    if (q.multi) {
        return sum + q.answers.reduce((s, a) => s + a.points, 0);
    }
    return sum + Math.max(...q.answers.map(a => a.points));
}, 0);

// RISK TIERS
const TIERS = [
    {
        key: "safe",
        threshold: 0,
        title: "STABIL VIZEKEN",
        status: "A hajó egyenesen áll, a családod védett.",
        summary: "A hajód jelenleg stabilan halad. A felelősséged még kicsi, de érdemes már most átgondolni, mi történne, ha hirtelen irányt kellene váltanod."
    },
    {
        key: "watch",
        threshold: 0.25,
        title: "VESZÉLYEZTETETT?",
        status: "A hajó enyhén megdőlt.",
        summary: "Egyre többen és több minden utazik a fedélzeteden. A hajód még bírja a széllökéseket, de egy komolyabb vihar már megingatná."
    },
    {
        key: "warn",
        threshold: 0.5,
        title: "VESZÉLYEZTETETT!",
        status: "A hajó erősen süllyed a hiányos védelem miatt.",
        summary: "A családod jelentős felelősséget hordoz — gyerekek, hitel, vagy hiányzó tartalék —, miközben a védelem hiányos. Érdemes minél előbb megerősíteni a hajótestet."
    },
    {
        key: "danger",
        threshold: 0.75,
        title: "KOCKÁZATOS!",
        status: "Azonnali cselekvés szükséges.",
        summary: "A hajód komoly terhet visz, biztosítás nélkül. Ha most jönne a vihar, a családod védtelenül nézne szembe vele. Egy szakértői konzultáció most a legfontosabb lépés."
    }
];

// Weather buckets (independent of crew) — a 4 real-art stage.
const WEATHER_THRESHOLDS = [0, 0.25, 0.5, 0.75]; // idx 0..3
const WEATHER_KEYS = ["calm", "cloudy", "storm", "tempest"];

let currentQuestion = 0;
let totalPoints = 0;

// Minden megválaszolt kérdésnél feljegyezzük a kiválasztott válasz(ok)
// szövegét (kérdés id szerint kulcsolva) -- ez teszi lehetővé, hogy a záró
// összegzés (showSummary) személyre szabottan, a tényleges válaszokra
// hivatkozva vezessen a konzultáció felé.
const selectedAnswers = {};

// Legénység állapota -- élőben frissül, ahogy a nem/társ/gyerek kérdésekre
// válaszol a kitöltő.
const state = {
    started: false,
    gender: null,   // "ferfi" | "no" -- a 0. kérdésig null, addig csak a dokk látszik
    spouse: false,
    kids: false,    // van(nak) már (nagyobb) gyermeke(i)
    baby: false     // nincs még gyermeke, de szeretne (kisbaba a fedélzeten)
};

// A "kids" és "baby" állapotból egy egységes "dependent" kódot számol, amit
// a jelenetválasztó függvények használnak -- "kids" elsőbbséget élvez, ha
// valamiért mindkettő igaz lenne (nem fordulhat elő a jelenlegi kérdéseknél,
// de így biztonságosabb).
function currentDependent() {
    if (state.kids) return "kids";
    if (state.baby) return "baby";
    return "none";
}

const heroEl = document.getElementById("hero");
const introEl = document.getElementById("intro");
const quizEl = document.getElementById("quiz");
const questionEl = document.getElementById("question");
const questionEyebrowEl = document.getElementById("questionEyebrow");
const answersEl = document.getElementById("answers");
const startButton = document.getElementById("startButton");

const statusCalloutEl = document.getElementById("statusCallout");
const statusTitleEl = document.getElementById("statusTitle");
const statusTextEl = document.getElementById("statusText");
const gaugeEl = document.getElementById("gauge");
const needleEl = gaugeEl.querySelector(".needle");

// Two stacked background layers we crossfade between.
const sceneLayers = [
    document.getElementById("sceneLayerA"),
    document.getElementById("sceneLayerB")
];
let activeLayerIndex = 0;
let currentSceneKey = null;

function tierForPct(pct) {
    let tier = TIERS[0];
    for (const t of TIERS) {
        if (pct >= t.threshold) tier = t;
    }
    return tier;
}

function weatherIndexForPct(pct) {
    let idx = 0;
    for (let i = 0; i < WEATHER_THRESHOLDS.length; i++) {
        if (pct >= WEATHER_THRESHOLDS[i]) idx = i;
    }
    return idx;
}

// Az egyedülálló legénység (nincs társ, nincs gyerek, nincs úton lévő
// kisbaba sem) csak calm/cloudy képpel rendelkezik -- nincs hozzá
// storm/tempest render --, ezért nála az időjárás legfeljebb "cloudy"-ig
// emelkedik, bármekkora is a kockázati pontszám. Minden más legénységnél
// (akár csak egy társ, akár egy úton lévő kisbaba is van) a teljes
// calm→cloudy→storm→tempest skála elérhető.
function maxWeatherForCrew(spouse, dependent) {
    if (!spouse && dependent === "none") return 1; // cloudy
    return WEATHER_KEYS.length - 1; // tempest
}

// Legyártja a fájlnevet egy adott nem/társ/"dependent"/időjárás
// kombinációhoz. A "dependent" egyike: "none" (nincs gyerek/kisbaba),
// "baby" (kisbaba kosárban a fedélzeten) vagy "kids" (3 nagyobb gyerek).
// Minden jelenet (egyedül, társsal, kisbabával, gyerekkel, stb.) külön
// férfi ("ferfi") és női ("no") főszereplővel készül.
function sceneFilename(gender, spouse, dependent, weatherIdx) {
    const s = spouse ? 1 : 0;
    const k = dependent === "kids" ? 3 : (dependent === "baby" ? "baby" : 0);
    return `images/scenes/crew-${gender}-${s}-${k}-${WEATHER_KEYS[weatherIdx]}.jpg`;
}

// Ha a pontos kombináció még hiányzik (pl. a képek gyártása épp zajlik),
// ezek a tartalék kombinációk próbálkoznak -- a nem mindig rögzített marad,
// előbb a "dependent" állapot (legközelebbitől a legtávolabbiig), majd a
// társ be/kikapcsolása lépked végig.
function fallbackCrewOrder(gender, spouse, dependent) {
    const dependentFallbacks = dependent === "baby"
        ? ["baby", "kids", "none"]
        : dependent === "kids"
            ? ["kids", "baby", "none"]
            : ["none", "baby", "kids"];

    const combos = [];
    for (const dep of dependentFallbacks) {
        combos.push([gender, spouse, dep]);
        combos.push([gender, !spouse, dep]);
    }
    return combos;
}

function preloadableUrl(gender, spouse, dependent, weatherIdx, onResolved) {
    const candidates = fallbackCrewOrder(gender, spouse, dependent)
        .map(([g, s, dep]) => sceneFilename(g, s, dep, weatherIdx));

    function tryNext(i) {
        if (i >= candidates.length) {
            onResolved(candidates[candidates.length - 1]); // give up, show broken
            return;
        }
        const img = new Image();
        img.onload = () => onResolved(candidates[i]);
        img.onerror = () => tryNext(i + 1);
        img.src = candidates[i];
    }
    tryNext(0);
}

// A "no" (női kapitány) + társ kombinációknál a generált képeken a férj
// következetesen a kép jobb szélére esik (feltehetően mert minden ilyen
// jelenet ugyanarra a "kapitány + társ a kormánynál" horgonyképre
// hivatkozva készült). Asztali nézetben ez nem probléma -- ott a kép
// szélessége közel esik a fotó natív arányához, így alig vágódik le
// vízszintesen --, de mobilon a lerövidített, széles hajó-sáv miatt a kép
// vízszintesen jóval erősebben be van zoomolva (a magasság tölti ki a
// konténert), és a középre igazított vágás pont a jobb szélen álló férjet
// vágta le teljesen. A `crew-ferfi-*` (férfi kapitány + feleség) képeken ez
// nem jelentkezik, ott a pár középen/kicsit jobbra áll, belefér a
// középre igazított vágásba -- ott nincs is szükség eltolásra.
// A "kids" (3 gyerek) variánsnál a család túl szélesen (gyerekek a bal
// szélen, apa a jobb szélen) oszlik el ahhoz, hogy BÁRMELYIK vízszintes
// vágás mindenkit mutasson egyszerre -- azt változatlanul hagytuk (ez nem
// az itt jelentett hiba, és a jelenlegi középre igazított vágás legalább a
// gyerekeket + anyát mutatja).
function scenePositionFix(gender, spouse, dependent) {
    if (gender === "no" && spouse && dependent === "none") return "spouseRight";
    if (gender === "no" && spouse && dependent === "baby") return "spouseRightBaby";
    return "";
}

function setScene(gender, spouse, dependent, weatherIdx) {
    // A 0. kérdésig (amíg a nem ismeretlen) az üres, kikötőben álló hajót
    // mutatjuk -- ezt a showDock() már beállította, itt nincs teendő.
    if (!gender) return;

    const key = `${gender}-${spouse ? 1 : 0}-${dependent}-${weatherIdx}`;
    if (key === currentSceneKey) return;
    currentSceneKey = key;

    preloadableUrl(gender, spouse, dependent, weatherIdx, (url) => {
        const nextIndex = 1 - activeLayerIndex;
        const nextLayer = sceneLayers[nextIndex];
        const currentLayer = sceneLayers[activeLayerIndex];

        nextLayer.style.backgroundImage = `url('${url}')`;
        nextLayer.dataset.posfix = scenePositionFix(gender, spouse, dependent);
        nextLayer.classList.add("active");
        currentLayer.classList.remove("active");
        activeLayerIndex = nextIndex;
    });

    heroEl.classList.toggle("storm-active", weatherIdx >= 2);
    heroEl.classList.toggle("tempest-active", weatherIdx >= 3);
}

function updateRisk(pct) {
    const tier = tierForPct(pct);
    const dependent = currentDependent();
    const rawWeatherIdx = weatherIndexForPct(pct);
    // Never ask for a weather tier this crew has no art for.
    const weatherIdx = Math.min(rawWeatherIdx, maxWeatherForCrew(state.spouse, dependent));

    // Drives the CSS idle-loop (rocking, cloud drift, water shimmer,
    // lightning) via [data-weather] — the scene keeps moving continuously and
    // only steps up in intensity/cuts to a new still when the weather changes.
    heroEl.dataset.weather = WEATHER_KEYS[weatherIdx];

    setScene(state.gender, state.spouse, dependent, weatherIdx);

    statusTitleEl.textContent = tier.title;
    statusTitleEl.className = "status-title " + tier.key;
    statusTextEl.textContent = tier.status;
    statusCalloutEl.classList.add("visible");

    const angle = -90 + pct * 180;
    needleEl.style.setProperty("--needle", angle + "deg");
    gaugeEl.classList.add("visible");
}

// START — empty ship waiting at the dock, before the journey begins. Ez
// marad látható egészen a 0. (nem) kérdés megválaszolásáig.
(function showDock() {
    const layer = sceneLayers[activeLayerIndex];
    layer.style.backgroundImage = "url('images/scenes/hero-dock.jpg')";
    layer.classList.add("active");
    currentSceneKey = "dock";
})();

startButton.addEventListener("click", () => {
    introEl.classList.add("hidden");
    quizEl.classList.remove("hidden");
    state.started = true;
    currentQuestion = nextApplicableIndex(0);
    showQuestion();
});

// A showIf feltétellel rendelkező (jelenleg csak a 2/3. opcionális) kérdést
// kihagyja, ha a feltétel a jelenlegi állapot szerint nem teljesül.
function nextApplicableIndex(fromIndex) {
    let i = fromIndex;
    while (i < questions.length && questions[i].showIf && !questions[i].showIf(state)) {
        i++;
    }
    return i;
}

// Közös "léptető" logika: pontszám hozzáadása, legénység-állapot frissítése,
// a kártya elrejtése 2 másodpercre (hogy a jelenet/időjárás-váltás látszódjon
// a háttérben), majd a következő (vagy a feltétel miatt kihagyott utáni)
// kérdés, illetve az összegzés megjelenítése.
function advance(pointsToAdd, flagUpdate) {
    totalPoints += pointsToAdd;
    if (flagUpdate) flagUpdate();

    quizEl.classList.add("card-hidden");
    updateRisk(totalPoints / MAX_POINTS);

    currentQuestion = nextApplicableIndex(currentQuestion + 1);

    setTimeout(() => {
        if (currentQuestion < questions.length) {
            showQuestion();
        } else {
            showSummary();
        }
        quizEl.classList.remove("card-hidden");
    }, 2000);
}

function showQuestion() {
    const current = questions[currentQuestion];

    questionEyebrowEl.textContent = current.label;
    questionEl.textContent = current.question;
    answersEl.innerHTML = "";

    if (current.hint) {
        const hintEl = document.createElement("p");
        hintEl.className = "answers-hint";
        hintEl.textContent = current.hint;
        answersEl.appendChild(hintEl);
    }

    // Többválasztós kérdés: a gombok csak ki/bejelölnek, nem lépnek tovább
    // azonnal -- a "Tovább" gomb zárja le a választást.
    if (current.multi) {
        const selected = new Set();

        current.answers.forEach((answer, idx) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "multi-choice";
            button.innerText = answer.text;
            button.addEventListener("click", () => {
                if (selected.has(idx)) {
                    selected.delete(idx);
                    button.classList.remove("selected");
                } else {
                    selected.add(idx);
                    button.classList.add("selected");
                }
            });
            answersEl.appendChild(button);
        });

        const continueButton = document.createElement("button");
        continueButton.type = "button";
        continueButton.className = "pill-button continue-button";
        continueButton.innerText = "Tovább";
        continueButton.addEventListener("click", () => {
            const pointsToAdd = current.answers.reduce(
                (sum, answer, idx) => sum + (selected.has(idx) ? answer.points : 0),
                0
            );
            selectedAnswers[current.id] = current.answers
                .filter((_, idx) => selected.has(idx))
                .map(answer => answer.text);
            advance(pointsToAdd, null);
        });
        answersEl.appendChild(continueButton);
        return;
    }

    current.answers.forEach(answer => {
        const button = document.createElement("button");
        button.type = "button";
        button.innerText = answer.text;

        button.addEventListener("click", () => {
            let flagUpdate = null;
            if (current.flag === "gender") flagUpdate = () => { state.gender = answer.value; };
            if (current.flag === "spouse") flagUpdate = () => { state.spouse = answer.value; };
            if (current.flag === "kids") flagUpdate = () => {
                state.kids = answer.value;
                state.baby = Boolean(answer.baby);
            };

            selectedAnswers[current.id] = answer.text;
            advance(answer.points, flagUpdate);
        });

        answersEl.appendChild(button);
    });
}

// Minden megválaszolt kérdést és a hozzá tartozó választ (szöveges formában)
// egyetlen, emberi szemmel olvasható szöveggé fűz össze -- ezt a
// contact.html olvassa ki a sessionStorage-ból, és csatolja a konzultációs
// emailhez, hogy a tanácsadó előre lássa, mire számítson. Csak azok a
// kérdések szerepelnek benne, amikre ténylegesen válaszolt a kitöltő
// (a feltételes, kihagyott kérdések -- pl. a gyerek nélkülieknél a 2/3.
// kérdés -- nem kerülnek bele).
function buildQuizSummaryText() {
    const lines = [];

    questions.forEach(q => {
        const answer = selectedAnswers[q.id];
        if (answer === undefined) return;

        const answerText = Array.isArray(answer)
            ? (answer.length ? answer.join(", ") : "(nem jelölt meg semmit)")
            : answer;

        lines.push(`${q.question}\n→ ${answerText}`);
    });

    const tier = tierForPct(totalPoints / MAX_POINTS);
    lines.push(`Összesített kockázati szint: ${tier.title} (${totalPoints} / ${MAX_POINTS} pont)`);

    return lines.join("\n\n");
}

// A kiválasztott veszélyeket (5. kérdés, "events") egy rövid, a
// konzultáció felé vezető blokká alakítja. Ha a kitöltő nem jelölt meg
// semmit, egy általánosabb, de ugyanúgy a konzultációra sarkalló szöveget
// ad vissza.
function buildRisksHtml() {
    const risks = selectedAnswers.events || [];

    if (risks.length === 0) {
        return `
            <div class="result-risks">
                <p class="result-risks-cta">Konkrét veszélyt most nem jelöltél meg, de egyetlen váratlan hullám -- egy baleset, egy komolyabb diagnózis -- is megingathatja a hajót. Egy rövid, kötelezettség nélküli konzultáción pontosan átláthatod, mire kell felkészülnöd.</p>
            </div>
        `;
    }

    const items = risks.map(text => `<li>${text}</li>`).join("");
    return `
        <div class="result-risks">
            <p class="result-risks-label">Te ezeket a veszélyeket jelölted meg, amelyek bármikor megdönthetik a hajót:</p>
            <ul class="result-risks-list">${items}</ul>
            <p class="result-risks-cta">Ha ezek közül csak egy is bekövetkezne, a családod anyagi biztonsága azonnal veszélybe kerülne. Egy szakértő tanácsadó pontosan ezekre a kockázatokra tud személyre szabott, kötelezettség nélküli megoldást javasolni -- most van itt az idő, hogy megerősítsd a hajótestet.</p>
        </div>
    `;
}

function showSummary() {
    const pct = totalPoints / MAX_POINTS;
    const tier = tierForPct(pct);

    // A kvíz-válaszok összegzését a sessionStorage-ba mentjük -- ha innen a
    // kitöltő a "Kérek konzultációt" gombbal a contact.html-re lép, az ottani
    // szkript ezt kiolvassa és csatolja az emailhez. Ha a kitöltő kvíz
    // nélkül, közvetlenül nyitja meg a kapcsolat oldalt, egyszerűen nincs mit
    // kiolvasni, és a levél a megszokott (kvíz nélküli) formában megy el.
    try {
        sessionStorage.setItem("familyCaptainQuizSummary", buildQuizSummaryText());
    } catch (err) {
        // sessionStorage nem elérhető (pl. privát böngészés) -- a kontakt
        // form enélkül is simán működik, csak a válaszok nem csatolódnak.
    }

    quizEl.querySelector(".question-box").outerHTML = `
        <div class="question-box result">
            <span class="result-tier ${tier.key}">${tier.title}</span>
            <h2>A hajód eredménye</h2>
            <p class="result-summary">${tier.summary}</p>
            ${buildRisksHtml()}
            <p class="result-score">Felelősségi pontszám: <strong>${totalPoints}</strong> / ${MAX_POINTS}</p>
            <div class="result-actions">
                <a href="contact.html" class="pill-button">Kérek konzultációt</a>
                <a href="index.html" class="pill-button secondary">Újra kezdem</a>
            </div>
        </div>
    `;
}
