const { Op, fn, col, literal } = require("sequelize");
const { User, Subject, TimetableSlot, AttendanceRecord } = require("../../db/models");
const curriculum = require("../../data/curriculum");

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

const VALID_BRANCHES = Object.keys(curriculum.BRANCH_CODES);
const VALID_BATCHES = ["G1", "G2"];

// ==============================
// Class catalogue
// ==============================
/** Every section that exists, for enrolment dropdowns and teacher filters. */
function listClasses() {
    return curriculum.SECTIONS.map(s => ({
        branch: s.branch,
        branchName: curriculum.BRANCH_NAMES[s.branch],
        section: s.section,
        semester: 1,
        year: 1,
        room: s.room,
        label: `${s.branch}-${s.section} · Sem 1`
    }));
}

function classMeta() {
    return {
        branches: VALID_BRANCHES.map(code => ({
            code,
            name: curriculum.BRANCH_NAMES[code],
            sections: curriculum.SECTIONS.filter(s => s.branch === code).map(s => s.section)
        })),
        // Only semester 1 is modelled so far; years/semesters are listed so the
        // UI can show the full picture and disable what is not seeded yet.
        years: [1],
        semesters: [1],
        batches: VALID_BATCHES,
        periods: curriculum.PERIODS,
        lunch: curriculum.LUNCH,
        days: curriculum.DAYS
    };
}

function findSectionDef(branch, section) {
    return curriculum.SECTIONS.find(
        s => s.branch === branch && s.section === String(section).toUpperCase()
    );
}

// ==============================
// Enrolment
// ==============================
/**
 * Records which class a student belongs to. Called after their first sign-in,
 * and again whenever they correct their details.
 */
async function enrolStudent(userId, data = {}) {
    const branch = String(data.branch || "").toUpperCase();
    const section = String(data.section || "").toUpperCase();
    const semester = Number(data.semester);
    const year = Number(data.year);

    if (!VALID_BRANCHES.includes(branch)) {
        throw httpError(400, `branch must be one of: ${VALID_BRANCHES.join(", ")}`);
    }
    if (!findSectionDef(branch, section)) {
        throw httpError(400, `Section ${section} does not exist for ${branch}`);
    }
    if (semester !== 1) {
        throw httpError(400, "Only semester 1 is available at the moment");
    }
    if (year !== 1) {
        throw httpError(400, "Only first year is available at the moment");
    }

    const batch = data.batch ? String(data.batch).toUpperCase() : null;
    if (batch && !VALID_BATCHES.includes(batch)) {
        throw httpError(400, "batch must be G1 or G2");
    }

    const user = await User.findByPk(userId);
    if (!user) throw httpError(404, "User not found");

    if (data.enrolmentNumber) {
        const enrolmentNumber = String(data.enrolmentNumber).trim();
        const clash = await User.findOne({
            where: { enrolmentNumber, id: { [Op.ne]: userId } }
        });
        if (clash) throw httpError(409, "That enrolment number belongs to another account");
        user.enrolmentNumber = enrolmentNumber;
    }

    user.branch = branch;
    user.section = section;
    user.semester = semester;
    user.year = year;
    if (batch) user.batch = batch;
    await user.save();

    return user.toJSON();
}

function enrolmentOf(user) {
    if (!user.branch || !user.section || !user.semester) return null;
    const sectionDef = findSectionDef(user.branch, user.section);
    return {
        branch: user.branch,
        branchName: curriculum.BRANCH_NAMES[user.branch] || user.branch,
        section: user.section,
        semester: user.semester,
        year: user.year,
        batch: user.batch,
        room: sectionDef ? sectionDef.room : null,
        enrolmentNumber: user.enrolmentNumber,
        label: `${user.branch}-${user.section} · Year ${user.year} · Sem ${user.semester}`
    };
}

// ==============================
// Timetable
// ==============================
/**
 * Returns the week as day -> period -> entry. When `batch` is given, the
 * parallel lab slot for the other batch is filtered out so a student sees
 * only the classes they actually attend.
 */
async function getTimetable({ branch, section, semester = 1, batch = null }) {
    if (!findSectionDef(branch, section)) {
        throw httpError(404, `No timetable for ${branch}-${section}`);
    }

    const slots = await TimetableSlot.findAll({
        where: { branch, section: String(section).toUpperCase(), semester },
        order: [["period", "ASC"]]
    });

    const subjects = await Subject.findAll({ where: { branch, semester } });
    const nameByCode = new Map(subjects.map(s => [s.code, s.name]));

    const week = {};
    for (const day of curriculum.DAYS) week[day] = [];

    for (const slot of slots) {
        if (batch && slot.batch && slot.batch !== batch) continue;
        week[slot.day].push({
            period: slot.period,
            subjectCode: slot.subjectCode,
            subject: nameByCode.get(slot.subjectCode) || curriculum.SUBJECTS[slot.subjectCode] || slot.subjectCode,
            type: slot.type,
            batch: slot.batch,
            room: slot.room,
            faculty: slot.faculty
        });
    }

    for (const day of curriculum.DAYS) {
        week[day].sort((a, b) => a.period - b.period);
    }

    const sectionDef = findSectionDef(branch, section);
    return {
        branch,
        branchName: curriculum.BRANCH_NAMES[branch],
        section: String(section).toUpperCase(),
        semester,
        batch,
        room: sectionDef.room,
        periods: curriculum.PERIODS,
        lunch: curriculum.LUNCH,
        days: curriculum.DAYS,
        week
    };
}

