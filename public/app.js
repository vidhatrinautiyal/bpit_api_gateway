const state = {
  token: localStorage.getItem("bpit_token"),
  user: null,
  meta: null,
  classView: null
};

const $ = (selector) => document.querySelector(selector);
const can = (permission) => Boolean(state.user && state.user.permissions.includes(permission));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function showMessage(selector, text, error = false) {
  const element = $(selector);
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("error", error);
  element.classList.remove("hidden");
}

function clearMessage(selector) {
  const element = $(selector);
  if (element) element.classList.add("hidden");
}

// ==============================
// Presentation helpers (purely visual — never gate data or logic)
// ==============================

/** Shows a view element with a fresh entrance animation each time. */
function revealView(el) {
  if (!el) return;
  el.classList.remove("hidden", "view-enter");
  // Force a reflow so the animation restarts even if the view was just shown.
  void el.offsetWidth;
  el.classList.add("view-enter");
}

/** Animates a number counting up to its target instead of snapping into place. */
function animateNumber(el, target, { decimals = 0, suffix = "", duration = 650 } = {}) {
  if (!el) return;
  const startTime = performance.now();
  const from = 0;
  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + (target - from) * eased;
    el.textContent = value.toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function setAnimatedStat(selector, value, suffix = "") {
  const el = $(selector);
  if (!el) return;
  const decimals = Number.isInteger(value) ? 0 : 1;
  animateNumber(el, value, { decimals, suffix });
}

/** A small ring chart next to an attendance percentage — reads at a glance. */
function progressRing(percentage, size = 30) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(percentage, 0), 100) / 100);
  const color = percentage >= 75 ? "#4f6b3c" : "#b8613c";
  return `<span class="progress-ring">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="rgba(60,42,34,.10)" stroke-width="3"></circle>
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="3"
        stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round"
        transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
    </svg>
    <span class="progress-ring-value" style="color:${color}">${percentage}%</span>
  </span>`;
}

/** A brief shimmer placeholder shown while a table's data is still loading. */
function skeletonRows(count = 4) {
  return Array.from({ length: count }, () => `<div class="skeleton-row"></div>`).join("");
}

