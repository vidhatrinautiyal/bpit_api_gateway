const {
    createRemoteJWKSet,
    jwtVerify,
    SignJWT
} = require("jose")

// ==============================
// ENV CONFIG
// ==============================
const TENANT_ID = process.env.TENANT_ID
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

// ==============================
// Microsoft JWKS (auto cached)
// ==============================
const JWKS = createRemoteJWKSet(
    new URL(
        `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`
    )
)

// ==============================
// Verify Microsoft Token
// ==============================
async function verifyMicrosoftToken(token) {
    const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
        audience: MICROSOFT_CLIENT_ID
    })

    return payload
}

// ==============================
// Create Your Own JWT
// ==============================
async function createAppToken(user, roles, permissions) {
    return await new SignJWT({
        sub: user.id,
        roles,
        permissions
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30m")
        .sign(JWT_SECRET)
}

// ==============================
// Auth Middleware
// ==============================
async function auth(req, res, next) {
    try {
        const header = req.headers.authorization
        if (!header) return res.status(401).json({ error: "No token" })

        const token = header.split(" ")[1]

        const { payload } = await jwtVerify(token, JWT_SECRET)

        req.user = payload
        next()
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" })
    }
}

// ==============================
// Permission Middleware
// ==============================
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user?.permissions?.includes(permission)) {
            return res.status(403).json({ error: "Forbidden" })
        }
        next()
    }
}

// ==============================
// EXPORTS
// ==============================
module.exports = {
    verifyMicrosoftToken,
    createAppToken,
    auth,
    requirePermission
}