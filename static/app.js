// DOM helpers --------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const stageEls = {
  name: $("stageName"),
  intro: $("stageIntro"),
  loading: $("stageLoading"),
  qa: $("stageQA"),
  popups: $("stagePopups"),
};

const logBox = $("logBox");
const popupConsole = $("popupConsole");
const popupOverlay = $("popupOverlay");
const popupQueue = [];
let popupActive = false;
let popupTimer = null;
const recentPopups = new Set();

const loadingTextEl = $("loadingText");
const nameHintEl = $("nameHint");
const introHintEl = $("introHint");
const storyPromptEl = $("storyPrompt");
const hintBox = $("hintBox");
const popupSummary = $("popupSummary");
const suggestionWrap = $("suggestionWrap");
const suggestionList = $("suggestionList");

const hudPanel = $("hudPanel");
const hudToggle = $("hudToggle");
const btnCloseHud = $("btnCloseHud");

const btnStart = $("btnStart");
const btnNameNext = $("btnNameNext");
const btnRecord = $("btnRecord");
const btnAnswer = $("btnAnswer");
const btnSkip = $("btnSkip");
const btnReset = $("btnReset");
const btnRestart = $("btnRestart");
const userNameInput = $("userName");
const btnLogout = $("btnLogout");
const userChip = $("userChip");
const hudUserLine = $("hudUserLine");

const answerInput = $("answerInput");
const questionStem = $("questionStem");
const questionOptions = $("questionOptions");
const questionCounter = $("questionCounter");
const questionSubject = $("questionSubject");
const questionProgress = $("questionProgress");
const mutateBadge = $("mutateBadge");
const integerPanel = $("integerPanel");
const integerInput = $("integerInput");
const btnClearInteger = $("btnClearInteger");
const btnBackspace = $("btnBackspace");
const scoreMeta = $("scoreMeta");
const testHint = $("testHint");
const btnPrevQuestion = $("btnPrevQuestion");
const btnNextQuestion = $("btnNextQuestion");
const btnReloadQuestions = $("btnReloadQuestions");
const btnSubmitQuestion = $("btnSubmitQuestion");

// State --------------------------------------------------------------------
let sessionId = null;
let currentDomain = null;
let currentSlot = null;
let socket = null;
let socketInitialized = false;
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordedAudioBlob = null;
let recordingMimeType = "audio/webm";
let testQuestions = [];
let testQuestionIndex = 0;
let selectedOptions = {};
let answeredMap = {};
let mutationTimers = [];
let integerKeypadListenerAttached = false;
let suggestTimer = null;
const disableStressMode = false;
const stressDebug = true;
const manualStressTriggerMode = true;
const enableDevTriggerPanel =
  manualStressTriggerMode &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.search.includes("devTriggers=1"));

const DEV_FALLBACK_QUESTIONS = [
  {
    question_id: "dev-fallback-1",
    question_type: "scq",
    subject: "Mathematics",
    chapter: "Algebra",
    difficulty: "Easy",
    level: "EASY",
    question_html: "<p>If 3x + 6 = 21, the value of x is:</p>",
    question_images: [],
    options: [
      { label: "A", text: "3" },
      { label: "B", text: "4" },
      { label: "C", text: "5" },
      { label: "D", text: "6" },
    ],
    correct_answer: "C",
  },
  {
    question_id: "dev-fallback-2",
    question_type: "scq",
    subject: "Physics",
    chapter: "Laws of Motion",
    difficulty: "Easy",
    level: "EASY",
    question_html: "<p>The SI unit of force is:</p>",
    question_images: [],
    options: [
      { label: "A", text: "Newton" },
      { label: "B", text: "Joule" },
      { label: "C", text: "Watt" },
      { label: "D", text: "Pascal" },
    ],
    correct_answer: "A",
  },
  {
    question_id: "dev-fallback-3",
    question_type: "integer",
    subject: "Chemistry",
    chapter: "Mole Concept",
    difficulty: "Easy",
    level: "EASY",
    question_html: "<p>Enter the integer part of Avogadro number coefficient in x × 10<sup>23</sup>.</p>",
    question_images: [],
    integer_answer: 6,
  },
  {
    question_id: "dev-fallback-4",
    question_type: "scq",
    subject: "Mathematics",
    chapter: "Trigonometry",
    difficulty: "Medium",
    level: "MEDIUM",
    question_html: "<p>sin²θ + cos²θ is equal to:</p>",
    question_images: [],
    options: [
      { label: "A", text: "0" },
      { label: "B", text: "1" },
      { label: "C", text: "2" },
      { label: "D", text: "Depends on θ" },
    ],
    correct_answer: "B",
  },
  {
    question_id: "dev-fallback-5",
    question_type: "scq",
    subject: "Physics",
    chapter: "Kinematics",
    difficulty: "Medium",
    level: "MEDIUM",
    question_html: "<p>A body starts from rest with acceleration 2 m/s². Distance in 3 s is:</p>",
    question_images: [],
    options: [
      { label: "A", text: "3 m" },
      { label: "B", text: "6 m" },
      { label: "C", text: "9 m" },
      { label: "D", text: "12 m" },
    ],
    correct_answer: "C",
  },
  {
    question_id: "dev-fallback-6",
    question_type: "scq",
    subject: "Chemistry",
    chapter: "Periodic Table",
    difficulty: "Easy",
    level: "EASY",
    question_html: "<p>Atomic number represents:</p>",
    question_images: [],
    options: [
      { label: "A", text: "Number of neutrons" },
      { label: "B", text: "Number of protons" },
      { label: "C", text: "Mass number" },
      { label: "D", text: "Number of isotopes" },
    ],
    correct_answer: "B",
  },
  {
    question_id: "dev-fallback-7",
    question_type: "scq",
    subject: "Mathematics",
    chapter: "Coordinate Geometry",
    difficulty: "Medium",
    level: "MEDIUM",
    question_html: "<p>Distance between points (0,0) and (3,4) is:</p>",
    question_images: [],
    options: [
      { label: "A", text: "4" },
      { label: "B", text: "5" },
      { label: "C", text: "6" },
      { label: "D", text: "7" },
    ],
    correct_answer: "B",
  },
];

const CLIENT_FALLBACK_QUESTIONS = [
  {
    question_id: "client-local-q-1",
    question_type: "scq",
    subject: "Physics",
    difficulty: "Easy",
    question_html: "<p>A body accelerates at 2 m/s^2 for 5 s from rest. Final velocity?</p>",
    options: [
      { label: "A", text: "5 m/s" },
      { label: "B", text: "10 m/s" },
      { label: "C", text: "12 m/s" },
      { label: "D", text: "15 m/s" },
    ],
    correct_answer: "B",
  },
  {
    question_id: "client-local-q-2",
    question_type: "scq",
    subject: "Chemistry",
    difficulty: "Easy",
    question_html: "<p>How many moles are present in 22 g of CO2 (M=44 g/mol)?</p>",
    options: [
      { label: "A", text: "0.25 mol" },
      { label: "B", text: "0.5 mol" },
      { label: "C", text: "1 mol" },
      { label: "D", text: "2 mol" },
    ],
    correct_answer: "B",
  },
  {
    question_id: "client-local-q-3",
    question_type: "scq",
    subject: "Math",
    difficulty: "Easy",
    question_html: "<p>For x^2 - 5x + 6 = 0, sum of roots equals?</p>",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "3" },
      { label: "C", text: "5" },
      { label: "D", text: "6" },
    ],
    correct_answer: "C",
  },
  {
    question_id: "client-local-q-4",
    question_type: "integer",
    subject: "Physics",
    difficulty: "Medium",
    question_html: "<p>Force 10 N moves object 3 m in same direction. Work (J)?</p>",
    integer_answer: 30,
  },
  {
    question_id: "client-local-q-5",
    question_type: "scq",
    subject: "Biology",
    difficulty: "Easy",
    question_html: "<p>Which organelle is called the powerhouse of the cell?</p>",
    options: [
      { label: "A", text: "Nucleus" },
      { label: "B", text: "Golgi body" },
      { label: "C", text: "Mitochondria" },
      { label: "D", text: "Ribosome" },
    ],
    correct_answer: "C",
  },
  {
    question_id: "client-local-q-6",
    question_type: "scq",
    subject: "Math",
    difficulty: "Easy",
    question_html: "<p>sin 30 degrees equals:</p>",
    options: [
      { label: "A", text: "1/2" },
      { label: "B", text: "sqrt(3)/2" },
      { label: "C", text: "0" },
      { label: "D", text: "1" },
    ],
    correct_answer: "A",
  },
  {
    question_id: "client-local-q-7",
    question_type: "integer",
    subject: "Chemistry",
    difficulty: "Easy",
    question_html: "<p>Electrons in a neutral oxygen atom?</p>",
    integer_answer: 8,
  },
];

function openDevFallbackQuestionsDirect() {
  const cloned = DEV_FALLBACK_QUESTIONS.map((q, idx) => ({
    ...q,
    question_index: idx + 1,
    options: Array.isArray(q.options) ? q.options.map((opt) => ({ ...opt })) : [],
  }));
  testQuestions = cloned;
  testQuestionIndex = 0;
  selectedOptions = {};
  answeredMap = {};
  clearMutationTimers();
  setTestHint("Dev mode: Loaded local fallback questions directly.");
  renderTestQuestion();
  StressTriggers.beginExamTimer();
  showStage("popups");
}

// Utility ------------------------------------------------------------------
function log(...args) {
  if (!logBox) return;
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  logBox.textContent = (logBox.textContent + line + "\n").slice(-15000);
  logBox.scrollTop = logBox.scrollHeight;
}

