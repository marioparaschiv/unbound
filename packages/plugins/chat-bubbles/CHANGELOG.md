# Changelog

## [1.5.2] - 2026-11-03

### Changed

- On iOS, each bubble is measured with about half as many native calls: the plugin reads a message in batched calls, draws its bubble in one pass on the UI thread, and remembers which cells sit inside other message cells until the cell moves to a different parent view. A reused cell is measured a second time only when its layout or text changed after the first measure, and a bubble that would come out the same is not drawn again.

## [1.5.1] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

## [1.5.0] - 2026-11-03

### Added

- A **Layout** setting. **Fit to message** keeps the bubbles that wrap each message's text and media, and stays the default. **Full-width cards** draws one rounded card behind each whole message, name, embeds and reactions included, reaching from the text column to the right edge like Rosiecord's Flowercord. The color, opacity and corner radius settings apply to both layouts.

### Fixed

- On Android, bubbles no longer jump to the left edge behind the avatars. Every row used to line up with the leftmost content edge any message row had reported, so one row laid out without the avatar gutter dragged every bubble on screen under the avatars. Each row now starts its bubble at its own text column.

## [1.4.7] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.4.6] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.4.5] - 2026-11-02

### Changed

- On Android, a row whose bubble is already known is handled on the UI thread alone; JavaScript only hears about rows that still need measuring, which halves the plugin's allocations while scrolling.

## [1.4.4] - 2026-11-01

### Fixed

- On iOS, a message measured before it finished laying out, such as a reply still loading its preview, no longer stays without a bubble: the plugin measures it again.

## [1.4.3] - 2026-11-01

### Changed

- Listens only to message rows laying out, so scrolling other lists no longer wakes the plugin.

## [1.4.2]

### Changed

- On Android, a row shown again for a message whose bubble is already drawn at the same size skips measuring it again, which roughly halves the plugin's JavaScript allocations while scrolling.

## [1.4.1]

### Fixed

- The plugin starts again on the current client, which no longer provides the old settings API.

## [1.4.0]

### Changed

- On Android, a message whose bubble was already measured gets its bubble the moment its row is bound, so bubbles no longer pop in when scrolling back over messages.

## [1.3.0]

### Changed

- On iOS, a message whose bubble was already measured gets its bubble in the same pass that lays it out, so bubbles no longer pop in when scrolling back over messages.

## [1.2.0]

### Changed

- On Android, a reused row gives back its own background on the UI thread as soon as it shows a different message, so the old bubble is never drawn behind it.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

## [1.1.0]

### Changed

- On iOS, message backgrounds are kept clear and a reused message's old bubble is hidden on the UI thread, in the same pass as Discord's change, so neither flashes while scrolling.

## [1.0.3]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS no longer stalls alongside other plugins: message and separator cells are kept transparent after UIKit sets their background, so UIKit never waits on JavaScript.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-29

### Added

- Initial release.
