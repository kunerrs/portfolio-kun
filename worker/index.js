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

function json(body, status, origin, extraHeaders = {}) {
    return withCors(
        new Response(JSON.stringify(body), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                ...extraHeaders,
            },
        }),
        origin
    );
}

// Health answers are reused for a short while so page loads cannot turn into a
// burst of probes: the free host sits behind Cloudflare, which replies to
// bursts with a 429 challenge page that makes the chat look offline.
const HEALTH_FRESH_MS = 30 * 1000;
const HEALTH_STALE_MS = 2 * 60 * 1000;
// While the free host wakes up its CDN answers with a challenge (a 429 with
// cf-mitigated: challenge). Probing again during that window only extends the
// block, so answer from the recorded failure until it has passed.
const HEALTH_FAILURE_BACKOFF_MS = 20 * 1000;
// A sleeping instance answers with a challenge until it has booted, which can
// take most of a minute, so a chat request waits and is replayed rather than
// throwing away the visitor's message. The budget stays under the client's 45s
// timeout so a failure is still reported before the browser gives up.
const WAKE_RETRY_MS = 4 * 1000;
const WAKE_BUDGET_MS = 35 * 1000;
let healthMemo = { at: 0, body: null };
let healthFailure = { at: 0, status: 0 };
let healthInFlight = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The challenge page is HTML; the API itself always answers JSON.
function isWakeChallenge(response) {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return false;
    if (response.headers.get('cf-mitigated') === 'challenge') return true;
    return [429, 502, 503, 504].includes(response.status);
}

function noteUpstreamHealthy() {
    healthMemo = { at: Date.now(), body: { status: 'ok', message: 'Server is running' } };
    healthFailure = { at: 0, status: 0 };
}

async function fetchHealthPayload(upstreamBase) {
    // Share one in-flight request between concurrent callers.
    if (!healthInFlight) {
        healthInFlight = (async () => {
            const response = await fetch(`${upstreamBase}/health`, { redirect: 'manual' });
            if (!response.ok) {
                healthFailure = { at: Date.now(), status: response.status };
                return { ok: false, status: response.status };
            }

            const payload = await response.json();
            healthMemo = { at: Date.now(), body: payload };
            healthFailure = { at: 0, status: 0 };
            return { ok: true, payload };
        })()
            .catch((error) => {
                healthFailure = { at: Date.now(), status: 0 };
                return { ok: false, status: 0, error };
            })
            .finally(() => {
                healthInFlight = null;
            });
    }

    return healthInFlight;
}

async function handleHealth(env, origin) {
    if (healthMemo.body && Date.now() - healthMemo.at < HEALTH_FRESH_MS) {
        return json(healthMemo.body, 200, origin, { 'X-Health-Cache': 'hit' });
    }

    const backingOff =
        healthFailure.at && Date.now() - healthFailure.at < HEALTH_FAILURE_BACKOFF_MS;

    if (!backingOff) {
        const upstreamBase = (env.UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, '');
        const result = await fetchHealthPayload(upstreamBase);

        if (result.ok) {
            return json(result.payload, 200, origin, { 'X-Health-Cache': 'miss' });
        }
    }

    // A short block should not take the chat down: keep answering with the last
    // good result, and only report a failure once that has gone stale too.
    if (healthMemo.body && Date.now() - healthMemo.at < HEALTH_STALE_MS) {
        return json(healthMemo.body, 200, origin, { 'X-Health-Cache': 'stale' });
    }

    return json(
        { status: 'error', message: 'Chat backend unavailable', upstreamStatus: healthFailure.status },
        503,
        origin,
        { 'Retry-After': String(HEALTH_FAILURE_BACKOFF_MS / 1000) }
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

        if (request.method === 'GET' && url.pathname === '/health') {
            return handleHealth(env, origin);
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

        const body = ['GET', 'HEAD'].includes(request.method)
            ? undefined
            : await request.arrayBuffer();
        const deadline = Date.now() + WAKE_BUDGET_MS;

        let upstreamResponse;
        for (;;) {
            try {
                upstreamResponse = await fetch(upstreamUrl, {
                    method: request.method,
                    headers,
                    body,
                    redirect: 'manual',
                });
            } catch (error) {
                if (Date.now() + WAKE_RETRY_MS < deadline) {
                    await sleep(WAKE_RETRY_MS);
                    continue;
                }
                return json({ error: 'Chat backend unreachable' }, 502, origin);
            }

            // The challenge never reached the app, so replaying the same body is
            // safe and saves the visitor from retyping their question.
            if (isWakeChallenge(upstreamResponse)) {
                if (upstreamResponse.body) await upstreamResponse.body.cancel().catch(() => {});

                if (Date.now() + WAKE_RETRY_MS < deadline) {
                    await sleep(WAKE_RETRY_MS);
                    continue;
                }

                return json(
                    { error: 'Chat backend is starting up. Please try again in a moment.', retryAfter: 20 },
                    503,
                    origin,
                    { 'Retry-After': '20' }
                );
            }

            break;
        }

        // An answered request proves the backend is awake, so stop reporting the
        // stale failure from the health cache.
        if (upstreamResponse.status < 500) noteUpstreamHealthy();

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
