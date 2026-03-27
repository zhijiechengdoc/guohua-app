const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");
const brushSizeInput = document.getElementById("brushSize");
const inkFlowInput = document.getElementById("inkFlow");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const presetButtons = [...document.querySelectorAll(".preset")];

const presets = {
  light: { alpha: 0.09, spread: 1.9, jitter: 0.85, tone: 26 },
  rich: { alpha: 0.16, spread: 1.35, jitter: 0.55, tone: 18 },
  dry: { alpha: 0.08, spread: 0.88, jitter: 1.25, tone: 38 }
};

let currentPreset = "light";
let drawing = false;
let lastPoint = null;
let snapshotStack = [];

function initializePaper() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const paperGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  paperGradient.addColorStop(0, "#f9f2e3");
  paperGradient.addColorStop(0.52, "#f2e8d4");
  paperGradient.addColorStop(1, "#ece0c6");
  ctx.fillStyle = paperGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPaperBloom();
  drawPaperFibers();
  drawFrame();
  drawTitleDecoration();
  saveSnapshot();
}

function drawPaperBloom() {
  for (let i = 0; i < 14; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 90 + Math.random() * 220;
    const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1, "rgba(161,129,77,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPaperFibers() {
  for (let i = 0; i < 2600; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const alpha = 0.03 + Math.random() * 0.045;
    const shade = 95 + Math.random() * 30;
    ctx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 20}, ${alpha})`;
    ctx.fillRect(x, y, 1.2 + Math.random() * 1.5, 1.2 + Math.random() * 1.5);
  }
}

function drawFrame() {
  ctx.save();
  ctx.strokeStyle = "rgba(93, 66, 37, 0.16)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = "rgba(93, 66, 37, 0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  ctx.restore();
}

function drawTitleDecoration() {
  ctx.save();
  ctx.fillStyle = "rgba(126, 36, 25, 0.12)";
  ctx.font = "600 64px serif";
  ctx.fillText("墨", 60, 120);
  ctx.fillStyle = "rgba(36, 36, 36, 0.08)";
  ctx.font = "500 26px serif";
  ctx.fillText("写意留白", 74, 158);
  ctx.restore();
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    time: performance.now()
  };
}

function saveSnapshot() {
  if (snapshotStack.length > 24) {
    snapshotStack.shift();
  }
  snapshotStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function restoreSnapshot(imageData) {
  ctx.putImageData(imageData, 0, 0);
}

function drawInkStamp(point, radius, velocityFactor) {
  const preset = presets[currentPreset];
  const flow = Number(inkFlowInput.value) / 100;
  const layers = 6;
  const tone = preset.tone;

  for (let i = 0; i < layers; i += 1) {
    const bloomRadius = radius * (0.55 + i * 0.25) * preset.spread;
    const offsetX = (Math.random() - 0.5) * radius * preset.jitter;
    const offsetY = (Math.random() - 0.5) * radius * preset.jitter;
    const gradient = ctx.createRadialGradient(
      point.x + offsetX,
      point.y + offsetY,
      0,
      point.x + offsetX,
      point.y + offsetY,
      bloomRadius
    );

    const alphaCore = Math.max(0.03, preset.alpha * flow * (1.16 - velocityFactor * 0.6));
    gradient.addColorStop(0, `rgba(${tone}, ${tone}, ${tone}, ${alphaCore})`);
    gradient.addColorStop(0.45, `rgba(${tone + 12}, ${tone + 10}, ${tone + 8}, ${alphaCore * 0.42})`);
    gradient.addColorStop(1, "rgba(120, 100, 80, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x + offsetX, point.y + offsetY, bloomRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const hairCount = 6 + Math.round(radius / 4);
  for (let i = 0; i < hairCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const length = radius * (0.5 + Math.random() * 0.9);
    ctx.strokeStyle = `rgba(${tone}, ${tone}, ${tone}, ${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.4 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(
      point.x + Math.cos(angle) * length,
      point.y + Math.sin(angle) * length
    );
    ctx.stroke();
  }
}

function drawSegment(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const velocityFactor = Math.min(1, distance / 42);
  const baseSize = Number(brushSizeInput.value);
  const dynamicRadius = Math.max(4, baseSize * (1.22 - velocityFactor * 0.58));
  const steps = Math.max(1, Math.ceil(distance / 2.4));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    drawInkStamp({ x, y }, dynamicRadius * (0.88 + Math.random() * 0.26), velocityFactor);
  }
}

function beginStroke(event) {
  drawing = true;
  lastPoint = getPointerPosition(event);
  saveSnapshot();
  drawInkStamp(lastPoint, Number(brushSizeInput.value) * 0.92, 0.15);
}

function moveStroke(event) {
  if (!drawing) return;
  const point = getPointerPosition(event);
  drawSegment(lastPoint, point);
  lastPoint = point;
}

function endStroke() {
  drawing = false;
  lastPoint = null;
}

function selectPreset(name) {
  currentPreset = name;
  presetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === name);
  });

  if (name === "light") {
    inkFlowInput.value = 68;
  } else if (name === "rich") {
    inkFlowInput.value = 86;
  } else if (name === "dry") {
    inkFlowInput.value = 34;
  }
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => selectPreset(button.dataset.preset));
});

undoBtn.addEventListener("click", () => {
  if (snapshotStack.length <= 1) return;
  snapshotStack.pop();
  restoreSnapshot(snapshotStack[snapshotStack.length - 1]);
});

clearBtn.addEventListener("click", () => {
  snapshotStack = [];
  initializePaper();
});

exportBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `guohua-${Date.now()}.png`;
  link.click();
});

canvas.addEventListener("mousedown", beginStroke);
canvas.addEventListener("mousemove", moveStroke);
window.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  beginStroke(event.touches[0]);
}, { passive: false });

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  moveStroke(event.touches[0]);
}, { passive: false });

window.addEventListener("touchend", endStroke);

initializePaper();
