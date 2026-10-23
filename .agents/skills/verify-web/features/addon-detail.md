# Addon detail

`/addons/<id>` shows one addon: name, author, latest version, description, version history, details (type, id, version, listed date), maintainers and an `Install` button that copies the manifest URL.

## Sub-features

- `detail-render` shows the heading, `Version History` with `Latest`, `Details` and `Maintainers` (owner marked `Owner`).
- `detail-install` copies the CDN manifest URL and toasts `Install link copied`.
- `detail-missing` shows a not-found state for an unknown id.

## How to get to it (user POV)

- Click an addon card's name on `/plugins`, `/themes` or the home page.
- Open `/addons/verify.hello` directly.

## Driving it with preview tools

Preconditions: a fresh seed.

- **Render.** `preview_open` `<URL>/addons/verify.hello`. Body text contains `Verify Hello`, `by Verify Developer · v1.0.0`, `Version History`, `Latest` and `Owner`.
- **Install link.** `preview_click` `role=button[name='Install']`. A toast reads `Install link copied`. The link should be `<CDN_URL>/addons/verify.hello/1.0.0/manifest.json`, and a `curl` of it returns 200 with the manifest.
- **Unknown id.** Open `/addons/does.not.exist` and record what renders.

## Gotchas

- The clipboard write can fail in the preview browser. The page then shows an error toast, which is a real result to report, not a reason to skip.
- Install is not yet driven. Record the first real run here.
