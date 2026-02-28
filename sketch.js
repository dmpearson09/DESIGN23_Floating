// Sensor A controls upward velocity, Sensor B controls downward velocity
// Net velocity = vMax * (upStrength - downStrength)
// Chrome Web Serial

let bg;
let ball;

let gameState = "start"; // start, playing, lost
let loseReason = "";

let connected = false;

// Incoming sensor values (cm)
let upCm = 40;
let dnCm = 40;
let latestLine = "";

// Debug counters
let bytesSeen = 0;
let linesSeen = 0;

// Web Serial
let port;
let reader;

function formatState(s) {
  if (s === "start") return "Start";
  if (s === "playing") return "Playing";
  if (s === "lost") return "Lost";
  return s;
}

function preload() {
  bg = loadImage("UnderwaterBackground.jpg");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");
  resetGame();

  const btn = document.getElementById("connectBtn");
  btn.addEventListener("click", connectSerial);

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space") e.preventDefault();
    },
    { passive: false }
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  ball.x = width * 0.5;
  ball.y = constrain(ball.y, ball.r, height - ball.r);
}

function resetGame() {
  ball = { x: width * 0.5, y: height * 0.55, r: 26, v: 0 };
  loseReason = "";
  gameState = "start";
}

function startGame() {
  gameState = "playing";
}

function keyPressed() {
  if (key === " ") {
    if (gameState === "start") startGame();
    return false;
  }
  if (key === "r" || key === "R") {
    resetGame();
    return false;
  }
}

function draw() {
  drawBackgroundPhoto();

  if (gameState === "start") {
    drawBall();
    drawOverlay();
    drawStartScreen();
    return;
  }

  if (gameState === "playing") {
    // closer (less) is higher (more) for BOTH sensors.
    const cmMin = 5;   // min (close)
    const cmMax = 45;  // max (far)

    const upStrength = strengthFromCm(upCm, cmMin, cmMax); // 0..1
    const dnStrength = strengthFromCm(dnCm, cmMin, cmMax); // 0..1

    // Net velocity control
    const vMax = 12.0;     // max speed from full difference
    const smooth = 0.20;   // smoothing

    const targetV = vMax * (upStrength - dnStrength);

    ball.v = lerp(ball.v, targetV, smooth);
    ball.y += ball.v;

    // Lose conditions
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      loseReason = "Hit the surface!";
      gameState = "lost";
    } else if (ball.y + ball.r >= height) {
      ball.y = height - ball.r;
      loseReason = "Hit the seabed!";
      gameState = "lost";
    }

    drawBall();
    drawOverlay(upStrength, dnStrength);
  }

  if (gameState === "lost") {
    drawBall();
    drawOverlay();
    drawLoseScreen();
  }
}

function strengthFromCm(cm, cmMin, cmMax) {
  let t = (cm - cmMin) / (cmMax - cmMin);
  t = constrain(t, 0, 1);
  return 1 - t; // close -> 1, far -> 0
}

// Drawing Functions
function drawBackgroundPhoto() {
  const scale = max(width / bg.width, height / bg.height);
  const w = bg.width * scale;
  const h = bg.height * scale;
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  image(bg, x, y, w, h);

  noStroke();
  fill(0, 0, 0, 70);
  rect(0, 0, width, height);
}

function drawBall() {
  noStroke();
  fill(255, 255, 255, 30);
  circle(ball.x, ball.y, ball.r * 2.8);

  fill(255);
  circle(ball.x, ball.y, ball.r * 2);

  fill(255, 255, 255, 160);
  circle(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.6);
}

function drawOverlay(upStrength = null, dnStrength = null) {
  noStroke();
  fill(0, 0, 0, 140);
  rect(14, 64, 480, 180, 14);

  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);

  text(`Game State: ${formatState(gameState)}`, 28, 78);
  text(`Connected: ${connected ? "Yes" : "No"}`, 28, 92);

  text(`Up cm: ${upCm.toFixed(2)}   Down cm: ${dnCm.toFixed(2)}`, 28, 112);
  if (upStrength !== null && dnStrength !== null) {
    text(
      `Up strength: ${upStrength.toFixed(2)}   Down strength: ${dnStrength.toFixed(2)}`,
      28,
      132
    );
    text(`Ball v: ${ball.v.toFixed(2)}`, 28, 152);
  }

  text(`Last Line: ${latestLine}`, 28, 170);
  text(`Bytes: ${bytesSeen} | Lines: ${linesSeen}`, 28, 190);
  text(`Space = Start | R = Reset`, 28, 210);
}

function drawStartScreen() {
  push();
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(34);
  text("Underwater Float", width * 0.5, height * 0.45);

  textSize(16);
  fill(255, 255, 255, 230);
  text(
    "Connect Arduino, then press SPACE.\nUse the UP sensor to float up, DOWN sensor to pull down.",
    width * 0.5,
    height * 0.65
  );
  pop();
}

function drawLoseScreen() {
  push();
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(34);
  text("You Lose", width * 0.5, height * 0.44);

  textSize(16);
  fill(255, 255, 255, 230);
  text(loseReason, width * 0.5, height * 0.51);

  textSize(18);
  fill(255, 255, 255, 240);
  text("Press R to restart", width * 0.5, height * 0.60);
  pop();
}

// Web Serial Functions
async function connectSerial() {
  try {
    if (!("serial" in navigator)) {
      alert("Web Serial not supported. Use Chrome or Edge.");
      return;
    }

    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    connected = true;

    const btn = document.getElementById("connectBtn");
    btn.disabled = true;
    btn.style.opacity = "0.85";
    btn.style.cursor = "default";
    btn.textContent = "Connect Arduino";
    btn.blur();

    readSerialLoop();
  } catch (err) {
    console.log("Connect error:", err);
    connected = false;
  }
}

async function readSerialLoop() {
  const decoder = new TextDecoder();
  reader = port.readable.getReader();

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      bytesSeen += chunk.length;
      buffer += chunk;

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        linesSeen++;
        latestLine = trimmed;

        // Expect: upCm,downCm
        const parts = trimmed.split(",");
        if (parts.length >= 2) {
          const a = parseFloat(parts[0]);
          const b = parseFloat(parts[1]);
          if (!Number.isNaN(a)) upCm = a;
          if (!Number.isNaN(b)) dnCm = b;
        }
      }
    }
  } catch (err) {
    console.log("Read error:", err);
    connected = false;
  } finally {
    if (reader) reader.releaseLock();
  }
}