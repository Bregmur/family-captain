// ============================================================
// A CSALÁD KAPITÁNYA — quiz + realistic scene engine
// v4: simplified crew (alone / with kids / with wife / with wife+kids)
//     x 4 real-art weather stages (calm/cloudy/storm/tempest) — no more
//     scripted grading. The kids question is a plain yes/no since the art
//     only distinguishes "has kids" from "no kids". The loan question sits
//     at position 7 of 8, since the tempest art (which carries a visible
//     weight/chain symbolising the loan) can already appear from question 7
//     onward.
// ============================================================

// Each question can carry a "flag" that updates crew state in addition to
// (or instead of) contributing risk points.
const questions = [
    {
        question: "Van házastársad vagy élettársad?",
        flag: "spouse",
        answers: [
            { text: "Igen", points: 2, value: true },
            { text: "Nem", points: 0, value: false }
        ]
    },
    {
        question: "Van gyermeked?",
        flag: "kids",
        answers: [
            { text: "Igen", points: 4, value: 1 },
            { text: "Nem", points: 0, value: 0 }
        ]
    },
    {
        question: "Van jelenleg életbiztosításod?",
        answers: [
            { text: "Van", points: 0 },
            { text: "Nincs", points: 4 }
        ]
    },
    {
        question: "Mennyire elegendő a jelenlegi anyagi védelmed egy váratlan esemény esetén?",
        answers: [
            { text: "Teljesen", points: 0 },
            { text: "Részben", points: 2 },
            { text: "Egyáltalán nem", points: 4 }
        ]
    },
    {
        question: "Ha veled történne valami, ki tudná fizetni egyedül a család hiteleit?",
        answers: [
            { text: "Igen, könnyen", points: 0 },
            { text: "Nehezen", points: 2 },
            { text: "Nem", points: 5 }
        ]
    },
    {
        question: "Van tartalékotok, ha 6 hónapig nem lenne bevételetek?",
        answers: [
            { text: "Igen, több hónapra", points: 0 },
            { text: "Igen, de kevés", points: 2 },
            { text: "Nincs", points: 5 }
        ]
    },
    // Position 7 of 8 on purpose: the tempest art (which can already appear
    // from this point onward) carries a visible weight/chain on the ship
    // that symbolises the loan, so the reveal lines up with this question.
    {
        question: "Van hiteled (jelzálog, autóhitel, vagy más)?",
        answers: [
            { text: "Nincs", points: 0, value: false },
            { text: "Van", points: 4, value: true }
        ]
    },
    {
        question: "Terveztek hosszabb távon a család anyagi biztonságáról?",
        answers: [
            { text: "Igen, részletesen", points: 0 },
            { text: "Igen, alapszinten", points: 2 },
            { text: "Nem", points: 4 }
        ]
    }
];

const MAX_POINTS = questions.reduce(
    (sum, q) => sum + Math.max(...q.answers.map(a => a.points)),
    0
);

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

// Weather buckets (independent of crew) — now exactly the 4 real-art stages.
const WEATHER_THRESHOLDS = [0, 0.25, 0.5, 0.75]; // idx 0..3
const WEATHER_KEYS = ["calm", "cloudy", "storm", "tempest"];

let currentQuestion = 0;
let totalPoints = 0;

// crew state, updated live as the spouse/kids questions are answered
const state = {
    spouse: false,
    kids: 0,      // 0 = none, >0 = has kids (art only distinguishes the two)
    started: false
};

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

// The "man alone" crew (no spouse, no kids) only has calm/cloudy art — there
// is no storm or tempest render for it, so its weather is capped at cloudy
// regardless of how high the risk score climbs. Every other crew has the
// full calm→cloudy→storm→tempest set.
function maxWeatherForCrew(spouse, kids) {
    if (!spouse && kids === 0) return 1; // cloudy
    return WEATHER_KEYS.length - 1; // tempest
}

// Builds the filename for a given crew/weather combination. Kids only ever
// bucket to "has none" (0) or "has kids" (3) — that's the granularity the
// art actually covers, even though the quiz still scores exact child counts.
function sceneFilename(spouse, kids, weatherIdx) {
    const s = spouse ? 1 : 0;
    const k = kids > 0 ? 3 : 0;
    return `images/scenes/crew-${s}-${k}-${WEATHER_KEYS[weatherIdx]}.jpg`;
}

