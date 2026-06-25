---
name: lcb-interview-deploy
description: Build, package, upload, and deploy the LCB Interview full-stack system to the configured CentOS Docker server. Use when the user asks to publish, deploy, update online, upload latest local changes to the server, restart the LCB Interview service, or run the repeatable release flow for this repository.
---

# LCB Interview Deploy

Use this skill to deploy the local `lcb-interview` repository to the existing server at `106.12.166.113` without re-discovering the deployment steps.

## Workflow

1. Start in the repository root and read `AGENTS.md`.
2. Check `git status --short` and do not revert unrelated user changes.
3. Run the deploy script:

   ```powershell
   powershell -ExecutionPolicy Bypass -File C:/Users/chenbo.li/.codex/skills/lcb-interview-deploy/scripts/deploy.ps1 -RepoPath E:/develop-lcb/workspace-tools/lcb-interview
   ```

4. When `scp` or `ssh` prompts for a password, ask the user to provide or confirm the server password. Do not write the password into files or the command line.
5. Verify the live app after deployment:
   - `http://106.12.166.113/`
   - `http://106.12.166.113/admin/login`
   - `GET http://106.12.166.113/api/categories`
   - If an admin token is available, also verify `GET /api/admin/ai/config`.

## Script Behavior

The script performs:

- backend tests with `mvn test`
- backend packaging with `mvn -q -DskipTests package`
- frontend production build with `npm run build`
- archive creation with project-specific excludes
- idempotent `ai_config` table migration
- upload to `/tmp` on the server
- extraction into `/opt/lcb-interview`
- `docker compose -f docker-compose.runtime.yml up -d`
- backend/frontend restart so the new jar and static assets are loaded
- basic HTTP smoke checks

Use `-SkipTests` only when the user explicitly accepts the risk. Use `-BuildOnly` to test local packaging without touching the server.

## Deployment Defaults

- Repository: `E:/develop-lcb/workspace-tools/lcb-interview`
- Server: `root@106.12.166.113`
- Server app directory: `/opt/lcb-interview`
- Archive: `%TEMP%/lcb-interview-deploy.tar.gz`
- Runtime compose file: `docker-compose.runtime.yml`

## Guardrails

- Never run the full `backend/scripts/sql/init.sql` against an existing server database; it drops and recreates tables.
- Only run idempotent migrations or user-approved data changes.
- Do not commit or upload real API keys, passwords, cookies, or tokens.
- If database schema changes beyond `ai_config`, inspect the diff and add a safe migration before deploying.
- If the script fails after upload but before restart, inspect remote container logs before retrying blindly.
