const express = require("express");
const { auth, requirePermission } = require("../middlewares/auth");
const academic = require("../services/academic/service");
const { User } = require("../db/models");

const router = express.Router();

function fail(res, error, fallback) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error(`${fallback}:`, error.message);
    return res.status(500).json({ error: fallback });
}

// ---- Catalogue: what classes exist (needed to render the enrolment form) ----
router.get("/meta", auth, (req, res) => {
    res.json(academic.classMeta());
});

router.get("/classes", auth, requirePermission("view_timetable"), (req, res) => {
    res.json({ classes: academic.listClasses() });
});

// ---- Enrolment: a student declares their year / semester / branch / section ----
router.post("/enrol", auth, async (req, res) => {
    try {
        const user = await academic.enrolStudent(req.user.id, req.body);
        res.json({
            message: "Enrolment saved",
            enrolment: academic.enrolmentOf(user)
        });
    } catch (error) {
        fail(res, error, "Unable to save enrolment");
    }
});

// ---- Timetable ----
// A student gets their own class; anyone who can view all attendance may ask
// for a specific one.
router.get("/timetable", auth, requirePermission("view_timetable"), async (req, res) => {
    try {
        const canPickClass = req.user.permissions?.includes("view_all_attendance");
        let { branch, section, semester, batch } = req.query;

        if (!branch || !section || !canPickClass) {
            const user = await User.findByPk(req.user.id);
            if (!user?.branch || !user?.section) {
                return res.status(409).json({
                    error: "Not enrolled yet",
                    code: "NOT_ENROLLED"
                });
            }
            branch = user.branch;
            section = user.section;
            semester = user.semester;
            batch = user.batch;
        }

        const timetable = await academic.getTimetable({
            branch,
            section,
            semester: Number(semester) || 1,
            batch: batch || null
        });
        res.json(timetable);
    } catch (error) {
        fail(res, error, "Unable to load timetable");
    }
});

router.get("/subjects", auth, requirePermission("view_timetable"), async (req, res) => {
    try {
        let branch = req.query.branch;
        if (!branch) {
            const user = await User.findByPk(req.user.id);
            branch = user?.branch;
        }
        if (!branch) return res.status(400).json({ error: "branch is required" });

        res.json({ branch, subjects: await academic.getSubjects(branch, Number(req.query.semester) || 1) });
    } catch (error) {
        fail(res, error, "Unable to load subjects");
    }
});

// ---- Attendance analytics ----
// Own summary by default; teachers may request any student's.
router.get("/attendance/summary", auth, requirePermission("view_attendance"), async (req, res) => {
    try {
        const requested = Number(req.query.userId);
        const canViewOthers = req.user.permissions?.includes("view_all_attendance");

        if (requested && requested !== req.user.id && !canViewOthers) {
            return res.status(403).json({ error: "Forbidden: you can only view your own attendance" });
        }

        res.json(await academic.getStudentAttendanceSummary(requested || req.user.id));
    } catch (error) {
        fail(res, error, "Unable to load attendance summary");
    }
});

// The teacher view: a whole class, segregated by branch / section / semester.
router.get("/attendance/class", auth, requirePermission("view_all_attendance"), async (req, res) => {
    try {
        const { branch, section } = req.query;
        if (!branch || !section) {
            return res.status(400).json({ error: "branch and section are required" });
        }

        res.json(await academic.getClassAttendance({
            branch,
            section,
            semester: Number(req.query.semester) || 1,
            subjectCode: req.query.subjectCode || null
        }));
    } catch (error) {
        fail(res, error, "Unable to load class attendance");
    }
});

module.exports = router;
