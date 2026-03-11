const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
    "mysql://root:root@127.0.0.1:3306/userDb"
);

async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log("Database connected");

        await sequelize.sync();
        console.log("Tables synced");

    } catch (err) {
        console.error("DB Error:", err);
    }
}

module.exports = { sequelize, connectDB };