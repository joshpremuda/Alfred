#!/usr/bin/env node
// render.mjs — wrap the day's written content in an email-safe HTML issue.
// Input:  paper-filter/issue-content.json  (written by the agent step)
// Output: paper-filter/issue.html          (ready for Mailchimp)
//
//   node paper-filter/render.mjs
//
// Deterministic + email-safe: inline styles, a 600px table, system fonts (email
// clients don't have Iowan), the brand ink-blue accent. No external assets.

import { readFileSync, writeFileSync } from "node:fs";

const inPath = new URL("./issue-content.json", import.meta.url);
const outPath = new URL("./issue.html", import.meta.url);
const c = JSON.parse(readFileSync(inPath, "utf8"));

const INK = "#16181c", SOFT = "#5b5f67", LINE = "#e2e2dc", PAPER = "#f6f6f3", ACCENT = "#33518c";
const serif = "Georgia,'Times New Roman',serif";
const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const mono = "'SFMono-Regular',Menlo,Consolas,monospace";

const esc = (s = "") => String(s).replace(/&(?!\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// body/quick text may contain <a href> links written by the agent — keep those.

const sources = (arr = []) =>
  arr
    .map(
      (s) =>
        `<a href="${esc(s.url)}" style="color:${ACCENT};text-decoration:none;border-bottom:1px solid ${ACCENT}">${esc(s.name)}</a>`,
    )
    .join(`<span style="color:${SOFT}"> &middot; </span>`);

const item = (it) => `
  <tr><td style="padding:18px 0;border-bottom:1px solid ${LINE}">
    <p style="margin:0 0 10px;font-family:${serif};font-size:17px;line-height:1.6;color:${INK}">
      <strong>${esc(it.lead)} &mdash;</strong> ${it.body}
    </p>
    <p style="margin:0;font-family:${mono};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${SOFT}">
      Sources &nbsp;${sources(it.sources)}
    </p>
  </td></tr>`;

const quick = (c.quick || []).length
  ? `<tr><td style="padding:20px 0 4px;font-family:${mono};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${SOFT}">A couple more worth a glance</td></tr>
     ${(c.quick || [])
       .map(
         (q) =>
           `<tr><td style="padding:6px 0;font-family:${serif};font-size:16px;line-height:1.55;color:${INK}">&mdash;&nbsp; ${q}</td></tr>`,
       )
       .join("")}`
  : "";

const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Paper Filter</title></head>
<body style="margin:0;background:${PAPER};font-family:${sans}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:28px 16px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px">
    <tr><td style="padding:24px 28px 16px;border-bottom:1px solid ${LINE}">
      <div style="font-family:${serif};font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:${INK};font-size:15px">The Paper Filter</div>
      <div style="font-family:${mono};font-size:11px;letter-spacing:.05em;color:${SOFT};margin-top:4px">${esc(c.date || "")} &middot; The news, filtered</div>
    </td></tr>
    <tr><td style="padding:6px 28px 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:16px 0 2px;font-family:${serif};font-size:17px;line-height:1.55;color:${INK}">${c.intro ? c.intro : ""}</td></tr>
        ${(c.items || []).map(item).join("")}
        ${quick}
      </table>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};font-family:${mono};font-size:11px;color:${SOFT};letter-spacing:.04em">
      The Paper Filter &middot; a morning companion to Crema &amp; Smalley Coffee &middot;
      <a href="*|UNSUB|*" style="color:${SOFT}">unsubscribe</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

writeFileSync(outPath, html);
console.log(`Rendered ${(c.items || []).length} items + ${(c.quick || []).length} quick hits → paper-filter/issue.html`);
