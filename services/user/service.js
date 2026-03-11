const { User } = require("../../db/users");

async function findUserByOid(oid) {
    const user = await User.findOne({
        where: { username: oid }
    });

    return user ? user.toJSON() : null;
}

async function createUser(userData) {

    const existingUser = await User.findOne({
        where: { username: userData.username }
    });

    if (existingUser) {
        return existingUser.toJSON();
    }

    const user = await User.create({
        username: userData.username,
        role: userData.role || "STUDENT",
        lastLoggedIn: new Date()
    });

    return user.toJSON();
}

async function getUserRoles(userId) {
    const user = await User.findOne({
        where: { username: userId }
    });
    if (!user) return [];

    return [user.role.toLowerCase()];
}

async function getPermissionsFromRoles(roles) {

    const rolePermissions = {
        admin: [
            "view_users",
            "edit_users",
            "delete_users",
            "view_profile"
        ],
        student: [
            "view_profile",
        ]
    };

    const permissions = new Set();

    roles.forEach(role => {
        const perms = rolePermissions[role] || [];
        perms.forEach(p => permissions.add(p));
    });

    return Array.from(permissions);
}

module.exports = {
    findUserByOid,
    createUser,
    getUserRoles,
    getPermissionsFromRoles
};