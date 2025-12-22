let bank = []; // [{word, meaning}]
let order = []; // shuffled indices
let pos = 0; // next question pointer (0..order.length)
let answered = 0;
let correctCount = 0;
let current = null; // {prompt, options, correctIndex, correctText, speakText}
let wrongBank = []; // 儲存答錯的題目

// DOM 元素
const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const scoreEl = document.querySelector("#score");
const modeEl = document.querySelector("#mode");
const promptEl = document.querySelector("#prompt");
const choicesEl = document.querySelector("#choices");
const feedbackEl = document.querySelector("#feedback");
const speakBtn = document.querySelector("#speakBtn");

// 新增功能相關 DOM
const viewWrongBtn = document.querySelector("#viewWrongBtn");
const wrongListArea = document.querySelector("#wrongListArea");
const wrongList = document.querySelector("#wrongList");
const closeWrongBtn = document.querySelector("#closeWrongBtn");

const NEXT_DELAY_MS = 2000;

// ---------- CSV 處理 ----------
async function loadCSV(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseSimpleCSV(text);
}

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

// ---------- 工具函式 ----------
function randInt(n) { return Math.floor(Math.random() * n); }

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

// ---------- 核心 UI 邏輯 ----------
function updateHUD() {
    const total = bank.length;
    const shown = Math.min(pos, total);
    progressEl.textContent = `第 ${shown} / ${total} 題（已作答：${answered}）`;
    scoreEl.textContent = `答對：${correctCount} / ${answered}`;
    if (answered === 0) scoreEl.textContent = `答對：0 / 0`;
    if (speakBtn) speakBtn.disabled = !current;
}

function makeQuestion(index) {
    const item = bank[index];
    const wrong = pickWrongIndices(bank.length, 3, index);
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
        speakText: item.word,
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
        
        // 測驗結束若有錯題，顯示查看按鈕
        if (wrongBank.length > 0 && viewWrongBtn) {
            viewWrongBtn.style.display = "inline-block";
        }
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
    
    if (isCorrect) {
        correctCount += 1;
    } else {
        // 紀錄錯題 (避免重複加入相同單字)
        if (!wrongBank.find(item => item.prompt === current.prompt)) {
            wrongBank.push({ ...current });
        }
    }

    feedbackEl.textContent = isCorrect ? "答對" : `答錯（正確：${current.correctText}）`;
    buttons[current.correctIndex]?.classList.add("correct");
    if (!isCorrect) buttons[idx]?.classList.add("wrong");
    
    updateHUD();
    setTimeout(() => nextQuestion(), NEXT_DELAY_MS);
}

// ---------- 語音功能 ----------
function speak(text) {
    if (!("speechSynthesis" in window)) {
        console.error("此瀏覽器不支援朗讀");
        return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
}

// ---------- 錯題清單展示 ----------
function renderWrongList() {
    if (!wrongList) return;
    wrongList.innerHTML = "";
    wrongBank.forEach(item => {
        const li = document.createElement("li");
        li.className = "wrong-item";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "10px";
        li.style.borderBottom = "1px solid #d1d5db";

        li.innerHTML = `
            <div style="flex-grow:1;">
                <strong>${item.prompt}</strong>: ${item.correctText}
            </div>
            <button class="speak-small" style="padding: 5px 10px; cursor:pointer;">🔊</button>
        `;
        
        // 綁定錯題清單內的發音按鈕
        li.querySelector(".speak-small").addEventListener("click", () => speak(item.speakText));
        wrongList.appendChild(li);
    });
    
    if (wrongListArea) wrongListArea.style.display = "block";
    if (viewWrongBtn) viewWrongBtn.style.display = "none";
}

// ---------- 初始化與事件綁定 ----------
(async function init() {
    // 綁定原有按鈕
    if (speakBtn) {
        speakBtn.addEventListener("click", () => {
            if (current) speak(current.speakText);
        });
    }

    // 綁定新功能按鈕
    if (viewWrongBtn) viewWrongBtn.addEventListener("click", renderWrongList);
    if (closeWrongBtn) {
        closeWrongBtn.addEventListener("click", () => {
            wrongListArea.style.display = "none";
            viewWrongBtn.style.display = "inline-block";
        });
    }

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
