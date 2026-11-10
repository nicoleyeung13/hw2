/**
 * Haunted Palm Controller
 * Integrates Teachable Machine Image Model, Web Audio FX, and Floating Ghost Animations
 */

// State variables
let model = null;
let webcam = null;
let labelContainer = null;
let maxPredictions = 0;
let isWebcamRunning = false;
let isGhostVisible = false;
let animationFrameId = null;
let isCameraFlipped = true;

// Class mappings
let closedClass = "";
let openClass = "";

// DOM Elements
const ghostEntity = document.getElementById("ghostEntity");
const stateMessage = document.getElementById("stateMessage");
const detectedValue = document.getElementById("detectedValue");
const modelStatusBadge = document.getElementById("modelStatusBadge");
const modelUrlInput = document.getElementById("modelUrlInput");
const loadModelBtn = document.getElementById("loadModelBtn");
const mappingContainer = document.getElementById("mappingContainer");
const closedPalmSelect = document.getElementById("closedPalmSelect");
const openPalmSelect = document.getElementById("openPalmSelect");
const swapClassesBtn = document.getElementById("swapClassesBtn");
const webcamContainer = document.getElementById("webcam-container");
const webcamPlaceholder = document.getElementById("webcamPlaceholder");
const webcamControls = document.getElementById("webcamControls");
const startWebcamBtn = document.getElementById("startWebcamBtn");
const stopCamBtn = document.getElementById("stopCamBtn");
const flipCamBtn = document.getElementById("flipCamBtn");
const audioToggleBtn = document.getElementById("audioToggleBtn");
const audioIcon = document.getElementById("audioIcon");
const audioStatusText = document.getElementById("audioStatusText");
const lightning = document.getElementById("lightning");
const simCloseBtn = document.getElementById("simCloseBtn");
const simOpenBtn = document.getElementById("simOpenBtn");
const particleCanvas = document.getElementById("particleCanvas");

// Particle System for Haunted Wisps
let particles = [];
let particleCtx = null;

