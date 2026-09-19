/**
 * End-to-end smoke test for the gateway.
 *
 * Boots the real server against the configured database and exercises
 * authentication, role-based access control and the attendance routes over
 * HTTP. Run with: npm test
 */
require("dotenv").config();

const { spawn } = require("child_process");
const path = require("path");

const PORT = process.env.TEST_PORT || 3999;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
    if (condition) {
        passed += 1;
        console.log(`  PASS  ${name}`);
    } else {
        failed += 1;
        failures.push(name);
        console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
    }
}

function section(title) {
    console.log(`\n${title}`);
}

async function api(method, route, { token, body, raw } = {}) {
    const headers = {};
    if (!raw) headers["Content-Type"] = "application/json";
    if (raw) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(BASE + route, {
        method,
        headers,
        body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined)
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: response.status, data };
}

async function waitForServer(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${BASE}/health`);
            if (response.ok) return true;
        } catch {
            // server not up yet
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    return false;
}

async function run() {
    const unique = Date.now().toString().slice(-8);
    const throwaway = {
        username: `smoke_${unique}`,
        email: `smoke_${unique}@example.com`,
        password: "Smoke@1234",
        name: "Smoke Test User"
    };

    // ---------------------------------------------------------------
    section("Health");
    // ---------------------------------------------------------------
    const health = await api("GET", "/health");
    check("GET /health returns ok", health.status === 200 && health.data.status === "ok", JSON.stringify(health.data));

    // ---------------------------------------------------------------
    section("Common authentication - registration");
    // ---------------------------------------------------------------
    const weak = await api("POST", "/auth/register", {
        body: { username: `weak_${unique}`, email: `weak_${unique}@example.com`, password: "abc" }
    });
    check("weak password rejected with 400", weak.status === 400, `${weak.status} ${JSON.stringify(weak.data)}`);

    const noDigit = await api("POST", "/auth/register", {
        body: { username: `nodigit_${unique}`, email: `nodigit_${unique}@example.com`, password: "abcdefghij" }
    });
    check("password without a digit rejected", noDigit.status === 400, String(noDigit.status));

    const missing = await api("POST", "/auth/register", { body: { username: "only" } });
    check("missing fields rejected with 400", missing.status === 400, String(missing.status));

    const registered = await api("POST", "/auth/register", { body: throwaway });
    check("registration succeeds with 201", registered.status === 201, JSON.stringify(registered.data));
    check("registration returns a token", Boolean(registered.data.token));
    check("new account defaults to STUDENT", JSON.stringify(registered.data.user?.roles) === JSON.stringify(["STUDENT"]),
        JSON.stringify(registered.data.user?.roles));

    const duplicate = await api("POST", "/auth/register", { body: throwaway });
    check("duplicate username rejected with 409", duplicate.status === 409, String(duplicate.status));

    const throwawayId = registered.data.user?.id;
    let throwawayToken = registered.data.token;

    // ---------------------------------------------------------------
    section("Common authentication - login");
    // ---------------------------------------------------------------
    const badPassword = await api("POST", "/auth/login", { body: { login: throwaway.username, password: "WrongPass1" } });
    check("wrong password rejected with 401", badPassword.status === 401, String(badPassword.status));

    const unknownUser = await api("POST", "/auth/login", { body: { login: "does_not_exist_at_all", password: "WrongPass1" } });
    check("unknown user gives the same 401 message (no enumeration)",
        unknownUser.status === 401 && unknownUser.data.error === badPassword.data.error,
        `${unknownUser.data.error} vs ${badPassword.data.error}`);

    const byUsername = await api("POST", "/auth/login", { body: { login: throwaway.username, password: throwaway.password } });
    check("login by username succeeds", byUsername.status === 200 && Boolean(byUsername.data.token), String(byUsername.status));

    const byEmail = await api("POST", "/auth/login", { body: { login: throwaway.email, password: throwaway.password } });
    check("login by email succeeds", byEmail.status === 200 && Boolean(byEmail.data.token), String(byEmail.status));
    throwawayToken = byEmail.data.token || throwawayToken;

    const msLogin = await api("POST", "/auth/microsoft", { body: { idToken: "not-a-real-token" } });
    check("Microsoft login reports 503 when unconfigured", msLogin.status === 503, String(msLogin.status));

    // ---------------------------------------------------------------
    section("Token handling");
    // ---------------------------------------------------------------
    const noToken = await api("GET", "/auth/me");
    check("protected route without token returns 401", noToken.status === 401, String(noToken.status));

    const badToken = await api("GET", "/auth/me", { token: "garbage.token.value" });
    check("protected route with invalid token returns 401", badToken.status === 401, String(badToken.status));

    const me = await api("GET", "/auth/me", { token: throwawayToken });
    check("GET /auth/me returns the profile", me.status === 200 && me.data.user?.username === throwaway.username,
        JSON.stringify(me.data));
    check("student permissions are least-privileged",
        JSON.stringify((me.data.user?.permissions || []).sort()) === JSON.stringify(["view_attendance", "view_profile", "view_timetable"]),
        JSON.stringify(me.data.user?.permissions));
    check("a brand-new student is flagged as needing enrolment",
        me.data.user?.needsEnrolment === true, String(me.data.user?.needsEnrolment));

    // ---------------------------------------------------------------
    section("Role-based access control");
    // ---------------------------------------------------------------
    const student = await api("POST", "/auth/login", { body: { login: "student1", password: "Student@123" } });
    const teacher = await api("POST", "/auth/login", { body: { login: "demo_teacher", password: "Teacher@123" } });
    const admin = await api("POST", "/auth/login", { body: { login: "demo_admin", password: "Admin@123" } });
    check("demo accounts can all sign in",
        student.status === 200 && teacher.status === 200 && admin.status === 200,
        `${student.status}/${teacher.status}/${admin.status}`);

    const studentToken = student.data.token;
    const teacherToken = teacher.data.token;
    const adminToken = admin.data.token;

    // Uses the freshly registered account rather than a shared demo login,
    // whose role can drift as other tests promote and demote it.
    const studentListsUsers = await api("GET", "/auth/users", { token: throwawayToken });
    check("STUDENT cannot list users (403)", studentListsUsers.status === 403, String(studentListsUsers.status));

    const teacherListsUsers = await api("GET", "/auth/users", { token: teacherToken });
    check("TEACHER can list users (view_users)", teacherListsUsers.status === 200, String(teacherListsUsers.status));
    check("user list is paginated", typeof teacherListsUsers.data.total === "number", JSON.stringify(teacherListsUsers.data).slice(0, 120));

    const teacherAssignsRole = await api("POST", `/auth/users/${throwawayId}/roles`, {
        token: teacherToken, body: { role: "ADMIN" }
    });
    check("TEACHER cannot assign roles (403)", teacherAssignsRole.status === 403, String(teacherAssignsRole.status));

    const teacherDeletes = await api("DELETE", `/auth/users/${throwawayId}`, { token: teacherToken });
    check("TEACHER cannot delete users (403)", teacherDeletes.status === 403, String(teacherDeletes.status));

    const adminRoles = await api("GET", "/auth/roles", { token: adminToken });
    check("ADMIN can read the role matrix", adminRoles.status === 200 && Array.isArray(adminRoles.data.roles),
        String(adminRoles.status));

    const adminPromotes = await api("POST", `/auth/users/${throwawayId}/roles`, {
        token: adminToken, body: { role: "TEACHER" }
    });
    check("ADMIN can assign a role", adminPromotes.status === 200, JSON.stringify(adminPromotes.data));
    check("assigning a role replaces rather than accumulates",
        JSON.stringify(adminPromotes.data.user?.roles) === JSON.stringify(["TEACHER"]),
        JSON.stringify(adminPromotes.data.user?.roles));

    const selfDemote = await api("POST", `/auth/users/${admin.data.user.id}/roles`, {
        token: adminToken, body: { role: "STUDENT" }
    });
    check("ADMIN cannot change their own role", selfDemote.status === 400, String(selfDemote.status));

    const missingUser = await api("POST", "/auth/users/999999/roles", { token: adminToken, body: { role: "STUDENT" } });
    check("assigning a role to a missing user returns 404", missingUser.status === 404, String(missingUser.status));

    const badRole = await api("POST", `/auth/users/${throwawayId}/roles`, { token: adminToken, body: { role: "WIZARD" } });
    check("unknown role returns 404", badRole.status === 404, String(badRole.status));

    // ---------------------------------------------------------------
    section("Attendance authorization");
    // ---------------------------------------------------------------
    // A real, enrolled student from the seeded CSE-A roster.
    const roster = await api("POST", "/auth/login", {
        body: { login: "vidhatri.nautiyal001@bpitindia.edu.in", password: "Bpit@2026" }
    });
    check("seeded roster student can sign in", roster.status === 200, JSON.stringify(roster.data).slice(0, 120));
    const rosterToken = roster.data.token;
    const rosterId = roster.data.user?.id;
    check("roster student is already enrolled in CSE-A",
        roster.data.user?.enrolment?.branch === "CSE" && roster.data.user?.enrolment?.section === "A",
        JSON.stringify(roster.data.user?.enrolment));

    const studentMarks = await api("POST", "/api/attendance", {
        token: rosterToken,
        body: { studentId: rosterId, subjectCode: "PPS", date: "2026-09-10", status: "PRESENT" }
    });
    check("STUDENT cannot mark attendance (403)", studentMarks.status === 403, String(studentMarks.status));

    const teacherMarks = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: rosterId, subjectCode: "PPS", date: "2026-09-10", status: "PRESENT" }
    });
    check("TEACHER can mark attendance (201)", teacherMarks.status === 201, JSON.stringify(teacherMarks.data));

    const remark = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: rosterId, subjectCode: "PPS", date: "2026-09-10", status: "LATE" }
    });
    check("re-marking the same student, subject and date updates in place",
        remark.status === 201 && remark.data.record?.id === teacherMarks.data.record?.id,
        `${remark.data.record?.id} vs ${teacherMarks.data.record?.id}`);

    const wrongSubject = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: rosterId, subjectCode: "DECO", date: "2026-09-10", status: "PRESENT" }
    });
    check("a subject outside the branch scheme is rejected", wrongSubject.status === 400, String(wrongSubject.status));

    const nonAcademic = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: rosterId, subjectCode: "LIB", date: "2026-09-10", status: "PRESENT" }
    });
    check("library and enrichment slots cannot be marked", nonAcademic.status === 400, String(nonAcademic.status));

    const invalidStatus = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: rosterId, subjectCode: "PPS", date: "2026-09-10", status: "MAYBE" }
    });
    check("invalid attendance status rejected", invalidStatus.status === 400, String(invalidStatus.status));

    const missingStudent = await api("POST", "/api/attendance", {
        token: teacherToken,
        body: { studentId: 999999, subjectCode: "PPS", date: "2026-09-10", status: "PRESENT" }
    });
    check("marking a missing student returns 404", missingStudent.status === 404, String(missingStudent.status));

    const studentRecords = await api("GET", "/api/attendance", { token: rosterToken });
    const studentOwnsAll = Array.isArray(studentRecords.data.records)
        && studentRecords.data.records.every(r => r.userId === rosterId);
    check("STUDENT sees only their own records", studentRecords.status === 200 && studentOwnsAll,
        JSON.stringify(studentRecords.data).slice(0, 160));

    const crossUser = await api("GET", `/api/attendance?userId=${throwawayId}`, { token: rosterToken });
    check("STUDENT cannot read another students records (403)", crossUser.status === 403, String(crossUser.status));

    const badScope = await api("GET", "/api/attendance?userId=abc", { token: rosterToken });
    check("invalid userId fails closed instead of listing everyone",
        badScope.status === 400 || badScope.status === 403, String(badScope.status));

    const teacherRecords = await api("GET", "/api/attendance", { token: teacherToken });
    const seesMultipleUsers = new Set((teacherRecords.data.records || []).map(r => r.userId)).size > 1;
    check("TEACHER sees records across students", teacherRecords.status === 200 && seesMultipleUsers,
        `status ${teacherRecords.status}, distinct users ${new Set((teacherRecords.data.records || []).map(r => r.userId)).size}`);

    // ---------------------------------------------------------------
    section("Account deactivation");
    // ---------------------------------------------------------------
    const deactivate = await api("PATCH", `/auth/users/${throwawayId}/status`, {
        token: adminToken, body: { isActive: false }
    });
    check("ADMIN can deactivate a user", deactivate.status === 200, JSON.stringify(deactivate.data));

    const deactivatedRequest = await api("GET", "/auth/me", { token: throwawayToken });
    check("existing token stops working once deactivated", deactivatedRequest.status === 403,
        String(deactivatedRequest.status));

    const deactivatedLogin = await api("POST", "/auth/login", {
        body: { login: throwaway.username, password: throwaway.password }
    });
    check("deactivated user cannot log back in", deactivatedLogin.status === 403, String(deactivatedLogin.status));

    const reactivate = await api("PATCH", `/auth/users/${throwawayId}/status`, {
        token: adminToken, body: { isActive: true }
    });
    check("ADMIN can reactivate a user", reactivate.status === 200, String(reactivate.status));

    const selfDeactivate = await api("PATCH", `/auth/users/${admin.data.user.id}/status`, {
        token: adminToken, body: { isActive: false }
    });
    check("ADMIN cannot deactivate themselves", selfDeactivate.status === 400, String(selfDeactivate.status));

    // ---------------------------------------------------------------
    section("Gateway proxy and error handling");
    // ---------------------------------------------------------------
    const proxyNoAuth = await api("GET", "/attendance_service/anything");
    check("proxy requires authentication (401)", proxyNoAuth.status === 401, String(proxyNoAuth.status));

    const proxyDown = await api("GET", "/attendance_service/anything", { token: adminToken });
    check("unreachable upstream returns 502 instead of crashing",
        proxyDown.status === 502, `${proxyDown.status} ${JSON.stringify(proxyDown.data)}`);

    const stillAlive = await api("GET", "/health");
    check("server still healthy after upstream failure", stillAlive.status === 200, String(stillAlive.status));

    const notFound = await api("GET", "/no/such/route");
    check("unknown route returns JSON 404", notFound.status === 404 && Boolean(notFound.data.error), String(notFound.status));

    const malformed = await api("POST", "/auth/login", { raw: "{not json" });
    check("malformed JSON returns 400", malformed.status === 400, String(malformed.status));

    // ---------------------------------------------------------------
    section("Timetable and enrolment");
    // ---------------------------------------------------------------
    const meta = await api("GET", "/api/academic/meta", { token: rosterToken });
    check("class catalogue lists every branch",
        meta.status === 200 && meta.data.branches?.length === 5,
        `${meta.status}, ${meta.data.branches?.length} branches`);
    check("catalogue carries the eight-period grid",
        meta.data.periods?.length === 8 && meta.data.lunch?.start === "12:50",
        JSON.stringify(meta.data.periods?.length));

    const rosterTimetable = await api("GET", "/api/academic/timetable", { token: rosterToken });
    check("student gets their own timetable without asking for a class",
        rosterTimetable.status === 200 && rosterTimetable.data.section === "A" && rosterTimetable.data.branch === "CSE",
        `${rosterTimetable.status} ${rosterTimetable.data.branch}-${rosterTimetable.data.section}`);
    check("timetable covers all five weekdays",
        Object.keys(rosterTimetable.data.week || {}).length === 5,
        JSON.stringify(Object.keys(rosterTimetable.data.week || {})));

    const allSlots = Object.values(rosterTimetable.data.week || {}).flat();
    check("timetable carries real subject codes and rooms",
        allSlots.some(s => s.subjectCode === "PPS") && allSlots.some(s => s.room),
        `${allSlots.length} slots`);
    check("student only sees their own lab batch",
        allSlots.filter(s => s.batch && s.batch !== "G1").length === 0,
        JSON.stringify([...new Set(allSlots.map(s => s.batch).filter(Boolean))]));
    check("faculty names come through from the timetable",
        allSlots.some(s => s.faculty && s.faculty.length > 3),
        JSON.stringify(allSlots.find(s => s.faculty)?.faculty));

    const otherClass = await api("GET", "/api/academic/timetable?branch=IT&section=B", { token: rosterToken });
    check("a student asking for another class still gets their own",
        otherClass.status === 200 && otherClass.data.branch === "CSE",
        `${otherClass.data.branch}-${otherClass.data.section}`);

    const teacherPicks = await api("GET", "/api/academic/timetable?branch=ECE&section=A", { token: teacherToken });
    check("TEACHER can open any section timetable",
        teacherPicks.status === 200 && teacherPicks.data.branch === "ECE",
        `${teacherPicks.status} ${teacherPicks.data.branch}-${teacherPicks.data.section}`);

    const badClass = await api("GET", "/api/academic/timetable?branch=CSE&section=Z", { token: teacherToken });
    check("an unknown section returns 404", badClass.status === 404, String(badClass.status));

    const enrolBad = await api("POST", "/api/academic/enrol", {
        token: throwawayToken, body: { branch: "CSE", section: "A", semester: 3, year: 1 }
    });
    check("enrolment rejects a semester that is not modelled", enrolBad.status === 400, String(enrolBad.status));

    const enrolBadSection = await api("POST", "/api/academic/enrol", {
        token: throwawayToken, body: { branch: "EEE", section: "C", semester: 1, year: 1 }
    });
    check("enrolment rejects a section the branch does not have",
        enrolBadSection.status === 400, String(enrolBadSection.status));

    const enrolOk = await api("POST", "/api/academic/enrol", {
        token: throwawayToken, body: { branch: "IT", section: "C", semester: 1, year: 1, batch: "G2" }
    });
    check("a new student can enrol themselves",
        enrolOk.status === 200 && enrolOk.data.enrolment?.branch === "IT",
        JSON.stringify(enrolOk.data));

    const afterEnrol = await api("GET", "/auth/me", { token: throwawayToken });
    check("enrolment clears the needsEnrolment flag",
        afterEnrol.data.user?.needsEnrolment === false, String(afterEnrol.data.user?.needsEnrolment));

    const newTimetable = await api("GET", "/api/academic/timetable", { token: throwawayToken });
    check("the newly enrolled student now has a timetable",
        newTimetable.status === 200 && newTimetable.data.section === "C",
        `${newTimetable.status} ${newTimetable.data.branch}-${newTimetable.data.section}`);

    // ---------------------------------------------------------------
    section("Attendance analytics");
    // ---------------------------------------------------------------
    const summary = await api("GET", "/api/academic/attendance/summary", { token: rosterToken });
    check("student gets a per-subject summary",
        summary.status === 200 && summary.data.subjects?.length > 0,
        `${summary.status}, ${summary.data.subjects?.length} subjects`);
    check("summary reports the real CSE subject codes",
        summary.data.subjects?.some(s => s.subjectCode === "PPS")
        && summary.data.subjects?.some(s => s.subjectCode === "EVS"),
        JSON.stringify(summary.data.subjects?.map(s => s.subjectCode)));
    check("summary never includes library or enrichment slots",
        !summary.data.subjects?.some(s => ["LIB", "ENR", "PDP"].includes(s.subjectCode)),
        JSON.stringify(summary.data.subjects?.map(s => s.subjectCode)));
    check("overall percentage is consistent with the per-subject totals",
        summary.data.overall?.total === summary.data.subjects.reduce((n, s) => n + s.total, 0),
        `${summary.data.overall?.total} vs ${summary.data.subjects.reduce((n, s) => n + s.total, 0)}`);

    const peek = await api("GET", `/api/academic/attendance/summary?userId=${rosterId}`, { token: throwawayToken });
    check("a student cannot read another summary (403)", peek.status === 403, String(peek.status));

    const teacherPeek = await api("GET", `/api/academic/attendance/summary?userId=${rosterId}`, { token: teacherToken });
    check("TEACHER can read any student summary", teacherPeek.status === 200, String(teacherPeek.status));

    const classView = await api("GET", "/api/academic/attendance/class?branch=CSE&section=A&semester=1", { token: teacherToken });
    check("TEACHER gets a class roster with percentages",
        classView.status === 200 && classView.data.students?.length > 0,
        `${classView.status}, ${classView.data.students?.length} students`);
    check("roster carries enrolment numbers and batches",
        classView.data.students?.every(s => s.enrolmentNumber && s.batch),
        JSON.stringify(classView.data.students?.[0]));
    check("class summary reports strength and average",
        typeof classView.data.summary?.strength === "number"
        && typeof classView.data.summary?.percentage === "number",
        JSON.stringify(classView.data.summary));

    const otherSection = await api("GET", "/api/academic/attendance/class?branch=IT&section=B&semester=1", { token: teacherToken });
    const cseIds = new Set((classView.data.students || []).map(s => s.id));
    check("a different section returns a different roster",
        otherSection.status === 200
        && otherSection.data.students?.length > 0
        && !otherSection.data.students.some(s => cseIds.has(s.id)),
        `${otherSection.data.students?.length} students, no overlap`);

    const bySubject = await api("GET", "/api/academic/attendance/class?branch=CSE&section=A&semester=1&subjectCode=PPS", { token: teacherToken });
    check("class view can be narrowed to one subject",
        bySubject.status === 200 && bySubject.data.subjectCode === "PPS"
        && bySubject.data.students.every(s => s.total <= classView.data.students.find(c => c.id === s.id).total),
        `${bySubject.status}`);

    const studentClassView = await api("GET", "/api/academic/attendance/class?branch=CSE&section=A", { token: rosterToken });
    check("STUDENT cannot open the class roster (403)", studentClassView.status === 403, String(studentClassView.status));

    const missingParams = await api("GET", "/api/academic/attendance/class", { token: teacherToken });
    check("class view requires branch and section", missingParams.status === 400, String(missingParams.status));

    // ---------------------------------------------------------------
    section("Cleanup");
    // ---------------------------------------------------------------
    const removed = await api("DELETE", `/auth/users/${throwawayId}`, { token: adminToken });
    check("ADMIN can delete a user", removed.status === 200, JSON.stringify(removed.data));

    const goneToken = await api("GET", "/auth/me", { token: throwawayToken });
    check("token of a deleted user is rejected", goneToken.status === 401, String(goneToken.status));
}

async function main() {
    console.log(`Starting server on port ${PORT}...`);
    const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        env: { ...process.env, PORT: String(PORT), SEED_DEMO_DATA: "true" },
        stdio: ["ignore", "pipe", "pipe"]
    });

    const serverLog = [];
    server.stdout.on("data", d => serverLog.push(d.toString()));
    server.stderr.on("data", d => serverLog.push(d.toString()));

    try {
        if (!await waitForServer()) {
            console.error("Server did not become healthy in time. Output:\n" + serverLog.join(""));
            process.exitCode = 1;
            return;
        }

        await run();

        console.log(`\n${"=".repeat(52)}`);
        console.log(`  ${passed} passed, ${failed} failed`);
        if (failed > 0) {
            console.log(`  Failing: ${failures.join(", ")}`);
        }
        console.log("=".repeat(52));
        process.exitCode = failed > 0 ? 1 : 0;
    } catch (error) {
        console.error("\nSmoke test crashed:", error);
        console.error("Server output:\n" + serverLog.join(""));
        process.exitCode = 1;
    } finally {
        server.kill();
    }
}

main();
