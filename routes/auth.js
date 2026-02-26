const express = require("express")
const router = express.Router()

const { microsoftLogin } = require("../services/auth/service")

router.post("/microsoft", microsoftLogin)

module.exports = router