async function getSubjects(branch, semester = 1) {
    const subjects = await Subject.findAll({
        where: { branch, semester },
        order: [["code", "ASC"]]
    });
    return subjects.map(s => ({
        code: s.code,
        name: s.name,
        theoryFaculty: s.theoryFaculty,
        labFaculty: s.labFaculty,
        countsForAttendance: s.countsForAttendance
    }));
}

// ==============================
// Attendance analytics
// ==============================
/** Per-subject present/absent/late totals and percentage for one student. */
async function getStudentAttendanceSummary(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw httpError(404, "User not found");

    const rows = await AttendanceRecord.findAll({
        attributes: [
            "subjectCode",
            "subject",
            [fn("COUNT", col("id")), "total"],
            [fn("SUM", literal("CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END")), "present"],
            [fn("SUM", literal("CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END")), "absent"],
            [fn("SUM", literal("CASE WHEN status = 'LATE' THEN 1 ELSE 0 END")), "late"]
        ],
        where: { userId },
        group: ["subjectCode", "subject"],
        order: [["subjectCode", "ASC"]],
        raw: true
    });

    const subjects = rows.map(row => {
        const total = Number(row.total) || 0;
        const present = Number(row.present) || 0;
        const late = Number(row.late) || 0;
        // Late still counts as attended for the percentage.
        const attended = present + late;
        return {
            subjectCode: row.subjectCode,
            subject: row.subject,
            total,
            present,
            absent: Number(row.absent) || 0,
            late,
            attended,
            percentage: total ? Math.round((attended / total) * 1000) / 10 : 0
        };
    });

    const total = subjects.reduce((sum, s) => sum + s.total, 0);
    const attended = subjects.reduce((sum, s) => sum + s.attended, 0);

    return {
        enrolment: enrolmentOf(user),
        subjects,
        overall: {
            total,
            attended,
            percentage: total ? Math.round((attended / total) * 1000) / 10 : 0,
            // Most universities, GGSIPU included, gate exams at 75%.
            shortfall: total ? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25)) : 0
        }
    };
}

/**
 * Class-wide roster with each student's percentage. This is the teacher view,
 * segregated by branch / section / semester.
 */
async function getClassAttendance({ branch, section, semester = 1, subjectCode = null }) {
    if (!findSectionDef(branch, section)) {
        throw httpError(404, `No such class: ${branch}-${section}`);
    }

    const normalizedSection = String(section).toUpperCase();
    const students = await User.findAll({
        where: { branch, section: normalizedSection, semester },
        attributes: ["id", "name", "username", "enrolmentNumber", "batch"],
        order: [["enrolmentNumber", "ASC"]]
    });

    if (students.length === 0) {
        return { branch, section: normalizedSection, semester, subjectCode, students: [], summary: null };
    }

    const where = { userId: students.map(s => s.id) };
    if (subjectCode) where.subjectCode = subjectCode;

    const rows = await AttendanceRecord.findAll({
        attributes: [
            "userId",
            [fn("COUNT", col("id")), "total"],
            [fn("SUM", literal("CASE WHEN status <> 'ABSENT' THEN 1 ELSE 0 END")), "attended"]
        ],
        where,
        group: ["userId"],
        raw: true
    });

    const statsByUser = new Map(rows.map(r => [Number(r.userId), r]));

    const roster = students.map(student => {
        const stat = statsByUser.get(student.id);
        const total = stat ? Number(stat.total) : 0;
        const attended = stat ? Number(stat.attended) : 0;
        const percentage = total ? Math.round((attended / total) * 1000) / 10 : 0;
        return {
            id: student.id,
            name: student.name,
            username: student.username,
            enrolmentNumber: student.enrolmentNumber,
            batch: student.batch,
            total,
            attended,
            percentage,
            atRisk: total > 0 && percentage < 75
        };
    });

    const classTotal = roster.reduce((sum, s) => sum + s.total, 0);
    const classAttended = roster.reduce((sum, s) => sum + s.attended, 0);

    return {
        branch,
        branchName: curriculum.BRANCH_NAMES[branch],
        section: normalizedSection,
        semester,
        subjectCode,
        students: roster,
        summary: {
            strength: roster.length,
            percentage: classTotal ? Math.round((classAttended / classTotal) * 1000) / 10 : 0,
            atRisk: roster.filter(s => s.atRisk).length
        }
    };
}

module.exports = {
    listClasses,
    classMeta,
    findSectionDef,
    enrolStudent,
    enrolmentOf,
    getTimetable,
    getSubjects,
    getStudentAttendanceSummary,
    getClassAttendance,
    VALID_BRANCHES,
    VALID_BATCHES
};