// Ordered list of (spouse, kids) combos to try if the exact one is missing,
// closest match first.
function fallbackCrewOrder(spouse, kids) {
    const k = kids > 0 ? 3 : 0;
    const otherK = k === 0 ? 3 : 0;
    return [
        [spouse, k],
        [spouse, otherK],
        [!spouse, k],
        [!spouse, otherK]
    ];
}

function preloadableUrl(spouse, kids, weatherIdx, onResolved) {
    const candidates = fallbackCrewOrder(spouse, kids)
        .map(([s, k]) => sceneFilename(s, k, weatherIdx));

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

function setScene(spouse, kids, weatherIdx) {
    const key = `${spouse ? 1 : 0}-${kids > 0 ? 3 : 0}-${weatherIdx}`;
    if (key === currentSceneKey) return;
    currentSceneKey = key;

    preloadableUrl(spouse, kids, weatherIdx, (url) => {
        const nextIndex = 1 - activeLayerIndex;
        const nextLayer = sceneLayers[nextIndex];
        const currentLayer = sceneLayers[activeLayerIndex];

        nextLayer.style.backgroundImage = `url('${url}')`;
        nextLayer.classList.add("active");
        currentLayer.classList.remove("active");
        activeLayerIndex = nextIndex;
    });

    heroEl.classList.toggle("storm-active", weatherIdx >= 2);
    heroEl.classList.toggle("tempest-active", weatherIdx >= 3);
}

function updateRisk(pct) {
    const tier = tierForPct(pct);
    const rawWeatherIdx = weatherIndexForPct(pct);
    // Never ask for a weather tier this crew has no art for.
    const weatherIdx = Math.min(rawWeatherIdx, maxWeatherForCrew(state.spouse, state.kids));

    // Drives the CSS idle-loop (rocking, cloud drift, water shimmer, rain,
    // lightning) via [data-weather] — the scene keeps moving continuously and
    // only steps up in intensity/cuts to a new still when the weather changes.
    heroEl.dataset.weather = WEATHER_KEYS[weatherIdx];

    setScene(state.spouse, state.kids, weatherIdx);

    statusTitleEl.textContent = tier.title;
    statusTitleEl.className = "status-title " + tier.key;
    statusTextEl.textContent = tier.status;
    statusCalloutEl.classList.add("visible");

    const angle = -90 + pct * 180;
    needleEl.style.setProperty("--needle", angle + "deg");
    gaugeEl.classList.add("visible");
}

// START — empty ship waiting at the dock, before the journey begins
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
    updateRisk(0); // father boards alone, calm water — crew fills in as questions are answered
    showQuestion();
});

function showQuestion() {
    const current = questions[currentQuestion];

    questionEyebrowEl.textContent = (currentQuestion + 1) + ". kérdés / " + questions.length;
    questionEl.textContent = current.question;
    answersEl.innerHTML = "";

    current.answers.forEach(answer => {
        const button = document.createElement("button");
        button.type = "button";
        button.innerText = answer.text;

        button.addEventListener("click", () => {
            totalPoints += answer.points;

            if (current.flag === "spouse") state.spouse = answer.value;
            if (current.flag === "kids") state.kids = answer.value;

            updateRisk(totalPoints / MAX_POINTS);

            currentQuestion++;

            if (currentQuestion < questions.length) {
                showQuestion();
            } else {
                showSummary();
            }
        });

        answersEl.appendChild(button);
    });
}

function showSummary() {
    const pct = totalPoints / MAX_POINTS;
    const tier = tierForPct(pct);

    quizEl.querySelector(".question-box").outerHTML = `
        <div class="question-box result">
            <span class="result-tier ${tier.key}">${tier.title}</span>
            <h2>A hajód eredménye</h2>
            <p class="result-summary">${tier.summary}</p>
            <p class="result-score">Felelősségi pontszám: <strong>${totalPoints}</strong> / ${MAX_POINTS}</p>
            <div class="result-actions">
                <a href="contact.html" class="pill-button">Kérek konzultációt</a>
                <a href="index.html" class="pill-button secondary">Újra kezdem</a>
            </div>
        </div>
    `;
}
