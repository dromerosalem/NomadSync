---
name: securing-api-tokens
description: Prevents exposure of sensitive API tokens and credentials on the client side. Use when the user mentions API keys, .env files, or deploying to serverless/edge functions.
---

# Securing API Tokens

## When to use this skill
- When adding a new API integration (e.g., OpenAI, Stripe, Supabase Service Role).
- When configuring environment variables.
- When planning deployment to cloud platforms (Vercel, Netlify, Supabase Edge Functions).
- Whenever the user asks to "connect to a service."

## Workflow
1.  **Credential Scoping**: Identify if the token is "Public" (e.g., Supabase Anon Key) or "Secret" (e.g., API Key).
2.  **Environment Setup**: 
    - Ensure a `.env` file exists for local development.
    - IMMEDIATELY check that `.env` is listed in `.gitignore`.
3.  **Proxy Pattern Selection**:
    - If a Secret token is needed, refuse to call it from the browser.
    - Plan a Serverless or Edge Function to act as a proxy.
4.  **Implementation**:
    - Write the server-side function to handle the sensitive API call.
    - Update the client-side to call the internal proxy endpoint instead.
5.  **Validation**: Scan codebase for hardcoded strings that look like tokens.

## Instructions
- **Strict Prohibition**: NEVER hardcode a secret token into a `.js`, `.ts`, or `.tsx` file that is bundled for the client.
- **Prefix Awareness**: 
    - In Vite, only variables prefixed with `VITE_` are exposed. Do NOT prefix secret tokens with `VITE_`.
    - In Next.js, only variables prefixed with `NEXT_PUBLIC_` are exposed.
- **Git Safety**: If you find a token in a file, redact it, move it to `.env`, and advise the user to rotate the key immediately.
- **Serverless-First**: Always assume the final destination is a serverless/edge environment. Use `process.env` or `Deno.env.get()` appropriately.

## Checklist
- [ ] `.env` is in `.gitignore`.
- [ ] No secret tokens are hardcoded in the source code.
- [ ] Secret tokens are accessed via server-side context only.
- [ ] Client calls a proxy endpoint/function rather than the external API directly.

## Resources
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Edge Functions Security](https://supabase.com/docs/guides/functions/secrets)
- [12-Factor App: Config](https://12factor.net/config)
