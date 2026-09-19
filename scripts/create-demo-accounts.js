require("dotenv").config();

const { sequelize, connectDB } = require("../db/connect");
const { User } = require("../db/models");
const userService = require("../services/user/service");

// These match the quick-select buttons on the dashboard sign-in card.
const demoAccounts = [
    {
        username: "student1",
        email: "student1@example.com",
        password: "Student@123",
        name: "Student One",
        role: "STUDENT"
    },
    {
        username: "demo_teacher",
        email: "demo.teacher@example.com",
        password: "Teacher@123",
        name: "Demo Teacher",
        role: "TEACHER"
    },
    {
        username: "demo_admin",
        email: "demo.admin@example.com",
        password: "Admin@123",
        name: "Demo Administrator",
        role: "ADMIN"
    }
];

async function main() {
    await connectDB();

    for (const account of demoAccounts) {
        const existing = await userService.findUserByUsername(account.username);

        if (!existing) {
            await userService.createUser(account);
            console.log(`Created ${account.role} account: ${account.username}`);
            continue;
        }

        // Re-assert password and role so the documented demo credentials work
        // even if the row was created by an earlier version of this project.
        await User.update(
            { passwordHash: userService.hashPassword(account.password), isActive: true },
            { where: { id: existing.id } }
        );
        await userService.assignRoleToUser(existing.id, account.role);
        console.log(`Refreshed ${account.role} account: ${account.username}`);
    }

    console.log("\nDemo credentials:");
    demoAccounts.forEach(a => console.log(`  ${a.role.padEnd(8)} ${a.username} / ${a.password}`));
}

main()
    .catch(error => {
        console.error("Unable to create demo accounts:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
