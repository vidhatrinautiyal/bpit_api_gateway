const express = require("express")
const path = require("path")
const cors = require("cors")

const config = require("./config")
const { connectDB, sequelize } = require("./db/connect")
const { auth } = require("./middlewares/auth")

const authRouter = require("./routes/auth")
const localAttendanceRouter = require("./routes/attendance")
const academicRouter = require("./routes/academic")
const attendanceServiceRouter = require("./routes/attendance_service_routes")

const app = express()
const publicDirectory = path.join(__dirname, "public")

// ==============================
// Middlewares
// ==============================
app.use(cors())
app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(publicDirectory))

// ==============================
// Public routes
// ==============================
app.get("/health", async (req, res) => {
    try {
        await sequelize.authenticate()
        res.json({ status: "ok", database: "connected", uptime: process.uptime() })
    } catch {
        res.status(503).json({ status: "degraded", database: "disconnected" })
    }
})

// Serves the dashboard shell. Must be registered before the gateway-wide auth
// guard below, or the browser could never load the page it signs in from.
app.get("/", (req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"))
})

// ==============================
// Application routes
// ==============================
// Each route applies `auth` itself, so the public endpoints above stay reachable.
app.use("/auth", authRouter)
app.use("/api/attendance", localAttendanceRouter)
app.use("/api/academic", academicRouter)

// Everything proxied downstream requires a valid gateway token.
app.use("/attendance_service", auth, attendanceServiceRouter)

// ==============================
// Fallbacks
// ==============================
app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
})

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ error: "Malformed JSON body" })
    }
    console.error("Unhandled error:", err)
    res.status(err.status || 500).json({ error: "Internal server error" })
})

// ==============================
// Startup
// ==============================
async function start() {
    try {
        await connectDB()
    } catch (err) {
        // Without the database there is no authentication and no authorization,
        // so failing loudly beats serving a gateway that rejects every request.
        console.error("Startup failed - could not initialise the database:", err.message)
        process.exit(1)
    }

    const server = app.listen(config.port, () => {
        console.log(`App listening on port: ${config.port}`)
        console.log(`Dashboard: http://localhost:${config.port}`)
    })

    const shutdown = async (signal) => {
        console.log(`\n${signal} received, shutting down.`)
        server.close(async () => {
            await sequelize.close()
            process.exit(0)
        })
    }

    process.on("SIGINT", () => shutdown("SIGINT"))
    process.on("SIGTERM", () => shutdown("SIGTERM"))
}

if (require.main === module) {
    start()
}

module.exports = { app, start }
