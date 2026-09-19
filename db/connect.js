const { Sequelize } = require("sequelize");
const config = require("../config");

const sequelize = new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password,
    {
        host: config.db.host,
        port: config.db.port,
        dialect: "mysql",
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            charset: "utf8mb4",
            collate: "utf8mb4_unicode_ci"
        }
    }
);

/**
 * Boots the data layer in the only order that is safe:
 * register models -> create missing tables -> add missing columns -> seed.
 * Throws on failure so the caller can decide whether to keep serving.
 */
async function connectDB({ sync = true, seed = true } = {}) {
    // Required before sync() so Sequelize knows which tables to create.
    require("./models");

    await sequelize.authenticate();
    console.log(`Database connected (${config.db.user}@${config.db.host}:${config.db.port}/${config.db.name})`);

    if (sync) {
        // Columns first: sync() builds the new indexes, and those fail if the
        // columns they cover are missing from an already-existing table.
        const { ensureSchema, ensureCascadeDeletes } = require("./migrate");
        await ensureSchema();
        await sequelize.sync();
        await ensureCascadeDeletes();
        console.log("Tables synced");
    }

    if (seed) {
        const { seedDatabase } = require("./seed");
        await seedDatabase();
    }
}

module.exports = { sequelize, connectDB };
