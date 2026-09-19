const { sequelize } = require("./connect");

/**
 * sequelize.sync() creates missing tables but never alters existing ones,
 * and sync({ alter: true }) re-adds unique indexes on every boot until
 * MySQL hits its 64-key limit. So we reconcile columns and indexes by
 * hand, idempotently.
 */
async function ensureSchema() {
    const queryInterface = sequelize.getQueryInterface();
    const applied = [];

    for (const [tableName, model] of Object.entries(sequelize.models)) {
        let existing;
        try {
            existing = await queryInterface.describeTable(tableName);
        } catch {
            continue; // sync() will have created it with every column already
        }

        for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
            const columnName = attr.field || attrName;
            if (existing[columnName]) continue;

            await queryInterface.addColumn(tableName, columnName, {
                type: attr.type,
                allowNull: attr.allowNull !== false,
                defaultValue: attr.defaultValue
            });

            // addColumn drops the attribute's unique flag, so re-assert it.
            // MySQL permits repeated NULLs in a unique index, which is what we
            // want for optional identifiers like enrolmentNumber.
            if (attr.unique) {
                try {
                    await queryInterface.addIndex(tableName, [columnName], {
                        unique: true,
                        name: `${tableName}_${columnName}_unique`
                    });
                } catch (err) {
                    console.warn(`Could not add unique index on ${tableName}.${columnName}: ${err.message}`);
                }
            }

            applied.push(`${tableName}.${columnName}`);
        }
    }

    if (applied.length) {
        console.log("Schema migrated, added columns:", applied.join(", "));
    }
    return applied;
}

/**
 * Legacy rows stored authorization in users.role. The join table is now the
 * single source of truth, so fold any leftover values into it once.
 */
async function backfillLegacyRoles(Role, User) {
    const [columns] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (columns.length === 0) return 0;

    const [rows] = await sequelize.query(`
        SELECT u.id, u.role
        FROM users u
        LEFT JOIN user_roles ur ON ur.userId = u.id
        WHERE ur.userId IS NULL AND u.role IS NOT NULL
    `);
    if (rows.length === 0) return 0;

    const roles = await Role.findAll();
    const byName = new Map(roles.map(role => [role.name.toUpperCase(), role]));
    const fallback = byName.get("STUDENT");
    let migrated = 0;

    for (const row of rows) {
        const role = byName.get(String(row.role).toUpperCase()) || fallback;
        if (!role) continue;
        const user = await User.findByPk(row.id);
        if (!user) continue;
        await user.addRole(role);
        migrated += 1;
    }

    if (migrated) console.log(`Backfilled ${migrated} legacy user role(s) into user_roles`);
    return migrated;
}

/**
 * The original schema created attendance_records.userId with ON DELETE SET
 * NULL, so deleting a user left their records behind pointing at nothing.
 * sync() never alters an existing constraint, so switch it to CASCADE by hand
 * and clear out any rows already orphaned.
 */
async function ensureCascadeDeletes() {
    const [[constraint]] = await sequelize.query(`
        SELECT CONSTRAINT_NAME AS name, DELETE_RULE AS rule
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'attendance_records'
        LIMIT 1
    `);

    if (!constraint || constraint.rule === "CASCADE") return false;

    const [orphaned] = await sequelize.query(
        "DELETE FROM attendance_records WHERE userId IS NULL"
    );
    if (orphaned.affectedRows) {
        console.log(`Removed ${orphaned.affectedRows} orphaned attendance record(s)`);
    }

    await sequelize.query(`ALTER TABLE attendance_records DROP FOREIGN KEY \`${constraint.name}\``);
    await sequelize.query(`
        ALTER TABLE attendance_records
        ADD CONSTRAINT \`${constraint.name}\`
        FOREIGN KEY (userId) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    `);

    console.log("Migrated attendance_records.userId to ON DELETE CASCADE");
    return true;
}

module.exports = { ensureSchema, backfillLegacyRoles, ensureCascadeDeletes };
