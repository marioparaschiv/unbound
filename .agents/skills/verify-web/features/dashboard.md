# Dashboard and staff gates

Signed-in users manage their addons at `/dashboard` and their linked accounts and API keys at `/account`. Staff pages are gated by role: moderators get `Review Queue` and `Users`, and admins also get `Addons`.

## Sub-features

- `gate-signed-out` sends a signed-out visit to `/dashboard`, `/submit`, `/review` or `/admin/*` to `/login` (`Sign in to Unbound`, `Continue with Discord`).
- `gate-role` sends a plain `user` from `/review` to `/`. The `Staff` sidebar lists only the sections a role grants.
- `dashboard-empty` shows `No Addons Yet` with `Submit Addon` for a user with nothing.
- `dashboard-owner` shows `verify.hello` with its maintainers and the `Your User ID` copy card for Verify Developer.
- `admin-users` and `admin-addons` list users and addons for staff, with ban, role, delist and transfer actions.

## How to get to it (user POV)

- Use the account menu (the header button with your name), then `Dashboard`, `Account` or the staff entries.
- Open the routes directly.

## Driving it with preview tools

Preconditions: a fresh seed.

- **Signed out.** In a new tab, open `<URL>/dashboard`. The URL becomes `/login`.
- **Owner dashboard.** Sign in as `developer` and open `/dashboard`. It shows `Verify Hello` and the `Your User ID` input.
- **Role gate.** Sign in as `user` and open `/review`. The URL becomes `/`. Sign in as `moderator`: the sidebar shows `Review Queue`, `Users` and `Addons`, as observed on 2026-10-23.
- **Admin users.** Sign in as `admin` and open `/admin/users`. All four `Verify *` users are listed.

## Gotchas

- Observed so far: the signed-out redirects and the moderator's empty dashboard (`No Addons Yet`). The rest is from source and has not yet been driven.
- `/account` lists linked accounts. Linking GitHub cannot complete locally.
