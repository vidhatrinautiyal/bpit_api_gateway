const express = require('express');
const router = express.Router()
const axios = require('axios')
const config = require('../config')
const { GetServerURL, GetErrorResponse, BuildHeaders } = require('../utils')

const ATTENDANCE_SERVICE_PREFIX = '/attendance_service'
const REQUEST_TIMEOUT_MS = 15000

function forward(method) {
    return async (req, res) => {
        const service_url = GetServerURL(
            config.attendanceService.host,
            config.attendanceService.port,
            ATTENDANCE_SERVICE_PREFIX,
            req.originalUrl
        )

        try {
            const response = await axios({
                method,
                url: service_url,
                headers: BuildHeaders(req.headers),
                data: ["get", "delete"].includes(method) ? undefined : req.body,
                params: undefined,
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: () => true
            })

            return res.status(response.status).json(response.data)
        } catch (err) {
            const { status, body } = GetErrorResponse(err)
            console.error(`Proxy ${method.toUpperCase()} ${service_url} failed:`, err.code || err.message)
            return res.status(status).json(body)
        }
    }
}

router.get('*', forward('get'))
router.post('*', forward('post'))
router.put('*', forward('put'))
router.patch('*', forward('patch'))
router.delete('*', forward('delete'))

module.exports = router
