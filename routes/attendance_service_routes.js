const express = require('express');
const router = express.Router()
const axios = require('axios')
// const multer = require("multer");
// const upload = multer();
const { GetServerURL, GetErrorResponse, BuildHeaders } = require('../utils')
const { Blob } = require("buffer");

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
    // router.post('*', upload.single("file"), (req, res) => {
    const service_url = GetServerURL(ATTENDANCE_SERVICE_PORT, ATTENDANCE_SERVICE_PREFIX, req.url)
    const config = {
        headers: BuildHeaders(req.headers)
    }
    // const body = { ...req.body, "file": req.file }
    // console.log(body, req.file, req.body)
    // const body = new FormData()
    // for (let key in req.body) {
    //     body.append(key, req.body[key])
    // }

    // if (req.file !== undefined) {
    //     const blob = new Blob(req.body.buffer)
    //     body.append("file", req.file.buffer, req.file.originalname)
    // }

    // axios.post(service_url, body, config)
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