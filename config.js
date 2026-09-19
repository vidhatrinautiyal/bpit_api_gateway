require("dotenv").config()

function required(name, fallback) {
    const value = process.env[name] || fallback
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`
        )
    }
    return value
}

const config = {
    port: Number(process.env.PORT) || 3000,

    db: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        name: process.env.DB_NAME || "userDb",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root"
    },

    jwt: {
        secret: required("JWT_SECRET"),
        expiresIn: process.env.JWT_EXPIRES_IN || "30m"
    },

    microsoft: {
        tenantId: process.env.TENANT_ID || "",
        clientId: process.env.MICROSOFT_CLIENT_ID || ""
    },

    attendanceService: {
        port: process.env.ATTENDANCE_SERVICE_PORT || "8000",
        host: process.env.ATTENDANCE_SERVICE_HOST || "http://localhost"
    },

    seedDemoData: process.env.SEED_DEMO_DATA !== "false"
}

if (config.jwt.secret.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long.")
}

module.exports = config
