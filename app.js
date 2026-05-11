import { BIRDS } from "./data/birds.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const STORAGE_KEY = "vogelverzamelaar.records.v1";
const DB_NAME = "vogelverzamelaar-db";
const STORE_NAME = "records";

const state = {
  records: {},
  filter: "all",
  query: "",
  family: "",
  activeBirdId: null,
  deferredInstall: null,
  supabase: null,
  session: null,
  partner: null,
  partnerRecords: {}
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
  installButton: document.querySelector("#installButton"),
  progressTitle: document.querySelector("#progressTitle"),
  syncStatus: document.querySelector("#syncStatus"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  partnerForm: document.querySelector("#partnerForm"),
  partnerEmail: document.querySelector("#partnerEmail")
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
  syncRecord(id).catch(() => setSyncStatus("Lokaal opgeslagen, maar online sync lukte niet."));
  render();
}

function partnerRecordFor(id) {
  return state.partnerRecords[id] || {};
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
      (state.filter === "photo" && hasPhoto) ||
      (state.filter === "both" && record.seen && partnerRecordFor(bird.id).seen) ||
      (state.filter === "only-me" && record.seen && !partnerRecordFor(bird.id).seen) ||
      (state.filter === "only-partner" && !record.seen && partnerRecordFor(bird.id).seen);
    return matchesQuery && matchesFamily && matchesFilter;
  });
}

function updateProgress() {
  const seen = BIRDS.filter((bird) => recordFor(bird.id).seen).length;
  const partnerSeen = BIRDS.filter((bird) => partnerRecordFor(bird.id).seen).length;
  const percentage = Math.round((seen / BIRDS.length) * 100);
  els.progressTitle.textContent = state.partner ? `Mijn collectie · partner ${partnerSeen}` : "Mijn collectie";
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
  if (state.partner && partnerRecordFor(bird.id).seen) {
    badges.append(badge(`${state.partner.email}: gezien`, "partner"));
  }
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
      await syncAllLocalRecords();
      render();
    } catch {
      alert("Deze back-up kon niet gelezen worden.");
    }
  };
  reader.readAsText(file);
}

function hasSupabaseConfig() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}

function setSyncStatus(message) {
  if (els.syncStatus) els.syncStatus.textContent = message;
}

function remoteFromRecord(id, record) {
  return {
    bird_id: id,
    seen: Boolean(record.seen),
    seen_date: record.date || null,
    place: record.place || null,
    note: record.note || null,
    updated_at: record.updatedAt || new Date().toISOString()
  };
}

function recordFromRemote(row, existing = {}) {
  return {
    ...existing,
    id: row.bird_id,
    seen: row.seen,
    date: row.seen_date || "",
    place: row.place || "",
    note: row.note || "",
    updatedAt: row.updated_at
  };
}

async function initSupabase() {
  if (!hasSupabaseConfig()) {
    setSyncStatus("Supabase staat nog uit. Vul `supabase-config.js` in om online te delen.");
    return;
  }

  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    await refreshAuthState();
    state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await refreshAuthState();
    });
  } catch {
    setSyncStatus("Supabase kon niet laden. De app blijft lokaal werken.");
  }
}

async function refreshAuthState() {
  const user = state.session?.user;
  els.signOutButton.hidden = !user;
  els.partnerForm.hidden = !user;

  if (!user) {
    state.partner = null;
    state.partnerRecords = {};
    setSyncStatus("Niet ingelogd. Log in om online te syncen en een partner te koppelen.");
    render();
    return;
  }

  await upsertProfile();
  await loadRemoteRecords();
  await loadPartner();
  await syncAllLocalRecords();
  setSyncStatus(state.partner
    ? `Ingelogd als ${user.email}. Partner gekoppeld: ${state.partner.email}.`
    : `Ingelogd als ${user.email}. Voeg je partner toe via e-mail.`);
  render();
}

async function upsertProfile() {
  const user = state.session?.user;
  if (!state.supabase || !user) return;
  const { error } = await state.supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id" });
  if (error) throw error;
}

