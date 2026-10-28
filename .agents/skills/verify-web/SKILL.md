---
name: verify-web
description: Boot and drive apps/web (the unbound.rip addon site and its /api/v1 API) locally, signed in as any role, with a throwaway DB and a local MinIO. Use when proving a change to apps/web pages, endpoints, submissions, review or auth, or whenever you would otherwise hand-roll a vite dev boot with env vars.
---

# Verify apps/web

One command boots a disposable instance from this checkout. It writes a fake env, creates a fresh Postgres database, starts a MinIO container, a fake GitHub and a fake Discord, migrates, seeds one session per role, and serves vite in its own tmux session. Scripts live in `scripts/` next to this file and run from any directory. Never point them at production. They only touch `/tmp/verify-web/<name>/`, the database `unbound_web_verify_<name>`, their own tmux session and their own container.

The database lives on the local cluster that `DATABASE_DIRECT_URL` in `apps/web/.env` names (role `unbound_web`, which has CREATEDB). `scripts/database.ts` creates it like the test helpers do (`TEMPLATE template0`, UTF8, libc `LOCALE 'C'`), and the app's `scripts/migrate.ts` migrates it. The instance's `DATABASE_URL` and `DATABASE_DIRECT_URL` are both the direct URL of that database. Skipping pgbouncer is fine for one local instance. Those URLs carry the cluster password, so they live only in `/tmp/verify-web/<name>/web.env` (mode 600). Never print or copy them into logs or evidence, or pass them as a command argument. Each launch drops the `unbound_web_verify_*` databases of instances that have neither a state dir nor a tmux session left.

## Launch

```bash
.agents/skills/verify-web/scripts/launch.sh            # [--name N] [--port N] [--no-s3]
```

It is ready when it prints `ready: http://verify-web-<name>.localhost:<port>`, after `GET /` returned 200 and the doctor passed. The boot takes about 10 s. Re-running it while the instance is healthy only prints the URL. If the instance is unhealthy, it tears it down and boots fresh. A failed boot tears itself down and keeps the vite log at `/tmp/verify-web/<name>.failed.log`.

`--name` isolates parallel runs. Each name gets its own port (first free port from 4310), database, container and hostname. `--no-s3` skips MinIO. Browse still works, but submit and approve fail.

Seed data (`scripts/seed.ts`):

