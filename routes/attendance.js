const express = require("express");
const { auth, requirePermission } = require("../middlewares/auth");
const attendanceService = require("../services/attendance/service");

const router = express.Router();

function fail(res, error, fallback, defaultStatus = 500) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error(`${fallback}:`, error.message);
    return res.status(defaultStatus).json({ error: fallback });
}

router.get("/", auth, requirePermission("view_attendance"), async (req, res) => {
    try {
        const records = await attendanceService.listAttendance(req.user, req.query);
        res.json({ records });
    } catch (error) {
        fail(res, error, "Unable to load attendance");
    }
});

router.post("/", auth, requirePermission("manage_attendance"), async (req, res) => {
    try {
        const record = await attendanceService.markAttendance(req.user, req.body);
        res.status(201).json({ message: "Attendance marked successfully", record });
    } catch (error) {
        fail(res, error, "Unable to mark attendance", 400);
    }
});

// Mark a whole class for one subject and date in one request.
router.post("/bulk", auth, requirePermission("manage_attendance"), async (req, res) => {
    try {
        const result = await attendanceService.markClassAttendance(req.user, req.body);
        res.status(201).json({ message: `Marked ${result.marked} student(s)`, ...result });
    } catch (error) {
        fail(res, error, "Unable to mark class attendance", 400);
    }
});

module.exports = router;