async function getJSON(url) {
  const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

async function postFormData(url, formData) {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

function showStage(name, message) {
  Object.values(stageEls).forEach((el) => el?.classList.remove("active"));
  const stage = stageEls[name];
  if (stage) stage.classList.add("active");
  if (name === "loading" && message) setLoadingMessage(message);
  // Keep viewport at top when switching stages so users see loaders/questions without scrolling
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    window.scrollTo(0, 0);
  }
  StressTriggers.setStage(name);
}

function setLoadingMessage(message) {
  if (loadingTextEl) loadingTextEl.textContent = message || "Calibrating vibes…";
}

function setHint(text) {
  if (hintBox) hintBox.textContent = text || "";
}

function setIntroHint(text) {
  if (!introHintEl) return;
  introHintEl.textContent = text || "";
  if (text) {
    stageEls.intro?.classList.add("shake");
    setTimeout(() => stageEls.intro?.classList.remove("shake"), 400);
  }
}

function setNameHint(text) {
  if (!nameHintEl) return;
  nameHintEl.textContent = text || "";
  if (text) {
    stageEls.name?.classList.add("shake");
    setTimeout(() => stageEls.name?.classList.remove("shake"), 400);
  }
}

function setStoryPrompt(name) {
  if (!storyPromptEl) return;
  const cleanName = (name || "").trim();
  if (!cleanName) {
    storyPromptEl.textContent = "What's on your mind today?";
    return;
  }
  storyPromptEl.textContent = `Hey ${cleanName}, what's on your mind today?`;
}

function setRecordButtonState() {
  if (!btnRecord) return;
  if (mediaRecorder && mediaRecorder.state === "recording") {
    btnRecord.textContent = "Stop Recording";
    btnRecord.classList.remove("ghost");
    btnRecord.classList.add("primary");
    return;
  }
  btnRecord.textContent = recordedAudioBlob ? "Re-record Voice" : "Record Voice";
  btnRecord.classList.remove("primary");
  btnRecord.classList.add("ghost");
}

function setSessionUI(id, domains) {
  sessionId = id;
  window.currentSessionId = id || null;
  $("sessionId").textContent = id || "—";
  $("sessionStatus").textContent = id ? `session: ${id.slice(0, 8)}…` : "session: none";
  $("activeDomains").textContent = domains && domains.length ? domains.join(", ") : "—";
}

function syncUserUI() {
  const u = window.StressDostAuth?.getUser?.();
  if (userChip) {
    userChip.textContent = u ? `${u.display_name} · ${String(u.user_id).slice(0, 8)}…` : "";
    userChip.style.display = u ? "inline-flex" : "none";
  }
  if (hudUserLine) {
    if (!u) hudUserLine.textContent = "—";
    else hudUserLine.textContent = `${u.display_name} (${u.user_id})`;
  }
}

function clientUserPayload() {
  const u = window.StressDostAuth?.getUser?.();
  if (!u) return null;
  const out = { user_id: u.user_id, display_name: u.display_name };
  if (u.mood) out.mood = u.mood;
  return out;
}

function updateScoreMeta() {
  const totalAnswered = Object.keys(answeredMap).length;
  const correct = Object.values(answeredMap).filter((v) => v?.correct).length;
  const totalQuestions = testQuestions.length || totalAnswered;
  if (scoreMeta) scoreMeta.textContent = `Score: ${correct}/${totalQuestions || 0}`;
}

function setQuestionUI(data) {
  currentDomain = data.domain || null;
  currentSlot = data.slot || null;
  const totalAsked = Number(data?.meta?.total_questions_asked || 0);

  $("qMeta").textContent = `domain: ${currentDomain || "—"} | slot: ${currentSlot || "—"}`;
  $("questionText").textContent = data.question || "Your next question will bloom here.";
  if (btnSkip) {
    btnSkip.hidden = totalAsked < 3;
    btnSkip.disabled = false;
  }
  setHint(data.hint || "");
  btnAnswer.disabled = false;
  answerInput.disabled = false;
  answerInput.focus();
}

function resetFlow() {
  StressTriggers.onReset();
  sessionId = null;
  currentDomain = null;
  currentSlot = null;
  setSuggestions([]);
  btnAnswer.disabled = true;
  if (btnSkip) {
    btnSkip.hidden = true;
    btnSkip.disabled = false;
  }
  answerInput.value = "";
  if (userNameInput) userNameInput.value = "";
  $("initialText").value = "";
  recordedAudioBlob = null;
  recordingMimeType = "audio/webm";
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
  setRecordButtonState();
  setHint("");
  setNameHint("");
  setIntroHint("");
  setStoryPrompt("");
  // Reset test question panel
  testQuestions = [];
  testQuestionIndex = 0;
  selectedOptions = {};
  answeredMap = {};
  if (questionStem) questionStem.textContent = "Questions will appear here with options.";
  if (questionOptions) questionOptions.innerHTML = "";
  if (questionCounter) questionCounter.textContent = "Questions —";
  if (questionSubject) questionSubject.textContent = "—";
  if (questionProgress) questionProgress.style.width = "0%";
  if (mutateBadge) mutateBadge.style.display = "none";
  if (integerPanel) integerPanel.style.display = "none";
  updateScoreMeta();
  setTestHint("");
  popupSummary.textContent = "We're releasing your personalized pulses now. Watch the center top.";
  popupOverlay.innerHTML = "";
  log("reset_flow");
  setSessionUI(null, null);
  showStage("name");
}

function proceedFromNameStep() {
  const name = (userNameInput?.value || "").trim();
  if (!name) {
    setNameHint("Please enter your name first.");
    userNameInput?.focus();
    return;
  }
  setNameHint("");
  setStoryPrompt(name);
  showStage("intro");
  $("initialText")?.focus();
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setIntroHint("Your browser does not support mic recording.");
    return;
  }
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  recordedAudioBlob = null;
  const preferredMime =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
  mediaRecorder = preferredMime
    ? new MediaRecorder(mediaStream, { mimeType: preferredMime })
    : new MediaRecorder(mediaStream);
  recordingMimeType = mediaRecorder.mimeType || preferredMime || "audio/webm";

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });

  mediaRecorder.addEventListener("stop", () => {
    recordedAudioBlob = audioChunks.length
      ? new Blob(audioChunks, { type: recordingMimeType })
      : null;
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    setRecordButtonState();
    if (recordedAudioBlob) {
      setIntroHint("Voice captured. Click Launch Session to transcribe and continue.");
    }
  });

  mediaRecorder.start();
  setIntroHint("Recording... click again to stop.");
  setRecordButtonState();
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  mediaRecorder.stop();
}

function getAudioExtension() {
  if (recordingMimeType.includes("mp4") || recordingMimeType.includes("mpeg")) return "m4a";
  if (recordingMimeType.includes("ogg")) return "ogg";
  if (recordingMimeType.includes("wav")) return "wav";
  return "webm";
}

async function resolveInitialText() {
  const typed = $("initialText").value.trim();
  if (typed) return typed;
  if (!recordedAudioBlob) return "";

  setLoadingMessage("Transcribing your recording...");
  const formData = new FormData();
  formData.append("audio", recordedAudioBlob, `recording.${getAudioExtension()}`);
  const data = await postFormData("/session/transcribe", formData);
  const text = (data.text || "").trim();
  if (text) {
    $("initialText").value = text;
  }
  return text;
}

function clearMutationTimers() {
  mutationTimers.forEach((id) => clearTimeout(id));
  mutationTimers = [];
}

function cloneClientFallbackQuestions() {
  return CLIENT_FALLBACK_QUESTIONS.map((q, idx) => ({
    ...q,
    question_index: idx + 1,
    options: Array.isArray(q.options) ? q.options.map((opt) => ({ ...opt })) : [],
  }));
}

