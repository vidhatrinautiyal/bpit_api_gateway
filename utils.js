function GetServerURL(PORT, prefix, url) {
    return "http://localhost:" + PORT + url.replace(prefix, '')
}

function GetErrorResponse(err) {
    const response_type = typeof err.response.data
    var error_response
    if (response_type == 'string') {
        error_response = err.response.data
    }
    else if (response_type == 'object') {
        error_response = { ...err.response.data }
    }
    return error_response
}

function BuildHeaders(reqHeaders) {
    const headers = {}
    for (let key in reqHeaders) {
        if (key == 'content-length')
            continue
        headers[key] = reqHeaders[key]
    }
    return headers
}

module.exports = {
    GetServerURL,
    GetErrorResponse,
    BuildHeaders,
}