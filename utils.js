function GetServerURL(host, PORT, prefix, url) {
    const base = host.replace(/\/$/, "")
    return `${base}:${PORT}${url.replace(prefix, "") || "/"}`
}

/**
 * axios only populates err.response when the downstream service actually
 * answered. Connection refused, DNS failures and timeouts leave it undefined,
 * so every caller must go through here instead of reading err.response
 * directly.
 */
function GetErrorResponse(err) {
    if (!err.response) {
        const unreachable = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT"]
        const status = unreachable.includes(err.code) || err.code === "ECONNABORTED" ? 502 : 500
        return {
            status,
            body: {
                error: "Upstream service unavailable",
                code: err.code || "UPSTREAM_ERROR"
            }
        }
    }

    const data = err.response.data
    return {
        status: err.response.status || 502,
        body: typeof data === "object" && data !== null ? { ...data } : data
    }
}

// Hop-by-hop and length headers must not be forwarded: the body is
// re-serialized downstream, so the original values no longer describe it.
const STRIPPED_HEADERS = new Set([
    "content-length",
    "host",
    "connection",
    "transfer-encoding",
    "keep-alive",
    "upgrade",
    "accept-encoding"
])

function BuildHeaders(reqHeaders) {
    const headers = {}
    for (const key in reqHeaders) {
        if (STRIPPED_HEADERS.has(key.toLowerCase())) continue
        headers[key] = reqHeaders[key]
    }
    return headers
}

module.exports = {
    GetServerURL,
    GetErrorResponse,
    BuildHeaders,
}
