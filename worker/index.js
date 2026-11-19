/**
 * Edge proxy for the portfolio chat API.
 *
 * Browsers call this worker instead of https://portfolio-kun.onrender.com
 * directly. onrender.com is shared hosting, so ad-blocker filter lists block it
 * wholesale and the browser cancels the request before it leaves the machine
 * (net::ERR_BLOCKED_BY_CLIENT).
 *
 * Only the two chat endpoints are forwarded, so this is not an open proxy.
 */

const DEFAULT_UPSTREAM = 'https://portfolio-kun.onrender.com';
const DEFAULT_ALLOWED_ORIGINS = 'https://kunerrs.github.io,null';
const PROXY_PATHS = new Set(['/health', '/api/chat']);

const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function parseOrigins(value) {
    return String(value || DEFAULT_ALLOWED_ORIGINS)
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

function withCors(response, origin) {
    const headers = new Headers(response.headers);
    // Echo the caller's origin: the browser only accepts an exact match, and the
    // allow list is checked before any request is proxied.
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function json(body, status, origin) {
    return withCors(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }),
        origin
    );
}

export default {
    async fetch(request, env = {}) {
        const origin = request.headers.get('Origin') || '';
        const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
        // "null" is the Origin a page opened from disk (file://) sends.
        const allowed =
            origin === 'null' || allowedOrigins.includes(origin) || isLocalOrigin(origin);

        if (request.method === 'OPTIONS') {
            if (!allowed) return json({ error: 'Origin not allowed' }, 403, origin || 'null');
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Max-Age': '86400',
                    Vary: 'Origin',
                },
            });
        }

        if (!allowed) return json({ error: 'Origin not allowed' }, 403, origin || 'null');

        const url = new URL(request.url);
        if (!PROXY_PATHS.has(url.pathname)) {
            return json({ error: 'Not found' }, 404, origin);
        }

        const upstreamBase = (env.UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, '');
        const upstreamUrl = `${upstreamBase}${url.pathname}${url.search}`;

        const headers = new Headers();
        const contentType = request.headers.get('Content-Type');
        if (contentType) headers.set('Content-Type', contentType);
        // Keeps the API's per-IP rate limit keyed on the visitor instead of this
        // worker's egress IP (see the trust proxy setting in server/server.js).
        const clientIp = request.headers.get('CF-Connecting-IP');
        if (clientIp) headers.set('X-Forwarded-For', clientIp);

        let upstreamResponse;
        try {
            upstreamResponse = await fetch(upstreamUrl, {
                method: request.method,
                headers,
                body: ['GET', 'HEAD'].includes(request.method)
                    ? undefined
                    : await request.arrayBuffer(),
                redirect: 'manual',
            });
        } catch (error) {
            return json({ error: 'Chat backend unreachable' }, 502, origin);
        }

        const response = new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: upstreamResponse.headers,
        });
        // The edge already decoded the body, so these headers would corrupt it.
        response.headers.delete('content-encoding');
        response.headers.delete('content-length');
        return withCors(response, origin);
    },
};
