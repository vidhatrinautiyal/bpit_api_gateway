const { DataTypes } = require("sequelize");

/**
 * One row per (section, day, period, batch). A two-period lab is stored as two
 * rows so that "what is on right now" is a single equality lookup.
 */
module.exports = (sequelize) => sequelize.define("timetable_slots", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    branch: { type: DataTypes.STRING(16), allowNull: false },
    section: { type: DataTypes.STRING(4), allowNull: false },
    semester: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    day: {
        type: DataTypes.ENUM("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"),
        allowNull: false
    },
    period: { type: DataTypes.INTEGER, allowNull: false },
    subjectCode: { type: DataTypes.STRING(12), allowNull: false },
    type: {
        type: DataTypes.ENUM("THEORY", "LAB", "LIBRARY", "ENRICHMENT"),
        allowNull: false,
        defaultValue: "THEORY"
    },
    // Null means the whole section; G1/G2 means only that lab batch.
    batch: { type: DataTypes.STRING(4), allowNull: true },
    room: { type: DataTypes.STRING(16), allowNull: true },
    faculty: { type: DataTypes.STRING(160), allowNull: true }
}, {
    timestamps: true,
    indexes: [
        { fields: ["branch", "section", "semester"] },
        { fields: ["day", "period"] }
    ]
});
