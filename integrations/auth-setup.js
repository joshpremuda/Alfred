#!/usr/bin/env node
/**
 * auth-setup.js — One-time Google OAuth2 setup for Gmail + Sheets access
 *
 * Run: node auth-setup.js
 * It will print an auth URL → open it → paste the code back → saves token.json
 */

require('dotenv').config({ path: '../.env' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TOKEN_PATH = path.join(__dirname, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('\nMissing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    console.error('See integrations/README.md for setup instructions.\n');
    process.exit(1);
  }

  const oAuth2Client = getOAuth2Client();

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n=== Google OAuth2 Setup ===');
  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in and grant access');
  console.log('3. Copy the authorization code and paste it below\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Paste the authorization code here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code.trim());
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log(`\nToken saved to ${TOKEN_PATH}`);
      console.log('You can now run: npm run sync\n');
    } catch (err) {
      console.error('\nFailed to get token:', err.message);
    }
  });
}

main();