function startLiveClock() {
  const el = $("#live-clock");
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleString(undefined, {
      weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };
  tick();
  setInterval(tick, 1000);
}

/** Pings /health periodically so the "API online" indicator reflects reality. */
async function pollHealth() {
  const dots = document.querySelectorAll(".app-status-dot");
  const text = $("#health-text");
  const connectionText = $("#connection-text");
  try {
    const response = await fetch("/health");
    const ok = response.ok;
    dots.forEach((dot) => dot.classList.toggle("live", ok));
    dots.forEach((dot) => dot.classList.toggle("offline", !ok));
    if (text) text.textContent = ok ? "API online" : "API degraded";
    if (connectionText) connectionText.textContent = ok ? "LOCAL / ONLINE" : "LOCAL / DEGRADED";
  } catch {
    dots.forEach((dot) => { dot.classList.remove("live"); dot.classList.add("offline"); });
    if (text) text.textContent = "API unreachable";
    if (connectionText) connectionText.textContent = "OFFLINE";
  }
}

/** Highlights the timetable cell for whatever period is happening right now. */
function highlightCurrentPeriod(data) {
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const now = new Date();
  const today = dayNames[now.getDay()].slice(0, 3);

  document.querySelectorAll("#timetable-grid .tt-day").forEach((el) => {
    el.classList.toggle("tt-today", el.textContent.trim().toUpperCase() === today);
  });

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentPeriod = data.periods.find((p) => {
    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);
    return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
  });
  if (!currentPeriod) return;

  document.querySelectorAll("#timetable-grid .tt-row:not(.tt-head)").forEach((row) => {
    const dayEl = row.querySelector(".tt-day");
    if (!dayEl || dayEl.textContent.trim().toUpperCase() !== today) return;
    const cell = row.querySelectorAll(".tt-cell")[currentPeriod.period - 1];
    if (cell && !cell.classList.contains("tt-free")) {
      cell.classList.add("tt-now");
      cell.style.position = "relative";
      const chip = document.createElement("span");
      chip.className = "tt-now-chip";
      chip.textContent = "NOW";
      cell.appendChild(chip);
    }
  });
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

// ==============================
// View routing
// ==============================
const VIEWS = ["auth-view", "dashboard-view", "access-view", "identity-view",
  "attendance-view", "about-view", "enrolment-view", "timetable-view"];

const TITLES = {
  access: "Access control",
  identity: "Identity model",
  attendance: "Attendance",
  timetable: "Timetable",
  enrolment: "Confirm your class",
  about: "About",
  overview: "Overview"
};

function switchAuth(mode) {
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#login-form").classList.toggle("hidden", mode !== "login");
  $("#register-form").classList.toggle("hidden", mode !== "register");
  clearMessage("#auth-message");
}

function showView(view) {
  if (!state.user && !["overview", "about"].includes(view)) view = "overview";

  // A student without a class cannot use the academic views yet.
  if (state.user && state.user.needsEnrolment && !["enrolment", "about", "identity"].includes(view)) {
    view = "enrolment";
  }

  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  VIEWS.forEach((id) => $("#" + id).classList.add("hidden"));

  if (!state.user) {
    revealView($(view === "about" ? "#about-view" : "#auth-view"));
  } else if (view === "enrolment") {
    revealView($("#enrolment-view"));
  } else if (view === "access" && can("view_users")) {
    revealView($("#access-view"));
    loadUsers();
  } else if (view === "identity") {
    revealView($("#identity-view"));
  } else if (view === "timetable") {
    revealView($("#timetable-view"));
    loadTimetable();
  } else if (view === "attendance") {
    revealView($("#attendance-view"));
    loadAttendance();
  } else if (view === "about") {
    revealView($("#about-view"));
  } else {
    revealView($("#dashboard-view"));
  }

  $("#page-title").textContent = TITLES[view] || "Overview";
}

// ==============================
// Session
// ==============================
function renderUser(user) {
  state.user = user;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  const displayName = user.name || user.username || "User";
  const enrolment = user.enrolment;

  $("#welcome-name").textContent = displayName.split(" ")[0];
  $("#profile-name").textContent = displayName;
  $("#profile-email").textContent = user.email || "No email provided";
  $("#profile-username").textContent = enrolment?.enrolmentNumber || user.username || "—";
  $("#profile-last-login").textContent = user.lastLoggedIn
    ? new Date(user.lastLoggedIn).toLocaleString()
    : "Current session";
  $("#avatar").textContent = displayName.charAt(0).toUpperCase();
  $("#hero-role").textContent = enrolment ? enrolment.label : (roles[0] || "USER");
  setAnimatedStat("#role-count", roles.length);
  $("#role-summary").textContent = roles.join(" · ") || "No roles assigned";
  setAnimatedStat("#permission-count", permissions.length);
  setAnimatedStat("#permission-count-small", permissions.length);
  $("#permission-list").innerHTML = permissions.map((p) => `<span class="tag">${escapeHtml(p)}</span>`).join("");
  $("#permission-empty").classList.toggle("hidden", permissions.length > 0);

  $(".admin-nav").classList.toggle("hidden", !permissions.includes("view_users"));
  $(".class-nav").classList.toggle("hidden", !permissions.includes("view_timetable"));
  $("#logout-button").classList.remove("hidden");

  const sidebarUser = $("#sidebar-user");
  if (sidebarUser) {
    sidebarUser.classList.remove("hidden");
    $("#sidebar-avatar").textContent = displayName.charAt(0).toUpperCase();
    $("#sidebar-user-name").textContent = displayName;
    $("#sidebar-user-role").textContent = (enrolment ? enrolment.label : roles[0]) || "USER";
  }

  if (user.needsEnrolment) {
    showView("enrolment");
  } else {
    showView("overview");
    loadAttendance();
  }
}

async function loadCurrentUser() {
  if (!state.token) return showView("overview");
  try {
    await loadMeta();
    const data = await request("/auth/me");
    renderUser(data.user);
  } catch {
    state.token = null;
    localStorage.removeItem("bpit_token");
    showView("overview");
  }
}

// ==============================
// Class catalogue
// ==============================
async function loadMeta() {
  if (state.meta) return state.meta;
  try {
    state.meta = await request("/api/academic/meta");
    populateClassSelectors();
  } catch {
    state.meta = null;
  }
  return state.meta;
}

function fillSelect(select, values, { selected, placeholder } = {}) {
  if (!select) return;
  const options = values.map((v) => {
    const value = typeof v === "object" ? v.value : v;
    const label = typeof v === "object" ? v.label : v;
    return `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>`;
  });
  select.innerHTML = (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") + options.join("");
}

/** Keeps a section dropdown in step with the branch chosen next to it. */
function bindBranchSection(branchSelect, sectionSelect) {
  const sync = () => {
    const branch = state.meta.branches.find((b) => b.code === branchSelect.value);
    fillSelect(sectionSelect, branch ? branch.sections : []);
  };
  branchSelect.addEventListener("change", sync);
  sync();
}

function populateClassSelectors() {
  if (!state.meta) return;
  const branches = state.meta.branches.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }));

  [["#enrol-branch", "#enrol-section"], ["#tt-branch", "#tt-section"], ["#cls-branch", "#cls-section"]]
    .forEach(([branchId, sectionId]) => {
      const branchSelect = $(branchId);
      if (!branchSelect) return;
      fillSelect(branchSelect, branches);
      bindBranchSection(branchSelect, $(sectionId));
    });

  fillSelect($("#enrol-year"), state.meta.years);
  fillSelect($("#enrol-semester"), state.meta.semesters);
  fillSelect($("#tt-semester"), state.meta.semesters);
  fillSelect($("#cls-semester"), state.meta.semesters);
}

