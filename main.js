let bank = []; 
let order = []; 
let pos = 0; 
let answered = 0;
let correctCount = 0;
let current = null; 
let wrongBank = []; // 錯題儲存區

const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const scoreEl = document.querySelector("#score");
const modeEl = document.querySelector("#mode");
const promptEl = document.querySelector("#prompt");
const choicesEl = document.querySelector("#choices");
const feedbackEl = document.querySelector("#feedback");
const speakBtn = document.querySelector("#speakBtn");

// 新功能 DOM
const viewWrongBtn = document.querySelector("#viewWrongBtn");
const wrongListArea = document.querySelector("#wrongListArea");
const wrongList = document.querySelector("#wrongList");
const closeWrongBtn = document.querySelector("#closeWrongBtn");

const NEXT_DELAY_MS = 2000;

// ---------- CSV ----------
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
        rows.push({ word, meaning });
    }
    return rows;
}

// ---------- Utils ----------
function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ---------- UI Logic ----------
function updateHUD() {
    const total = bank.length;
    progressEl.textContent = `第 ${Math.min(pos, total)} / ${total} 題（已作答：${answered}）`;
    scoreEl.textContent = `答對：${correctCount} / ${answered}`;
    speakBtn.disabled = !current;
    
    // 只要有錯題就顯示按鈕
    if (wrongBank.length > 0) {
        viewWrongBtn.style.display = "inline-block";
    }
}

function makeQuestion(index) {
    const item = bank[index];
    const wrongIdxs = [];
    while(wrongIdxs.length < 3) {
        let r = Math.floor(Math.random() * bank.length);
        if(r !== index && !wrongIdxs.includes(r)) wrongIdxs.push(r);
    }
    
    modeEl.textContent = "模式：英翻中";
    const options = [item.meaning, bank[wrongIdxs[0]].meaning, bank[wrongIdxs[1]].meaning, bank[wrongIdxs[2]].meaning];
    shuffleInPlace(options);
    
    return {
        prompt: item.word,
        options,
        correctIndex: options.indexOf(item.meaning),
        correctText: item.meaning,
        speakText: item.word
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
        btn.textContent = text;
        btn.onclick = () => choose(idx);
        choicesEl.appendChild(btn);
    });
    updateHUD();
}

function nextQuestion() {
    if (pos >= order.length) {
        current = null;
        promptEl.textContent = "測驗完成";
        feedbackEl.textContent = `總結：${answered} 題中答對 ${correctCount} 題。`;
        choicesEl.innerHTML = "";
        updateHUD();
        return;
    }
    renderQuestion(makeQuestion(order[pos++]));
}

function choose(idx) {
    const buttons = document.querySelectorAll(".choice");
    buttons.forEach(b => b.disabled = true);
    answered++;
    
    const isCorrect = idx === current.correctIndex;
    if (isCorrect) {
        correctCount++;
    } else {
        // 紀錄錯題
        if (!wrongBank.some(i => i.prompt === current.prompt)) {
            wrongBank.push({...current});
        }
    }

    feedbackEl.textContent = isCorrect ? "答對！" : `答錯 (正確：${current.correctText})`;
    buttons[current.correctIndex].classList.add("correct");
    if (!isCorrect) buttons[idx].classList.add("wrong");
    
    updateHUD();
    setTimeout(nextQuestion, NEXT_DELAY_MS);
}

function speak(text) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
}

function renderWrongList() {
    wrongList.innerHTML = "";
    wrongBank.forEach(item => {
        const li = document.createElement("li");
        li.className = "wrong-item";
        li.innerHTML = `
            <div class="wrong-text"><strong>${item.prompt}</strong>: ${item.correctText}</div>
            <button class="speak wrong-speak-btn">🔊</button>
        `;
        li.querySelector("button").onclick = () => speak(item.speakText);
        wrongList.appendChild(li);
    });
    wrongListArea.style.display = "block";
}

// ---------- Init ----------
(async function init() {
    speakBtn.onclick = () => current && speak(current.speakText);
    viewWrongBtn.onclick = renderWrongList;
    closeWrongBtn.onclick = () => wrongListArea.style.display = "none";

    try {
        bank = await loadCSV("words.csv");
        order = [...Array(bank.length).keys()];
        shuffleInPlace(order);
        nextQuestion();
        statusEl.textContent = `題庫載入完成：${bank.length} 筆`;
    } catch (err) {
        statusEl.textContent = "載入失敗，請確認 words.csv 是否存在。";
    }
})();
