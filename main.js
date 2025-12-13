let bank = [];     // [{word, meaning}]
let order = [];    // shuffled indices
let pos = 0;       // next question pointer
let answered = 0;
let correctCount = 0;

let current = null;  // {prompt, options, correctIndex, correctText}

const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const scoreEl = document.querySelector("#score");
const modeEl = document.querySelector("#mode");
const promptEl = document.querySelector("#prompt");
const choicesEl = document.querySelector("#choices");
const feedbackEl = document.querySelector("#feedback");

async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseSimpleCSV(text);
}

// 適合兩欄 CSV：word,meaning（meaning 盡量不要含逗號；若含逗號會被 join 回來）
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

function randInt(n) {
  return Math.floor(Math.random() * n);
}

// Fisher–Yates shuffle（in-place）
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

function updateHUD() {
  const total = bank.length;
  const currentNo = Math.min(pos + 1, total); // 即將要顯示的題號（當 pos > total 時仍顯示 total）
  progressEl.textContent = `第 ${Math.min(pos, total)} / ${total} 題（已作答：${answered}）`;
  scoreEl.textContent = `答對：${correctCount} / ${answered}`;
  if (answered === 0) scoreEl.textContent = `答對：0 / 0`;
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
    };
  } else {
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
    };
  }
}

function renderQuestion(q) {
  current = q;
  feedbackEl.textContent = "";
  choicesEl.innerHTML = "";
  promptEl.textContent = q.prompt;

  q.options.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = text;
    btn.addEventListener("click", () => choose(idx));
    choicesEl.appendChild(btn);
  });

  updateHUD();
}

function nextQuestion() {
  if (pos >= order.length) {
    promptEl.textContent = "測驗完成";
    feedbackEl.textContent = `總共 ${answered} 題，答對 ${correctCount} 題。`;
    choicesEl.innerHTML = "";
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

  // 標示正確/錯誤（可有可無）
  buttons[current.correctIndex]?.classList.add("correct");
  if (!isCorrect) buttons[idx]?.classList.add("wrong");

  updateHUD();

  // 自動跳下一題
  setTimeout(() => nextQuestion(), 2000);
}

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
