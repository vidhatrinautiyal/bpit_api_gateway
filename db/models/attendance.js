const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("attendance_records", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    // Display name, kept for readability in exports and older rows.
    subject: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    // Timetable code (PPS, BEE, ...). The join key to subjects.
    subjectCode: {
        type: DataTypes.STRING(12),
        allowNull: true
    },
    // Class context copied in at marking time. Denormalized on purpose: a
    // record must keep saying which class it was taken in even if the student
    // later moves section or advances a semester.
    branch: { type: DataTypes.STRING(16), allowNull: true },
    section: { type: DataTypes.STRING(4), allowNull: true },
    semester: { type: DataTypes.INTEGER, allowNull: true },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM("PRESENT", "ABSENT", "LATE"),
        allowNull: false
    },
    markedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    notes: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ["userId", "date"] },
        { fields: ["subject"] },
        { fields: ["branch", "section", "semester", "date"] },
        { fields: ["subjectCode"] }
    ]
});
