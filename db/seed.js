const config = require("../config");
const { User, Role, Permission, AttendanceRecord, Subject, TimetableSlot } = require("./models");
const { backfillLegacyRoles } = require("./migrate");
const curriculum = require("../data/curriculum");
const roster = require("../data/students");

// The whole authorization matrix in one place. Adding a role or a
// permission is a data change here, never a schema change.
const PERMISSIONS = {
    view_users: "View the list of users",
    edit_users: "Edit user details and assign roles",
    delete_users: "Deactivate or delete users",
    view_profile: "View own profile",
    view_timetable: "View a class timetable",
    view_attendance: "View own attendance records",
    view_all_attendance: "View attendance across every class",
    manage_attendance: "Create and manage attendance records"
};

const ROLES = {
    ADMIN: {
        description: "Administrator with full access",
        permissions: Object.keys(PERMISSIONS)
    },
    TEACHER: {
        description: "Teacher with attendance management access",
        permissions: ["view_users", "view_profile", "view_timetable", "view_attendance", "view_all_attendance", "manage_attendance"]
    },
    STUDENT: {
        description: "Student with access to their own records",
        permissions: ["view_profile", "view_timetable", "view_attendance"]
    }
};

const TEACHER_PASSWORD = "Teach@2026";

async function seedRolesAndPermissions() {
    const permissionsByName = {};
    for (const [name, description] of Object.entries(PERMISSIONS)) {
        const [permission] = await Permission.findOrCreate({ where: { name }, defaults: { description } });
        permissionsByName[name] = permission;
    }

    const rolesByName = {};
    for (const [name, definition] of Object.entries(ROLES)) {
        const [role] = await Role.findOrCreate({
            where: { name },
            defaults: { description: definition.description }
        });
        // setPermissions is a full replace, so the matrix above always wins.
        await role.setPermissions(definition.permissions.map(p => permissionsByName[p]));
        rolesByName[name] = role;
    }

    return { rolesByName, permissionsByName };
}

// ==============================
// Academic data
// ==============================
async function seedSubjectsAndTimetable() {
    let subjectCount = 0;

    for (const sectionDef of curriculum.SECTIONS) {
        // Subjects are per branch, so only build them once per branch.
        for (const code of curriculum.subjectCodesFor(sectionDef)) {
            const [subject, created] = await Subject.findOrCreate({
                where: { code, branch: sectionDef.branch, semester: 1 },
                defaults: {
                    name: curriculum.SUBJECTS[code] || code,
                    theoryFaculty: sectionDef.faculty[code]?.theory || null,
                    labFaculty: sectionDef.faculty[code]?.lab || null,
                    countsForAttendance: !curriculum.NON_ACADEMIC.includes(code)
                }
            });
            if (created) subjectCount += 1;
            else {
                await subject.update({
                    name: curriculum.SUBJECTS[code] || code,
                    countsForAttendance: !curriculum.NON_ACADEMIC.includes(code)
                });
            }
        }

        // The timetable is fully derived from the data file, so replace it
        // wholesale rather than trying to diff individual periods.
        const where = { branch: sectionDef.branch, section: sectionDef.section, semester: 1 };
        await TimetableSlot.destroy({ where });

        const slots = curriculum.expandTimetable(sectionDef).map(slot => ({
            ...where,
            day: slot.day,
            period: slot.period,
            subjectCode: slot.subjectCode,
            type: slot.type,
            batch: slot.batch,
            room: slot.room,
            faculty: slot.type === "LAB"
                ? sectionDef.faculty[slot.subjectCode]?.lab || sectionDef.faculty[slot.subjectCode]?.theory || null
                : sectionDef.faculty[slot.subjectCode]?.theory || null
        }));

        await TimetableSlot.bulkCreate(slots);
    }

    console.log(`Seeded ${subjectCount} new subject(s) and rebuilt ${curriculum.SECTIONS.length} timetables`);
}

// ==============================
// People
// ==============================
async function seedStudents(studentRole) {
    const { hashPassword } = require("../services/user/service");
    let created = 0;

    // Roll numbers continue across the sections of a branch.
    const rollOffsets = {};

    for (const sectionDef of curriculum.SECTIONS) {
        const branchCode = curriculum.BRANCH_CODES[sectionDef.branch];
        const rollOffset = rollOffsets[sectionDef.branch] || 0;
        const students = roster.studentsFor(sectionDef.branch, sectionDef.section, branchCode, { rollOffset });
        rollOffsets[sectionDef.branch] = rollOffset + students.length;

        for (const student of students) {
            const existing = await User.findOne({ where: { username: student.username } });
            if (existing) {
                await existing.update({
                    name: student.name,
                    enrolmentNumber: student.enrolmentNumber,
                    branch: student.branch,
                    section: student.section,
                    semester: student.semester,
                    year: student.year,
                    batch: student.batch
                });
                continue;
            }

            const user = await User.create({
                username: student.username,
                email: student.email,
                name: student.name,
                passwordHash: hashPassword(student.password),
                authProvider: "local",
                isActive: true,
                enrolmentNumber: student.enrolmentNumber,
                branch: student.branch,
                section: student.section,
                semester: student.semester,
                year: student.year,
                batch: student.batch,
                lastLoggedIn: null
            });
            await user.addRole(studentRole);
            created += 1;
        }
    }

    if (created) console.log(`Seeded ${created} student account(s)`);
}

