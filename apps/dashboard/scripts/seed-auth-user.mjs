// Seeds the first admin user directly against the Neon Auth service.
// Run: node --env-file=.env scripts/seed-auth-user.mjs
//
// After the user is created, assign the admin role with the Neon CLI:
//   npx neon neon-auth user set-role <user-id> --roles admin

const seedUser = {
  name: 'Raj',
  email: 'admin@raj.com',
  password: 'Admin@123',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const baseUrl = requireEnv('NEON_AUTH_BASE_URL');

async function main() {
  const response = await fetch(`${baseUrl}/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.BETTER_AUTH_ORIGIN || 'http://localhost:3000',
    },
    body: JSON.stringify(seedUser),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? payload?.error?.message ?? `HTTP ${response.status}`;
    console.error(`Failed to seed user: ${message}`);
    process.exit(1);
  }

  const user = payload?.user;
  if (!user?.id) {
    console.error('Unexpected response from Auth service:', JSON.stringify(payload));
    process.exit(1);
  }

  console.log(`Seeded user: ${user.email} (${user.id})`);
  console.log(`Next step — set admin role:\n`);
  console.log(`  npx neon neon-auth user set-role ${user.id} --roles admin`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