// ==============================
// Enrolment
// ==============================
$("#enrol-submit").addEventListener("click", async () => {
  clearMessage("#enrol-message");
  try {
    const data = await request("/api/academic/enrol", {
      method: "POST",
      body: JSON.stringify({
        year: Number($("#enrol-year").value),
        semester: Number($("#enrol-semester").value),
        branch: $("#enrol-branch").value,
        section: $("#enrol-section").value,
        batch: $("#enrol-batch").value || undefined,
        enrolmentNumber: $("#enrol-number").value.trim() || undefined
      })
    });
    showMessage("#enrol-message", `Saved. You are in ${data.enrolment.label}.`);
    await loadCurrentUser();
  } catch (error) {
    showMessage("#enrol-message", error.message, true);
  }
});

// ==============================
// Timetable
// ==============================
async function loadTimetable(params) {
  const canPick = can("view_all_attendance");
  $("#timetable-picker").classList.toggle("hidden", !canPick);
  $("#timetable-grid").innerHTML = skeletonRows(5);

  const query = new URLSearchParams(params || {}).toString();
  try {
    const data = await request(`/api/academic/timetable${query ? "?" + query : ""}`);
    renderTimetable(data);
    await loadSubjectFaculty(data.branch, data.semester);
  } catch (error) {
    if (error.code === "NOT_ENROLLED") return showView("enrolment");
    $("#timetable-grid").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderTimetable(data) {
  $("#timetable-caption").textContent =
    `${data.branchName} · Section ${data.section} · Semester ${data.semester} · Room ${data.room}`;
  $("#timetable-badge").textContent = data.batch ? `${data.branch}-${data.section} · ${data.batch}` : `${data.branch}-${data.section}`;

  const header = `<div class="tt-row tt-head"><span>Day</span>${data.periods
    .map((p) => `<span>${p.label}<small>${p.start}</small></span>`).join("")}</div>`;

  const body = data.days.map((day) => {
    const cells = data.periods.map((period) => {
      const slot = data.week[day].find((s) => s.period === period.period);
      if (!slot) return `<span class="tt-cell tt-free">—</span>`;
      const kind = slot.type.toLowerCase();
      const badge = slot.batch ? `<em class="tt-batch">${escapeHtml(slot.batch)}</em>` : "";
      const room = slot.room ? `<small>${escapeHtml(slot.room)}</small>` : "";
      return `<span class="tt-cell tt-${kind}" title="${escapeHtml(slot.subject)}${slot.faculty ? " — " + escapeHtml(slot.faculty) : ""}">
        <strong>${escapeHtml(slot.subjectCode)}</strong>${badge}${room}</span>`;
    }).join("");
    return `<div class="tt-row"><span class="tt-day">${day.slice(0, 3)}</span>${cells}</div>`;
  }).join("");

  $("#timetable-grid").innerHTML = header + body +
    `<div class="tt-legend"><span class="tt-key tt-theory"></span>Theory
     <span class="tt-key tt-lab"></span>Lab
     <span class="tt-key tt-library"></span>Library
     <span class="tt-key tt-enrichment"></span>Enrichment
     <span class="tt-lunch-note">Lunch ${data.lunch.start}–${data.lunch.end}</span></div>`;

  highlightCurrentPeriod(data);
}

async function loadSubjectFaculty(branch, semester) {
  try {
    const data = await request(`/api/academic/subjects?branch=${encodeURIComponent(branch)}&semester=${semester}`);
    const rows = data.subjects.filter((s) => s.countsForAttendance);
    $("#subject-faculty").innerHTML =
      `<div class="attendance-row subject-row header"><span>Code</span><span>Subject</span><span>Theory</span><span>Lab</span></div>` +
      rows.map((s) => `<div class="attendance-row subject-row"><span><strong>${escapeHtml(s.code)}</strong></span><span>${escapeHtml(s.name)}</span><span class="muted">${escapeHtml(s.theoryFaculty || "—")}</span><span class="muted">${escapeHtml(s.labFaculty || "—")}</span></div>`).join("");
  } catch {
    $("#subject-faculty").innerHTML = "";
  }
}

$("#tt-load").addEventListener("click", () => loadTimetable({
  branch: $("#tt-branch").value,
  section: $("#tt-section").value,
  semester: $("#tt-semester").value
}));

// ==============================
// Attendance
// ==============================
async function loadAttendance() {
  const teacherMode = can("view_all_attendance");
  $("#attendance-class-picker").classList.toggle("hidden", !teacherMode);
  $("#student-attendance").classList.toggle("hidden", teacherMode);
  $("#class-attendance").classList.toggle("hidden", !teacherMode);
  $("#mark-attendance-panel").classList.toggle("hidden", !can("manage_attendance"));
  $("#attendance-scope").textContent = teacherMode ? "ALL CLASSES" : "MY RECORDS";

  if (teacherMode) {
    $("#attendance-caption").textContent = "Attendance segregated by branch, section and semester.";
    await loadClassAttendance();
  } else {
    $("#attendance-caption").textContent = state.user.enrolment
      ? `${state.user.enrolment.label} · Room ${state.user.enrolment.room}`
      : "Your attendance across all subjects.";
    await loadStudentAttendance();
  }
}

async function loadStudentAttendance() {
  $("#subject-table").innerHTML = skeletonRows(4);
  $("#attendance-table").innerHTML = skeletonRows(6);
  try {
    const summary = await request("/api/academic/attendance/summary");
    const attended = summary.overall.attended;
    const total = summary.overall.total;

    setAnimatedStat("#present-count", attended);
    setAnimatedStat("#absent-count", total - attended);
    setAnimatedStat("#attendance-rate", summary.overall.percentage, "%");
    $("#attendance-shortfall").textContent = total === 0
      ? "No attendance recorded yet"
      : summary.overall.percentage >= 75
        ? "Above the 75% requirement"
        : `Attend ${summary.overall.shortfall} more to reach 75%`;

    const subjects = summary.subjects;
    $("#subject-empty").classList.toggle("hidden", subjects.length > 0);
    $("#subject-table").innerHTML = subjects.length
      ? `<div class="attendance-row subject-row header"><span>Code</span><span>Subject</span><span>Attended</span><span>Percentage</span></div>` +
        subjects.map((s) =>
          `<div class="attendance-row subject-row"><span><strong>${escapeHtml(s.subjectCode)}</strong></span><span>${escapeHtml(s.subject)}</span><span>${s.attended} / ${s.total}</span><span>${progressRing(s.percentage)}</span></div>`
        ).join("")
      : "";

    const data = await request("/api/attendance?limit=40");
    const records = data.records || [];
    $("#attendance-empty").classList.toggle("hidden", records.length > 0);
    $("#attendance-table").innerHTML = records.length
      ? `<div class="attendance-row header"><span>Subject</span><span>Date</span><span>Code</span><span>Status</span></div>` +
        records.map((r) => `<div class="attendance-row"><span>${escapeHtml(r.subject)}</span><span>${escapeHtml(r.date)}</span><span>${escapeHtml(r.subjectCode || "—")}</span><span><em class="status-badge status-${r.status.toLowerCase()}">${r.status}</em></span></div>`).join("")
      : "";

    renderDashboardChart(subjects);
  } catch (error) {
    showMessage("#attendance-message", error.message, true);
  }
}

async function loadClassAttendance(params) {
  const query = params || {
    branch: $("#cls-branch").value,
    section: $("#cls-section").value,
    semester: $("#cls-semester").value || 1,
    subjectCode: $("#cls-subject").value || undefined
  };
  if (!query.branch || !query.section) return;

  $("#class-roster").innerHTML = skeletonRows(6);
  try {
    const search = new URLSearchParams(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ""))
    ).toString();
    const data = await request(`/api/academic/attendance/class?${search}`);
    state.classView = data;

    const students = data.students || [];
    setAnimatedStat("#class-strength", data.summary ? data.summary.strength : 0);
    $("#class-label").textContent = `${data.branch}-${data.section} · Sem ${data.semester}`;
    setAnimatedStat("#class-average", data.summary ? data.summary.percentage : 0, "%");
    setAnimatedStat("#class-at-risk", data.summary ? data.summary.atRisk : 0);
    $("#class-roster-title").textContent = `${data.branch}-${data.section}${data.subjectCode ? " · " + data.subjectCode : ""}`;
    $("#class-empty").classList.toggle("hidden", students.length > 0);

    $("#class-roster").innerHTML = students.length
      ? `<div class="attendance-row roster-row header"><span>Enrolment</span><span>Student</span><span>Batch</span><span>Attended</span><span>Percentage</span></div>` +
        students.map((s) =>
          `<div class="attendance-row roster-row"><span>${escapeHtml(s.enrolmentNumber || "—")}</span><span><strong>${escapeHtml(s.name || s.username)}</strong></span><span>${escapeHtml(s.batch || "—")}</span><span>${s.attended} / ${s.total}</span><span>${progressRing(s.percentage)}</span></div>`
        ).join("")
      : "";

    await populateMarkingForm(data);
    renderDashboardChart([]);
  } catch (error) {
    showMessage("#attendance-message", error.message, true);
  }
}