function initParticles() {
  if (!particleCanvas) return;
  particleCtx = particleCanvas.getContext("2d");
  
  function resizeCanvas() {
    particleCanvas.width = particleCanvas.parentElement.clientWidth;
    particleCanvas.height = particleCanvas.parentElement.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Initialize particles
  particles = [];
  for (let i = 0; i < 35; i++) {
    particles.push({
      x: Math.random() * particleCanvas.width,
      y: Math.random() * particleCanvas.height,
      radius: Math.random() * 3 + 1,
      speedY: -(Math.random() * 0.8 + 0.3),
      speedX: (Math.random() - 0.5) * 0.6,
      opacity: Math.random() * 0.5 + 0.1,
      fadeSpeed: Math.random() * 0.01 + 0.005,
      growing: Math.random() > 0.5
    });
  }

  function renderParticles() {
    if (!particleCtx) return;
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    const isSpooky = isGhostVisible;
    for (let p of particles) {
      p.y += isSpooky ? p.speedY * 1.8 : p.speedY;
      p.x += p.speedX;

      if (p.growing) {
        p.opacity += p.fadeSpeed;
        if (p.opacity >= 0.7) p.growing = false;
      } else {
        p.opacity -= p.fadeSpeed;
        if (p.opacity <= 0.05) p.growing = true;
      }

      if (p.y < 0) {
        p.y = particleCanvas.height;
        p.x = Math.random() * particleCanvas.width;
      }

      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      particleCtx.fillStyle = isSpooky 
        ? `rgba(0, 245, 212, ${p.opacity})` 
        : `rgba(157, 78, 221, ${p.opacity * 0.6})`;
      particleCtx.shadowBlur = isSpooky ? 12 : 5;
      particleCtx.shadowColor = isSpooky ? '#00f5d4' : '#9d4edd';
      particleCtx.fill();
    }
    requestAnimationFrame(renderParticles);
  }

  renderParticles();
}

/**
 * Trigger Flash of lightning effect
 */
function triggerLightning() {
  if (!lightning) return;
  lightning.classList.add("flash");
  setTimeout(() => lightning.classList.remove("flash"), 120);
  setTimeout(() => {
    lightning.classList.add("flash");
    setTimeout(() => lightning.classList.remove("flash"), 80);
  }, 220);
}

/**
 * Summon or Banish Ghost based on palm state
 */
function setGhostState(summon) {
  if (isGhostVisible === summon) return;
  isGhostVisible = summon;

  if (summon) {
    // Summon Ghost
    document.body.classList.add("ghost-active");
    ghostEntity.classList.add("is-visible");
    stateMessage.innerHTML = `<span style="color: #00f5d4; font-weight: bold;">👻 The spirit has been summoned!</span>`;
    triggerLightning();

    // Start spooky music
    if (window.spookyAudio) {
      window.spookyAudio.startSpookyMusic();
    }
  } else {
    // Banish Ghost
    document.body.classList.remove("ghost-active");
    ghostEntity.classList.remove("is-visible");
    stateMessage.innerHTML = `<span>Palm open — the spirit vanishes into the shadows...</span>`;

    // Stop spooky music
    if (window.spookyAudio) {
      window.spookyAudio.stopSpookyMusic();
    }
  }
}

/**
 * Load Teachable Machine Model
 */
async function loadTeachableMachineModel(url) {
  if (!url || !url.trim()) {
    alert("Please enter a valid Teachable Machine model URL.");
    return;
  }

  // Ensure trailing slash
  let cleanUrl = url.trim();
  if (!cleanUrl.endsWith("/")) cleanUrl += "/";

  const modelURL = cleanUrl + "model.json";
  const metadataURL = cleanUrl + "metadata.json";

  modelStatusBadge.textContent = "Loading...";
  modelStatusBadge.className = "status-badge";

  try {
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    
    // Save URL in localStorage
    localStorage.setItem("tm_model_url", cleanUrl);

    modelStatusBadge.textContent = "Ready (" + maxPredictions + " classes)";
    modelStatusBadge.className = "status-badge loaded";

    // Setup prediction bar elements and class selection
    setupClassMapping(model.getClassLabels());

    // If webcam is not running, start it automatically
    if (!isWebcamRunning) {
      await startWebcam();
    }
  } catch (error) {
    console.error("Failed to load model:", error);
    modelStatusBadge.textContent = "Failed to Load";
    modelStatusBadge.className = "status-badge";
    alert("Could not load the model from: " + cleanUrl + "\n\nMake sure the link is an exported Teachable Machine model URL with model.json & metadata.json accessible.");
  }
}

/**
 * Setup class mapping and prediction bars
 */
function setupClassMapping(classLabels) {
  closedPalmSelect.innerHTML = "";
  openPalmSelect.innerHTML = "";
  labelContainer = document.getElementById("label-container");
  labelContainer.innerHTML = "";

  let guessedClosed = "";
  let guessedOpen = "";

  classLabels.forEach((label, i) => {
    // Prediction bar markup
    const item = document.createElement("div");
    item.className = "prediction-item";
    item.innerHTML = `
      <div class="pred-header">
        <span class="pred-name">${label}</span>
        <span class="pred-score" id="pred-score-${i}">0%</span>
      </div>
      <div class="pred-bar-bg">
        <div class="pred-bar-fill" id="pred-fill-${i}"></div>
      </div>
    `;
    labelContainer.appendChild(item);

    // Dropdown options
    const opt1 = new Option(label, label);
    const opt2 = new Option(label, label);
    closedPalmSelect.add(opt1);
    openPalmSelect.add(opt2);

    const lower = label.toLowerCase();
    if (!guessedClosed && (lower === "no palm" || lower === "no_palm" || lower.includes("close") || lower.includes("fist"))) {
      guessedClosed = label;
    }
    if (!guessedOpen && (lower === "palm" || lower.includes("open")) && lower !== "no palm") {
      guessedOpen = label;
    }
  });

  // Pick reasonable defaults
  closedClass = guessedClosed || classLabels[0];
  openClass = guessedOpen || (classLabels.length > 1 ? (classLabels[0] === closedClass ? classLabels[1] : classLabels[0]) : classLabels[0]);

  closedPalmSelect.value = closedClass;
  openPalmSelect.value = openClass;
  mappingContainer.style.display = "block";
}

// Select event listeners
closedPalmSelect.addEventListener("change", (e) => {
  closedClass = e.target.value;
});

openPalmSelect.addEventListener("change", (e) => {
  openClass = e.target.value;
});

if (swapClassesBtn) {
  swapClassesBtn.addEventListener("click", () => {
    const temp = closedClass;
    closedClass = openClass;
    openClass = temp;
    closedPalmSelect.value = closedClass;
    openPalmSelect.value = openClass;
  });
}

/**
 * Start Webcam
 */
async function startWebcam() {
  if (isWebcamRunning) return;

  try {
    const flip = isCameraFlipped;
    webcam = new tmImage.Webcam(200, 200, flip);
    await webcam.setup();
    await webcam.play();

    isWebcamRunning = true;
    webcamPlaceholder.style.display = "none";
    webcamControls.style.display = "flex";

    // Clean webcam container
    const existingCanvas = webcamContainer.querySelector("canvas");
    if (existingCanvas) existingCanvas.remove();
    webcamContainer.appendChild(webcam.canvas);

    if (flip) {
      webcamContainer.classList.add("flipped");
    } else {
      webcamContainer.classList.remove("flipped");
    }

    // Start rendering / prediction loop
    window.requestAnimationFrame(loop);
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Camera access denied or unavailable. Please enable webcam permissions.");
  }
}

/**
 * Stop Webcam
 */
function stopWebcam() {
  if (!isWebcamRunning) return;
  isWebcamRunning = false;
  if (webcam) {
    webcam.stop();
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  const canvas = webcamContainer.querySelector("canvas");
  if (canvas) canvas.remove();
  webcamPlaceholder.style.display = "flex";
  webcamControls.style.display = "none";
  setGhostState(false);
  detectedValue.textContent = "Offline";
}

/**
 * Main prediction loop
 */
async function loop() {
  if (!isWebcamRunning) return;

  webcam.update(); // Update webcam frame
  await predict();
  animationFrameId = window.requestAnimationFrame(loop);
}

/**
 * Run prediction on current webcam frame
 */
async function predict() {
  if (!model || !webcam || !webcam.canvas) return;

  const predictions = await model.predict(webcam.canvas);
  let highestClass = "";
  let highestProb = 0;

  for (let i = 0; i < maxPredictions; i++) {
    const p = predictions[i];
    const scorePct = Math.round(p.probability * 100);
    const scoreElem = document.getElementById(`pred-score-${i}`);
    const fillElem = document.getElementById(`pred-fill-${i}`);

    if (scoreElem) scoreElem.textContent = `${scorePct}%`;
    if (fillElem) fillElem.style.width = `${scorePct}%`;

    if (p.probability > highestProb) {
      highestProb = p.probability;
      highestClass = p.className;
    }
  }

  // Update detected state label
  detectedValue.textContent = `${highestClass} (${Math.round(highestProb * 100)}%)`;

  // Check if closed palm is triggered
  // If user selected closedClass has highest confidence or >= 60% probability
  const closedPrediction = predictions.find(p => p.className === closedClass);
  const isClosed = closedPrediction && closedPrediction.probability >= 0.65;

  if (isClosed) {
    setGhostState(true);
  } else if (highestClass === openClass || (closedPrediction && closedPrediction.probability < 0.35)) {
    setGhostState(false);
  }
}

// Event Listeners
loadModelBtn.addEventListener("click", () => {
  window.spookyAudio.ensureContext();
  loadTeachableMachineModel(modelUrlInput.value);
});

modelUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    window.spookyAudio.ensureContext();
    loadTeachableMachineModel(modelUrlInput.value);
  }
});

