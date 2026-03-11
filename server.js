const express = require("express")
const path = require("path")
const cors = require("cors")
require("dotenv").config()

const attendanceServiceRouter = require("./routes/attendance_service_routes")
const authRouter = require("./routes/auth")
const { auth } = require("./middlewares/auth")
const { User } = require("./db/users");
const { connectDB } = require("./db/connect")
const app = express()
const PORT = 3000

// Auth Routes
app.use("/auth", authRouter)

// Middlewares
app.use(cors())
app.use(express.json())
app.use(auth)
// app.use(express.static("build))
//sync database
// Service Routes
connectDB();
app.use("/attendance_service", attendanceServiceRouter)

// React root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "build", "index.html"))
})

app.listen(PORT, () => {
    console.log("App listening on port:", PORT)
})