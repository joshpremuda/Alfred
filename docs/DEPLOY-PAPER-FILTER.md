# The Paper Filter — deploy & send (free)

Everything is built. Three parts need *your* accounts (I can't log into Mailchimp
or your DNS): **① connect Mailchimp**, **② put the page on a Smalley subdomain**,
**③ send the daily issue**. All free. ~20 minutes total.

The landing page lives in `paper-filter/index.html`. The news engine is
`paper-filter/gather.mjs` + `paper-filter/sources.json`.

---

## ① Waitlist — Mailchimp (free)

1. In Mailchimp: **Audience → create/choose an audience** for The Paper Filter.
2. **Audience → Signup forms → Embedded form.** Copy the form's **action URL**
   (looks like `https://us21.list-manage.com/subscribe/post?u=abc123&id=def456`)
   and the hidden **honeypot field name** (`b_abc123_def456`).
3. In `paper-filter/index.html`, replace in **both** forms:
   - `https://YOURDC.list-manage.com/subscribe/post?u=YOUR_U&id=YOUR_ID` → your action URL
   - `b_YOUR_U_YOUR_ID` → your honeypot name

That's it — the form posts straight to Mailchimp, no backend, no cost.

---

## ② Host it on Smalley (free static host + subdomain)

Recommended: **Cloudflare Pages** (free, easiest custom domain). Alternative:
Netlify or GitHub Pages.

1. Go to **Cloudflare → Workers & Pages → Create → Pages → Upload assets**.
   Upload the **`paper-filter/`** folder (or connect this GitHub repo and set the
   output directory to `paper-filter`). Deploy — you get a `*.pages.dev` URL.
2. In Pages → **Custom domains → Set up a domain** → enter
   **`paper.smalleycoffee.com`** (or `read.smalleycoffee.com`).
3. Add the **CNAME** it gives you wherever `smalleycoffee.com` DNS is managed
   (your registrar or Shopify domain settings): `paper` → the `pages.dev` target.
   Leave the Shopify store untouched — this is just a new subdomain.

Within a few minutes, `https://paper.smalleycoffee.com` is live with the working
waitlist. (Keep the store on Shopify; the newsletter lives on its own subdomain.)

---

## ③ The daily issue — automated (free, on your Mac)

The full pipeline is built: **gather → write → render → send**. Writing runs on
your **Claude subscription** (Claude Code headless — no API credits), so the only
paid-or-limited service is Mailchimp's free tier.

**Prereqs:** Claude Code installed and signed in on the Mac (`claude` on PATH);
Node 18+.

**1. Secrets** — create `paper-filter/.env` (gitignored):
```
MAILCHIMP_API_KEY=xxxxxxxx-us21     # the -usNN suffix is your server
MAILCHIMP_LIST_ID=your_audience_id
PF_FROM_NAME=The Paper Filter
PF_REPLY_TO=you@smalleycoffee.com
PF_APPROVE_EMAIL=you@gmail.com      # where the daily review copy goes
```
(Mailchimp API key: Account → Extras → API keys. List ID: Audience → Settings →
Audience name and defaults.)

**2. Try one run by hand:**
```bash
./paper-filter/run.sh               # gather → write → render → draft + review copy
```
You'll get the issue in your inbox and a link to send it from Mailchimp.

**3. Schedule it daily (approve mode first):**
```bash
./paper-filter/install-schedule.sh install      # runs every day at 06:00
```
Each morning it builds the issue and emails you a review copy + a one-click send
link. Nothing goes to subscribers until you approve.

**4. Flip to fully automatic** once you trust it:
```bash
PF_MODE=auto ./paper-filter/install-schedule.sh install
```
Now it gathers, writes, and sends on its own — zero involvement.

> If the write step errors, it's usually the `claude -p … --permission-mode
> acceptEdits` flags in `run.sh` needing a tweak for your Claude Code version —
> paste the error to Claude and it'll adjust.

---

## House voice (for whoever/whatever writes the issue)

- Conversational — a sharp friend catching you up over coffee.
- Short reads, not headlines. Links woven into the sentences.
- Neutral: what happened across sources; note where coverage diverges, briefly.
- Never invent facts — use only what's in `issue-data.json`.
- End each item with a simple **Sources** line of linked outlets.
