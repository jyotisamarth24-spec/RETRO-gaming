// ===================================
// RETRO ARCADE - GAME ENGINE
// ===================================

const $ = id => document.getElementById(id);

function openGame(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(name).classList.add("active");
  if (name !== "race") stopRace();
}

function goHome() {
  stopRace();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("home").classList.add("active");
}

// ===================================
// RETRO RACING GAME
// ===================================

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

let running = false;
let paused = false;
let animation = 0;
let lastTime = 0;

let score = 0;
let coins = 0;
let speed = 0;
let nitro = 100;
let nitroActive = false;
let roadOffset = 0;
let spawnTimer = 0;
let coinTimer = 0;
let enemies = [];
let pickups = [];

const player = {
  x: W / 2 - 22,
  y: H - 130,
  w: 44,
  h: 75,
  steer: 0
};

let best = Number(localStorage.getItem("retroBest") || 0);

$("best").textContent = best;

function drawCar(x, y, color, isPlayer = false) {
  ctx.save();
  ctx.translate(x, y);

  // Wheels
  ctx.fillStyle = "#080810";
  ctx.fillRect(2, 12, 8, 17);
  ctx.fillRect(34, 12, 8, 17);
  ctx.fillRect(2, 49, 8, 17);
  ctx.fillRect(34, 49, 8, 17);

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(7, 5, 30, 64);

  // Front hood
  ctx.fillStyle = "#ffffff33";
  ctx.fillRect(10, 8, 24, 12);

  // Windshield
  ctx.fillStyle = "#101a38";
  ctx.fillRect(10, 23, 24, 18);

  // Roof
  ctx.fillStyle = "#ffffff20";
  ctx.fillRect(12, 26, 20, 12);

  // Back section
  ctx.fillStyle = "#111122";
  ctx.fillRect(10, 47, 24, 13);

  // Lights
  ctx.fillStyle = isPlayer ? "#00f5ff" : "#ff304c";
  ctx.fillRect(8, 4, 9, 5);
  ctx.fillRect(27, 4, 9, 5);

  if (isPlayer) {
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00f5ff";
    ctx.fillRect(19, 68, 6, 5);
  }

  ctx.restore();
}

