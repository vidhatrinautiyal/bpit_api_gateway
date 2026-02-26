async function findUserByOid(oid) {
    // DB lookup later
    return null
}

async function createUser(userData) {
    // DB insert later
    return { id: "123", ...userData }
}

async function getUserRoles(userId) {
    // Fetch roles from DB later
    return ["student"]
}

async function getPermissionsFromRoles(roles) {
    // Map roles → permissions
    return ["view_profile"]
}

module.exports = {
    findUserByOid,
    createUser,
    getUserRoles,
    getPermissionsFromRoles
}