startWebcamBtn.addEventListener("click", () => {
  window.spookyAudio.ensureContext();
  startWebcam();
});

stopCamBtn.addEventListener("click", stopWebcam);

flipCamBtn.addEventListener("click", () => {
  isCameraFlipped = !isCameraFlipped;
  if (webcamContainer) {
    webcamContainer.classList.toggle("flipped", isCameraFlipped);
  }
});

// Audio toggle
audioToggleBtn.addEventListener("click", () => {
  const muted = window.spookyAudio.toggleMute();
  if (muted) {
    audioIcon.textContent = "🔇";
    audioStatusText.textContent = "Muted";
  } else {
    audioIcon.textContent = "🔊";
    audioStatusText.textContent = "Active";
  }
});

// Quick testing simulation buttons
simCloseBtn.addEventListener("click", () => {
  window.spookyAudio.ensureContext();
  detectedValue.textContent = "Simulated: Closed Palm";
  setGhostState(true);
});

simOpenBtn.addEventListener("click", () => {
  window.spookyAudio.ensureContext();
  detectedValue.textContent = "Simulated: Open Palm";
  setGhostState(false);
});

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  initParticles();

  // Load cached model URL or default user model
  const defaultUrl = "https://teachablemachine.withgoogle.com/models/_N-sZIHOD/";
  const cachedUrl = localStorage.getItem("tm_model_url");
  modelUrlInput.value = cachedUrl || defaultUrl;

  // Auto-load model on page load
  loadTeachableMachineModel(modelUrlInput.value);

  // Enable audio context on any user click
  document.body.addEventListener("click", () => {
    if (window.spookyAudio) {
      window.spookyAudio.ensureContext();
    }
  }, { once: true });
});