function drawRoad() {
  // Background
  ctx.fillStyle = "#07151b";
  ctx.fillRect(0, 0, W, H);

  // Grass texture
  ctx.fillStyle = "#10291d";
  ctx.fillRect(0, 0, 62, H);
  ctx.fillRect(W - 62, 0, 62, H);

  // Road
  ctx.fillStyle = "#242633";
  ctx.fillRect(62, 0, W - 124, H);

  // Road edges
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(62, 0, 5, H);
  ctx.fillRect(W - 67, 0, 5, H);

  // Neon roadside stripes
  for (let y = -40; y < H + 40; y += 40) {
    let py = (y + roadOffset) % (H + 40) - 20;
    ctx.fillStyle = "#ff32bd";
    ctx.fillRect(48, py, 9, 22);
    ctx.fillStyle = "#00f5ff";
    ctx.fillRect(W - 57, py, 9, 22);
  }

  // Lane markers
  ctx.strokeStyle = "#ffffff77";
  ctx.lineWidth = 4;
  ctx.setLineDash([30, 35]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Road details
  for (let i = 0; i < 25; i++) {
    let y = (i * 43 + roadOffset * 1.5) % H;
    ctx.fillStyle = "#ffffff12";
    ctx.fillRect(90 + (i % 4) * 70, y, 3, 3);
  }
}

function updateRace(dt) {
  const frame = Math.min(dt / 16.67, 2);

  let boost = nitroActive && nitro > 0;
  speed = boost ? 220 : 130;

  if (boost) {
    nitro = Math.max(0, nitro - 0.55 * frame);
  } else {
    nitro = Math.min(100, nitro + 0.12 * frame);
  }

  roadOffset = (roadOffset + speed * frame * 0.12) % 75;

  player.x += player.steer * 6 * frame;
  player.x = Math.max(76, Math.min(W - 120, player.x));

  score += Math.floor(speed * frame / 80);

  spawnTimer += dt;
  coinTimer += dt;

  if (spawnTimer > 1050) {
    spawnTimer = 0;

    const lanes = [105, 200, 295];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    enemies.push({
      x: lane,
      y: -90,
      w: 44,
      h: 75,
      color: ["#ff315b", "#ffb52e", "#a56aff", "#37e69a"][
        Math.floor(Math.random() * 4)
      ]
    });
  }

  if (coinTimer > 1500) {
    coinTimer = 0;
    pickups.push({
      x: 110 + Math.random() * 240,
      y: -25
    });
  }

  enemies.forEach(e => e.y += speed * frame * 0.055);
  pickups.forEach(c => c.y += speed * frame * 0.055);

  enemies = enemies.filter(e => e.y < H + 100);
  pickups = pickups.filter(c => c.y < H + 50);

  // Collision detection
  for (const e of enemies) {
    const hit =
      player.x + 8 < e.x + e.w - 8 &&
      player.x + player.w - 8 > e.x + 8 &&
      player.y + 8 < e.y + e.h - 8 &&
      player.y + player.h - 8 > e.y + 8;

    if (hit) {
      endRace();
      return;
    }
  }

  // Collect coins
  pickups = pickups.filter(c => {
    const dx = player.x + 22 - c.x;
    const dy = player.y + 35 - c.y;

    if (Math.hypot(dx, dy) < 37) {
      coins++;
      score += 100;
      return false;
    }
    return true;
  });

  $("score").textContent = String(score).padStart(6, "0");
  $("coins").textContent = coins;
  $("speed").textContent = Math.floor(speed) + " KM/H";
  $("nitroFill").style.width = nitro + "%";
}

function drawRace() {
  drawRoad();

  // Draw coins
  pickups.forEach(c => {
    ctx.save();
    ctx.fillStyle = "#ffd83d";
    ctx.shadowColor = "#ffd83d";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff5a0";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  });

  enemies.forEach(e => drawCar(e.x, e.y, e.color));
  drawCar(player.x, player.y, "#00bde9", true);

  if (nitroActive && nitro > 0 && running) {
    ctx.fillStyle = "#00eaff";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(player.x + 12, player.y + 73, 8, 30);
    ctx.fillRect(player.x + 26, player.y + 73, 8, 30);
    ctx.globalAlpha = 1;
  }
}

function raceLoop(time) {
  if (!running || paused) return;

  const dt = lastTime ? Math.min(time - lastTime, 40) : 16;
  lastTime = time;

  updateRace(dt);
  if (!running) return;

  drawRace();
  animation = requestAnimationFrame(raceLoop);
}

function startRace() {
  cancelAnimationFrame(animation);

  running = true;
  paused = false;
  score = 0;
  coins = 0;
  speed = 0;
  nitro = 100;
  nitroActive = false;
  roadOffset = 0;
  spawnTimer = 0;
  coinTimer = 0;
  enemies = [];
  pickups = [];

  player.x = W / 2 - 22;
  player.steer = 0;

  lastTime = 0;

  $("raceOverlay").classList.add("hidden");
  $("score").textContent = "000000";
  $("coins").textContent = "0";
  $("speed").textContent = "0 KM/H";

  drawRace();
  animation = requestAnimationFrame(raceLoop);
}

function stopRace() {
  running = false;
  paused = false;
  nitroActive = false;
  cancelAnimationFrame(animation);
}

function pauseRace() {
  if (!running) return;

  paused = !paused;

  if (paused) {
    cancelAnimationFrame(animation);
    $("raceOverlay").classList.remove("hidden");
    $("raceOverlay").innerHTML =
      '<div class="overlay-box"><div class="big-icon">Ⅱ</div><h2>PAUSED</h2><button class="primary-btn" onclick="pauseRace()">RESUME</button></div>';
  } else {
    $("raceOverlay").classList.add("hidden");
    lastTime = 0;
    animation = requestAnimationFrame(raceLoop);
  }
}

function endRace() {
  stopRace();

  if (score > best) {
    best = score;
    localStorage.setItem("retroBest", best);
  }

  $("best").textContent = best;

  $("raceOverlay").classList.remove("hidden");
  $("raceOverlay").innerHTML =
    `<div class="overlay-box">
      <div class="big-icon">🏁</div>
      <h2>RACE OVER!</h2>
      <p>Score: ${score} • Coins: ${coins}</p>
      <button class="primary-btn" onclick="startRace()">RACE AGAIN</button>
    </div>`;
}

function useNitro() {
  if (running && !paused && nitro > 0) {
    nitroActive = true;
    $("nitroButton").textContent = "⚡ BOOSTING!";
    setTimeout(() => {
      nitroActive = false;
      $("nitroButton").textContent = "⚡ NITRO";
    }, 1200);
  }
}

function setSteer(value) {
  player.steer = value;
}

// Keyboard controls
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
    player.steer = -1;
    e.preventDefault();
  }

  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
    player.steer = 1;
    e.preventDefault();
  }

  if (e.code === "Space") {
    e.preventDefault();
    useNitro();
  }

  if (e.key.toLowerCase() === "p") pauseRace();
});

document.addEventListener("keyup", e => {
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key) ||
      ["a", "d"].includes(e.key.toLowerCase())) {
    player.steer = 0;
  }
});

// ===================================
// QUIZ MASTER
// ===================================

