'use client';

import { createAuthClient } from 'better-auth/react';
import { usernameClient, adminClient } from 'better-auth/client/plugins';

const authBaseURL =
  typeof window === 'undefined'
    ? 'http://localhost:3000/api/auth'
    : `${window.location.origin}/api/auth`;

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [usernameClient(), adminClient()],
});
