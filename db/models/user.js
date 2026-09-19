const { DataTypes } = require("sequelize");

/**
 * Identity only. Authorization lives entirely in the roles/permissions
 * join tables so that adding a role or permission never requires a
 * schema change.
 */
module.exports = (sequelize) => sequelize.define("users", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        validate: { isEmail: true }
    },
    passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    oid: {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true
    },
    authProvider: {
        type: DataTypes.ENUM("local", "microsoft"),
        allowNull: false,
        defaultValue: "local"
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    lastLoggedIn: {
        type: DataTypes.DATE,
        allowNull: true
    },

    // ---- Academic enrolment (students) ----
    // Null until the student completes enrolment after their first sign-in.
    enrolmentNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true
    },
    branch: {
        type: DataTypes.STRING(16),
        allowNull: true
    },
    section: {
        type: DataTypes.STRING(4),
        allowNull: true
    },
    semester: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Lab batch within the section (G1 / G2).
    batch: {
        type: DataTypes.STRING(4),
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ["isActive"] },
        { fields: ["authProvider"] },
        { fields: ["branch", "section", "semester"] }
    ]
});
