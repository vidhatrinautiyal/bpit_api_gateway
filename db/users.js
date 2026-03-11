const { DataTypes } = require("sequelize");
const { sequelize } = require("./connect");
const User = sequelize.define("users", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    role: {
        type: DataTypes.ENUM("ADMIN", "STUDENT"),
        defaultValue: "STUDENT"
    },

    lastLoggedIn: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }

}, {
    timestamps: true
});

module.exports = { User };