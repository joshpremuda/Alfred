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

## ③ The daily issue (free)

The engine gathers today's real headlines; the *writing* is done by an agent
(Claude Code on your subscription — no API credits needed).

**Each morning:**
```bash
cd ~/valet
node paper-filter/gather.mjs        # → paper-filter/issue-data.json
```
Then, in a Claude Code session:
> "Write today's Paper Filter issue from paper-filter/issue-data.json in the
>  conversational house voice (short reads, links woven in, a Sources line),
>  and give me the email HTML."

Paste that HTML into a **Mailchimp → Create → Email → Regular** campaign and send
to your audience. Two minutes.

**Automate later:** once Mailchimp is connected, add a Mailchimp API key and a
send step, and a daily scheduled agent can gather → write → send on its own.
Ask Claude to set that up.

---

## House voice (for whoever/whatever writes the issue)

- Conversational — a sharp friend catching you up over coffee.
- Short reads, not headlines. Links woven into the sentences.
- Neutral: what happened across sources; note where coverage diverges, briefly.
- Never invent facts — use only what's in `issue-data.json`.
- End each item with a simple **Sources** line of linked outlets.
