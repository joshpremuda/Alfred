#!/usr/bin/env node
// send.mjs — push paper-filter/issue.html to Mailchimp as a campaign.
//
//   MODE=approve node paper-filter/send.mjs   (default) → creates a DRAFT and
//     sends a review copy to you; you approve + send from Mailchimp.
//   MODE=auto    node paper-filter/send.mjs           → creates and SENDS it.
//
// Env (put in paper-filter/.env — gitignored):
//   MAILCHIMP_API_KEY   e.g. abc123...-us21   (the -us21 suffix is your server)
//   MAILCHIMP_LIST_ID   your audience ID
//   PF_FROM_NAME        "The Paper Filter"
//   PF_REPLY_TO         "you@smalleycoffee.com"
//   PF_SUBJECT          optional; defaults to "The Paper Filter — <date>"
//   PF_APPROVE_EMAIL    where the review copy goes (approve mode)

import { readFileSync } from "node:fs";

const KEY = process.env.MAILCHIMP_API_KEY;
const LIST = process.env.MAILCHIMP_LIST_ID;
const MODE = process.env.MODE || "approve";
if (!KEY || !LIST) {
  console.error("Missing MAILCHIMP_API_KEY or MAILCHIMP_LIST_ID (see paper-filter/.env).");
  process.exit(1);
}
const dc = KEY.split("-")[1];
if (!dc) {
  console.error("MAILCHIMP_API_KEY must end in a server suffix like '-us21'.");
  process.exit(1);
}
const base = `https://${dc}.api.mailchimp.com/3.0`;
const auth = "Basic " + Buffer.from("key:" + KEY).toString("base64");

async function mc(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Mailchimp ${method} ${path} → ${res.status}: ${data.detail || JSON.stringify(data)}`);
  }
  return data;
}

const html = readFileSync(new URL("./issue.html", import.meta.url), "utf8");
const content = JSON.parse(readFileSync(new URL("./issue-content.json", import.meta.url), "utf8"));
const subject = process.env.PF_SUBJECT || `The Paper Filter — ${content.date || new Date().toDateString()}`;

const campaign = await mc("POST", "/campaigns", {
  type: "regular",
  recipients: { list_id: LIST },
  settings: {
    subject_line: subject,
    preview_text: content.intro?.slice(0, 140) || "The news, filtered.",
    title: subject,
    from_name: process.env.PF_FROM_NAME || "The Paper Filter",
    reply_to: process.env.PF_REPLY_TO || "hello@smalleycoffee.com",
    auto_footer: false,
  },
});

await mc("PUT", `/campaigns/${campaign.id}/content`, { html });

if (MODE === "auto") {
  await mc("POST", `/campaigns/${campaign.id}/actions/send`);
  console.log(`✓ Sent: "${subject}"`);
} else {
  const review = process.env.PF_APPROVE_EMAIL;
  if (review) {
    await mc("POST", `/campaigns/${campaign.id}/actions/test`, { test_emails: [review], send_type: "html" });
    console.log(`✓ Review copy sent to ${review}.`);
  }
  console.log(`Draft ready. Approve + send here:`);
  console.log(`  https://${dc}.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`);
}
