const {
    isMicrosoftAuthConfigured,
    verifyMicrosoftToken,
    createAppToken
} = require("../../middlewares/auth")
const userService = require("../user/service")
const academic = require("../academic/service")

/**
 * Both login paths converge here so a session is built identically no matter
 * how the user authenticated.
 */
async function buildSession(user) {
    const roles = await userService.getUserRoles(user.id)
    const permissions = await userService.getPermissionsFromRoles(roles)
    const token = await createAppToken(user, roles, permissions)

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            authProvider: user.authProvider,
            roles,
            permissions,
            enrolment: academic.enrolmentOf(user),
            needsEnrolment: roles.includes("STUDENT") && !academic.enrolmentOf(user)
        }
    }
}

// ==============================
// Microsoft SSO
// ==============================
async function microsoftLogin(req, res) {
    try {
        if (!isMicrosoftAuthConfigured()) {
            return res.status(503).json({
                error: "Microsoft login is not configured. Use /auth/register and /auth/login instead."
            })
        }

        const { idToken } = req.body || {}
        if (!idToken) {
            return res.status(400).json({ error: "Microsoft idToken is required" })
        }

        const payload = await verifyMicrosoftToken(idToken)
        const oid = payload.oid
        if (!oid) {
            return res.status(401).json({ error: "Microsoft token is missing an object id" })
        }

        const email = payload.preferred_username || payload.email

        let user = await userService.findUserByOid(oid)
        if (!user && email) {
            // Same person, previously registered locally: link the accounts
            // instead of failing on the unique email constraint.
            user = await userService.findUserByEmail(email)
        }
        if (!user) {
            user = await userService.createUser({ oid, email, name: payload.name })
        }

        if (user.isActive === false) {
            return res.status(403).json({ error: "Account is deactivated" })
        }

        await userService.touchLastLogin(user.id)
        return res.json(await buildSession(user))
    } catch (err) {
        console.error("Microsoft login failed:", err.message)
        return res.status(401).json({ error: "Authentication failed" })
    }
}

// ==============================
// Local registration
// ==============================
async function localRegister(req, res) {
    try {
        const { username, email, password, name } = req.body || {}
        if (!username || !email || !password) {
            return res.status(400).json({ error: "Username, email, and password are required" })
        }

        const passwordError = userService.validatePassword(password)
        if (passwordError) {
            return res.status(400).json({ error: passwordError })
        }

        if (await userService.findUserByUsername(username)) {
            return res.status(409).json({ error: "Username is already taken" })
        }
        if (await userService.findUserByEmail(email)) {
            return res.status(409).json({ error: "Email is already registered" })
        }

        // Self-registration always yields the least-privileged role; elevation
        // is a separate, permission-gated action.
        const user = await userService.createUser({ username, email, password, name, role: "STUDENT" })
        const session = await buildSession(user)

        return res.status(201).json({ message: "User registered successfully", ...session })
    } catch (err) {
        console.error("Registration failed:", err.message)
        return res.status(500).json({ error: "Registration failed" })
    }
}

// ==============================
// Local login
// ==============================
async function localLogin(req, res) {
    try {
        const { login, password } = req.body || {}
        if (!login || !password) {
            return res.status(400).json({ error: "Login (username/email) and password are required" })
        }

        const user = await userService.findUserByUsername(login)
            || await userService.findUserByEmail(login)

        // One message for every failure mode so the endpoint cannot be used to
        // enumerate which usernames exist.
        if (!user || !user.passwordHash || !userService.verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid username/email or password" })
        }

        if (!user.isActive) {
            return res.status(403).json({ error: "Account is deactivated" })
        }

        await userService.touchLastLogin(user.id)
        const session = await buildSession(user)

        return res.json({ message: "Login successful", ...session })
    } catch (err) {
        console.error("Login failed:", err.message)
        return res.status(500).json({ error: "Login failed" })
    }
}