| Thing              | Value                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users              | `Verify User` (user), `Verify Developer` (developer), `Verify Moderator` (moderator), `Verify Admin` (admin), `Verify Ci` (ci, the account CI's API key belongs to). Each has a Discord account dated 2020, so the 30-day account-age gate passes, and a linked GitHub account that can push to `verify/addons`.                |
| Fake GitHub        | `scripts/fake-github.ts` in the instance's tmux session (window `github`) serves `verify/addons`: a workspace with `plugins/verify.new` 0.1.0, `plugins/verify.hello` 1.1.0 and `plugins/verify.broken` (bundle not committed), tag `v1`. `GITHUB_API_URL` points at it.                                                        |
| First party        | `FIRST_PARTY_REPOSITORY` is `verify/first-party` on the fake GitHub: `plugins/verify.first` 0.1.0, with its build on a commit only the tag `plugin-builds/<main sha>` reaches. `github.log` prints the line `first-party build: {…}`, which is the publish request body.                                                        |
| Fake Discord       | `scripts/fake-discord.ts` (window `discord`) serves `GET /guilds/950850315601711176/members` and `/users/{id}`; `DISCORD_API_URL` points at it and the five `DISCORD_*_ROLE_ID` vars name its roles. `scripts/team.ts` holds the members.                                                                                       |
| Team               | The team sync runs at boot: `Verify Admin` holds Admin (site `admin`), `Verify Moderator` holds Staff (site `moderator`), `Dev Lead` and `Dev Second` hold Development Team, `Staff Only` holds Staff, and 25 `Contributor NN` hold Contributor. With `verify.hello`'s credited author that is 31 people, two Team pages of 24. |
| Approved addon     | `verify.hello` 1.0.0, plugin, owned by Verify Developer. Its manifest and bundle are on the MinIO CDN.                                                                                                                                                                                                                          |
| Pending submission | `verify.pending` 0.1.0, new listing by Verify User, pinned to `verify/addons` (a seeded pin, not a real commit there). Its 1024-byte bundle is staged with a matching sha256, so Approve really publishes.                                                                                                                      |

## Sign in

No OAuth runs locally. The seed creates the session rows through Better Auth's internal adapter, the same way `apps/web/tests/helpers` does, and signs the cookie with the instance's secret.

```bash
scripts/session.sh moderator                 # preview_evaluate expression that sets the cookie and reloads
scripts/session.sh admin --field token       # bearer token for curl: -H "authorization: Bearer $T"
```

Roles: `user`, `developer`, `moderator`, `admin`, `ci`. To switch roles in a tab, run the other role's expression.

API keys for curl journeys:

- CI's first-party key: `curl -X POST $URL/api/auth/api-key/create -H "authorization: Bearer $(scripts/session.sh ci --field token)" -H 'content-type: application/json' -d '{"name":"ci"}'`. Send `key` as `x-api-key` to `/api/v1/first-party/addons` and `/api/v1/first-party/publish`.
- The bot's key: in `apps/web`, run `set -a; . /tmp/verify-web/<name>/web.env; set +a; bun run bot:mint-key`. It prints the key last. Send it as `x-api-key` to `/api/v1/bot/*`.

## Doctor

```bash
scripts/doctor.sh [--name N]
```

The doctor is read-only and exits 0 only when every line is `PASS`. It checks the tmux session and pid, that our process holds the port, that the instance serves this checkout, that its database exists, `GET /`, that `/api/v1/addons` lists `verify.hello`, that the admin bearer session is valid, that the fake GitHub serves `verify/addons` with push access, that the fake Discord lists the guild, and MinIO liveness. Run it first whenever anything looks off.

## Drive

Use T3's preview tools. Open with `reuseExistingTab: false` and pass the returned `tabId` on every call.

1. `preview_open` with `url: <URL>/login`.
2. `preview_evaluate` with the output of `scripts/session.sh <role>`.
3. Navigate with `preview_evaluate` `location.href='/review'`, or click links by accessible name.
4. Click with `preview_click` and a role locator, e.g. `role=button[name='Approve']`. Inside a dialog, use `role=dialog >> role=button[name='Approve']`.

Routes: `/`, `/plugins`, `/themes`, `/developers`, `/addons/<id>`, `/submit`, `/dashboard`, `/account`, `/review`, `/admin/users`, `/admin/addons`, `/login`, `/device`. The API lives at `/api/v1/*` and Better Auth at `/api/auth/*`. The [feature map](features/README.md) has per-journey recipes.

## Evidence

Write proofs to `/tmp/verify-web-evidence/` (or `/tmp/<task>-evidence/`). Teardown never touches either.

- Record with `preview_recording_start` and `preview_recording_stop`. Copy the returned mp4 path into the evidence dir.
- `preview_snapshot` with `save: true` returns a PNG path. Copy it too.
- Prove side effects with a second view. Read the DB in a read-only session. The subshell takes the connection from `PG*` variables, because a URL in psql's arguments shows its password in `ps`:

```bash
(eval "$(bun .agents/skills/verify-web/scripts/database.ts env default)"; PGOPTIONS='-c default_transaction_read_only=on' psql -c 'select addon_id,status from submission')
```

The CDN view is `curl http://$MINIO_ADDR/unbound-addons/addons/<id>/<version>/manifest.json`. `MINIO_ADDR` is in `/tmp/verify-web/<name>/instance.env`.

- Drive the real UI path. The seeded session replaces only the OAuth hop, so do not call endpoints to fake a click.

## Cleanup

```bash
scripts/teardown.sh [--name N]
```

Teardown kills the tmux session, the vite and fake GitHub pane pids and their children (matched by parent pid, never by name), stops the MinIO container, force-drops `unbound_web_verify_<name>` and deletes `/tmp/verify-web/<name>/`. Also close your tabs with `t3_preview_close`. Run teardown after every failed iteration as well.

## Gotchas

- **Local sign-in has no seam.** Discord OAuth cannot complete locally, and GitHub can only link to an existing account. The seeded cookie is the only local way in. "Continue with Discord" on `/login` goes to the real Discord and fails with the fake client id.
- **Cookies ignore ports.** On plain `localhost`, another app's `better-auth.session_token` silently replaces yours. That is why the URL is `verify-web-<name>.localhost`. Keep using that host.
- **Never stop vite with `pkill -f`.** The pattern matches your own shell. `bun --bun vite` runs vite as a `node` child of the tmux pane, so teardown kills by pid.
- **A tmux server you did not start keeps its own PATH.** launch.sh passes `PATH` explicitly. Copy that if you start anything else in tmux.
- **Discord decides staff roles.** The team sync reruns every `TEAM_SYNC_INTERVAL_SECONDS` (900) and sets `admin`/`moderator` from the fake guild, so a staff role set by hand on a seeded Discord-linked user reverts. Edit `scripts/team.ts` and relaunch to change the team.
- **Approval changes roles.** Approving a first listing promotes its author to `developer`. Relaunch (`teardown.sh && launch.sh`) for a clean seed.
- **Submitting reads the fake GitHub, never github.com.** The server reads `verify/addons` through `GITHUB_API_URL`, and links on `/submit` and `/review` point at github.com, where that repository does not exist. To submit something new, commit to the fake's git repository (its path is in `github.log`) and pick the new commit.
- **MinIO differs from B2.** MinIO honours headers that B2 rejects (e.g. `if-none-match` on PUT). A storage change proven here is not proven against production storage.
