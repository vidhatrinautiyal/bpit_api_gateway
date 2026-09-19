const express = require("express")
const router = express.Router()

const {
    microsoftLogin,
    localRegister,
    localLogin,
    getCurrentUser,
    listUsers,
    listRoles,
    assignRole,
    setUserStatus,
    deleteUser
} = require("../services/auth/service")
const { auth, requirePermission } = require("../middlewares/auth")

// ---- Public: authentication ----
router.post("/microsoft", microsoftLogin)
router.post("/register", localRegister)
router.post("/login", localLogin)

// ---- Authenticated: own session ----
router.get("/me", auth, getCurrentUser)

// ---- Permission-gated: user administration ----
router.get("/roles", auth, requirePermission("view_users"), listRoles)
router.get("/users", auth, requirePermission("view_users"), listUsers)
router.post("/users/:userId/roles", auth, requirePermission("edit_users"), assignRole)
router.patch("/users/:userId/status", auth, requirePermission("delete_users"), setUserStatus)
router.delete("/users/:userId", auth, requirePermission("delete_users"), deleteUser)

module.exports = router