// Stress trigger engine ----------------------------------------------------
const StressTriggers = (() => {
  const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const active = new Map();
  const cooldownUntil = new Map();
  const activationCounts = new Map();
  const devButtons = new Map();
  let audioContext = null;
  let autoEvaluateTimer = null;
  const state = {
    stage: "name",
    examStartedAt: 0,
    examDurationMs: 900000,
    questionStartedAt: 0,
    currentQuestionId: "",
    questionDifficulty: "",
    lastInteractionAt: Date.now(),
    clickTimestamps: [],
    answerChangesByQuestion: {},
    lastAnswerLatencyMs: null,
    hoverIntentOnOption: false,
    hoverOptionEl: null,
    isSubmittingAnswer: false,
    lastTriggerName: null,
    lastPhantomMessageIndex: -1,
    lastConfidencePunchIndex: -1,
    lastMiragePunchIndex: -1,
    followupAnswers: [],
  };

  const triggerConfig = {
    optionShuffle: { conflicts: [], cooldown: [18000, 26000] },
    phantomCompetitor: { conflicts: [], cooldown: [18000, 30000] },
    stressTimer: { conflicts: [], cooldown: [20000, 30000] },
    confidenceBreaker: { conflicts: [], cooldown: [15000, 22000] },
    mirageHighlight: { conflicts: [], cooldown: [15000, 22000] },
    blurAttack: { conflicts: [], cooldown: [16000, 24000], idleOnly: true },
    screenFlip: { conflicts: ["colorInversion", "blurAttack", "heartbeatVibration"], cooldown: [20000, 30000] },
    colorInversion: { conflicts: ["screenFlip", "blurAttack", "heartbeatVibration"], cooldown: [19000, 29000] },
    heartbeatVibration: { conflicts: [], cooldown: [18000, 26000] },
    waveDistortion: { conflicts: ["screenFlip"], cooldown: [18000, 26000] },
    fakeMentorCount: { conflicts: [], cooldown: [20000, 32000] },
    chaosBackground: { conflicts: ["blackout"], cooldown: [22000, 32000] },
    shepardTone: { conflicts: ["spatialTicking"], cooldown: [25000, 36000] },
    spatialTicking: { conflicts: ["shepardTone"], cooldown: [22000, 34000] },
    fakeLowBattery: { conflicts: ["fakeCrashScreen", "blackout"], cooldown: [22000, 32000] },
    fakeCrashScreen: { conflicts: ["fakeLowBattery", "blackout"], cooldown: [26000, 38000] },
    blackout: { conflicts: ["fakeLowBattery", "fakeCrashScreen", "chaosBackground"], cooldown: [24000, 36000] },
    hesitationHeatmap: { conflicts: [], cooldown: [18000, 26000] },
    bollywoodReelTrap: { conflicts: ["blackout", "fakeCrashScreen"], cooldown: [32000, 52000] },
  };

  function debugLog(kind, detail) {
    if (!stressDebug) return;
    log(`stress_${kind}`, detail || "");
  }

  function stableHash(text) {
    let hash = 0;
    const src = String(text || "");
    for (let i = 0; i < src.length; i += 1) {
      hash = (hash * 31 + src.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function stableRange(name, min, max) {
    const count = (activationCounts.get(name) || 0) + 1;
    const key = `${sessionId || "anon"}|${state.currentQuestionId}|${name}|${count}`;
    const hash = stableHash(key);
    const span = Math.max(1, max - min + 1);
    return min + (hash % span);
  }

  function getAppShell() {
    return document.querySelector(".app-shell");
  }

  function getTestCard() {
    return document.getElementById("testCard");
  }

  function getOrCreateAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new Ctx();
    }
    return audioContext;
  }

  async function resumeAudioContextIfNeeded() {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (e) {
        debugLog("audio_resume_failed", e?.message || String(e));
      }
    }
    return ctx;
  }

  function mountDevilTopBanner(lines) {
    const banner = document.createElement("div");
    banner.className = "stress-heart-devil-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <div class="avatar" aria-hidden="true">😈</div>
      <div class="bubble">
        <strong>${escapeHTML(lines?.title || "Devil Notice")}</strong>
        <span>${escapeHTML(lines?.lead || "Stay focused.")}</span>
        <em>${escapeHTML(lines?.challenge || "Can you hold your nerve?")}</em>
        ${lines?.taunt ? `<small>${escapeHTML(lines.taunt)}</small>` : ""}
      </div>
    `;
    document.body.appendChild(banner);
    return banner;
  }

  function refreshDevButtonState(name) {
    const btn = devButtons.get(name);
    if (!btn) return;
    btn.classList.toggle("is-active", isTriggerActive(name));
  }

  function clearIdleVisuals() {
    // No idle-only cleanup required at the moment.
  }

  function setStage(name) {
    state.stage = name;
    if (name !== "popups") {
      deactivateAllTriggers();
    }
  }

  function markInteraction(kind) {
    const now = Date.now();
    state.lastInteractionAt = now;
    if (kind === "click") {
      state.clickTimestamps.push(now);
      const cutoff = now - 1000;
      state.clickTimestamps = state.clickTimestamps.filter((ts) => ts >= cutoff);
    }
    if (kind === "scroll" || kind === "click" || kind === "keydown") {
      clearIdleVisuals();
    }
  }

  function timeRemainingMs() {
    if (!state.examStartedAt) return state.examDurationMs;
    return Math.max(0, state.examDurationMs - (Date.now() - state.examStartedAt));
  }

  function currentUserState() {
    const now = Date.now();
    const qid = state.currentQuestionId || "";
    return {
      timeOnQuestionMs: state.questionStartedAt ? now - state.questionStartedAt : 0,
      idleMs: now - state.lastInteractionAt,
      answerChangeCount: Number(state.answerChangesByQuestion[qid] || 0),
      clickFrequency: state.clickTimestamps.length,
      hoverIntentOnOption: Boolean(state.hoverIntentOnOption),
      answerLatencyMs: state.lastAnswerLatencyMs == null ? Number.POSITIVE_INFINITY : state.lastAnswerLatencyMs,
      timeRemainingMs: timeRemainingMs(),
      questionDifficulty: state.questionDifficulty || "",
      isSubmittingAnswer: Boolean(state.isSubmittingAnswer),
    };
  }

  function canActivateTrigger(name, context) {
    const force = Boolean(context?.force);
    if (disableStressMode) return { ok: false, reason: "disabled" };
    if (!force && state.stage !== "popups") return { ok: false, reason: "stage" };
    if (active.has(name)) return { ok: false, reason: "active" };
    if (!force && state.lastTriggerName === name) return { ok: false, reason: "repeat" };
    if (!force && active.size >= 2) return { ok: false, reason: "max-active" };
    const until = cooldownUntil.get(name) || 0;
    if (!force && Date.now() < until) return { ok: false, reason: "cooldown" };
    const config = triggerConfig[name] || { conflicts: [] };
    if (!force && (config.conflicts || []).some((other) => active.has(other))) {
      return { ok: false, reason: "conflict" };
    }
    if (!force && reducedMotion && [
      "phantomCompetitor",
      "heartbeatVibration",
      "blurAttack",
      "screenFlip",
      "colorInversion",
      "waveDistortion",
      "chaosBackground",
      "blackout",
      "hesitationHeatmap",
    ].includes(name)) {
      return { ok: false, reason: "reduced-motion" };
    }
    return { ok: true };
  }

  function setCooldown(name) {
    const cfg = triggerConfig[name] || { cooldown: [15000, 30000] };
    const [minMs, maxMs] = cfg.cooldown || [15000, 30000];
    const cooldown = stableRange(name, minMs, maxMs);
    cooldownUntil.set(name, Date.now() + cooldown);
  }

  function registerTrigger(name, cleanupFn, durationMs) {
    const timers = [];
    if (durationMs > 0) {
      timers.push(
        setTimeout(() => {
          deactivateTrigger(name);
        }, durationMs)
      );
    }
    active.set(name, { cleanupFn, timers, activatedAt: Date.now() });
    state.lastTriggerName = name;
    setCooldown(name);
    activationCounts.set(name, (activationCounts.get(name) || 0) + 1);
    refreshDevButtonState(name);
    debugLog("activated", name);
  }

  function deactivateTrigger(name) {
    const entry = active.get(name);
    if (!entry) return;
    (entry.timers || []).forEach((timerId) => clearTimeout(timerId));
    try {
      entry.cleanupFn?.();
    } catch (e) {
      debugLog("cleanup_error", `${name}:${e?.message || String(e)}`);
    }
    active.delete(name);
    refreshDevButtonState(name);
    debugLog("ended", name);
  }

  function deactivateAllTriggers() {
    [...active.keys()].forEach((name) => deactivateTrigger(name));
  }

  function isTriggerActive(name) {
    return active.has(name);
  }

  function triggerOptionShuffle() {
    const q = testQuestions[testQuestionIndex];
    if (!q || (q.question_type || "").toLowerCase() !== "scq" || !questionOptions) return null;
    const questionId = q.question_id;
    const totalCycles = 3;
    const warmupMs = 180;
    const reorderDurationMs = stableRange("optionShuffle_reorder", 620, 760);
    const pauseAfterEachMs = stableRange("optionShuffle_pause", 260, 340);
    const cycleStepMs = reorderDurationMs + pauseAfterEachMs;
    let lastOrder = [];
    questionOptions.classList.add("stress-option-shuffle");

    const quotes = [
      "I shuffled the obvious. Find truth, not pattern.",
      "Memory of position is a trap. Read again.",
      "Fast eyes lose. Calm eyes win.",
      "If order controls you, I already won.",
    ];
    const quote = quotes[stableRange("optionShuffle_quote", 0, quotes.length - 1)];
    const topBanner = mountDevilTopBanner({
      title: "Devil Shuffle",
      lead: "I moved your options when your focus blinked.",
      challenge: "Choose by logic, not by where it used to be.",
      taunt: quote,
    });

    const ephemeralNodes = [];

    function pushEphemeral(node) {
      if (!node) return;
      ephemeralNodes.push(node);
      return node;
    }

    function nextOrder(nodes) {
      const base = [...nodes];
      for (let i = base.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [base[i], base[j]] = [base[j], base[i]];
      }
      const currentSig = nodes.map((node) => node.querySelector("input")?.value || "?").join("|");
      const nextSig = base.map((node) => node.querySelector("input")?.value || "?").join("|");
      if (nextSig === currentSig && base.length > 1) {
        [base[0], base[1]] = [base[1], base[0]];
      }
      const finalSig = base.map((node) => node.querySelector("input")?.value || "?").join("|");
      if (finalSig === lastOrder.join("|") && base.length > 2) {
        [base[1], base[2]] = [base[2], base[1]];
      }
      lastOrder = base.map((node) => node.querySelector("input")?.value || "?");
      return base;
    }

    function animateReorder(nodes) {
      const beforeRects = new Map();
      nodes.forEach((node) => {
        beforeRects.set(node, node.getBoundingClientRect());
      });

      const reordered = nextOrder(nodes);
      reordered.forEach((entry) => questionOptions.appendChild(entry));

      const orderedNodes = Array.from(questionOptions.querySelectorAll("label.option"));
      orderedNodes.forEach((node, idx) => {
        const before = beforeRects.get(node);
        if (!before) return;
        const after = node.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (!dx && !dy) return;
        const tilt = (idx % 2 === 0 ? 1 : -1) * (2.5 + (idx % 3));
        const settleX = dx * 0.28;
        const settleY = dy * 0.28;
        node.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scale(0.96) rotate(${tilt}deg)`,
              filter: "blur(1.6px) saturate(1.28)",
            },
            {
              transform: `translate(${settleX}px, ${settleY}px) scale(1.05) rotate(${tilt * -0.35}deg)`,
              filter: "blur(0.45px) saturate(1.15)",
              offset: 0.45,
            },
            {
              transform: "translate(0, 0) scale(1) rotate(0deg)",
              filter: "blur(0px) saturate(1)",
            },
          ],
          {
            duration: reorderDurationMs,
            easing: "cubic-bezier(0.22, 0.78, 0.24, 1)",
            fill: "both",
            delay: idx * 14,
          }
        );
      });
    }

    function pulseEachOption(nodes) {
      nodes.forEach((node, idx) => {
        const ring = document.createElement("span");
        ring.className = "stress-option-ring";
        ring.style.setProperty("--ring-delay", `${idx * 42}ms`);
        ring.style.setProperty("--ring-size", `${40 + (idx % 3) * 8}px`);
        ring.style.setProperty("--ring-alpha", `${0.62 - (idx % 3) * 0.08}`);
        node.appendChild(ring);
        pushEphemeral(ring);
      });
    }

    const timeoutIds = [];
    const selected = selectedOptions[questionId] || "";
    for (let cycle = 0; cycle < totalCycles; cycle += 1) {
      const cycleDelay = warmupMs + cycle * cycleStepMs;
      const cycleTimer = setTimeout(() => {
        const cycleNodes = Array.from(questionOptions.querySelectorAll("label.option"));
        if (cycleNodes.length < 2) return;
        animateReorder(cycleNodes);
        pulseEachOption(cycleNodes);
        cycleNodes.forEach((node) => {
          node.classList.remove("stress-shuffle-flash");
        });
        requestAnimationFrame(() => {
          cycleNodes.forEach((node) => node.classList.add("stress-shuffle-flash"));
        });
        if (selected) {
          const input = questionOptions.querySelector(`input[value="${selected}"]`);
          if (input) input.checked = true;
        }
      }, cycleDelay);
      timeoutIds.push(cycleTimer);
    }

    const totalDurationMs = warmupMs + totalCycles * cycleStepMs;
    return {
      durationMs: totalDurationMs,
      cleanup: () => {
        timeoutIds.forEach((id) => clearTimeout(id));
        questionOptions.classList.remove("stress-option-shuffle");
        questionOptions.querySelectorAll(".stress-shuffle-flash").forEach((node) => node.classList.remove("stress-shuffle-flash"));
        ephemeralNodes.forEach((node) => node.remove());
        topBanner.remove();
      },
    };
  }

  function triggerPhantomCompetitor() {
    const host = getTestCard();
    if (!host) return null;
    const statusSteps = [
      "⚡ 3 people just moved ahead of you",
      "🔥 Others are clearing this faster — you're still here",
      "🚨 You're falling behind the current pace",
      "👀 Most have already locked an answer",
      "⚡ Someone just overtook you — gap increasing",
    ];
    let pickedIndex = stableRange("phantomCompetitor_copy", 0, statusSteps.length - 1);
    if (pickedIndex === state.lastPhantomMessageIndex) {
      pickedIndex = (pickedIndex + 1) % statusSteps.length;
    }
    state.lastPhantomMessageIndex = pickedIndex;
    const pickedMessage = statusSteps[pickedIndex];
    const quotes = [
      "Pressure from others is noise. But can you filter it?",
      "Race panic is my favorite shortcut to mistakes.",
      "They are ahead. Are you still thinking clearly?",
      "Speed envy breaks focus faster than fear.",
    ];
    const quote = quotes[stableRange("phantomCompetitor_quote", 0, quotes.length - 1)];
    const topBanner = mountDevilTopBanner({
      title: "Devil Crowd",
      lead: "Look around. Everyone seems to be moving faster than you.",
      challenge: "Can you hold your pace without chasing panic?",
      taunt: quote,
    });

    const banner = document.createElement("div");
    banner.className = "stress-competitor-banner";
    banner.innerHTML = `
      <span class="pulse"></span>
      <span class="message">${escapeHTML(pickedMessage)}</span>
    `;

    const head = host.querySelector(".test-head");
    if (head) host.insertBefore(banner, head);
    else host.prepend(banner);

    return {
      durationMs: stableRange("phantomCompetitor_duration", 5000, 8000),
      cleanup: () => {
        banner.remove();
        topBanner.remove();
      },
    };
  }

  function triggerStressTimer() {
    const durationMs = stableRange("stressTimer_duration", 10000, 15000);
    const quotes = [
      "Time noise is bait. Precision is the weapon.",
      "The clock screams loudest when your plan is weak.",
      "Beat me by staying methodical, not frantic.",
      "A rushed mind burns seconds faster than any timer.",
    ];
    const quote = quotes[stableRange("stressTimer_quote", 0, quotes.length - 1)];
    const topBanner = mountDevilTopBanner({
      title: "Devil Timer",
      lead: "I tightened the clock around your decision making.",
      challenge: "Answer under pressure. Can you stay exact?",
      taunt: quote,
    });

    const overlay = document.createElement("div");
    overlay.className = "stress-timer-overlay is-dramatic";
    overlay.style.setProperty("--stress-timer-duration", `${durationMs}ms`);
    let fakeCount = 60;
    overlay.innerHTML = `
      <div class="title">Time Compression</div>
      <div class="count">${fakeCount}s</div>
      <div class="stress-meter"><span style="width:100%"></span></div>
    `;
    document.body.appendChild(overlay);
    const tickId = setInterval(() => {
      fakeCount = Math.max(0, fakeCount - 1);
      const countEl = overlay.querySelector(".count");
      if (countEl) countEl.textContent = `${fakeCount}s`;
      const meter = overlay.querySelector(".stress-meter span");
      if (meter) meter.style.width = `${Math.max(0, Math.min(100, (fakeCount / 60) * 100))}%`;
    }, 280);
    return {
      durationMs,
      cleanup: () => {
        clearInterval(tickId);
        overlay.remove();
        topBanner.remove();
      },
    };
  }

  function triggerConfidenceBreaker() {
    const punchLines = [
      "You cannot beat the devil with guesses.",
      "Devil reads panic. Panic reads wrong.",
      "You blinked. Devil didn't.",
      "The devil wins when focus breaks.",
      "Beat the question, not your own nerves.",
    ];
    let punchIndex = Math.floor(Math.random() * punchLines.length);
    if (punchLines.length > 1 && punchIndex === state.lastConfidencePunchIndex) {
      punchIndex = (punchIndex + 1 + Math.floor(Math.random() * (punchLines.length - 1))) % punchLines.length;
    }
    state.lastConfidencePunchIndex = punchIndex;
    const punchLine = punchLines[punchIndex];

    const overlay = document.createElement("div");
    overlay.className = "stress-fail-overlay";
    overlay.innerHTML = `
      <div class="stress-fail-popup" role="dialog" aria-modal="true" aria-label="Test failed popup">
        <button type="button" class="stress-fail-close" aria-label="Close fail popup">×</button>
        <div class="stress-fail-emoji" aria-hidden="true">😈</div>
        <div class="stress-fail-main">Devil catched you</div>
        <div class="stress-fail-title">Wrong answer locked. Test failed.</div>
        <div class="stress-fail-sub">${escapeHTML(punchLine)}</div>
      </div>
    `;

    const closeBtn = overlay.querySelector(".stress-fail-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        deactivateTrigger("confidenceBreaker");
      });
    }

    document.body.appendChild(overlay);
    return {
      durationMs: stableRange("confidenceBreaker_duration", 8000, 12000),
      cleanup: () => overlay.remove(),
    };
  }

  function triggerMirageHighlight() {
    if (!questionOptions) return null;
    const allOptions = Array.from(questionOptions.querySelectorAll("label.option"));
    if (!allOptions.length) return null;
    const targetIndex = stableRange("mirageHighlight_target", 0, allOptions.length - 1);
    const target = allOptions[targetIndex];
    if (!target) return null;

    const punchLines = [
      "Chaos picks favorites. This could be your lucky click.",
      "Devil whispers: this one smells like a right answer.",
      "I lit this option for you. Try it if you dare.",
      "When logic shakes, this one may still stand.",
      "Take the hint. Devil rarely repeats himself.",
    ];
    let punchIndex = stableRange("mirageHighlight_punch", 0, punchLines.length - 1);
    if (punchLines.length > 1 && punchIndex === state.lastMiragePunchIndex) {
      punchIndex = (punchIndex + 1) % punchLines.length;
    }
    state.lastMiragePunchIndex = punchIndex;

    const cloud = document.createElement("div");
    cloud.className = "stress-devil-cloud";
    cloud.setAttribute("role", "status");
    cloud.setAttribute("aria-live", "polite");
    cloud.innerHTML = `
      <div class="stress-devil-avatar" aria-hidden="true">😈</div>
      <div class="stress-devil-bubble">
        <strong>Devil says</strong>
        <span>This option may be correct.</span>
        <em>${escapeHTML(punchLines[punchIndex])}</em>
      </div>
    `;

    target.classList.add("stress-mirage");
    target.appendChild(cloud);
    return {
      durationMs: stableRange("mirageHighlight_duration", 2200, 3400),
      cleanup: () => {
        target.classList.remove("stress-mirage");
        cloud.remove();
      },
    };
  }

  function triggerBlurAttack() {
    const taunts = [
      "Why can't you see? You're already losing. 😂",
      "Devil can control your vision. Keep up if you can. 😂",
      "Blurred focus, blurred score. Are you still in this? 😂",
      "Vision fading, pressure rising. Beat it if you dare. 😂",
    ];
    const taunt = taunts[stableRange("blurAttack_taunt", 0, taunts.length - 1)];
    const topBanner = mountDevilTopBanner({
      title: "Vision Hijack",
      lead: "I blurred your sight to break your rhythm.",
      challenge: "Can you solve it when clarity starts fading?",
      taunt,
    });

    const layer = document.createElement("div");
    layer.className = "stress-vignette";
    document.body.appendChild(layer);
    document.body.classList.add("stress-blur-attack");
    return {
      durationMs: 5000,
      cleanup: () => {
        document.body.classList.remove("stress-blur-attack");
        layer.remove();
        topBanner.remove();
      },
    };
  }

  function triggerHeartbeatVibration() {
    const shell = getAppShell();
    const lines = [
      "Keep your head steady. Panic is my playground.",
      "If your pulse leads, your logic follows it off a cliff.",
      "Breathe. Then answer. Speed without control is mine.",
      "A faster heart is fine. A rushed mind is fatal.",
    ];
    const taunt = lines[stableRange("heartbeatVibration_line", 0, lines.length - 1)];
    const banner = mountDevilTopBanner({
      title: "Devil Notice",
      lead: "Devil noticed that your heartbeat has increased a bit.",
      challenge: "Let's test your strength... can you answer beating that much faster?",
      taunt,
    });

    const focusFog = document.createElement("div");
    focusFog.className = "stress-heartbeat-focus";

    document.body.appendChild(focusFog);
    document.body.appendChild(banner);
    shell?.classList.add("stress-heartbeat");
    if (navigator.vibrate) {
      try {
        navigator.vibrate([130, 50, 150, 50, 170, 70, 130]);
      } catch (e) {
        // no-op
      }
    }
    return {
      durationMs: stableRange("heartbeatVibration_duration", 6500, 11000),
      cleanup: () => {
        shell?.classList.remove("stress-heartbeat");
        focusFog.remove();
        banner.remove();
      },
    };
  }

  function triggerScreenFlip() {
    const shell = getAppShell();
    if (!shell) return null;
    const taunts = [
      "Orientation is comfort. I just took it.",
      "When the world turns, only discipline stays upright.",
      "Panic flips first. Mind flips next.",
      "Your focus should not depend on direction.",
    ];
    const taunt = taunts[stableRange("screenFlip_taunt", 0, taunts.length - 1)];
    const banner = mountDevilTopBanner({
      title: "Devil Flip",
      lead: "I turned your screen against you.",
      challenge: "Answer now. Can your focus survive a full flip?",
      taunt,
    });

    shell.classList.add("stress-screen-flip");
    return {
      durationMs: stableRange("screenFlip_duration", 2600, 4200),
      cleanup: () => {
        shell.classList.remove("stress-screen-flip");
        banner.remove();
      },
    };
  }

  function triggerColorInversion() {
    const taunts = [
      "Light, dark, it does not matter when your mind is steady.",
      "Colors changed. Logic did not.",
      "Visual shock is easy. Stable focus is rare.",
      "Let your eyes panic. Keep your reasoning cold.",
    ];
    const taunt = taunts[stableRange("colorInversion_taunt", 0, taunts.length - 1)];
    const banner = mountDevilTopBanner({
      title: "Devil Inversion",
      lead: "I inverted your world in one blink.",
      challenge: "Now answer. Can you think clearly in this chaos?",
      taunt,
    });

    document.body.classList.add("stress-color-inversion");
    return {
      durationMs: stableRange("colorInversion_duration", 2600, 4200),
      cleanup: () => {
        document.body.classList.remove("stress-color-inversion");
        banner.remove();
      },
    };
  }

  function triggerWaveDistortion() {
    const shell = getAppShell();
    if (!shell) return null;
    const quotes = [
      "Read through the sway, not through panic.",
      "If lines move, your logic should not.",
      "Steady eyes beat unstable motion.",
      "Waves are visual. Mistakes are permanent.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Wave",
      lead: "I bent your screen into a moving tide.",
      challenge: "Can you read with discipline while the page drifts?",
      taunt: quotes[stableRange("waveDistortion_quote", 0, quotes.length - 1)],
    });

    const waveLayer = document.createElement("div");
    waveLayer.className = "stress-wave-sheet";
    const rowCount = 6;
    for (let i = 0; i < rowCount; i += 1) {
      const row = document.createElement("span");
      row.className = "wave-row";
      const top = (i * 100) / rowCount;
      const amp = stableRange(`waveDistortion_rowAmp_${i}`, 14, 30);
      const dir = i % 2 === 0 ? 1 : -1;
      row.style.setProperty("--top", `${top.toFixed(2)}%`);
      row.style.setProperty("--h", `${(100 / rowCount + 1.2).toFixed(2)}%`);
      row.style.setProperty("--dur", `${stableRange(`waveDistortion_rowDur_${i}`, 2200, 3600)}ms`);
      row.style.setProperty("--delay", `${stableRange(`waveDistortion_rowDelay_${i}`, 0, 600)}ms`);
      row.style.setProperty("--from-x", `${-amp * dir}px`);
      row.style.setProperty("--mid-x", `${amp * dir}px`);
      row.style.setProperty("--near-x", `${Math.round(amp * 0.35 * dir)}px`);
      row.style.setProperty("--tilt", `${(dir * 0.8).toFixed(2)}deg`);
      row.style.setProperty("--texture-dur", `${stableRange(`waveDistortion_textureDur_${i}`, 1200, 2300)}ms`);
      row.style.setProperty("--heave", `${stableRange(`waveDistortion_heave_${i}`, 2, 5)}px`);
      row.style.setProperty("--heave-dur", `${stableRange(`waveDistortion_heaveDur_${i}`, 2200, 4200)}ms`);
      waveLayer.appendChild(row);
    }

    const fishCount = 10;
    for (let i = 0; i < fishCount; i += 1) {
      const fish = document.createElement("span");
      const leftToRight = i % 2 === 0;
      fish.className = `wave-fish ${leftToRight ? "dir-ltr" : "dir-rtl"}`;
      fish.style.setProperty("--y", `${stableRange(`waveDistortion_fishY_${i}`, 18, 78)}%`);
      fish.style.setProperty("--size", `${stableRange(`waveDistortion_fishSize_${i}`, 16, 30)}px`);
      fish.style.setProperty("--dur", `${stableRange(`waveDistortion_fishDur_${i}`, 4200, 9200)}ms`);
      fish.style.setProperty("--delay", `${stableRange(`waveDistortion_fishDelay_${i}`, 0, 1400)}ms`);
      fish.style.setProperty("--bob", `${stableRange(`waveDistortion_fishBob_${i}`, 6, 16)}px`);
      fish.style.setProperty("--start-x", leftToRight ? "-12%" : "108%");
      fish.style.setProperty("--mid-x", leftToRight ? "52%" : "48%");
      fish.style.setProperty("--end-x", leftToRight ? "108%" : "-12%");
      fish.style.setProperty("--flip", leftToRight ? "1" : "-1");
      waveLayer.appendChild(fish);
    }

    const grassCount = 18;
    for (let i = 0; i < grassCount; i += 1) {
      const grass = document.createElement("span");
      grass.className = "wave-grass";
      grass.style.setProperty("--x", `${stableRange(`waveDistortion_grassX_${i}`, 2, 98)}%`);
      grass.style.setProperty("--h", `${stableRange(`waveDistortion_grassH_${i}`, 24, 72)}px`);
      grass.style.setProperty("--w", `${stableRange(`waveDistortion_grassW_${i}`, 3, 8)}px`);
      grass.style.setProperty("--dur", `${stableRange(`waveDistortion_grassDur_${i}`, 1800, 3600)}ms`);
      grass.style.setProperty("--delay", `${stableRange(`waveDistortion_grassDelay_${i}`, 0, 1600)}ms`);
      grass.style.setProperty("--bend", `${stableRange(`waveDistortion_grassBend_${i}`, 6, 18)}deg`);
      waveLayer.appendChild(grass);
    }

    const crabCount = 5;
    for (let i = 0; i < crabCount; i += 1) {
      const crab = document.createElement("span");
      crab.className = "wave-crab";
      crab.textContent = "🦀";
      const leftToRight = i % 2 === 0;
      crab.style.setProperty("--x", `${stableRange(`waveDistortion_crabX_${i}`, 10, 90)}%`);
      crab.style.setProperty("--y", `${stableRange(`waveDistortion_crabY_${i}`, 84, 96)}%`);
      crab.style.setProperty("--dur", `${stableRange(`waveDistortion_crabDur_${i}`, 2600, 6200)}ms`);
      crab.style.setProperty("--delay", `${stableRange(`waveDistortion_crabDelay_${i}`, 0, 1800)}ms`);
      crab.style.setProperty("--travel", `${stableRange(`waveDistortion_crabTravel_${i}`, 8, 24)}px`);
      crab.style.setProperty("--flip", leftToRight ? "1" : "-1");
      waveLayer.appendChild(crab);
    }

    const bubbleCount = 22;
    for (let i = 0; i < bubbleCount; i += 1) {
      const bubble = document.createElement("span");
      bubble.className = "wave-bubble";
      bubble.style.setProperty("--x", `${stableRange(`waveDistortion_bubbleX_${i}`, 4, 96)}%`);
      bubble.style.setProperty("--size", `${stableRange(`waveDistortion_bubbleSize_${i}`, 4, 14)}px`);
      bubble.style.setProperty("--dur", `${stableRange(`waveDistortion_bubbleDur_${i}`, 1800, 4600)}ms`);
      bubble.style.setProperty("--delay", `${stableRange(`waveDistortion_bubbleDelay_${i}`, 0, 2600)}ms`);
      bubble.style.setProperty("--rise", `${stableRange(`waveDistortion_bubbleRise_${i}`, 26, 72)}px`);
      bubble.style.setProperty("--sway", `${stableRange(`waveDistortion_bubbleSway_${i}`, 3, 16)}px`);
      waveLayer.appendChild(bubble);
    }

    document.body.appendChild(waveLayer);
    shell.classList.add("stress-wave-distortion");
    return {
      durationMs: stableRange("waveDistortion_duration", 4200, 6800),
      cleanup: () => {
        waveLayer.remove();
        shell.classList.remove("stress-wave-distortion");
        topBanner.remove();
      },
    };
  }

  function triggerFakeMentorCount() {
    const quotes = [
      "Eyes are on you. Noise is optional.",
      "Mentors watching. You still owe clean thinking.",
      "Audience pressure is my favorite distraction.",
      "Being watched changes nothing. Your method matters.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Audience",
      lead: "Mentors are watching this attempt in real time.",
      challenge: "Can you ignore the crowd and stay exact?",
      taunt: quotes[stableRange("fakeMentorCount_quote", 0, quotes.length - 1)],
    });

    const card = document.createElement("div");
    card.className = "stress-mentor-watch";
    let count = stableRange("fakeMentorCount_seed", 18, 43);
    card.innerHTML = `
      <div class="label">Mentors Watching</div>
      <div class="count">${count}</div>
      <div class="sub">Live observer panel connected</div>
    `;
    document.body.appendChild(card);

    const tick = setInterval(() => {
      const delta = stableRange("fakeMentorCount_delta", -1, 3);
      count = Math.max(7, count + delta);
      const countEl = card.querySelector(".count");
      if (countEl) countEl.textContent = String(count);
    }, 900);

    return {
      durationMs: stableRange("fakeMentorCount_duration", 6200, 9800),
      cleanup: () => {
        clearInterval(tick);
        card.remove();
        topBanner.remove();
      },
    };
  }

  function triggerChaosBackground() {
    const quotes = [
      "Background noise is the oldest trap in focus work.",
      "Ignore the art. Read the stem.",
      "If visuals lead you, reason will lag.",
      "The scene moves. The answer does not.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Fractals",
      lead: "I turned your background into elegant chaos.",
      challenge: "Can your attention stay locked on the question?",
      taunt: quotes[stableRange("chaosBackground_quote", 0, quotes.length - 1)],
    });

    const layer = document.createElement("div");
    layer.className = "stress-chaos-bg-layer";

    const glyphs = ["?", "!", "#", "∿", "≈", "⊗", "◇", "△", "⊕", "☍", "⚠", "✶"];
    const rand = (min, max) => min + Math.random() * (max - min);

    for (let i = 0; i < 22; i += 1) {
      const shard = document.createElement("span");
      shard.className = "chaos-shard";
      shard.textContent = glyphs[Math.floor(rand(0, glyphs.length))];
      shard.style.setProperty("--x", `${rand(4, 96).toFixed(2)}%`);
      shard.style.setProperty("--y", `${rand(6, 94).toFixed(2)}%`);
      shard.style.setProperty("--dur", `${rand(1800, 4600).toFixed(0)}ms`);
      shard.style.setProperty("--delay", `${rand(0, 1200).toFixed(0)}ms`);
      shard.style.setProperty("--drift-x", `${rand(-26, 26).toFixed(1)}px`);
      shard.style.setProperty("--drift-y", `${rand(-30, 30).toFixed(1)}px`);
      shard.style.setProperty("--rot", `${rand(-34, 34).toFixed(1)}deg`);
      shard.style.setProperty("--size", `${rand(12, 28).toFixed(0)}px`);
      layer.appendChild(shard);
    }

    for (let i = 0; i < 8; i += 1) {
      const orb = document.createElement("span");
      orb.className = "chaos-orb";
      orb.style.setProperty("--x", `${rand(6, 94).toFixed(2)}%`);
      orb.style.setProperty("--y", `${rand(8, 92).toFixed(2)}%`);
      orb.style.setProperty("--dur", `${rand(2600, 5200).toFixed(0)}ms`);
      orb.style.setProperty("--delay", `${rand(0, 1300).toFixed(0)}ms`);
      orb.style.setProperty("--drift-x", `${rand(-44, 44).toFixed(1)}px`);
      orb.style.setProperty("--drift-y", `${rand(-28, 28).toFixed(1)}px`);
      orb.style.setProperty("--size", `${rand(54, 140).toFixed(0)}px`);
      layer.appendChild(orb);
    }

    document.body.appendChild(layer);
    document.body.classList.add("stress-chaos-bg");

    const burstTimer = setInterval(() => {
      const shard = document.createElement("span");
      shard.className = "chaos-shard burst";
      shard.textContent = glyphs[Math.floor(rand(0, glyphs.length))];
      shard.style.setProperty("--x", `${rand(8, 92).toFixed(2)}%`);
      shard.style.setProperty("--y", `${rand(8, 92).toFixed(2)}%`);
      shard.style.setProperty("--dur", `${rand(1200, 2200).toFixed(0)}ms`);
      shard.style.setProperty("--delay", "0ms");
      shard.style.setProperty("--drift-x", `${rand(-34, 34).toFixed(1)}px`);
      shard.style.setProperty("--drift-y", `${rand(-34, 34).toFixed(1)}px`);
      shard.style.setProperty("--rot", `${rand(-70, 70).toFixed(1)}deg`);
      shard.style.setProperty("--size", `${rand(16, 30).toFixed(0)}px`);
      layer.appendChild(shard);
      setTimeout(() => shard.remove(), 2500);
    }, 520);

    return {
      durationMs: stableRange("chaosBackground_duration", 7000, 12000),
      cleanup: () => {
        clearInterval(burstTimer);
        document.body.classList.remove("stress-chaos-bg");
        layer.remove();
        topBanner.remove();
      },
    };
  }

  function triggerShepardTone() {
    const quotes = [
      "Listen closely: tension rises without release.",
      "The tone climbs. Keep your reasoning grounded.",
      "Endless rise, no landing. Classic focus break.",
      "Your ears panic first. Your mind follows.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Tone",
      lead: "I started a rising tension tone in your ears.",
      challenge: "Can you solve while pressure keeps climbing?",
      taunt: quotes[stableRange("shepardTone_quote", 0, quotes.length - 1)],
    });

    let master = null;
    let pulseTimer = null;
    let stopped = false;

    resumeAudioContextIfNeeded().then((ctx) => {
      if (!ctx || stopped) return;
      master = ctx.createGain();
      master.gain.value = 0.05;
      master.connect(ctx.destination);

      const spawnPulse = () => {
        if (stopped) return;
        const base = 140 + stableRange("shepardTone_base", 0, 70);
        [0, 12, 24].forEach((semi, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx % 2 === 0 ? "sine" : "triangle";
          osc.frequency.value = base * Math.pow(2, semi / 12);
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(master);
          const now = ctx.currentTime;
          gain.gain.exponentialRampToValueAtTime(0.018 - idx * 0.004, now + 0.28);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
          osc.start(now);
          osc.stop(now + 0.92);
        });
      };

      spawnPulse();
      pulseTimer = setInterval(spawnPulse, 720);
    });

    return {
      durationMs: stableRange("shepardTone_duration", 8000, 13000),
      cleanup: () => {
        stopped = true;
        if (pulseTimer) clearInterval(pulseTimer);
        try {
          master?.disconnect();
        } catch (e) {
          // no-op
        }
        topBanner.remove();
      },
    };
  }

  function triggerSpatialTicking() {
    const quotes = [
      "Tick left. Tick right. Where is your focus now?",
      "The clock circles you. Keep the answer centered.",
      "Directional time noise breaks reading rhythm.",
      "Follow the question, not the sound path.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Clock",
      lead: "I moved ticking sound around your head.",
      challenge: "Can you hold focus while time hunts from both sides?",
      taunt: quotes[stableRange("spatialTicking_quote", 0, quotes.length - 1)],
    });

    topBanner.classList.add("is-clock-ticking");
    const bubble = topBanner.querySelector(".bubble");
    if (bubble) {
      const clock = document.createElement("span");
      clock.className = "devil-ticking-clock";
      clock.innerHTML = `<span class="face"></span><span class="hand"></span><span class="dot"></span>`;
      bubble.appendChild(clock);
    }

    let tickTimer = null;
    let stopped = false;

    resumeAudioContextIfNeeded().then((ctx) => {
      if (!ctx || stopped) return;
      let step = 0;
      tickTimer = setInterval(() => {
        if (stopped) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
        osc.type = "square";
        osc.frequency.value = 950;
        gain.gain.value = 0.0001;
        const p = Math.sin(step * 0.72);
        step += 1;
        if (pan) {
          pan.pan.value = p;
          osc.connect(gain);
          gain.connect(pan);
          pan.connect(ctx.destination);
        } else {
          osc.connect(gain);
          gain.connect(ctx.destination);
        }
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.1);
      }, 320);
    });

    return {
      durationMs: stableRange("spatialTicking_duration", 7000, 12000),
      cleanup: () => {
        stopped = true;
        if (tickTimer) clearInterval(tickTimer);
        topBanner.remove();
      },
    };
  }

  function triggerFakeLowBattery() {
    const quotes = [
      "Power fear is fake. Mistakes are real.",
      "The battery warning is bait. Ignore and solve.",
      "Low power message. High pressure judgment.",
      "Urgency popups are my easiest traps.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Battery",
      lead: "I injected a system battery warning into your exam.",
      challenge: "Can you ignore fake urgency and stay accurate?",
      taunt: quotes[stableRange("fakeLowBattery_quote", 0, quotes.length - 1)],
    });

    const card = document.createElement("div");
    card.className = "stress-center-alert win11 low-battery";
    card.innerHTML = `
      <div class="win11-titlebar">
        <span class="app-dot" aria-hidden="true"></span>
        <span class="title">System Notification</span>
        <span class="window-actions" aria-hidden="true">— □ ×</span>
      </div>
      <div class="win11-body">
        <div class="alert-icon">🔋</div>
        <div class="content">
          <div class="alert-title">Battery Critically Low</div>
          <div class="alert-sub">3% remaining. Connect charger to prevent unexpected shutdown.</div>
          <div class="diag-line">Power service: <strong>ACPI_BAT_MONITOR</strong></div>
          <div class="diag-line">Diagnostic code: <strong>PWR-0x8A21</strong></div>
        </div>
      </div>
      <div class="win11-footer">
        <button type="button">Open Power Settings</button>
        <button type="button">Remind me later</button>
      </div>
    `;
    document.body.appendChild(card);
    return {
      durationMs: stableRange("fakeLowBattery_duration", 4200, 7200),
      cleanup: () => {
        card.remove();
        topBanner.remove();
      },
    };
  }

  function triggerFakeCrashScreen() {
    const quotes = [
      "A fake crash should not crash your focus.",
      "System panic is theater. Solve anyway.",
      "Error screens are noise until proven real.",
      "Can your composure outlive this fake failure?",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Crash",
      lead: "I staged a fake Windows diagnostic crash panel.",
      challenge: "Can you recover composure faster than the shock?",
      taunt: quotes[stableRange("fakeCrashScreen_quote", 0, quotes.length - 1)],
    });

    const card = document.createElement("div");
    card.className = "stress-center-alert win11 fake-crash";
    card.innerHTML = `
      <div class="win11-titlebar">
        <span class="app-dot" aria-hidden="true"></span>
        <span class="title">Windows Diagnostic Host</span>
        <span class="window-actions" aria-hidden="true">— □ ×</span>
      </div>
      <div class="win11-body">
        <div class="alert-icon">⚠️</div>
        <div class="content">
          <div class="alert-title">System UI Unresponsive</div>
          <div class="alert-sub">Collecting diagnostics and attempting recovery.</div>
          <div class="diag-line">Fault module: <strong>UIRenderer.dll</strong></div>
          <div class="diag-line">Exception code: <strong>0xC0000409</strong></div>
          <div class="diag-line">Session trace: <strong>WDH-${stableRange("fakeCrashScreen_trace", 1200, 9999)}</strong></div>
        </div>
      </div>
      <div class="win11-footer">
        <button type="button">Run Diagnostics</button>
        <button type="button">Close Program</button>
      </div>
    `;
    document.body.appendChild(card);
    return {
      durationMs: stableRange("fakeCrashScreen_duration", 3200, 5600),
      cleanup: () => {
        card.remove();
        topBanner.remove();
      },
    };
  }

  function triggerBlackout() {
    const quotes = [
      "Darkness tests memory and composure.",
      "When vision disappears, panic appears.",
      "Temporary blackout. Permanent consequences.",
      "Can your focus survive zero visibility?",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Blackout",
      lead: "Devil hacked your system and cut your display feed.",
      challenge: "Can you recover instantly when the screen returns?",
      taunt: quotes[stableRange("blackout_quote", 0, quotes.length - 1)],
    });

    const layer = document.createElement("div");
    layer.className = "stress-blackout";
    document.body.appendChild(layer);
    return {
      durationMs: stableRange("blackout_duration", 1200, 2400),
      cleanup: () => {
        layer.remove();
        topBanner.remove();
      },
    };
  }

  function triggerHesitationHeatmap() {
    const quotes = [
      "Your cursor betrays every hesitation.",
      "Indecision leaves a visible trail.",
      "I mapped your doubt in real time.",
      "Trails of hesitation, footprints of panic.",
    ];
    const topBanner = mountDevilTopBanner({
      title: "Devil Heatmap",
      lead: "I am visualizing every hesitation you make.",
      challenge: "Can you choose decisively while doubt is exposed?",
      taunt: quotes[stableRange("hesitationHeatmap_quote", 0, quotes.length - 1)],
    });

    const layer = document.createElement("div");
    layer.className = "stress-hesitation-layer";
    document.body.appendChild(layer);

    let lastMoveAt = 0;
    const spawnDot = (x, y, hot) => {
      const dot = document.createElement("span");
      dot.className = `trace ${hot ? "hot" : ""}`;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      layer.appendChild(dot);
      setTimeout(() => dot.remove(), hot ? 1400 : 900);
    };

    const onMove = (evt) => {
      const now = Date.now();
      if (now - lastMoveAt < 55) return;
      lastMoveAt = now;
      spawnDot(evt.clientX, evt.clientY, false);
    };

    const onClick = (evt) => {
      spawnDot(evt.clientX, evt.clientY, true);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });

    return {
      durationMs: stableRange("hesitationHeatmap_duration", 7000, 12000),
      cleanup: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("click", onClick);
        layer.remove();
        topBanner.remove();
      },
    };
  }

  function triggerBollywoodReelTrap() {
    const shell = getAppShell();

    function inferTopicFromAnswers() {
      const corpus = state.followupAnswers
        .slice(-12)
        .map((entry) => `${entry.answer || ""} ${entry.domain || ""} ${entry.slot || ""}`)
        .join(" ")
        .toLowerCase();
      if (/cricket|football|sport|match|league/.test(corpus)) return { topic: "sports", emoji: "🏅" };
      if (/music|song|dance|playlist|guitar|rap/.test(corpus)) return { topic: "music", emoji: "🎵" };
      if (/tech|ai|coding|app|software|phone|device/.test(corpus)) return { topic: "technology", emoji: "🤖" };
      if (/movie|film|series|actor|cinema/.test(corpus)) return { topic: "movies", emoji: "🎬" };
      if (/health|sleep|stress|focus|diet/.test(corpus)) return { topic: "health", emoji: "🩺" };
      const fallback = [
        { topic: "movies", emoji: "🎬" },
        { topic: "movies", emoji: "🎬" },
        { topic: "movies", emoji: "🎬" },
        { topic: "technology", emoji: "🤖" },
        { topic: "science", emoji: "🔬" },
        { topic: "world", emoji: "🌍" },
      ];
      return fallback[Math.floor(Math.random() * fallback.length)];
    }

    function pickBestHeadline(headlines) {
      if (!Array.isArray(headlines) || !headlines.length) return null;
      const scored = headlines
        .filter((item) => item && item.title)
        .map((item) => {
          const title = String(item.title || "");
          let score = Math.min(40, title.length);
          if (/breaking|latest|new|first|watch|major|report/i.test(title)) score += 12;
          if (/:/.test(title)) score += 8;
          return { item, score };
        })
        .sort((a, b) => b.score - a.score);
      return scored[0]?.item || null;
    }

    const factBank = {
      technology: [
        {
          title: "AI assistants now summarize long documents in seconds",
          summary: "Recent education tooling trends show students increasingly using summarization features to reduce reading time.",
          detail: "Usage snapshots indicate students are now combining summaries with concept maps to revise broader units more quickly before tests.",
          joke: "AI said: I can summarize 40 pages. Student said: summarize my whole semester too.",
          source: "Tech Brief",
        },
      ],
      science: [
        {
          title: "Sleep consistency strongly correlates with next-day concentration",
          summary: "Learning science research repeatedly finds regular sleep timing improves attention and recall in tests.",
          detail: "Across repeated studies, irregular late-night patterns show measurable dips in memory retrieval speed the next morning.",
          joke: "Brain at 2 AM: genius ideas. Brain at 9 AM exam: who am I?",
          source: "Science Digest",
        },
      ],
      world: [
        {
          title: "Student mobility is rising across major education hubs",
          summary: "New reports indicate growing cross-city academic movement as learners seek specialized programs.",
          detail: "Policy and placement trends both suggest students are choosing flexibility and industry-linked campuses more often than before.",
          joke: "Students changed cities for better courses; luggage still thinks this is a tour.",
          source: "Global Education Watch",
        },
      ],
      movies: [
        {
          title: "Short-form film explainers are shaping youth media habits",
          summary: "Media studies suggest quick explainers influence what students watch and discuss during breaks.",
          detail: "Engagement curves show concise explainers increase recall of plot points, cast references, and follow-up recommendations.",
          joke: "One reel explained the whole movie; still everyone asked, sequel kab aa raha hai?",
          source: "Screen Trends",
        },
      ],
      sports: [
        {
          title: "Micro-break routines are entering competitive training culture",
          summary: "Teams are increasingly adopting short focus resets between drills to sustain high performance.",
          detail: "Coaching reports link brief timed pauses with improved decision quality in late-session practice rounds.",
          joke: "Coach said micro-break. Team heard snack-break.",
          source: "Sports Analytics Desk",
        },
      ],
      music: [
        {
          title: "Lo-fi and ambient playlists remain top picks during study sessions",
          summary: "Listening behavior data shows students prefer low-distraction soundscapes for revision windows.",
          detail: "Playback analytics indicate calmer background tracks reduce skip rates during focused 25-40 minute study intervals.",
          joke: "Playlist said chill beats only. Student still danced during derivations.",
          source: "Audio Trends",
        },
      ],
      health: [
        {
          title: "Hydration and cognitive stamina are more linked than students assume",
          summary: "Campus wellness programs are emphasizing hydration as a practical way to avoid focus dips.",
          detail: "Recent student wellness audits found improved hydration habits correlate with steadier attention through long assessment blocks.",
          joke: "Water bottle became topper; everyone else asked for notes.",
          source: "Health Notes",
        },
      ],
    };

    const topicCtx = inferTopicFromAnswers();
    const panel = document.createElement("div");
    panel.className = "stress-news-quiz is-fact-edition";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = `
      <div class="news-quiz-card fact-edition app-popup-fact">
        <div class="fact-popup-topbar">
          <div class="fact-app-dot" aria-hidden="true"></div>
          <div class="fact-app-title">News Flash</div>
          <div class="fact-app-time">now</div>
        </div>
        <div class="fact-popup-body">
          <div class="fact-topic">${topicCtx.emoji} ${escapeHTML(topicCtx.topic)} update</div>
          <div class="news-list" data-role="story"></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    shell?.classList.add("stress-news-diversion-open");

    const storyEl = panel.querySelector('[data-role="story"]');
    let closeTimer = null;

    async function renderFact() {
      let best = null;
      try {
        const data = await postJSON("/api/bollywood/reel-fact", {
          topic_hint: topicCtx.topic,
          followup_answers: state.followupAnswers.slice(-12),
        });
        best = {
          title: data?.title,
          summary: data?.summary,
          detail: data?.detail,
          joke: data?.joke,
          source: data?.source,
        };
      } catch (e) {
        best = null;
      }

      if (!best || !best.title || !best.summary) {
        const topicFacts = factBank[topicCtx.topic] || factBank.movies || factBank.technology;
        best = topicFacts[Math.floor(Math.random() * topicFacts.length)] || topicFacts[0];
      }

      const title = escapeHTML(best?.title || "Latest update");
      const source = escapeHTML(best?.source || "News");
      const summary = escapeHTML(String(best?.summary || "Read this quick fact and return to test focus.").slice(0, 280));
      const detail = escapeHTML(String(best?.detail || "Recent trend checks suggest this update is likely to stay relevant for student discussions this week.").slice(0, 280));
      const joke = escapeHTML(String(best?.joke || "Even the syllabus needs an intermission.").slice(0, 160));

      if (storyEl) {
        storyEl.innerHTML = `
          <article class="news-item fact-story-block auto-pop expanded">
            <h4><span>${title}</span></h4>
            <p class="news-story">${summary}</p>
            <p class="news-story extra">${detail}</p>
            <p class="fact-joke">${joke}</p>
            <p class="fact-meta">${source} • just now</p>
          </article>
        `;
      }

      closeTimer = setTimeout(() => {
        deactivateTrigger("bollywoodReelTrap");
      }, 5000);
    }

    renderFact();

    return {
      durationMs: 0,
      cleanup: () => {
        if (closeTimer) clearTimeout(closeTimer);
        shell?.classList.remove("stress-news-diversion-open");
        panel.remove();
      },
    };
  }

  const triggerHandlers = {
    optionShuffle: triggerOptionShuffle,
    phantomCompetitor: triggerPhantomCompetitor,
    stressTimer: triggerStressTimer,
    confidenceBreaker: triggerConfidenceBreaker,
    mirageHighlight: triggerMirageHighlight,
    blurAttack: triggerBlurAttack,
    screenFlip: triggerScreenFlip,
    colorInversion: triggerColorInversion,
    heartbeatVibration: triggerHeartbeatVibration,
    waveDistortion: triggerWaveDistortion,
    fakeMentorCount: triggerFakeMentorCount,
    chaosBackground: triggerChaosBackground,
    shepardTone: triggerShepardTone,
    spatialTicking: triggerSpatialTicking,
    fakeLowBattery: triggerFakeLowBattery,
    fakeCrashScreen: triggerFakeCrashScreen,
    blackout: triggerBlackout,
    hesitationHeatmap: triggerHesitationHeatmap,
    bollywoodReelTrap: triggerBollywoodReelTrap,
  };

  function activateTrigger(name, context) {
    const check = canActivateTrigger(name, context);
    if (!check.ok) {
      debugLog("rejected", `${name}:${check.reason}`);
      return false;
    }
    const handler = triggerHandlers[name];
    if (!handler) return false;
    const out = handler(context);
    if (!out) {
      debugLog("rejected", `${name}:no-effect`);
      return false;
    }
    registerTrigger(name, out.cleanup, Number(out.durationMs || 0));
    return true;
  }

  function autoEvaluate() {
    if (disableStressMode) return;
    if (state.stage !== "popups") return;
    if (!testQuestions.length) return;

    const userState = currentUserState();
    const ranked = evaluateUserState(userState);
    for (const action of ranked) {
      if (activateTrigger(action.name, { userState })) {
        return;
      }
    }
  }

  function evaluateUserState(userState) {
    const actions = [];
    if (userState.idleMs > 8000) {
      actions.push({ name: "blurAttack", score: 90 });
      actions.push({ name: "colorInversion", score: 94 });
      actions.push({ name: "chaosBackground", score: 91 });
      actions.push({ name: "fakeMentorCount", score: 88 });
      actions.push({ name: "bollywoodReelTrap", score: 99 });
    }
    if (userState.answerChangeCount >= 3) {
      actions.push({ name: "optionShuffle", score: 86 });
      actions.push({ name: "screenFlip", score: 90 });
      actions.push({ name: "hesitationHeatmap", score: 92 });
      actions.push({ name: "waveDistortion", score: 89 });
      actions.push({ name: "bollywoodReelTrap", score: 97 });
    }
    if (userState.answerLatencyMs < 3000) {
      actions.push({ name: "confidenceBreaker", score: 84 });
      actions.push({ name: "screenFlip", score: 87 });
      actions.push({ name: "fakeCrashScreen", score: 90 });
    }
    if (userState.timeOnQuestionMs > 10000) {
      actions.push({ name: "phantomCompetitor", score: 82 });
      actions.push({ name: "colorInversion", score: 86 });
      actions.push({ name: "spatialTicking", score: 88 });
      actions.push({ name: "bollywoodReelTrap", score: 98 });
    }
    if (userState.timeRemainingMs < 300000) {
      actions.push({ name: "heartbeatVibration", score: 92 });
      actions.push({ name: "stressTimer", score: 89 });
      actions.push({ name: "shepardTone", score: 91 });
      actions.push({ name: "fakeLowBattery", score: 90 });
      actions.push({ name: "blackout", score: 93 });
    }
    if (userState.hoverIntentOnOption) {
      actions.push({ name: "mirageHighlight", score: 85 });
    }

    const dedupe = new Map();
    actions.forEach((item) => {
      const existing = dedupe.get(item.name);
      if (!existing || item.score > existing.score) {
        dedupe.set(item.name, item);
      }
    });

    return [...dedupe.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function getTriggerNames() {
    return Object.keys(triggerHandlers);
  }

  function onQuestionRendered(question) {
    state.currentQuestionId = question?.question_id || "";
    state.questionDifficulty = String(question?.difficulty || "");
    state.questionStartedAt = Date.now();
    state.lastAnswerLatencyMs = null;
    state.hoverIntentOnOption = false;
    state.hoverOptionEl = null;
  }

  function onOptionChange(questionId, prevValue, nextValue) {
    if (!questionId) return;
    if (prevValue && nextValue && prevValue !== nextValue) {
      state.answerChangesByQuestion[questionId] = Number(state.answerChangesByQuestion[questionId] || 0) + 1;
    }
    if (state.lastAnswerLatencyMs == null && state.questionStartedAt) {
      state.lastAnswerLatencyMs = Date.now() - state.questionStartedAt;
    }
    markInteraction("click");
  }

  function onOptionHover(optionEl) {
    state.hoverIntentOnOption = true;
    state.hoverOptionEl = optionEl || null;
    markInteraction("pointer");
  }

  function beginExamTimer() {
    if (!state.examStartedAt) {
      state.examStartedAt = Date.now();
    }
  }

  async function beforeSubmitDelay() {
    state.isSubmittingAnswer = true;
  }

  function afterSubmit() {
    state.isSubmittingAnswer = false;
  }

  function onReset() {
    state.examStartedAt = 0;
    state.questionStartedAt = 0;
    state.currentQuestionId = "";
    state.answerChangesByQuestion = {};
    state.followupAnswers = [];
    state.lastAnswerLatencyMs = null;
    state.isSubmittingAnswer = false;
    deactivateAllTriggers();
  }

  function recordFollowupAnswer(answer, domain, slot, questionText) {
    const clean = String(answer || "").trim();
    if (!clean) return;
    state.followupAnswers.push({
      answer: clean,
      domain: domain || "",
      slot: slot || "",
      question: String(questionText || ""),
      at: Date.now(),
    });
    if (state.followupAnswers.length > 20) {
      state.followupAnswers = state.followupAnswers.slice(-20);
    }
  }

  function mountDevPanel() {
    if (!enableDevTriggerPanel || !hudPanel) return;
    if (document.getElementById("devTriggerPanel")) return;

    const panel = document.createElement("div");
    panel.className = "hud-section dev-trigger-panel";
    panel.id = "devTriggerPanel";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "Trigger Test (Dev)";
    panel.appendChild(title);

    const row = document.createElement("div");
    row.className = "dev-trigger-grid";

    getTriggerNames().forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost small dev-trigger-btn";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        if (isTriggerActive(name)) {
          deactivateTrigger(name);
          return;
        }
        activateTrigger(name, { force: true, manual: true, userState: currentUserState() });
      });
      devButtons.set(name, btn);
      row.appendChild(btn);
    });

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn danger small dev-trigger-clear";
    clearBtn.textContent = "Clear Triggers";
    clearBtn.addEventListener("click", () => deactivateAllTriggers());

    const fallbackBtn = document.createElement("button");
    fallbackBtn.type = "button";
    fallbackBtn.className = "btn primary small dev-fallback-open";
    fallbackBtn.textContent = "Open Fallback Questions";
    fallbackBtn.addEventListener("click", () => {
      openDevFallbackQuestionsDirect();
    });

    panel.appendChild(row);
    panel.appendChild(fallbackBtn);
    panel.appendChild(clearBtn);
    hudPanel.appendChild(panel);
  }

  function attachGlobalListeners() {
    ["click", "keydown", "scroll", "pointerdown"].forEach((eventName) => {
      window.addEventListener(eventName, () => markInteraction(eventName), { passive: true });
    });
    if (!autoEvaluateTimer) {
      autoEvaluateTimer = setInterval(autoEvaluate, 1400);
    }
  }

  return {
    activateTrigger,
    deactivateTrigger,
    deactivateAllTriggers,
    isTriggerActive,
    canActivateTrigger,
    evaluateUserState,
    setStage,
    onQuestionRendered,
    onOptionChange,
    onOptionHover,
    beginExamTimer,
    beforeSubmitDelay,
    afterSubmit,
    onReset,
    attachGlobalListeners,
    mountDevPanel,
    getTriggerNames,
    recordFollowupAnswer,
  };
})();

// Socket -------------------------------------------------------------------
function initSocket() {
  if (socketInitialized) return;
  socket = io({ transports: ["websocket"] });
  socketInitialized = true;

  socket.on("connect", () => {
    $("wsStatus").textContent = "WS: connected";
    log("WS connected", socket.id);
    logPopupEvent({ event: "connect", socket_id: socket.id });
  });

  socket.on("disconnect", () => {
    $("wsStatus").textContent = "WS: disconnected";
    log("WS disconnected");
    logPopupEvent({ event: "disconnect" });
  });

  socket.on("connect_error", (err) => {
    log("WS error", err.message || String(err));
    logPopupEvent({ event: "connect_error", error: err.message || String(err) });
  });

  socket.on("server_hello", (data) => log("server_hello", data));

  socket.on("joined", (data) => log("joined room", data));

  socket.on("popup", (payload) => {
    log("popup event", payload);
    logPopupEvent({ event: "popup", payload });
    enqueuePopup(payload);
  });

  socket.on("suggestions", (payload) => {
    setSuggestions((payload && payload.items) || []);
  });

  socket.onAny((event, payload) => {
    if (event === "popup") return;
    logPopupEvent({ event, payload });
  });
}

function joinSessionRoom(targetId) {
  const id = targetId || sessionId;
  if (!id) return;
  if (!socketInitialized) initSocket();
  const payload = { session_id: id };
  const emitJoin = () => {
    socket.emit("join_session", payload);
    logPopupEvent({ event: "join_session", session_id: id });
  };

  if (socket.connected) emitJoin();
  else socket.once("connect", emitJoin);
}

// Popup rendering ----------------------------------------------------------
function logPopupEvent(obj) {
  if (!popupConsole) return;
  const row = document.createElement("div");
  row.className = "row";
  row.textContent = `[${new Date().toLocaleTimeString()}] ${JSON.stringify(obj)}`;
  popupConsole.prepend(row);
  if (popupConsole.children.length > 200) popupConsole.removeChild(popupConsole.lastChild);
}

function normalizePopupMessage(rawMessage) {
  let text = "";
  if (typeof rawMessage === "string") {
    text = rawMessage;
  } else if (Array.isArray(rawMessage)) {
    text = rawMessage.map((item) => normalizePopupMessage(item)).find(Boolean) || "";
  } else if (rawMessage && typeof rawMessage === "object") {
    text = normalizePopupMessage(rawMessage.message || rawMessage.text || rawMessage.value || "");
  } else if (rawMessage != null) {
    text = String(rawMessage);
  }

  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  // Recover from stringified arrays/objects if server sends serialized payloads.
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      const parsedText = normalizePopupMessage(parsed);
      if (parsedText) return parsedText;
    } catch (e) {
      // Keep original text when it is not valid JSON.
    }
  }

  return trimmed
    .replace(/\[\s*([^\[\]]+?)\s*\]/g, "$1")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function enqueuePopup(payload) {
  if (!payload) return;
  const message = normalizePopupMessage(payload.message);
  if (!message) return;
  const safePayload = { ...payload, message };
  const parts = message
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  const keyBase = `${safePayload.type || "unknown"}|${message}`;
  if (recentPopups.has(keyBase)) {
    return;
  }
  recentPopups.add(keyBase);
  if (recentPopups.size > 50) {
    const first = recentPopups.values().next().value;
    recentPopups.delete(first);
  }

  if (parts.length <= 1) {
    popupQueue.push(safePayload);
  } else {
    const ttl = safePayload.ttl || 4000;
    const perTtl = Math.max(2500, Math.floor(ttl / parts.length));
    parts.forEach((part) => {
      popupQueue.push({
        ...safePayload,
        message: part,
        ttl: perTtl,
      });
    });
  }
  processPopupQueue();
}

function processPopupQueue() {
  if (popupActive || popupQueue.length === 0) return;
  popupActive = true;
  const payload = popupQueue.shift();
  showPopupCard(payload, () => {
    popupActive = false;
    processPopupQueue();
  });
}

function showPopupCard(payload, done) {
  if (!popupOverlay) {
    done?.();
    return;
  }
  popupOverlay.innerHTML = "";
  const type = payload?.type || "pulse";
  const msg = payload?.message || "";

  const el = document.createElement("div");
  el.className = `popup ${escapeHTML(type)}`;
  el.innerHTML = `
    <div class="type">${escapeHTML(type)}</div>
    <div class="msg">${escapeHTML(msg)}</div>
  `;
  popupOverlay.prepend(el);

  clearTimeout(popupTimer);
  const duration = Math.min(Math.max(payload?.ttl || 3500, 2000), 7000);
  popupTimer = setTimeout(() => {
    el.remove();
    done?.();
  }, duration);
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Acadza question panel ----------------------------------------------------
function setTestHint(text) {
  if (testHint) testHint.textContent = text || "";
}

function renderTestQuestion() {
  if (!questionStem || !questionOptions || !questionCounter) return;

  if (!testQuestions.length) {
    questionStem.textContent = "Questions will appear here with options.";
    questionOptions.innerHTML = "";
    questionCounter.textContent = "Questions —";
    if (questionSubject) questionSubject.textContent = "—";
    if (questionProgress) questionProgress.style.width = "0%";
    if (mutateBadge) mutateBadge.style.display = "none";
    if (btnPrevQuestion) btnPrevQuestion.disabled = true;
    if (btnNextQuestion) btnNextQuestion.disabled = true;
    return;
  }

  testQuestionIndex = Math.min(Math.max(testQuestionIndex, 0), testQuestions.length - 1);
  const q = testQuestions[testQuestionIndex];
  if (questionCounter) {
    questionCounter.textContent = `Question ${testQuestionIndex + 1} of ${testQuestions.length}`;
  }
  if (questionSubject) {
    const parts = [];
    if (q.subject) parts.push(q.subject);
    if (q.difficulty) parts.push(q.difficulty);
    questionSubject.textContent = parts.join(" · ") || "—";
  }
  if (questionProgress) {
    const pct = ((testQuestionIndex + 1) / testQuestions.length) * 100;
    questionProgress.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
  if (mutateBadge) {
    const mutated = Boolean(q.mutated || (q.meta && q.meta.mutated));
    mutateBadge.style.display = mutated ? "inline-flex" : "none";
  }
  const qType = (q.question_type || "").toLowerCase();
  if (qType === "integer") {
    if (questionOptions) questionOptions.style.display = "none";
    if (integerPanel) {
      integerPanel.style.display = "flex";
      const existing = selectedOptions[q.question_id] || "";
      if (integerInput) integerInput.value = existing;
      attachKeypadListeners();
    }
  } else {
    if (questionOptions) questionOptions.style.display = "grid";
    if (integerPanel) integerPanel.style.display = "none";
  }
  const parts = [];
  if (q.question_html) {
    parts.push(q.question_html);
  }
  if (Array.isArray(q.question_images)) {
    q.question_images.forEach((src) => {
      parts.push(`<div class="q-img"><img src="${src}" alt="question image" /></div>`);
    });
  }
  questionStem.innerHTML = parts.join("");
  questionOptions.innerHTML = "";

  const opts = q.options || [];
  if (qType !== "integer" && !opts.length) {
    const empty = document.createElement("div");
    empty.className = "option-empty";
    empty.textContent = "No options provided.";
    questionOptions.appendChild(empty);
  } else if (qType !== "integer") {
    opts.forEach((opt) => {
      const wrapper = document.createElement("label");
      wrapper.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `option-${q.question_id}`;
      input.value = opt.label;
      input.checked = selectedOptions[q.question_id] === opt.label;
      input.addEventListener("change", () => {
        const prev = selectedOptions[q.question_id] || "";
        selectedOptions[q.question_id] = opt.label;
        StressTriggers.onOptionChange(q.question_id, prev, opt.label);
      });
      wrapper.addEventListener("mouseenter", () => {
        StressTriggers.onOptionHover(wrapper);
      });

      const body = document.createElement("div");
      const labelEl = document.createElement("div");
      labelEl.className = "option-label";
      labelEl.textContent = opt.label || "";
      const textEl = document.createElement("div");
      textEl.className = "option-text";
      textEl.innerHTML = opt.text || "";
      body.appendChild(labelEl);
      body.appendChild(textEl);

      wrapper.appendChild(input);
      wrapper.appendChild(body);
      questionOptions.appendChild(wrapper);
    });
  }

  if (btnPrevQuestion) btnPrevQuestion.disabled = testQuestionIndex === 0;
  if (btnNextQuestion) btnNextQuestion.disabled = testQuestionIndex >= testQuestions.length - 1;
  updateScoreMeta();
  StressTriggers.onQuestionRendered(q);
}

async function loadTestQuestions() {
  if (!questionStem || !questionCounter) return;
  setTestHint("Loading questions…");
  questionCounter.textContent = "Loading questions…";
  if (questionSubject) questionSubject.textContent = "—";
  if (questionProgress) questionProgress.style.width = "0%";
  clearMutationTimers();
  questionStem.textContent = "Fetching questions from server...";
  questionOptions.innerHTML = "";
  try {
    const data = await getJSON("/api/questions/load-test-questions");
    testQuestions = data.questions || [];
    testQuestionIndex = 0;
    if (!testQuestions.length) {
      setTestHint("No questions returned. Add IDs to data/question_ids.csv.");
      questionCounter.textContent = "Questions unavailable";
      return;
    }
    selectedOptions = {};
    answeredMap = {};
    setTestHint("");
    scheduleMutationsForQuestions();
    renderTestQuestion();
    StressTriggers.beginExamTimer();
  } catch (err) {
    testQuestions = cloneClientFallbackQuestions();
    testQuestionIndex = 0;
    selectedOptions = {};
    answeredMap = {};
    setTestHint("Server unavailable. Loaded local demo questions for trigger testing.");
    log("questions_load_error", err.message || String(err));
    scheduleMutationsForQuestions();
    renderTestQuestion();
  }
}

function gotoQuestion(delta) {
  if (!testQuestions.length) return;
  testQuestionIndex = Math.min(
    Math.max(testQuestionIndex + delta, 0),
    testQuestions.length - 1
  );
  renderTestQuestion();
}

function shouldMutateQuestion(q) {
  if (!q) return false;
  const type = (q.question_type || "").toLowerCase();
  if (!["scq", "integer"].includes(type)) return false;
  // Mutate any question that has digits in stem or options
  const hasDigits =
    /\d/.test(q.question_html || "") ||
    (Array.isArray(q.options) && q.options.some((opt) => /\d/.test(opt?.text || "")));
  return hasDigits && !q.mutated && !(q.meta && q.meta.mutated);
}

function scheduleMutationsForQuestions() {
  clearMutationTimers();
  testQuestions.forEach((q, idx) => {
    if (!shouldMutateQuestion(q)) return;
    const timerId = setTimeout(() => mutateQuestionAt(idx), 5000);
    mutationTimers.push(timerId);
  });
}

async function mutateQuestionAt(index) {
  const q = testQuestions[index];
  if (!q || q.mutated || (q.meta && q.meta.mutated)) return;
  try {
    const res = await fetch(`/api/questions/mutate/${q.question_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.question) {
      const mutated = data.question;
      mutated.mutated = Boolean(data.mutated);
      testQuestions[index] = mutated;
      if (index === testQuestionIndex) {
        renderTestQuestion();
      }
    } else {
      log("mutate_failed", data.message || data.error || res.status);
    }
  } catch (err) {
    log("mutate_error", err.message || String(err));
  }
}

