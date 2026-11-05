# Metro in brief

Discord's JS is thousands of numbered Metro modules; the numbers change every build. Find a module by what it exports, never by id.

- **Reuse before searching**: `metro.api`, `metro.common`, `metro.stores`, `metro.components`, then `flux.getStore('User')` for stores.
- **Use the named finders**: `findByProps('a', 'b')` (two or three names only that module has), `findByName` (components, classes), `findByFilePath` (stable source path, best for components), `findByPrototypes` (classes). Write a custom filter with `metro.filters` only when none fits.
- **Lookups are lazy**: they return a stand-in and search on first read. Reading a property, passing the stand-in to a function that reads it, or `{ all: true }` loads the module; do that inside functions, never at file top or in `start`.
- **Ask without loading**: `getModulePresence(handle)`, `getLoadedModule(handle)`.
- **Try it live first**: `ubd modules <regex>` lists matches and whether they loaded; `ubd eval "unbound.metro.findByProps('a', 'b', { lazy: false })"` confirms one ([probe.md](probe.md)).

Full reference: `docs/developer/plugins/metro.mdx` (https://unbound.rip/docs/developer/plugins/metro). To change what the module does, use [patching.md](patching.md).
