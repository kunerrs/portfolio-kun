# Chat API edge proxy

Browsers reach the chat API through this Cloudflare Worker instead of calling
`https://portfolio-kun.onrender.com` directly. `onrender.com` is shared hosting,
so ad-blocker filter lists block it wholesale and the request is cancelled
before it leaves the visitor's machine (`net::ERR_BLOCKED_BY_CLIENT`).

Only `GET /health` and `POST /api/chat` are forwarded, and only from the origins
in `ALLOWED_ORIGINS`, so this is not an open proxy.

## Deploy

```bash
cd worker
npx wrangler login     # opens the browser once
npx wrangler deploy
```

Wrangler prints the worker URL, for example:

```
https://portfolio-kun-chat.<your-subdomain>.workers.dev
```

## Check it

```bash
curl https://portfolio-kun-chat.<your-subdomain>.workers.dev/health
# {"status":"ok","message":"Server is running"}
```

## Point the site at it

Set `DEPLOYED_API_URL` in `client/js/alpine-data.js` to the worker URL. No manual
version bump: the Pages workflow replaces the `?v=dev` placeholder in
`client/index.html` with a hash of the script and page, so browsers fetch the
new file. Local development still uses `http://localhost:3000`.

## Configuration

`wrangler.toml` sets two optional variables (the code has the same defaults):

- `UPSTREAM` — the API being proxied.
- `ALLOWED_ORIGINS` — comma-separated origins, plus `null` for `file://` pages
  and any `localhost`/`127.0.0.1` port.

The worker forwards the visitor IP in `X-Forwarded-For`; `server/server.js` runs
with `trust proxy` set to one hop so the chat rate limit still applies per
visitor rather than per proxy egress IP.

## Keep the backend warm

Render spins a free service down after 15 minutes without traffic, and the next
request then waits about a minute for it to boot. The `[triggers]` block in
`wrangler.toml` registers a Cron Trigger that requests `/health` every 10
minutes, which keeps the service running and refreshes the worker's cached
health answer.

The schedule is deliberately not 24/7. Render gives each workspace 750 free
instance hours a month and suspends free services until the next month when they
run out; a continuous ping would use about 744. `*/10 0-4,12-23 * * *` runs 17
hours a day in UTC (roughly 08:00-23:00 Eastern), about 520 hours a month.
Visitors outside those hours still work, they just may wait out a boot.

Cron Triggers run in UTC and can take up to 15 minutes to take effect after a
deploy. Adjust the hours in `worker/wrangler.toml` and redeploy if needed.
