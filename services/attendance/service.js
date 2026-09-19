const { AttendanceRecord, User, Subject } = require("../../db/models");
const curriculum = require("../../data/curriculum");

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function toPositiveInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Builds the record filter. Every branch resolves to an explicit scope: a
 * caller whose own id cannot be resolved is rejected rather than falling
 * through to an unfiltered query that would expose every student's records.
 */
function resolveScope(currentUser, query = {}) {
    const canViewAll = currentUser.permissions?.includes("view_all_attendance")
        || currentUser.permissions?.includes("manage_attendance");
    const ownId = toPositiveInt(currentUser.id ?? currentUser.sub);
    const requestedUserId = query.userId;

    if (requestedUserId !== undefined && requestedUserId !== null && requestedUserId !== "") {
        const targetId = toPositiveInt(requestedUserId);
        if (!targetId) throw httpError(400, "userId must be a positive integer");
        if (!canViewAll && targetId !== ownId) {
            throw httpError(403, "Forbidden: you can only view your own attendance");
        }
        return { userId: targetId };
    }

    if (!canViewAll) {
        if (!ownId) throw httpError(401, "Unable to resolve the current user");
        return { userId: ownId };
    }

    // Privileged callers may narrow by class instead of by student.
    const where = {};
    if (query.branch) where.branch = String(query.branch).toUpperCase();
    if (query.section) where.section = String(query.section).toUpperCase();
    if (query.semester) {
        const semester = toPositiveInt(query.semester);
        if (!semester) throw httpError(400, "semester must be a positive integer");
        where.semester = semester;
    }
    if (query.subjectCode) where.subjectCode = String(query.subjectCode).toUpperCase();
    if (query.date) {
        if (Number.isNaN(Date.parse(query.date))) throw httpError(400, "date must be YYYY-MM-DD");
        where.date = query.date;
    }
    return where;
}

async function listAttendance(currentUser, query = {}) {
    const where = resolveScope(currentUser, query);
    const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 1000);

    const records = await AttendanceRecord.findAll({
        where,
        include: [{ model: User, attributes: ["id", "username", "name", "enrolmentNumber"] }],
        order: [["date", "DESC"], ["subject", "ASC"]],
        limit
    });

    return records.map(record => record.toJSON());
}

/**
 * Marks one student for one subject. The student's class is copied onto the
 * record so it keeps reporting the right class even if they move section.
 */
async function markAttendance(currentUser, data = {}) {
    const studentId = toPositiveInt(data.studentId);
    if (!studentId) throw httpError(400, "A valid studentId is required");

    const rawCode = data.subjectCode || data.subject;
    if (!rawCode || !String(rawCode).trim()) {
        throw httpError(400, "subjectCode is required");
    }
    if (!data.date || Number.isNaN(Date.parse(data.date))) {
        throw httpError(400, "A valid date (YYYY-MM-DD) is required");
    }
    if (!["PRESENT", "ABSENT", "LATE"].includes(data.status)) {
        throw httpError(400, "status must be PRESENT, ABSENT, or LATE");
    }

    const student = await User.findByPk(studentId);
    if (!student) throw httpError(404, "Student not found");
    if (!student.branch || !student.section) {
        throw httpError(409, "That student has not completed enrolment yet");
    }

    const subjectCode = String(rawCode).trim().toUpperCase();
    const subject = await Subject.findOne({
        where: { code: subjectCode, branch: student.branch, semester: student.semester || 1 }
    });
    if (!subject) {
        throw httpError(400, `${subjectCode} is not a subject for ${student.branch} semester ${student.semester || 1}`);
    }
    if (!subject.countsForAttendance) {
        throw httpError(400, `${subjectCode} is not marked for attendance`);
    }

    // One record per student per subject per day.
    const existing = await AttendanceRecord.findOne({
        where: { userId: studentId, subjectCode, date: data.date }
    });
    if (existing) {
        await existing.update({
            status: data.status,
            markedBy: toPositiveInt(currentUser.id ?? currentUser.sub),
            notes: data.notes ? String(data.notes).trim() : null
        });
        return existing;
    }

    return AttendanceRecord.create({
        userId: studentId,
        subject: subject.name || curriculum.SUBJECTS[subjectCode] || subjectCode,
        subjectCode,
        branch: student.branch,
        section: student.section,
        semester: student.semester || 1,
        date: data.date,
        status: data.status,
        markedBy: toPositiveInt(currentUser.id ?? currentUser.sub),
        notes: data.notes ? String(data.notes).trim() : null
    });
}

/**
 * Marks a whole class for one subject and date in a single call - what a
 * teacher actually does at the start of a period.
 */
async function markClassAttendance(currentUser, data = {}) {
    const { branch, section, subjectCode, date, entries } = data;
    if (!branch || !section) throw httpError(400, "branch and section are required");
    if (!Array.isArray(entries) || entries.length === 0) {
        throw httpError(400, "entries must be a non-empty array of { studentId, status }");
    }

    const results = [];
    for (const entry of entries) {
        const record = await markAttendance(currentUser, {
            studentId: entry.studentId,
            subjectCode,
            date,
            status: entry.status,
            notes: entry.notes
        });
        results.push(record.toJSON ? record.toJSON() : record);
    }

    return { marked: results.length, records: results };
}

module.exports = { listAttendance, markAttendance, markClassAttendance };