async function submitCurrentQuestion() {
  if (!testQuestions.length) {
    setTestHint("Load questions first.");
    return;
  }
  await StressTriggers.beforeSubmitDelay();
  try {
    const q = testQuestions[testQuestionIndex];
    const picked = selectedOptions[q.question_id];
    const qType = (q.question_type || "").toLowerCase();

    if (qType === "integer") {
      const value = (picked || "").trim();
      if (!value) {
        setTestHint("Enter an integer answer first.");
        return;
      }
      const correctVal = q.integer_answer;
      let correct = false;
      const hasAnswerKey = correctVal !== undefined && correctVal !== null;
      if (correctVal !== undefined && correctVal !== null) {
        const numPicked = Number(value);
        const numCorrect = Number(correctVal);
        if (!Number.isNaN(numPicked) && !Number.isNaN(numCorrect)) {
          correct = Math.abs(numPicked - numCorrect) < 1e-6;
        } else {
          correct = value === String(correctVal).trim();
        }
      }
      answeredMap[q.question_id] = { selected: value, correct };
      updateScoreMeta();
      if (hasAnswerKey && !correct) {
        StressTriggers.activateTrigger("confidenceBreaker", {
          force: true,
          reason: "wrong-answer",
        });
      }
      setTestHint(correct ? "Correct ✅" : "Saved. (Either incorrect or no answer key provided.)");
      return;
    }

    if (!picked) {
      setTestHint("Select an option before submitting.");
      return;
    }
    const correctAnswer = q.correct_answer || q.correct_answers;
    const hasAnswerKey =
      (Array.isArray(correctAnswer) && correctAnswer.length > 0) ||
      (typeof correctAnswer === "string" && Boolean(correctAnswer.trim()));
    let correct = false;
    if (Array.isArray(correctAnswer)) {
      const pickedSet = new Set(Array.isArray(picked) ? picked : [picked]);
      const correctSet = new Set(correctAnswer.map((v) => String(v).trim().toUpperCase()));
      correct = pickedSet.size === correctSet.size && [...pickedSet].every((v) => correctSet.has(String(v).trim().toUpperCase()));
    } else if (typeof correctAnswer === "string") {
      correct = picked.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
    }
    answeredMap[q.question_id] = { selected: picked, correct };
    updateScoreMeta();
    if (hasAnswerKey && !correct) {
      StressTriggers.activateTrigger("confidenceBreaker", {
        force: true,
        reason: "wrong-answer",
      });
    }
    setTestHint(correct ? "Correct ✅" : "Saved. (Either incorrect or no answer key provided.)");
  } finally {
    StressTriggers.afterSubmit();
  }
}

