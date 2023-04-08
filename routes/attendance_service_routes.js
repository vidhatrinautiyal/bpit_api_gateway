const express = require('express');
const router = express.Router()
const axios = require('axios')
const { GetServerURL, GetErrorResponse, BuildHeaders } = require('../utils')

const ATTENDANCE_SERVICE_PREFIX = '/attendance_service'
const ATTENDANCE_SERVICE_PORT = '8000'

router.get('*', (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    axios.get(service_url, {
        headers: req.headers
    })
        .then(response => {
            res.json(response.data)
        })
        .catch(err => {
            res.status(err.response.status).json(GetErrorResponse(err))
        })
})

router.post('*', (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    const config = {
        headers: BuildHeaders(req.headers)
    }
    axios.post(service_url, req.body, config)
        .then(response => {
            res.json(response.data)
        })
        .catch(err => {
            res.status(err.response.status || 500).send(GetErrorResponse(err))
        })
})

router.put('*', (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    const config = {
        headers: BuildHeaders(req.headers)
    }
    axios.put(service_url, req.body, config)
        .then(response => {
            res.json(response.data)
        })
        .catch(err => {
            res.status(err.response.status || 500).send(GetErrorResponse(err))
        })
})

router.patch('*', (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    const config = {
        headers: BuildHeaders(req.headers)
    }
    axios.patch(service_url, req.body, config)
        .then(response => {
            res.json(response.data)
        })
        .catch(err => {
            res.status(err.response.status || 500).send(GetErrorResponse(err))
        })
})

router.delete('*', (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    const config = {
        headers: BuildHeaders(req.headers)
    }
    axios.delete(service_url, req.body, config)
        .then(response => {
            res.json(response.data)
        })
        .catch(err => {
            res.status(err.response.status || 500).send(GetErrorResponse(err))
        })
})

module.exports = router