const questions = [
  {
    q: "Which planet is known as the Red Planet?",
    a: ["Earth", "Mars", "Venus", "Jupiter"],
    correct: 1
  },
  {
    q: "What is the largest ocean?",
    a: ["Atlantic", "Indian", "Pacific", "Arctic"],
    correct: 2
  },
  {
    q: "How many sides does a hexagon have?",
    a: ["Five", "Six", "Seven", "Eight"],
    correct: 1
  },
  {
    q: "Which gas do plants absorb?",
    a: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    correct: 2
  },
  {
    q: "What is the capital of Japan?",
    a: ["Seoul", "Tokyo", "Beijing", "Bangkok"],
    correct: 1
  },
  {
    q: "Which is the fastest land animal?",
    a: ["Lion", "Tiger", "Cheetah", "Horse"],
    correct: 2
  },
  {
    q: "How many continents are there?",
    a: ["Five", "Six", "Seven", "Eight"],
    correct: 2
  },
  {
    q: "Which organ pumps blood?",
    a: ["Lungs", "Heart", "Brain", "Kidney"],
    correct: 1
  },
  {
    q: "What is 12 × 8?",
    a: ["84", "92", "96", "108"],
    correct: 2
  },
  {
    q: "Which is the biggest planet?",
    a: ["Saturn", "Earth", "Jupiter", "Neptune"],
    correct: 2
  }
];

let quizIndex = 0;
let quizPoints = 0;
let quizClock = 15;
let quizInterval = null;
let quizLocked = false;

function startQuiz() {
  clearInterval(quizInterval);
  quizIndex = 0;
  quizPoints = 0;
  quizLocked = false;

  $("quizContent").innerHTML =
    '<div class="quiz-emoji">🚀</div><h2>LET\'S PLAY!</h2><p>Choose the correct answer.</p>';

  showQuestion();
}

function showQuestion() {
  clearInterval(quizInterval);

  if (quizIndex >= questions.length) {
    finishQuiz();
    return;
  }

  quizLocked = false;
  quizClock = 15;

  const item = questions[quizIndex];

  $("quizLevel").textContent =
    "LEVEL " + String(quizIndex + 1).padStart(2, "0");

  $("quizTimer").textContent = "TIME: " + quizClock;
  $("quizScore").textContent = "SCORE: " + quizPoints;
  $("quizCount").textContent =
    "QUESTION: " + (quizIndex + 1) + " / " + questions.length;

  $("quizProgress").style.width =
    (quizIndex / questions.length * 100) + "%";

  $("quizContent").innerHTML =
    `<h2>${item.q}</h2><p>Choose one answer below.</p>`;

  $("quizAnswers").innerHTML = "";

  item.a.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.textContent = String.fromCharCode(65 + index) + ". " + answer;
    button.onclick = () => chooseAnswer(index, button);
    $("quizAnswers").appendChild(button);
  });

  quizInterval = setInterval(() => {
    quizClock--;
    $("quizTimer").textContent = "TIME: " + quizClock;

    if (quizClock <= 0) {
      clearInterval(quizInterval);
      quizLocked = true;
      showCorrectAnswer();
      setTimeout(nextQuestion, 1100);
    }
  }, 1000);
}

function chooseAnswer(index, button) {
  if (quizLocked) return;

  quizLocked = true;
  clearInterval(quizInterval);

  const item = questions[quizIndex];
  const buttons = [...$("quizAnswers").children];

  if (index === item.correct) {
    quizPoints += 10;
    button.classList.add("correct");
    $("quizContent").innerHTML =
      '<div class="quiz-emoji">🎉</div><h2>CORRECT!</h2><p>+10 POINTS</p>';
  } else {
    button.classList.add("wrong");
    buttons[item.correct].classList.add("correct");
    $("quizContent").innerHTML =
      '<div class="quiz-emoji">💡</div><h2>NOT QUITE!</h2><p>Keep learning!</p>';
  }

  buttons.forEach(b => b.disabled = true);
  $("quizScore").textContent = "SCORE: " + quizPoints;

  setTimeout(nextQuestion, 1100);
}

function showCorrectAnswer() {
  const item = questions[quizIndex];
  const buttons = [...$("quizAnswers").children];

  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === item.correct) b.classList.add("correct");
  });

  $("quizContent").innerHTML =
    '<div class="quiz-emoji">⏰</div><h2>TIME UP!</h2><p>Try the next question!</p>';
}

function nextQuestion() {
  quizIndex++;
  showQuestion();
}

function finishQuiz() {
  clearInterval(quizInterval);

  $("quizProgress").style.width = "100%";
  $("quizTimer").textContent = "FINISHED";
  $("quizCount").textContent = "10 / 10";
  $("quizScore").textContent = "SCORE: " + quizPoints;

  $("quizContent").innerHTML =
    `<div class="quiz-emoji">🏆</div>
     <h2>QUIZ COMPLETED!</h2>
     <p>You scored ${quizPoints} out of 100 points.</p>
     <button class="primary-btn" onclick="startQuiz()">PLAY AGAIN</button>`;

  $("quizAnswers").innerHTML = "";
}

// Initial display
drawRoad();
drawCar(player.x, player.y, "#00bde9", true);
