let bank = [];     // [{word, meaning}]
let order = [];    // shuffled indices
let pos = 0;       // next question pointer (0..order.length)
let answered = 0;
let correctCount = 0;

let current = null; // {prompt, options, correctIndex, correctText, speakText}

const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const scoreEl = document.querySelector("#score");
const modeEl = document.querySelector("#mode");
const promptEl = document.querySelector("#prompt");
const choicesEl = document.querySelector("#choices");
const feedbackEl = document.querySelector("#feedback");
const speakBtn = document.querySelector("#speakBtn");

const NEXT_DELAY_MS = 2000;

// ---------- CSV ----------
async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseSimpleCSV(text);
}

// 適合兩欄 CSV：word,meaning（meaning 若含逗號會被 join 回來）
function parseSimpleCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 2) continue;

    const word = parts[0].replace(/^\uFEFF/, "").trim();
    const meaning = parts.slice(1).join(",").trim();
    if (!word || !meaning) continue;

    rows.push({ word, meaning });
  }
  return rows;
}

// ---------- utils ----------
function randInt(n) {
  return Math.floor(Math.random() * n);
}

// Fisher–Yates shuffle (in-place)
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pickWrongIndices(total, k, bannedIndex) {
  const result = new Set();
  while (result.size < k) {
    const idx = randInt(total);
    if (idx === bannedIndex) continue;
    result.add(idx);
  }
  return [...result];
}

// ---------- UI ----------
function updateHUD() {
  const total = bank.length;
  const shown = Math.min(pos, total); // 已出到第幾題（pos 在 nextQuestion 會先 +1）

  progressEl.textContent = `第 ${shown} / ${total} 題（已作答：${answered}）`;
  scoreEl.textContent = `答對：${correctCount} / ${answered}`;
  if (answered === 0) scoreEl.textContent = `答對：0 / 0`;

  if (speakBtn) speakBtn.disabled = !current;
}

function makeQuestion(index) {
  const item = bank[index];
  const direction = Math.random() < 0.5 ? "EN_TO_ZH" : "ZH_TO_EN";
  const wrong = pickWrongIndices(bank.length, 3, index);

  if (direction === "EN_TO_ZH") {
    // 題目：英文；選項：中文
    modeEl.textContent = "模式：英翻中";
    const options = [
      item.meaning,
      bank[wrong[0]].meaning,
      bank[wrong[1]].meaning,
      bank[wrong[2]].meaning,
    ];
    shuffleInPlace(options);

    return {
      prompt: item.word,
      options,
      correctIndex: options.indexOf(item.meaning),
      correctText: item.meaning,
      speakText: item.word, // 永遠朗讀英文單字
    };
  }

  // 題目：中文；選項：英文
  modeEl.textContent = "模式：中翻英";
  const options = [
    item.word,
    bank[wrong[0]].word,
    bank[wrong[1]].word,
    bank[wrong[2]].word,
  ];
  shuffleInPlace(options);

  return {
    prompt: item.meaning,
    options,
    correctIndex: options.indexOf(item.word),
    correctText: item.word,
    speakText: item.word, // 永遠朗讀英文單字
  };
}

function renderQuestion(q) {
  current = q;
  feedbackEl.textContent = "";
  choicesEl.innerHTML = "";
  promptEl.textContent = q.prompt;

  q.options.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = text;
    btn.addEventListener("click", () => choose(idx));
    choicesEl.appendChild(btn);
  });

  updateHUD();
}

function nextQuestion() {
  if (pos >= order.length) {
    current = null;
    promptEl.textContent = "測驗完成";
    feedbackEl.textContent = `總共 ${answered} 題，答對 ${correctCount} 題。`;
    choicesEl.innerHTML = "";
    modeEl.textContent = "模式：—";
    updateHUD();
    return;
  }

  const qIndex = order[pos];
  pos += 1;
  renderQuestion(makeQuestion(qIndex));
}

function choose(idx) {
  const buttons = [...document.querySelectorAll(".choice")];
  buttons.forEach(b => (b.disabled = true));

  answered += 1;

  const isCorrect = idx === current.correctIndex;
  if (isCorrect) correctCount += 1;

  feedbackEl.textContent = isCorrect
    ? "答對"
    : `答錯（正確：${current.correctText}）`;

  buttons[current.correctIndex]?.classList.add("correct");
  if (!isCorrect) buttons[idx]?.classList.add("wrong");

  updateHUD();

  setTimeout(() => nextQuestion(), NEXT_DELAY_MS);
}

// ---------- Speech ----------
function speak(text) {
  if (!("speechSynthesis" in window)) {
    feedbackEl.textContent = "此瀏覽器不支援朗讀";
    return;
  }

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  u.pitch = 1.0;

  window.speechSynthesis.speak(u);
}

if (speakBtn) {
  speakBtn.addEventListener("click", () => {
    if (!current) return;
    speak(current.speakText);
  });
}

// ---------- init ----------
(async function init() {
  try {
    bank = await loadCSV("words.csv");
    if (bank.length < 4) throw new Error("題庫至少需要 4 筆，才能四選一。");

    statusEl.textContent = `題庫載入完成：${bank.length} 筆`;

    order = [...Array(bank.length).keys()];
    shuffleInPlace(order);

    pos = 0;
    answered = 0;
    correctCount = 0;

    nextQuestion();
  } catch (err) {
    statusEl.textContent = `載入失敗：${err.message}`;
  }
})();
