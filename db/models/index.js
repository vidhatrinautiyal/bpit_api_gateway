const { sequelize } = require("../connect");

const User = require("./user")(sequelize);
const Role = require("./role")(sequelize);
const Permission = require("./permission")(sequelize);
const AttendanceRecord = require("./attendance")(sequelize);
const Subject = require("./subject")(sequelize);
const TimetableSlot = require("./timetable")(sequelize);

// Join tables carry the authorization model. Both are many-to-many so a
// user can hold several roles and a permission can belong to many roles.
const UserRoles = sequelize.define("user_roles", {}, { timestamps: false });
const RolePermissions = sequelize.define("role_permissions", {}, { timestamps: false });

User.belongsToMany(Role, { through: UserRoles, foreignKey: "userId", otherKey: "roleId" });
Role.belongsToMany(User, { through: UserRoles, foreignKey: "roleId", otherKey: "userId" });

Role.belongsToMany(Permission, { through: RolePermissions, foreignKey: "roleId", otherKey: "permissionId" });
Permission.belongsToMany(Role, { through: RolePermissions, foreignKey: "permissionId", otherKey: "roleId" });

User.hasMany(AttendanceRecord, { foreignKey: "userId", onDelete: "CASCADE" });
AttendanceRecord.belongsTo(User, { foreignKey: "userId" });

module.exports = {
    sequelize,
    User,
    Role,
    Permission,
    AttendanceRecord,
    Subject,
    TimetableSlot,
    UserRoles,
    RolePermissions
};
