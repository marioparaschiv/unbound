# Public API names read through their namespace

The `unbound` API is used through namespaces (`toasts.show`, `flux.getStore`), as the VS Code and Chrome extension APIs are. Names follow clarity at the point of use: a bare verb when the namespace holds one kind of thing (`commands.register`, `patcher.after`); verb plus noun when it holds several kinds, or the target isn't the namespace's noun (`flux.onAction`, `fs.readFile`); `is`/`has` for booleans, `get` for lookups, `on` for events, `use` for hooks; and methods on an object are bare (`bucket.get`). Names the Discord-mod ecosystem already knows stay as they are (`findByProps`).

We rejected two alternatives. Verb-plus-noun names everywhere (`showToast`, `getFluxStore`) read well when imported alone, but they repeat the noun on every call. Bare verbs everywhere (`flux.store`, `sync.now`) lost meaning wherever a namespace holds more than one kind of thing.

Everything ships in one bundle, and plugins reach the API at runtime, so namespace access costs nothing in tree-shaking. Importing a single function on its own (`import { show } from '…/toasts'`) is not a supported style.