async function loadRemoteRecords() {
  const user = state.session?.user;
  if (!state.supabase || !user) return;

  const { data, error } = await state.supabase
    .from("bird_records")
    .select("bird_id, seen, seen_date, place, note, updated_at")
    .eq("user_id", user.id);
  if (error) throw error;

  for (const row of data || []) {
    const local = recordFor(row.bird_id);
    const remoteIsNewer = !local.updatedAt || new Date(row.updated_at) > new Date(local.updatedAt);
    if (remoteIsNewer) {
      state.records[row.bird_id] = recordFromRemote(row, local);
      await saveRecord(row.bird_id, state.records[row.bird_id]);
    }
  }
}

async function syncRecord(id) {
  const user = state.session?.user;
  if (!state.supabase || !user) return;
  const { error } = await state.supabase
    .from("bird_records")
    .upsert({ ...remoteFromRecord(id, recordFor(id)), user_id: user.id }, { onConflict: "user_id,bird_id" });
  if (error) throw error;
}

async function syncAllLocalRecords() {
  const user = state.session?.user;
  if (!state.supabase || !user) return;
  const rows = Object.entries(state.records)
    .filter(([, record]) => record.seen || record.date || record.place || record.note)
    .map(([id, record]) => ({ ...remoteFromRecord(id, record), user_id: user.id }));
  if (!rows.length) return;
  const { error } = await state.supabase
    .from("bird_records")
    .upsert(rows, { onConflict: "user_id,bird_id" });
  if (error) throw error;
}

async function loadPartner() {
  const user = state.session?.user;
  if (!state.supabase || !user) return;

  const { data: links, error: linkError } = await state.supabase
    .from("bird_partners")
    .select("owner_id, partner_id")
    .or(`owner_id.eq.${user.id},partner_id.eq.${user.id}`)
    .limit(1);
  if (linkError) throw linkError;

  const link = links?.[0];
  if (!link) {
    state.partner = null;
    state.partnerRecords = {};
    return;
  }

  const partnerId = link.owner_id === user.id ? link.partner_id : link.owner_id;
  const { data: profile, error: profileError } = await state.supabase
    .from("profiles")
    .select("id, email")
    .eq("id", partnerId)
    .single();
  if (profileError) throw profileError;

  state.partner = profile;
  await loadPartnerRecords();
}

async function loadPartnerRecords() {
  if (!state.supabase || !state.partner) return;
  const { data, error } = await state.supabase
    .from("bird_records")
    .select("bird_id, seen, seen_date, place, note, updated_at")
    .eq("user_id", state.partner.id);
  if (error) throw error;
  state.partnerRecords = Object.fromEntries((data || []).map((row) => [row.bird_id, recordFromRemote(row)]));
}

async function addPartnerByEmail(email) {
  const user = state.session?.user;
  if (!state.supabase || !user) return;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === user.email.toLowerCase()) {
    alert("Je kunt jezelf niet als partner koppelen.");
    return;
  }

  const { data: partner, error: profileError } = await state.supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .single();
  if (profileError || !partner) {
    alert("Partner niet gevonden. Laat de ander eerst een account maken en inloggen.");
    return;
  }

  const { error } = await state.supabase
    .from("bird_partners")
    .upsert({ owner_id: user.id, partner_id: partner.id }, { onConflict: "owner_id,partner_id" });
  if (error) throw error;

  state.partner = partner;
  await loadPartnerRecords();
  setSyncStatus(`Partner gekoppeld: ${partner.email}.`);
  render();
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

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.supabase) {
      alert("Vul eerst je Supabase URL en anon key in `supabase-config.js` in.");
      return;
    }
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  });

  els.signUpButton.addEventListener("click", async () => {
    if (!state.supabase) {
      alert("Vul eerst je Supabase URL en anon key in `supabase-config.js` in.");
      return;
    }
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    const { error } = await state.supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    setSyncStatus("Account aangemaakt. Bevestig eventueel je e-mail en log daarna in.");
  });

  els.signOutButton.addEventListener("click", async () => {
    if (state.supabase) await state.supabase.auth.signOut();
  });

  els.partnerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await addPartnerByEmail(els.partnerEmail.value);
      els.partnerEmail.value = "";
    } catch {
      alert("Partner koppelen lukte niet. Controleer de e-mail en Supabase-tabellen.");
    }
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

await loadRecords();
populateFamilies();
bindEvents();
await initSupabase();
render();
