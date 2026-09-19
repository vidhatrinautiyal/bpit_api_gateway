const { createRemoteJWKSet, jwtVerify, SignJWT } = require("jose")
const config = require("../config")

const JWT_SECRET = new TextEncoder().encode(config.jwt.secret)
const TOKEN_ISSUER = "bpit-api-gateway"

let microsoftJWKS

// ==============================
// Microsoft SSO (optional)
// ==============================
function isMicrosoftAuthConfigured() {
    return Boolean(config.microsoft.tenantId && config.microsoft.clientId)
}

function getMicrosoftJWKS() {
    if (!microsoftJWKS) {
        microsoftJWKS = createRemoteJWKSet(
            new URL(`https://login.microsoftonline.com/${config.microsoft.tenantId}/discovery/v2.0/keys`)
        )
    }
    return microsoftJWKS
}

async function verifyMicrosoftToken(token) {
    if (!isMicrosoftAuthConfigured()) {
        throw new Error("Microsoft authentication is not configured")
    }

    const { payload } = await jwtVerify(token, getMicrosoftJWKS(), {
        issuer: `https://login.microsoftonline.com/${config.microsoft.tenantId}/v2.0`,
        audience: config.microsoft.clientId
    })

    return payload
}

// ==============================
// Gateway token
// ==============================
/**
 * Every login path — local password or Microsoft SSO — ends here, so the rest
 * of the gateway only ever deals with one token format.
 */
async function createAppToken(user, roles, permissions) {
    return await new SignJWT({
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        permissions
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(user.id))
        .setIssuer(TOKEN_ISSUER)
        .setIssuedAt()
        .setExpirationTime(config.jwt.expiresIn)
        .sign(JWT_SECRET)
}

function extractBearerToken(req) {
    const header = req.headers.authorization
    if (!header) return null
    const [scheme, token] = header.split(" ")
    if (scheme !== "Bearer" || !token) return null
    return token
}

// ==============================
// Authentication
// ==============================
async function auth(req, res, next) {
    const token = extractBearerToken(req)
    if (!token) {
        return res.status(401).json({ error: "Missing or malformed Authorization header" })
    }

    let payload
    try {
        ({ payload } = await jwtVerify(token, JWT_SECRET, { issuer: TOKEN_ISSUER }))
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" })
    }

    try {
        // A token stays valid until it expires, so check the account is still
        // enabled on every request — otherwise deactivating a user does nothing
        // until their token runs out.
        const { User } = require("../db/models")
        const user = await User.findByPk(payload.id || payload.sub, { attributes: ["id", "isActive"] })
        if (!user) return res.status(401).json({ error: "Account no longer exists" })
        if (!user.isActive) return res.status(403).json({ error: "Account is deactivated" })
    } catch (err) {
        console.error("Auth lookup failed:", err.message)
        return res.status(503).json({ error: "Authentication backend unavailable" })
    }

    req.user = { ...payload, id: Number(payload.id || payload.sub) }
    next()
}

// ==============================
// Authorization
// ==============================
function requirePermission(...permissions) {
    const required = permissions.flat()
    return (req, res, next) => {
        const held = req.user?.permissions || []
        const missing = required.filter(p => !held.includes(p))
        if (missing.length > 0) {
            return res.status(403).json({
                error: "Forbidden: missing permission",
                required: missing
            })
        }
        next()
    }
}

function requireRole(roles) {
    const required = (Array.isArray(roles) ? roles : [roles]).map(r => r.toUpperCase())
    return (req, res, next) => {
        const held = (req.user?.roles || []).map(r => r.toUpperCase())
        if (!held.some(r => required.includes(r))) {
            return res.status(403).json({
                error: "Forbidden: insufficient privileges",
                required
            })
        }
        next()
    }
}

module.exports = {
    isMicrosoftAuthConfigured,
    verifyMicrosoftToken,
    createAppToken,
    auth,
    requirePermission,
    requireRole,
    TOKEN_ISSUER
}
