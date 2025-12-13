let bank = [];          // [{word, meaning}]
let current = null;     // {word, meaning, options: [meaning...], correctIndex}
let locked = false;

const statusEl = document.querySelector("#status");
const wordEl = document.querySelector("#word");
const choicesEl = document.querySelector("#choices");
const feedbackEl = document.querySelector("#feedback");
const nextBtn = document.querySelector("#nextBtn");

// 讀取 CSV：放在同層 words.csv，GitHub Pages/Live Server 都可用 fetch 讀。[web:313]
async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  const text = await res.text();
  return parseSimpleCSV(text);
}

// 非嚴格 CSV 解析：適合「兩欄、且 meaning 不含逗號」的情況
function parseSimpleCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",");
    if (parts.length < 2) continue;

    // 處理 UTF-8 BOM（有些 Excel 匯出會在第一欄前面塞 \ufeff）
    const word = parts[0].replace(/^\uFEFF/, "").trim();
    const meaning = parts.slice(1).join(",").trim(); // 保底：如果後面多逗號就併回去
    if (!word || !meaning) continue;

    rows.push({ word, meaning });
  }
  return rows;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function pickUniqueIndices(n, k, bannedSet = new Set()) {
  const result = new Set();
  while (result.size < k) {
    const idx = randInt(n);
    if (bannedSet.has(idx)) continue;
    result.add(idx);
  }
  return [...result];
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function makeQuestion() {
  if (bank.length < 4) {
    throw new Error("題庫至少需要 4 筆，才能做四選一。");
  }

  const correctIdx = randInt(bank.length);
  const correct = bank[correctIdx];

  const wrongIndices = pickUniqueIndices(
    bank.length,
    3,
    new Set([correctIdx])
  );
  const options = [
    correct.meaning,
    bank[wrongIndices[0]].meaning,
    bank[wrongIndices[1]].meaning,
    bank[wrongIndices[2]].meaning,
  ];
  shuffleInPlace(options);

  return {
    word: correct.word,
    meaning: correct.meaning,
    options,
    correctIndex: options.indexOf(correct.meaning),
  };
}

function renderQuestion(q) {
  current = q;
  locked = false;
  nextBtn.disabled = true;
  feedbackEl.textContent = "";
  wordEl.textContent = q.word;
  choicesEl.innerHTML = "";

  q.options.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = text;
    btn.addEventListener("click", () => choose(idx));
    choicesEl.appendChild(btn);
  });
}

function choose(idx) {
  if (locked) return;
  locked = true;

  const buttons = [...document.querySelectorAll(".choice")];
  buttons.forEach(b => (b.disabled = true));

  const isCorrect = idx === current.correctIndex;
  feedbackEl.textContent = isCorrect ? "答對" : `答錯（正確：${current.meaning}）`;

  // 標示正確/錯誤按鈕（可選）
  buttons[current.correctIndex].classList.add("correct");
  if (!isCorrect) buttons[idx].classList.add("wrong");

  nextBtn.disabled = false;
}

nextBtn.addEventListener("click", () => {
  renderQuestion(makeQuestion());
});

(async function init() {
  try {
    // 注意：請用 Live Server / GitHub Pages 開，不要直接雙擊用 file:// 開，
    // 因為瀏覽器的同源策略/安全限制可能會擋掉讀取。[web:314]
    bank = await loadCSV("words.csv");
    statusEl.textContent = `題庫載入完成：${bank.length} 筆`;
    renderQuestion(makeQuestion());
  } catch (err) {
    statusEl.textContent = `載入失敗：${err.message}`;
  }
})();
