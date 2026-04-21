#!/usr/bin/env node
// Generates the Apple "Client Secret" JWT that Supabase's Apple provider needs.
// No npm dependencies — uses Node's built-in crypto.
//
// Usage:
//   node scripts/generate-apple-jwt.js \
//     --team  ABCDE12345 \
//     --service com.yourorg.storyloom.web \
//     --kid   XYZ9876543 \
//     --key   /absolute/path/to/AuthKey_XYZ9876543.p8
//
// Or set env vars APPLE_TEAM_ID, APPLE_SERVICES_ID, APPLE_KEY_ID, APPLE_P8_PATH.

const fs = require('fs');
const crypto = require('crypto');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const teamId     = arg('team')    || process.env.APPLE_TEAM_ID;
const servicesId = arg('service') || process.env.APPLE_SERVICES_ID;
const keyId      = arg('kid')     || process.env.APPLE_KEY_ID;
const keyPath    = arg('key')     || process.env.APPLE_P8_PATH;

if (!teamId || !servicesId || !keyId || !keyPath) {
  console.error('Missing required inputs.');
  console.error('  --team <Apple Team ID>');
  console.error('  --service <Services ID / client_id, e.g. com.yourorg.app.web>');
  console.error('  --kid <Key ID of the .p8 key>');
  console.error('  --key <absolute path to AuthKey_XXXX.p8>');
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');

const b64url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const now = Math.floor(Date.now() / 1000);
// Apple caps client_secret lifetime at 6 months (15777000s). Use ~180 days.
const exp = now + 60 * 60 * 24 * 180;

const header  = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
};

const signingInput =
  b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));

const signature = crypto.sign(
  'SHA256',
  Buffer.from(signingInput),
  { key: privateKey, dsaEncoding: 'ieee-p1363' },
);

const jwt = signingInput + '.' + b64url(signature);

console.log('\nApple client_secret JWT (paste into Supabase → Apple → Secret Key):\n');
console.log(jwt);
console.log(`\nExpires: ${new Date(exp * 1000).toISOString()} (~180 days)`);
console.log('Remember to regenerate before expiry.\n');
