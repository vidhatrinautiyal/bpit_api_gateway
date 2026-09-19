/**
 * Backward-compatible entry point. The models now live in db/models/ and the
 * seeding logic in db/seed.js; this file keeps the original import path working.
 */
const models = require("./models");
const { seedDatabase } = require("./seed");

module.exports = { ...models, seedDatabase };