/** Fills the mark-attendance dropdowns from the class currently loaded. */
async function populateMarkingForm(classData) {
  if (!can("manage_attendance")) return;

  fillSelect($("#attendance-student-id"),
    classData.students.map((s) => ({ value: s.id, label: `${s.enrolmentNumber || s.username} — ${s.name}` })));

  try {
    const subjects = await request(`/api/academic/subjects?branch=${encodeURIComponent(classData.branch)}&semester=${classData.semester}`);
    const teachable = subjects.subjects.filter((s) => s.countsForAttendance);
    fillSelect($("#attendance-subject"), teachable.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` })));
    fillSelect($("#cls-subject"), teachable.map((s) => ({ value: s.code, label: s.code })), {
      placeholder: "All subjects",
      selected: classData.subjectCode || ""
    });
  } catch { /* leave the dropdowns as they are */ }

  if (!$("#attendance-date").value) {
    $("#attendance-date").value = new Date().toISOString().slice(0, 10);
  }
}

function renderDashboardChart(subjects) {
  const chart = $("#dashboard-chart");
  if (!chart) return;
  const items = subjects.slice(0, 5);
  if (items.length === 0) {
    chart.innerHTML = `<div class="empty-state">Attendance appears here once records are loaded.</div>`;
    return;
  }
  chart.innerHTML = items.map((s) => `<div class="chart-column"><div class="chart-value">${s.percentage}%</div><div class="chart-track"><div class="chart-fill" style="height:${Math.max(s.percentage, 6)}%"></div></div><span>${escapeHtml(s.subjectCode)}</span></div>`).join("");
}

$("#cls-load").addEventListener("click", () => loadClassAttendance());
$("#refresh-attendance").addEventListener("click", loadAttendance);

$("#mark-attendance").addEventListener("click", async () => {
  clearMessage("#attendance-message");
  try {
    await request("/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        studentId: Number($("#attendance-student-id").value),
        subjectCode: $("#attendance-subject").value,
        date: $("#attendance-date").value,
        status: $("#attendance-status").value
      })
    });
    showMessage("#attendance-message", "Attendance saved.");
    await loadClassAttendance();
  } catch (error) {
    showMessage("#attendance-message", error.message, true);
  }
});

// ==============================
// Auth actions
// ==============================
$("#login-submit").addEventListener("click", async () => {
  clearMessage("#auth-message");
  try {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: $("#login-name").value.trim(), password: $("#login-password").value })
    });
    state.token = data.token;
    localStorage.setItem("bpit_token", state.token);
    await loadCurrentUser();
  } catch (error) { showMessage("#auth-message", error.message, true); }
});

$("#register-submit").addEventListener("click", async () => {
  clearMessage("#auth-message");
  try {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("#register-name").value.trim(),
        username: $("#register-username").value.trim(),
        email: $("#register-email").value.trim(),
        password: $("#register-password").value
      })
    });
    state.token = data.token;
    localStorage.setItem("bpit_token", state.token);
    await loadCurrentUser();
  } catch (error) { showMessage("#auth-message", error.message, true); }
});

$("#logout-button").addEventListener("click", () => {
  state.token = null;
  state.user = null;
  state.classView = null;
  localStorage.removeItem("bpit_token");
  $("#logout-button").classList.add("hidden");
  $(".admin-nav").classList.add("hidden");
  $(".class-nav").classList.add("hidden");
  $("#sidebar-user")?.classList.add("hidden");
  switchAuth("login");
  showView("overview");
});

// ==============================
// User administration
// ==============================
async function loadUsers() {
  if (!can("view_users")) return;
  const canEdit = can("edit_users");
  const canRemove = can("delete_users");
  $("#assign-role-panel").classList.toggle("hidden", !canEdit);
  $("#access-scope").textContent = canEdit ? "ADMIN" : "READ ONLY";
  $("#users-table").innerHTML = skeletonRows(5);

  try {
    const data = await request("/auth/users?pageSize=100");
    const users = data.users || [];
    $("#users-empty").classList.toggle("hidden", users.length > 0);
    $("#users-table").innerHTML = users.length
      ? `<div class="attendance-row users-row header"><span>ID</span><span>User</span><span>Roles</span><span>Status</span><span>Actions</span></div>` +
        users.map((user) => {
          const roles = (user.roles || []).join(", ") || "—";
          const isSelf = user.id === state.user.id;
          const statusClass = user.isActive ? "status-present" : "status-absent";
          const actions = (!canRemove || isSelf)
            ? `<span class="muted">${isSelf ? "You" : "—"}</span>`
            : `<span class="row-actions"><button class="link-button" data-toggle-user="${user.id}" data-active="${user.isActive}">${user.isActive ? "Deactivate" : "Activate"}</button><button class="link-button danger" data-delete-user="${user.id}">Delete</button></span>`;
          return `<div class="attendance-row users-row"><span>${user.id}</span><span><strong>${escapeHtml(user.username)}</strong><br><small class="muted">${escapeHtml(user.email || "no email")}</small></span><span>${escapeHtml(roles)}</span><span><em class="status-badge ${statusClass}">${user.isActive ? "ACTIVE" : "DISABLED"}</em></span>${actions}</div>`;
        }).join("")
      : "";
    bindUserActions();
  } catch (error) {
    showMessage("#role-message", error.message, true);
  }
}

function bindUserActions() {
  document.querySelectorAll("[data-toggle-user]").forEach((button) => button.addEventListener("click", async () => {
    clearMessage("#role-message");
    try {
      const isActive = button.dataset.active === "true";
      await request(`/auth/users/${button.dataset.toggleUser}/status`, {
        method: "PATCH", body: JSON.stringify({ isActive: !isActive })
      });
      showMessage("#role-message", isActive ? "User deactivated." : "User activated.");
      await loadUsers();
    } catch (error) { showMessage("#role-message", error.message, true); }
  }));

  document.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", async () => {
    clearMessage("#role-message");
    const id = button.dataset.deleteUser;
    if (!window.confirm(`Permanently delete user #${id} and their attendance records?`)) return;
    try {
      await request(`/auth/users/${id}`, { method: "DELETE" });
      showMessage("#role-message", "User deleted.");
      await loadUsers();
    } catch (error) { showMessage("#role-message", error.message, true); }
  }));
}

