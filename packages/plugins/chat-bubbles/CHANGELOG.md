# Changelog

## [1.6.6] - 2026-11-13

### Changed

- When a name and its tags leave no room for the time, the time hides instead of cutting tags off.

## [1.6.5] - 2026-11-12

### Fixed

- On iOS, bubbles stay around their message when row spacing moves it, instead of hanging below it or starting at the screen's edge.
- Tapping the avatar of a message whose reply is quoted inline opens the profile again.

## [1.6.4] - 2026-11-12

### Fixed

- On iOS, bubbles and the moved avatar line up with their message again instead of hanging below it or starting at the screen's edge.

## [1.6.3] - 2026-11-12

### Fixed

- On iOS, pinned messages and in-app notifications keep Discord's own look instead of losing their text.

## [1.6.2] - 2026-11-12

### Fixed

- On iOS, a long name with several tags is cut off before the time instead of running under it or out of the bubble.

## [1.6.1] - 2026-11-12

### Fixed

- On iOS, the bubble and avatar slide with the message when you swipe to reply instead of staying behind.

## [1.6.0] - 2026-11-12

### Added

- Messages in a row from the same author share one grouped bubble, with only the outer corners rounded, on iOS and Android.
- A tail points from the bubble beside the author's avatar.
- Cards such as embeds and attachments get padding around their content.
- Bubbles can blur the chat background behind them.
- Replies can be shown quoted inside the bubble or above it, in both layouts.
- eternal is listed as an author.

### Changed

- The settings are grouped, with a live chat preview at the top.
- Replies show a reply icon instead of the spine, lifted above cards.

## [1.5.4] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.5.3] - 2026-11-05

### Changed

- The settings screen's text can now be translated. The plugin works the same as before.

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
