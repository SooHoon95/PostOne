// Seeds an E2E test user using Supabase Admin API.
// Reads .env.local for SUPABASE creds, writes E2E_TEST_EMAIL/PASSWORD back to .env.local.
//
// Usage: node scripts/seed-e2e-user.mjs

import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function upsertEnv(text, key, value) {
  const lines = text.split(/\r?\n/);
  let updated = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!updated) next.push(`${key}=${value}`);
  return next.join("\n");
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(".env.local 없음. .env.local.example을 .env.local로 복사 후 채우세요.");
    process.exit(1);
  }
  let envText = fs.readFileSync(ENV_PATH, "utf8");
  const env = parseEnv(envText);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
    process.exit(1);
  }

  const email = env.E2E_TEST_EMAIL || `e2e+${Date.now()}@onepost.test`;
  const password = env.E2E_TEST_PASSWORD || "e2e_test_password_8plus";

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    // 409 = user already exists — treat as OK if we already have the creds in .env.local
    if (res.status === 422 || text.includes("already")) {
      console.log(`이미 존재함: ${email}`);
    } else {
      console.error(`생성 실패: ${res.status} ${text}`);
      process.exit(1);
    }
  } else {
    console.log(`생성 완료: ${email}`);
  }

  envText = upsertEnv(envText, "E2E_TEST_EMAIL", email);
  envText = upsertEnv(envText, "E2E_TEST_PASSWORD", password);
  fs.writeFileSync(ENV_PATH, envText);
  console.log("E2E_TEST_EMAIL / E2E_TEST_PASSWORD 를 .env.local에 기록함");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
