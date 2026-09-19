require("dotenv").config();

const { sequelize, connectDB } = require("../db/connect");

connectDB()
    .then(() => console.log("Seed complete."))
    .catch(error => {
        console.error("Seed failed:", error.message);
        if (error.errors) {
            error.errors.forEach(e => console.error(`  - ${e.path}: ${e.message} (value: ${e.value})`));
        }
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