// ==============================
// Session
// ==============================
async function getCurrentUser(req, res) {
    try {
        const user = await userService.findUserById(req.user.id)
        if (!user) return res.status(404).json({ error: "User not found" })

        const roles = await userService.getUserRoles(user.id)
        const permissions = await userService.getPermissionsFromRoles(roles)

        const enrolment = academic.enrolmentOf(user)

        return res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                authProvider: user.authProvider,
                isActive: user.isActive,
                roles,
                permissions,
                lastLoggedIn: user.lastLoggedIn,
                enrolment,
                // Students land on an enrolment form until this is false.
                needsEnrolment: roles.includes("STUDENT") && !enrolment
            }
        })
    } catch (err) {
        console.error("Unable to load current user:", err.message)
        return res.status(500).json({ error: "Unable to load current user" })
    }
}

// ==============================
// User administration
// ==============================
async function listUsers(req, res) {
    try {
        const result = await userService.listUsers({
            page: req.query.page,
            pageSize: req.query.pageSize
        })
        return res.json(result)
    } catch (err) {
        console.error("Unable to list users:", err.message)
        return res.status(500).json({ error: "Unable to list users" })
    }
}

async function listRoles(req, res) {
    try {
        return res.json({ roles: await userService.listRoles() })
    } catch (err) {
        console.error("Unable to list roles:", err.message)
        return res.status(500).json({ error: "Unable to list roles" })
    }
}

async function assignRole(req, res) {
    try {
        const { role } = req.body || {}
        if (!role) return res.status(400).json({ error: "Role is required" })

        const targetId = Number(req.params.userId)
        if (!Number.isInteger(targetId) || targetId < 1) {
            return res.status(400).json({ error: "A valid userId is required" })
        }
        // Without this an administrator can demote themselves and lock the
        // last admin out of role management entirely.
        if (targetId === req.user.id) {
            return res.status(400).json({ error: "You cannot change your own role" })
        }

        const user = await userService.assignRoleToUser(targetId, role)
        const roles = await userService.getUserRoles(user.id)
        const permissions = await userService.getPermissionsFromRoles(roles)

        return res.json({
            message: "Role assigned successfully",
            user: { id: user.id, username: user.username, email: user.email, name: user.name, roles, permissions }
        })
    } catch (err) {
        const status = ["User not found", "Role not found"].includes(err.message) ? 404 : 500
        if (status === 500) console.error("Unable to assign role:", err.message)
        return res.status(status).json({ error: err.message || "Unable to assign role" })
    }
}

async function setUserStatus(req, res) {
    try {
        const targetId = Number(req.params.userId)
        if (!Number.isInteger(targetId) || targetId < 1) {
            return res.status(400).json({ error: "A valid userId is required" })
        }
        if (targetId === req.user.id) {
            return res.status(400).json({ error: "You cannot deactivate your own account" })
        }
        if (typeof req.body?.isActive !== "boolean") {
            return res.status(400).json({ error: "isActive (boolean) is required" })
        }

        const user = await userService.setUserActive(targetId, req.body.isActive)
        return res.json({
            message: user.isActive ? "User activated" : "User deactivated",
            user: { id: user.id, username: user.username, isActive: user.isActive }
        })
    } catch (err) {
        const status = err.message === "User not found" ? 404 : 500
        if (status === 500) console.error("Unable to update user status:", err.message)
        return res.status(status).json({ error: err.message || "Unable to update user status" })
    }
}

async function deleteUser(req, res) {
    try {
        const targetId = Number(req.params.userId)
        if (!Number.isInteger(targetId) || targetId < 1) {
            return res.status(400).json({ error: "A valid userId is required" })
        }
        if (targetId === req.user.id) {
            return res.status(400).json({ error: "You cannot delete your own account" })
        }

        await userService.deleteUser(targetId)
        return res.json({ message: "User deleted successfully" })
    } catch (err) {
        const status = err.message === "User not found" ? 404 : 500
        if (status === 500) console.error("Unable to delete user:", err.message)
        return res.status(status).json({ error: err.message || "Unable to delete user" })
    }
}

module.exports = {
    microsoftLogin,
    localRegister,
    localLogin,
    getCurrentUser,
    listUsers,
    listRoles,
    assignRole,
    setUserStatus,
    deleteUser
}