$("#role-submit").addEventListener("click", async () => {
  clearMessage("#role-message");
  try {
    await request(`/auth/users/${$("#role-user-id").value}/roles`, {
      method: "POST", body: JSON.stringify({ role: $("#role-name").value })
    });
    showMessage("#role-message", "Role assigned. The user receives the new permissions on their next sign-in.");
    await loadUsers();
  } catch (error) { showMessage("#role-message", error.message, true); }
});

// ==============================
// Wiring
// ==============================
document.querySelectorAll(".auth-tab").forEach((tab) => tab.addEventListener("click", () => switchAuth(tab.dataset.auth)));
document.querySelectorAll("[data-view]").forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));

const demoCredentials = {
  student: ["vidhatri.nautiyal001@bpitindia.edu.in", "Bpit@2026"],
  teacher: ["demo.faculty", "Teach@2026"],
  admin: ["demo_admin", "Admin@123"]
};

document.querySelectorAll(".demo-role").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".demo-role").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  const [login, password] = demoCredentials[button.dataset.demoRole];
  $("#login-name").value = login;
  $("#login-password").value = password;
}));

function initThemeToggle() {
  const STORAGE_KEY = "bpit-theme";
  const root = document.documentElement;
  const toggle = $("#theme-toggle");

  function applyTheme(mode) {
    root.setAttribute("data-theme", mode);
    if (!toggle) return;
    const isDark = mode === "dark";
    toggle.classList.toggle("is-dark", isDark);
    toggle.setAttribute("aria-pressed", String(isDark));
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    toggle.title = label;
    toggle.setAttribute("aria-label", label);
  }

  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  toggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (err) { /* private mode / storage disabled */ }
  });
}

initThemeToggle();
startLiveClock();
pollHealth();
setInterval(pollHealth, 20000);
loadCurrentUser();
