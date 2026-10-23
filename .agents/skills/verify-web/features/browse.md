# Browse addons

Anyone, signed in or not, can list approved addons on the home page, `/plugins` and `/themes`, search them, sort them, and open one.

## Sub-features

- `browse-list` shows each approved addon on `/plugins` or `/themes` as a card with name, author, version, description and an `Install` button.
- `browse-search` filters by the `Search Plugins...` input (`Search Themes...` on `/themes`).
- `browse-sort` uses the `Sort` and `Asc` buttons.
- `browse-developers` lists developers at `/developers`.

## How to get to it (user POV)

- Use the header links `Plugins`, `Themes` and `Developers`.
- Open `/` and follow its links.

## Driving it with preview tools

Preconditions: a fresh seed. `verify.hello` is listed. `verify.pending` is listed only after a review-queue approval.

- **List.** `preview_open` `<URL>/plugins`. `main` contains the link `Verify Hello` with `by Verify Developer` and `v1.0.0`.
- **Search.** Type `hello` in the `Search Plugins...` input with `preview_type`. Only `Verify Hello` remains.
- **Open.** `preview_click` `role=link[name='Verify Hello']`. The URL becomes `/addons/verify.hello`.
- **API cross-check.** `curl <URL>/api/v1/addons` returns the same ids.

## Gotchas

- The seed has no themes, so `/themes` shows its empty state.
- Search, sort and developers are not yet driven. Record the first real run here.