// Flow ---------------------------------------------------------------------
async function startSessionFlow() {
  try {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      setIntroHint("Stop the recording first.");
      return;
    }

    btnStart.disabled = true;
    showStage("loading", recordedAudioBlob ? "Transcribing your recording..." : "Absorbing your story...");
    const text = await resolveInitialText();
    if (!text) {
      setIntroHint("Please share a few thoughts first.");
      showStage("intro");
      return;
    }

    setIntroHint("");
    showStage("loading", "Absorbing your story…");

    const startBody = { text };
    const clientUser = clientUserPayload();
    if (clientUser) startBody.client_user = clientUser;
    const data = await postJSON("/session/start", startBody);
    log("start_session", data);

    setSessionUI(data.session_id, data.active_domains);
    joinSessionRoom(data.session_id);
    setSuggestions([]);

    await fetchNextQuestion("Finding the first question…");
  } catch (err) {
    log("start_error", err.message);
    setIntroHint(err.message);
    showStage("intro");
  } finally {
    btnStart.disabled = false;
  }
}

async function fetchNextQuestion(message) {
  if (!sessionId) return;
  showStage("loading", message || "Designing your next cue…");
  try {
    const data = await postJSON(`/session/${sessionId}/next-question`, {});
    log("next_question", data);

    if (data.pending) {
      setHint(data.message || "Answer the current question first.");
      showStage("qa");
      return;
    }

    if (data.done) {
      await handleCompletion();
      return;
    }

    setQuestionUI(data);
    showStage("qa");
  } catch (err) {
    log("next_question_error", err.message);
    setHint(err.message);
    showStage("qa");
  }
}

