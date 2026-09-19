const crypto = require("crypto");
const { User, Role, Permission } = require("../../db/models");

const MIN_PASSWORD_LENGTH = 8;
const SCRYPT_KEYLEN = 64;

// ==============================
// Password hashing
// ==============================
function validatePassword(password) {
    if (!password || typeof password !== "string") {
        return "Password is required";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain at least one letter and one number";
    }
    return null;
}

function hashPassword(password) {
    if (!password) return null;
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!password || !storedHash) return false;
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;

    const [salt, hash] = parts;
    const expected = Buffer.from(hash, "hex");
    if (expected.length !== SCRYPT_KEYLEN) return false;

    const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    return crypto.timingSafeEqual(expected, actual);
}

// ==============================
// Lookups
// ==============================
function normalizeEmail(email) {
    return email ? String(email).trim().toLowerCase() : null;
}

async function findUserById(id) {
    const user = await User.findByPk(id);
    return user ? user.toJSON() : null;
}

async function findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const user = await User.findOne({ where: { email: normalized } });
    return user ? user.toJSON() : null;
}

async function findUserByUsername(username) {
    if (!username) return null;
    const user = await User.findOne({ where: { username: String(username).trim() } });
    return user ? user.toJSON() : null;
}

async function findUserByOid(oid) {
    if (!oid) return null;
    const user = await User.findOne({ where: { oid } });
    return user ? user.toJSON() : null;
}

// ==============================
// Creation
// ==============================
async function createUser(userData) {
    const username = String(userData.username || userData.email || userData.oid || "").trim();
    if (!username) {
        throw new Error("Username, email, or oid is required to create a user");
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
        return existingUser.toJSON();
    }

    const userInstance = await User.create({
        username,
        email: normalizeEmail(userData.email),
        passwordHash: userData.password ? hashPassword(userData.password) : null,
        name: userData.name || null,
        oid: userData.oid || null,
        authProvider: userData.oid ? "microsoft" : "local",
        isActive: true,
        lastLoggedIn: new Date()
    });

    const requestedRole = (userData.role || "STUDENT").toUpperCase();
    const role = await Role.findOne({ where: { name: requestedRole } })
        || await Role.findOne({ where: { name: "STUDENT" } });
    if (role) {
        await userInstance.addRole(role);
    }

    return userInstance.toJSON();
}

// ==============================
// Role management
// ==============================
/**
 * Replaces the user's roles rather than appending. Adding STUDENT to an
 * administrator must actually demote them, not leave ADMIN in place.
 */
async function assignRoleToUser(userId, roleName) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    const role = await Role.findOne({ where: { name: String(roleName).toUpperCase() } });
    if (!role) throw new Error("Role not found");

    await user.setRoles([role]);
    return user.toJSON();
}

async function getUserRoles(userId) {
    const user = await User.findByPk(userId, {
        include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user) return [];
    return user.roles ? user.roles.map(r => r.name) : [];
}

async function getPermissionsFromRoles(roles) {
    if (!roles || roles.length === 0) return [];

    const roleEntities = await Role.findAll({
        where: { name: roles },
        include: [{ model: Permission, through: { attributes: [] } }]
    });

    const permissions = new Set();
    roleEntities.forEach(role => {
        (role.permissions || []).forEach(p => permissions.add(p.name));
    });

    return Array.from(permissions);
}

async function listRoles() {
    const roles = await Role.findAll({
        include: [{ model: Permission, through: { attributes: [] } }],
        order: [["name", "ASC"]]
    });
    return roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: (role.permissions || []).map(p => p.name)
    }));
}

// ==============================
// Administration
// ==============================
async function listUsers({ page = 1, pageSize = 25 } = {}) {
    const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { rows, count } = await User.findAndCountAll({
        attributes: ["id", "username", "email", "name", "authProvider", "isActive", "lastLoggedIn", "createdAt"],
        include: [{ model: Role, through: { attributes: [] }, attributes: ["name"] }],
        order: [["id", "ASC"]],
        limit,
        offset,
        distinct: true
    });

    return {
        users: rows.map(user => {
            const plain = user.toJSON();
            return { ...plain, roles: (plain.roles || []).map(r => r.name) };
        }),
        total: count,
        page: Math.max(Number(page) || 1, 1),
        pageSize: limit
    };
}

async function setUserActive(userId, isActive) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");
    await user.update({ isActive: Boolean(isActive) });
    return user.toJSON();
}

async function deleteUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");
    await user.destroy();
    return true;
}

async function touchLastLogin(userId) {
    await User.update({ lastLoggedIn: new Date() }, { where: { id: userId } });
}

module.exports = {
    MIN_PASSWORD_LENGTH,
    validatePassword,
    hashPassword,
    verifyPassword,
    findUserById,
    findUserByEmail,
    findUserByUsername,
    findUserByOid,
    createUser,
    assignRoleToUser,
    getUserRoles,
    getPermissionsFromRoles,
    listRoles,
    listUsers,
    setUserActive,
    deleteUser,
    touchLastLogin
};
