# Screen input

`scripts/vphone <action> k=v ...`. The screen is 430x932 points. Prefer `ui` (the accessibility tree, fast) to a screenshot for finding things.

- **Press React Native views** with `swipe x1=X y1=Y x2=X y2=Y ms=150`. Inside tab pages use an exact zero-move press; elsewhere `x2 = x1 + 1` also works. A floating view (a FAB) that ignores it may take `tap`. `tap_text` reaches only native UIKit views such as alerts.
- **Wait, then look.** `wait text=<t>` (or `gone=true`) before a screenshot; `vphone shot <file> --wait <t>` does both. `wait` can match off-screen nodes: check the returned `frame`. A miss is an error `element wait timed out`.
- **Take coordinates from `ui`.** A label can be the caption beside an input: check its frame.
- **Type one character per call**; a fast `type` drops characters. Check the field afterwards.
- `-25215` right after a launch means retry; `relaunch` and `shot --wait` already do.
