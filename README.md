# Captain 97.1

The production website for Captain 97.1 / WXNR-LP in New Bern, North Carolina.

- Public site: <https://captain97.com>
- Station stream: <https://streaming.live365.com/a57695>
- Live365 page: <https://live365.com/station/Captain-97-a57695>

## Local development

Use Node.js 22 LTS (Next.js requires Node.js 20.9 or newer) and npm 10 or newer.

```bash
npm ci
npm run dev
```

Then open <http://localhost:3000>.

The now-playing integration requires an Upstash Redis database connected through Vercel and a private StationPlaylist update token. The donation checkout requires the server-only secret key from a dedicated Captain 97 Stripe account. See `.env.example` for the required variable names. Keep credentials and provider secrets in Vercel project settings; never commit them to the repository or expose server-only secrets through `NEXT_PUBLIC_` variables.

Stripe Checkout is created server-side after the donor chooses a suggested or custom amount on `/donate`. Configure `STRIPE_SECRET_KEY` for Preview and Production, enable successful-payment receipt emails in Stripe, and set the Captain 97 logo, public business details, and card statement descriptor in that Stripe account. Do not reuse a Stripe account belonging to an independently operated website or business; the account identity appears on receipts and card statements.

StationPlaylist Studio Pro sends current and upcoming track metadata to `/api/now-playing/update` at every track change. The public `/api/now-playing` route returns the latest safe snapshot for the site player. The update route is authenticated and must never be used without `STATIONPLAYLIST_UPDATE_TOKEN` configured.

Use lower-case names for the current track (`artist`, `title`) and lower camel case for upcoming tracks (`nextArtist`, `nextTitle`, `laterArtist`, `laterTitle`). StationPlaylist replaceable parameters can be placed directly in the request URL.

In StationPlaylist Studio Pro, open **View → Options → Now Playing → Stream Metadata**, enable **URL 1**, and use this template after replacing `TOKEN_GOES_HERE` with the same private value configured in Vercel:

```text
https://captain97.com/api/now-playing/update?token=TOKEN_GOES_HERE&artist=%a&title=%t&duration=%S&nextArtist=%+1a&nextTitle=%+1t&laterArtist=%+2a&laterTitle=%+2t
```

The request is sent at the start of each eligible track. The threshold on the Now Playing Parameters tab keeps short sweepers and jingles from replacing song metadata; tracks marked as songs are always included.

## Chat with the DJ

The public `/chat` page provides a private listener-to-studio conversation. Messages, unread state, and the studio availability heartbeat use the same Upstash Redis connection as now-playing metadata. The private `/studio` page contains one shared inbox account for the studio computer; it does not create or manage individual DJ users.

The shared studio session uses a secure, HTTP-only cookie and remains signed in for 30 days. Configure the launch verifier with the private Vercel environment variables `STUDIO_INITIAL_PASSWORD_SALT` and `STUDIO_INITIAL_PASSWORD_HASH`, then change the launch password from inside the studio console after the first sign-in. Changing it revokes older studio sessions. The **Available now** switch is backed by a short heartbeat, so the public page automatically falls back to **Taking messages** if the studio console closes or the computer sleeps.

Live message polling runs only while the relevant page is visible. When a listener is no longer online, the **Email listener** button opens the email account configured on the studio computer with a prefilled follow-up. Automated outbound email is intentionally not implied because this project does not currently have a transactional email provider.

## Contact form

The public `/contact` form posts to the same-origin `/api/contact` route, which validates every field, rejects cross-origin requests, uses a honeypot and Redis-backed throttling, and then sends the message to `kyle@captain97.com` through Resend. The Vercel Marketplace integration provisions the server-only `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` variables; verify `captain97.com` in Resend before sending. The sender defaults to `Captain 97 Website <website@captain97.com>`; set `CONTACT_FROM_EMAIL` only if a different verified sender is needed. Replies are addressed directly to the visitor. Contact messages are not written to Redis or another application database.

## Quality checks

Run the same checks used by continuous integration before opening or merging a pull request:

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run check` runs linting and TypeScript together. Pull requests and pushes to `main` run all three checks in GitHub Actions.

## Deployment runbook

1. Create a short-lived branch from an up-to-date `main`.
2. Open a pull request and wait for the CI workflow to pass.
3. Review the Vercel Preview deployment on desktop and a physical phone. Confirm navigation, the On Air schedule, the contact details, and live audio playback.
4. Merge only after the preview is approved. Vercel deploys `main` to production.
5. Smoke-test `/`, `/on-air`, `/captains-calendar`, `/underwriting`, `/donate`, `/contact`, `/robots.txt`, and `/sitemap.xml` on production.

Do not make experimental changes directly on `main`. Enable GitHub branch protection so `main` requires a pull request and a passing `quality` check.

## Domain cutover checklist

- Add both `captain97.com` and `www.captain97.com` to the production Vercel project; choose one canonical host and redirect the other.
- Record the existing DNS zone before changing web records.
- Preserve all mail-related MX, SPF, DKIM, and DMARC records. A web cutover should not change email delivery.
- Verify HTTPS before announcing the new site.
- Confirm the legacy redirects in `next.config.ts`, especially `/events`, `/community`, and `/event/*`.
- Re-run the production smoke tests and verify the Live365 player after DNS propagation.

## Operational notes

- Station address: 1423 South Glenburnie Road, Suite C, New Bern, NC 28562
- Station phone: 252-675-6100
- The security policy deliberately permits the Live365 origin and its current `cdnstream.com` audio delivery hosts. If the streaming provider changes domains, update the Content Security Policy in `next.config.ts` and verify playback in a Preview deployment first.
- Update `app/sitemap.ts` whenever a public top-level route is added or removed.
