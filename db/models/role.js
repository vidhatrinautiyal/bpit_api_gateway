const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("roles", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, { timestamps: true });