async function submitAnswer() {
  if (!sessionId || btnAnswer.disabled) return;
  const answer = answerInput.value.trim();
  if (!answer) {
    hintBox.textContent = "Type a quick sentence first.";
    answerInput.classList.add("shake");
    setTimeout(() => answerInput.classList.remove("shake"), 400);
    return;
  }

  try {
    btnAnswer.disabled = true;
    showStage("loading", "Reading your answer…");

    const payload = {
      answer,
      domain: currentDomain,
      slot: currentSlot,
    };
    const data = await postJSON(`/session/${sessionId}/answer`, payload);
    log("answer", data);
    StressTriggers.recordFollowupAnswer(answer, currentDomain, currentSlot, $("questionText")?.textContent || "");

    if (data.need_clarification) {
      setHint("Quick clarifier requested: keep it tight.");
      $("questionText").textContent = data.question || "Need a tiny clarification.";
      btnAnswer.disabled = false;
      showStage("qa");
      return;
    }

    answerInput.value = "";
    setHint("Noted. Crafting the next cue…");
    await fetchNextQuestion("Crafting the next question…");
  } catch (err) {
    log("answer_error", err.message);
    setHint(err.message);
    btnAnswer.disabled = false;
    showStage("qa");
  }
}

async function skipRemainingQuestions() {
  if (!sessionId || !btnSkip || btnSkip.hidden || btnSkip.disabled) return;
  try {
    btnSkip.disabled = true;
    btnAnswer.disabled = true;
    showStage("loading", "Skipping remaining questions…");
    await postJSON(`/session/${sessionId}/complete`, {});
    await handleCompletion();
  } catch (err) {
    log("skip_error", err.message);
    setHint(err.message || "Could not skip right now.");
    btnSkip.disabled = false;
    btnAnswer.disabled = false;
    showStage("qa");
  }
}

