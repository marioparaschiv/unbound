# Browse addons

Anyone, signed in or not, can list approved addons on the home page, `/plugins` and `/themes`, search, filter and sort them, and open one.

## Sub-features

- `browse-list` shows each approved addon on `/plugins` or `/themes` as a card with name, author, version, description and an `Install` button.
- `browse-search` filters by the `Search Plugins...` input (`Search Themes...` on `/themes`).
- `browse-filter` uses the `Filter` button (or the F key) for Tags (any, all, none of), Author (is, is not) and Updated (within, not within). Each filter is a chip and lives in the URL: `tags`, `tagMatch`, `authors` (Discord ids), `authorMatch`, `updated` (days) and `updatedMatch`.
- `browse-sort` uses the sort menu, labelled with the current sort: Name, Release Date or Recently Updated.
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
- **Filter.** Launch with `--tags` for 8 tags, and 14 plugins and 4 themes by 16 authors (ids from `100000000000000100`). Press F, Enter on Tags, click a tag. The URL gains `tags=<id>` and only tagged cards remain. Cross-check against `addon_tag` in a read-only session. Typing at the top of the menu searches authors on the server. The Author list pages 12 at a time.
- **Phone.** At 390px the Filter and sort menus open as bottom sheets with a `Done` button.

## Gotchas

- Without `--tags` the seed has no themes, so `/themes` shows its empty state.
- A view swap in the filter menu crossfades, so two `listbox` elements exist for about 300 ms. Wait for one before you read rows.
- The Author list loads its next page 160px before its end, so 12 rows fit and the second page arrives at once.
- Developers is not yet driven. Record the first real run here.
