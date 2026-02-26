const { verifyMicrosoftToken, createAppToken } = require("../../middlewares/auth")
const userService = require("../user/service")

async function microsoftLogin(req, res) {
    try {
        const { idToken } = req.body
        const payload = await verifyMicrosoftToken(idToken)

        const oid = payload.oid
        const email = payload.preferred_username || payload.email
        const name = payload.name

        let user = await userService.findUserByOid(oid)
        if (!user) {
            user = await userService.createUser({ oid, email, name })
        }

        const roles = await userService.getUserRoles(user.id)
        const permissions = await userService.getPermissionsFromRoles(roles)
        const token = await createAppToken(user, roles, permissions)

        res.json({ token })
    } catch (err) {
        console.error(err)
        res.status(401).json({ error: "Authentication failed" })
    }
}

module.exports = {
    microsoftLogin
}