async function handleCompletion() {
  showStage("loading", "Designing your focus pulses…");
  try {
    const data = await postJSON(`/session/${sessionId}/start-simulation`, {});
    log("start_simulation", data);
    popupSummary.textContent = `Popups scheduled: ${data.popups_scheduled}. Keep an eye on the center top.`;
  } catch (err) {
    log("simulation_error", err.message);
    popupSummary.textContent = err.message;
  }
  await loadTestQuestions();
  showStage("popups");
}

// HUD ----------------------------------------------------------------------
function toggleHud(open) {
  if (!hudPanel) return;
  const shouldOpen = typeof open === "boolean" ? open : !hudPanel.classList.contains("open");
  hudPanel.classList.toggle("open", shouldOpen);
}

hudToggle?.addEventListener("click", () => toggleHud());
btnCloseHud?.addEventListener("click", () => toggleHud(false));

// Events -------------------------------------------------------------------
btnStart?.addEventListener("click", startSessionFlow);
btnNameNext?.addEventListener("click", proceedFromNameStep);
userNameInput?.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    proceedFromNameStep();
  }
});
btnRecord?.addEventListener("click", async () => {
  try {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
      return;
    }
    await startRecording();
  } catch (err) {
    setIntroHint(err.message || "Mic access failed.");
    setRecordButtonState();
  }
});
btnAnswer?.addEventListener("click", submitAnswer);
btnSkip?.addEventListener("click", skipRemainingQuestions);
btnRestart?.addEventListener("click", resetFlow);
btnReset?.addEventListener("click", resetFlow);
btnLogout?.addEventListener("click", () => {
  window.StressDostAuth?.clearUser?.();
  window.location.href = "/login";
});
btnPrevQuestion?.addEventListener("click", () => gotoQuestion(-1));
btnNextQuestion?.addEventListener("click", () => gotoQuestion(1));
btnReloadQuestions?.addEventListener("click", () => loadTestQuestions());
btnSubmitQuestion?.addEventListener("click", submitCurrentQuestion);

