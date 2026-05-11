import { BIRDS } from "./data/birds.js";

const STORAGE_KEY = "vogelverzamelaar.records.v1";
const DB_NAME = "vogelverzamelaar-db";
const STORE_NAME = "records";

const state = {
  records: {},
  filter: "all",
  query: "",
  family: "",
  activeBirdId: null,
  deferredInstall: null
};

const els = {
  list: document.querySelector("#birdList"),
  search: document.querySelector("#searchInput"),
  family: document.querySelector("#familyFilter"),
  seenCount: document.querySelector("#seenCount"),
  totalCount: document.querySelector("#totalCount"),
  percent: document.querySelector("#progressPercent"),
  ring: document.querySelector(".progress-ring"),
  dialog: document.querySelector("#birdDialog"),
  dialogFamily: document.querySelector("#dialogFamily"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogScientific: document.querySelector("#dialogScientific"),
  dialogSeen: document.querySelector("#dialogSeen"),
  dialogDate: document.querySelector("#dialogDate"),
  dialogPlace: document.querySelector("#dialogPlace"),
  dialogNote: document.querySelector("#dialogNote"),
  dialogPhoto: document.querySelector("#dialogPhoto"),
  dialogPreview: document.querySelector("#dialogPreview"),
  deletePhoto: document.querySelector("#deletePhotoButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  resetButton: document.querySelector("#resetButton"),
  installButton: document.querySelector("#installButton")
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadRecords() {
  const db = await openDb();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  state.records = Object.fromEntries(records.map((record) => [record.id, record]));

  if (!records.length) {
    try {
      const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      state.records = legacy;
      await Promise.all(Object.entries(legacy).map(([id, record]) => saveRecord(id, record)));
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      state.records = {};
    }
  }
}

async function saveRecord(id, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ ...record, id });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function recordFor(id) {
  return state.records[id] || {};
}

function setRecord(id, patch) {
  state.records[id] = { ...recordFor(id), ...patch, id, updatedAt: new Date().toISOString() };
  saveRecord(id, state.records[id]).catch(() => alert("Opslaan lukte niet. Probeer opnieuw."));
  render();
}

function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function filteredBirds() {
  const query = normalize(state.query.trim());
  return BIRDS.filter((bird) => {
    const record = recordFor(bird.id);
    const hasPhoto = Boolean(record.photo);
    const matchesQuery = !query || normalize([
      bird.dutchName,
      bird.englishName,
      bird.scientificName,
      bird.family,
      bird.status
    ].join(" ")).includes(query);
    const matchesFamily = !state.family || bird.family === state.family;
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "seen" && record.seen) ||
      (state.filter === "missing" && !record.seen) ||
      (state.filter === "photo" && hasPhoto);
    return matchesQuery && matchesFamily && matchesFilter;
  });
}

function updateProgress() {
  const seen = BIRDS.filter((bird) => recordFor(bird.id).seen).length;
  const percentage = Math.round((seen / BIRDS.length) * 100);
  els.seenCount.textContent = seen;
  els.totalCount.textContent = BIRDS.length;
  els.percent.textContent = `${percentage}%`;
  els.ring.style.setProperty("--progress", `${percentage * 3.6}deg`);
}

function birdCard(bird) {
  const record = recordFor(bird.id);
  const card = document.createElement("article");
  card.className = `bird-card${record.seen ? " seen" : ""}`;

  const check = document.createElement("button");
  check.className = "bird-check";
  check.type = "button";
  check.textContent = "✓";
  check.ariaLabel = `${bird.dutchName} afvinken`;
  check.addEventListener("click", () => {
    setRecord(bird.id, {
      seen: !record.seen,
      date: record.date || new Date().toISOString().slice(0, 10)
    });
  });

  const content = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = bird.dutchName || bird.englishName;
  const meta = document.createElement("p");
  meta.textContent = `${bird.scientificName} · ${bird.family}`;
  content.append(title, meta);

  const badges = document.createElement("div");
  badges.className = "badges";
  if (bird.status) badges.append(badge(bird.status));
  if (record.seen) badges.append(badge(record.date ? `Gezien ${record.date}` : "Gezien"));
  if (record.photo) badges.append(badge("Foto", "photo"));
  content.append(badges);

  const details = document.createElement("button");
  details.className = "details-button";
  details.type = "button";
  details.textContent = "›";
  details.ariaLabel = `Details voor ${bird.dutchName}`;
  details.addEventListener("click", () => openDialog(bird.id));

  card.append(check, content, details);
  return card;
}

function badge(text, extraClass = "") {
  const item = document.createElement("span");
  item.className = `badge ${extraClass}`.trim();
  item.textContent = text;
  return item;
}

function render() {
  updateProgress();
  const birds = filteredBirds();
  els.list.replaceChildren();
  if (!birds.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Geen vogels gevonden met deze filters.";
    els.list.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  birds.forEach((bird) => fragment.append(birdCard(bird)));
  els.list.append(fragment);
}

function openDialog(id) {
  const bird = BIRDS.find((item) => item.id === id);
  if (!bird) return;
  const record = recordFor(id);
  state.activeBirdId = id;
  els.dialogFamily.textContent = `${bird.order} · ${bird.family}`;
  els.dialogTitle.textContent = bird.dutchName || bird.englishName;
  els.dialogScientific.textContent = `${bird.scientificName} · ${bird.englishName}`;
  els.dialogSeen.checked = Boolean(record.seen);
  els.dialogDate.value = record.date || "";
  els.dialogPlace.value = record.place || "";
  els.dialogNote.value = record.note || "";
  els.dialogPhoto.value = "";
  showPreview(record.photo);
  els.dialog.showModal();
}

function showPreview(photo) {
  if (photo) {
    els.dialogPreview.src = photo;
    els.dialogPreview.hidden = false;
    els.deletePhoto.hidden = false;
  } else {
    els.dialogPreview.removeAttribute("src");
    els.dialogPreview.hidden = true;
    els.deletePhoto.hidden = true;
  }
}

function persistDialog() {
  if (!state.activeBirdId) return;
  setRecord(state.activeBirdId, {
    seen: els.dialogSeen.checked,
    date: els.dialogDate.value,
    place: els.dialogPlace.value.trim(),
    note: els.dialogNote.value.trim()
  });
}

function populateFamilies() {
  const families = [...new Set(BIRDS.map((bird) => bird.family).filter(Boolean))].sort();
  for (const family of families) {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = family;
    els.family.append(option);
  }
}

async function resizePhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function exportData() {
  const payload = {
    app: "Vogelverzamelaar Belgie",
    exportedAt: new Date().toISOString(),
    records: state.records
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vogelverzamelaar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(reader.result);
      state.records = payload.records || payload;
      await clearRecords();
      await Promise.all(Object.entries(state.records).map(([id, record]) => saveRecord(id, record)));
      render();
    } catch {
      alert("Deze back-up kon niet gelezen worden.");
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  els.family.addEventListener("change", (event) => {
    state.family = event.target.value;
    render();
  });

  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(".segmented button.active").classList.remove("active");
      button.classList.add("active");
      state.filter = button.dataset.filter;
      render();
    });
  });

  [els.dialogSeen, els.dialogDate, els.dialogPlace, els.dialogNote].forEach((input) => {
    input.addEventListener("change", persistDialog);
  });
  els.dialogNote.addEventListener("input", persistDialog);

  els.dialogPhoto.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || !state.activeBirdId) return;
    const photo = await resizePhoto(file);
    setRecord(state.activeBirdId, { photo, seen: true, date: els.dialogDate.value || new Date().toISOString().slice(0, 10) });
    showPreview(photo);
    els.dialogSeen.checked = true;
    if (!els.dialogDate.value) els.dialogDate.value = new Date().toISOString().slice(0, 10);
  });

  els.deletePhoto.addEventListener("click", () => {
    if (!state.activeBirdId) return;
    setRecord(state.activeBirdId, { photo: "" });
    showPreview("");
  });

  els.exportButton.addEventListener("click", exportData);
  els.importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importData(file);
    event.target.value = "";
  });

  els.resetButton.addEventListener("click", () => {
    if (confirm("Alle vinkjes, notities en foto's uit deze browser wissen?")) {
      state.records = {};
      clearRecords();
      render();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    els.installButton.hidden = true;
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

await loadRecords();
populateFamilies();
bindEvents();
render();
