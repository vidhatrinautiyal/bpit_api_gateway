const { DataTypes } = require("sequelize");

/**
 * Subject master, keyed by the code printed on the timetable (PPS, BEE, ...).
 * Scoped by branch and semester because the same code can carry a different
 * scheme across programmes.
 */
module.exports = (sequelize) => sequelize.define("subjects", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(12),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(120),
        allowNull: false
    },
    branch: {
        type: DataTypes.STRING(16),
        allowNull: false
    },
    semester: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    theoryFaculty: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    labFaculty: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    // PDP / LIB / ENR occupy the grid but are not marked for attendance.
    countsForAttendance: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    timestamps: true,
    indexes: [
        { unique: true, fields: ["code", "branch", "semester"] }
    ]
});