/** Every distinct faculty name in the timetable gets a teacher login. */
function collectFacultyNames() {
    const names = new Set();
    for (const sectionDef of curriculum.SECTIONS) {
        for (const entry of Object.values(sectionDef.faculty)) {
            for (const value of [entry.theory, entry.lab]) {
                if (!value || value === "Lectures Assigned") continue;
                // "Dr. A (G1) / Dr. B (G2)" describes two people.
                value.split("/").forEach(part => {
                    const clean = part.replace(/\(.*?\)/g, "").trim();
                    if (clean) names.add(clean);
                });
            }
        }
    }
    return [...names].sort();
}

function teacherUsername(name) {
    return name
        .replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s*/i, "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .trim()
        .split(/\s+/)
        .join(".");
}

async function seedTeachers(teacherRole) {
    const { hashPassword } = require("../services/user/service");
    let created = 0;

    for (const name of collectFacultyNames()) {
        const username = teacherUsername(name);
        if (!username) continue;

        const existing = await User.findOne({ where: { username } });
        if (existing) continue;

        const user = await User.create({
            username,
            email: `${username}@bpitindia.edu.in`,
            name,
            passwordHash: hashPassword(TEACHER_PASSWORD),
            authProvider: "local",
            isActive: true
        });
        await user.addRole(teacherRole);
        created += 1;
    }

    if (created) console.log(`Seeded ${created} teacher account(s)`);
}

// ==============================
// Attendance history
// ==============================
/**
 * Builds a term-to-date attendance history from the real timetable: a record
 * exists only where that student's section actually had that subject.
 * Deterministic per student so repeated seeds stay stable.
 */
async function seedAttendanceHistory({ weeks = 4, endDate = new Date() } = {}) {
    const existing = await AttendanceRecord.count();
    if (existing > 0) {
        console.log(`Attendance history already present (${existing} records), skipping`);
        return;
    }

    const dayIndex = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5 };
    const rows = [];

    for (const sectionDef of curriculum.SECTIONS) {
        const students = await User.findAll({
            where: { branch: sectionDef.branch, section: sectionDef.section, semester: 1 }
        });
        if (students.length === 0) continue;

        const slots = await TimetableSlot.findAll({
            where: { branch: sectionDef.branch, section: sectionDef.section, semester: 1 }
        });

        // One teaching event per (day, subject) per week; a two-period lab is
        // a single class, not two.
        const events = [];
        const seen = new Set();
        for (const slot of slots) {
            if (curriculum.NON_ACADEMIC.includes(slot.subjectCode)) continue;
            const key = `${slot.day}|${slot.subjectCode}|${slot.batch || "ALL"}`;
            if (seen.has(key)) continue;
            seen.add(key);
            events.push(slot);
        }

        for (let week = weeks; week >= 1; week -= 1) {
            for (const event of events) {
                const date = new Date(endDate);
                const offsetToMonday = (date.getDay() + 6) % 7;
                date.setDate(date.getDate() - offsetToMonday - (week * 7) + (dayIndex[event.day] - 1));
                const isoDate = date.toISOString().slice(0, 10);

                for (const student of students) {
                    if (event.batch && student.batch !== event.batch) continue;

                    // Deterministic pseudo-random attendance, ~85% present.
                    const seed = (student.id * 31 + event.id * 17 + week * 7) % 100;
                    const status = seed < 82 ? "PRESENT" : seed < 93 ? "ABSENT" : "LATE";

                    rows.push({
                        userId: student.id,
                        subject: curriculum.SUBJECTS[event.subjectCode] || event.subjectCode,
                        subjectCode: event.subjectCode,
                        branch: sectionDef.branch,
                        section: sectionDef.section,
                        semester: 1,
                        date: isoDate,
                        status,
                        markedBy: null,
                        notes: null
                    });
                }
            }
        }
    }

    for (let i = 0; i < rows.length; i += 1000) {
        await AttendanceRecord.bulkCreate(rows.slice(i, i + 1000));
    }
    console.log(`Seeded ${rows.length} attendance record(s) across ${curriculum.SECTIONS.length} sections`);
}

// ==============================
// Entry point
// ==============================
async function seedDatabase() {
    const { rolesByName } = await seedRolesAndPermissions();

    await backfillLegacyRoles(Role, User);

    // Any user still without a role gets the least-privileged one.
    const roleless = await User.findAll({ include: [{ model: Role, through: { attributes: [] } }] });
    for (const user of roleless) {
        if (user.roles && user.roles.length > 0) continue;
        await user.addRole(rolesByName.STUDENT);
    }

    await seedSubjectsAndTimetable();

    if (config.seedDemoData) {
        await seedStudents(rolesByName.STUDENT);
        await seedTeachers(rolesByName.TEACHER);
        await seedAttendanceHistory();
    }

    console.log("Database seeded successfully.");
}

module.exports = {
    seedDatabase,
    seedRolesAndPermissions,
    seedSubjectsAndTimetable,
    collectFacultyNames,
    teacherUsername,
    TEACHER_PASSWORD,
    PERMISSIONS,
    ROLES
};