// Live suggestions for initial text ---------------------------------------
function setSuggestions(items) {
  if (!suggestionWrap || !suggestionList) return;
  suggestionList.innerHTML = "";
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    suggestionWrap.hidden = true;
    return;
  }
  list.forEach((text) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "suggestion-pill";
    pill.textContent = text;
    pill.addEventListener("click", () => applySuggestion(text));
    suggestionList.appendChild(pill);
  });
  suggestionWrap.hidden = false;
}

function applySuggestion(text) {
  const input = $("initialText");
  if (!input) return;
  input.value = String(text || "");
  input.focus();
  setSuggestions([]);
}

function requestSuggestionsDebounced(rawText) {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => {
    const text = (rawText || "").trim();
    if (!text || text.length < 4) {
      setSuggestions([]);
      return;
    }
    if (!socketInitialized) initSocket();
    if (socket) {
      socket.emit("suggest_request", { text });
    }
  }, 350);
}

const initialTextEl = $("initialText");
initialTextEl?.addEventListener("input", (evt) => requestSuggestionsDebounced(evt.target.value));

function attachKeypadListeners() {
  if (integerKeypadListenerAttached) return;
  integerKeypadListenerAttached = true;
  const keypad = $("keypad");
  if (keypad) {
    keypad.addEventListener("click", (evt) => {
      const key = evt.target?.dataset?.key;
      if (!key) return;
      const q = testQuestions[testQuestionIndex];
      if (!q || (q.question_type || "").toLowerCase() !== "integer") return;
      const current = selectedOptions[q.question_id] || "";
      const next = current + key;
      selectedOptions[q.question_id] = next;
      if (integerInput) integerInput.value = next;
    });
  }
  btnClearInteger?.addEventListener("click", () => {
    const q = testQuestions[testQuestionIndex];
    if (!q) return;
    selectedOptions[q.question_id] = "";
    if (integerInput) integerInput.value = "";
  });
  btnBackspace?.addEventListener("click", () => {
    const q = testQuestions[testQuestionIndex];
    if (!q) return;
    const current = selectedOptions[q.question_id] || "";
    const next = current.slice(0, -1);
    selectedOptions[q.question_id] = next;
    if (integerInput) integerInput.value = next;
  });
  integerInput?.addEventListener("input", (evt) => {
    const q = testQuestions[testQuestionIndex];
    if (!q) return;
    selectedOptions[q.question_id] = evt.target.value;
  });
}

answerInput?.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey)) {
    submitAnswer();
  }
});

// Init ---------------------------------------------------------------------
if (!window.StressDostAuth?.getUser?.()) {
  if (window.StressDostAuth?.redirectToLogin) {
    window.StressDostAuth.redirectToLogin();
  } else {
    window.location.replace("/login");
  }
} else {
  syncUserUI();
  StressTriggers.attachGlobalListeners();
  StressTriggers.mountDevPanel();
  resetFlow();
  initSocket();
  setRecordButtonState();
}

// expose for console debugging
window.__stressApp = {
  resetFlow,
  fetchNextQuestion,
  submitAnswer,
  loadTestQuestions,
  submitCurrentQuestion,
  evaluateUserState: StressTriggers.evaluateUserState,
  activateTrigger: (name, context = {}) =>
    StressTriggers.activateTrigger(name, { force: true, manual: true, ...context }),
  activateTriggerManual: (name) =>
    StressTriggers.activateTrigger(name, { force: true, manual: true }),
  deactivateTrigger: StressTriggers.deactivateTrigger,
  getUserId: () => window.StressDostAuth?.getUserId?.() ?? null,
};
