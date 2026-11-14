# Changelog

## [2.4.0](https://github.com/marioparaschiv/unbound/compare/contracts-v2.3.0...contracts-v2.4.0) (2026-11-14)


### Features

* **client:** send native crashes with opt-in crash reports ([#1403](https://github.com/marioparaschiv/unbound/issues/1403)) ([c3b7f91](https://github.com/marioparaschiv/unbound/commit/c3b7f916ce070ffa1d64e0860ab5dae2f5660396))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.4.0

## [2.3.0](https://github.com/marioparaschiv/unbound/compare/contracts-v2.2.0...contracts-v2.3.0) (2026-11-14)


### Features

* **client:** report gateway health in /debug ([#1395](https://github.com/marioparaschiv/unbound/issues/1395)) ([b7abfc8](https://github.com/marioparaschiv/unbound/commit/b7abfc89a9817c554c23b9bc7e232e635b66da0a))
* **client:** report power, clock, DNS and notifications in /debug ([#1393](https://github.com/marioparaschiv/unbound/issues/1393)) ([1a9227f](https://github.com/marioparaschiv/unbound/commit/1a9227fa96802e73efd2293ec850db477f2355a4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.3.0

## [2.2.0](https://github.com/marioparaschiv/unbound/compare/contracts-v2.1.0...contracts-v2.2.0) (2026-11-14)


### Features

* **client:** add Discord experiments to /debug ([#1237](https://github.com/marioparaschiv/unbound/issues/1237)) ([d2f4622](https://github.com/marioparaschiv/unbound/commit/d2f46220f9034b50ee0568e2447b5ad9a9ae60f5))
* **client:** add errors, log, storage and patches to /debug ([#1163](https://github.com/marioparaschiv/unbound/issues/1163)) ([1cc9625](https://github.com/marioparaschiv/unbound/commit/1cc9625ccecde514a8923d57e66e2e17fd19a339))
* **client:** add network context to /debug ([#1204](https://github.com/marioparaschiv/unbound/issues/1204)) ([6fc2287](https://github.com/marioparaschiv/unbound/commit/6fc22878df442f8c0e7b0e8712cad1da3c6b1280))
* **client:** add plugin versions, display and session to /debug ([#1175](https://github.com/marioparaschiv/unbound/issues/1175)) ([8ece009](https://github.com/marioparaschiv/unbound/commit/8ece009861b7ad241ab3feb9753fd63417e228cd))
* **client:** list other tweaks loaded into Discord in /debug ([#1250](https://github.com/marioparaschiv/unbound/issues/1250)) ([dd8c109](https://github.com/marioparaschiv/unbound/commit/dd8c1091d6d94c7776b1d2b2477df47694f91493))
* **client:** move installs of renamed addons to their replacement ([#1281](https://github.com/marioparaschiv/unbound/issues/1281)) ([39a3d4b](https://github.com/marioparaschiv/unbound/commit/39a3d4b7c3882f1b3c1f1fa5ef3795217a6387fa))
* **client:** report missing app extensions in /debug ([#1355](https://github.com/marioparaschiv/unbound/issues/1355)) ([a64b857](https://github.com/marioparaschiv/unbound/commit/a64b857dce2a8d6444c9514af99bdd0988f8c4a0))
* **client:** show addon updates waiting in /debug ([#1251](https://github.com/marioparaschiv/unbound/issues/1251)) ([6d11933](https://github.com/marioparaschiv/unbound/commit/6d11933f2cdaf3f1e3fc4ac041b925828249eec0))
* **client:** sort the marketplace by newest and badge new addons ([#1205](https://github.com/marioparaschiv/unbound/issues/1205)) ([9205847](https://github.com/marioparaschiv/unbound/commit/920584795d56cb98baca8f9b48b48875739a2aaa))
* **devtools:** build for Intel Macs ([#1385](https://github.com/marioparaschiv/unbound/issues/1385)) ([9d928ea](https://github.com/marioparaschiv/unbound/commit/9d928ea3cb9ffc3611add9ae9db66db96d23c89d))
* **devtools:** update the app in place and list its downloads ([#1325](https://github.com/marioparaschiv/unbound/issues/1325)) ([0848279](https://github.com/marioparaschiv/unbound/commit/084827906167b0991b86104dfa376b244e4e238f))
* **discord-bot:** diagnose notifications from /debug reports ([#1197](https://github.com/marioparaschiv/unbound/issues/1197)) ([2d540e1](https://github.com/marioparaschiv/unbound/commit/2d540e1e98dc53fe9181ed47470a07d10a3613ae))
* **loader:** report MetricKit hangs and system kills in /debug ([#1271](https://github.com/marioparaschiv/unbound/issues/1271)) ([8a8137a](https://github.com/marioparaschiv/unbound/commit/8a8137ab67e52076ef105555308a6b79bb342f23))
* **loader:** report signer, binary, re-sign, device and HTTPS facts ([#1274](https://github.com/marioparaschiv/unbound/issues/1274)) ([4bb2629](https://github.com/marioparaschiv/unbound/commit/4bb2629210d6cfb5fcd9defdbb89c52fc3178cf7))
* **loader:** report update checks, bundle source and settings ([#1162](https://github.com/marioparaschiv/unbound/issues/1162)) ([fdbe58d](https://github.com/marioparaschiv/unbound/commit/fdbe58da281df988197c52f0f560bc428d8478fd))
* **loader:** skip failed builds, report crashes and pressure ([#1158](https://github.com/marioparaschiv/unbound/issues/1158)) ([dd7f6dd](https://github.com/marioparaschiv/unbound/commit/dd7f6ddc44ede8e26c5cbeeb8d07faac8c4c7d3f))
* **web:** allow badges per sponsor tier ([#1168](https://github.com/marioparaschiv/unbound/issues/1168)) ([f93e012](https://github.com/marioparaschiv/unbound/commit/f93e01205034df265379d7aa82a75cbb30f9b348))
* **web:** mark scanned Discord builds and updates on /debug ([#1160](https://github.com/marioparaschiv/unbound/issues/1160)) ([b9344cd](https://github.com/marioparaschiv/unbound/commit/b9344cdb12ed71f19603069007a6cd76d290502d))
* **web:** show the Featured shelf atop the addon listings ([#1339](https://github.com/marioparaschiv/unbound/issues/1339)) ([117e6f2](https://github.com/marioparaschiv/unbound/commit/117e6f26825b2a96f597efdb91270b6c4d25a2db))


### Bug Fixes

* **plugins:** draw every ADDON.md page icon and flag unknown ones ([#1335](https://github.com/marioparaschiv/unbound/issues/1335)) ([cc6642c](https://github.com/marioparaschiv/unbound/commit/cc6642c50ecb6167dd9defbbdb551859526e2a5e))
* **web:** show sponsorships GitHub is still processing ([#1379](https://github.com/marioparaschiv/unbound/issues/1379)) ([380900b](https://github.com/marioparaschiv/unbound/commit/380900b8642c382402bd4d059290b893a13d6938))
* **web:** tidy tweak names and seconds on the debug card ([#1358](https://github.com/marioparaschiv/unbound/issues/1358)) ([c1eba58](https://github.com/marioparaschiv/unbound/commit/c1eba58b0dd65814e852c0c6b61366f4546f90c1))
* **web:** wrap /debug rows and tighten the environment rows ([#1275](https://github.com/marioparaschiv/unbound/issues/1275)) ([5dbf2db](https://github.com/marioparaschiv/unbound/commit/5dbf2db8edb1b6766a165fa4c5521340a6d6e868))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.2.0

## [2.1.0](https://github.com/marioparaschiv/unbound/compare/contracts-v2.0.0...contracts-v2.1.0) (2026-11-12)


### Features

* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **web:** render /debug cards on the server ([#1151](https://github.com/marioparaschiv/unbound/issues/1151)) ([6e39c74](https://github.com/marioparaschiv/unbound/commit/6e39c74b8c4bf68578b1a45c9cdb13054c5d4569))


### Continuous Integration

* **client:** one bundle channel, gated on a released loader ([#1137](https://github.com/marioparaschiv/unbound/issues/1137)) ([5e7efe3](https://github.com/marioparaschiv/unbound/commit/5e7efe37934f314788dcbb4b5f6c140ded00ec0b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.1.0

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/contracts-v1.1.1...contracts-v2.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Bug Fixes

* **web:** never overwrite a published addon version's files ([#1109](https://github.com/marioparaschiv/unbound/issues/1109)) ([ab09d06](https://github.com/marioparaschiv/unbound/commit/ab09d06f1e65d5effec6b2ba0d2befc81463f372))


### Code Refactoring

* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.0.0

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/contracts-v1.1.0...contracts-v1.1.1) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.15.0

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/contracts-v1.0.0...contracts-v1.1.0) (2026-11-11)


### Features

* **client:** draw settings-kit rows with Discord's built-ins ([#1084](https://github.com/marioparaschiv/unbound/issues/1084)) ([cb3b9e2](https://github.com/marioparaschiv/unbound/commit/cb3b9e285094a1f55d4eb75ed8e19826e61758fa))
* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.14.0

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.14.1...contracts-v1.0.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* count anonymous addon installs, sort by popularity ([#1066](https://github.com/marioparaschiv/unbound/issues/1066)) ([9a9f188](https://github.com/marioparaschiv/unbound/commit/9a9f1887a7979f6a6275c678dd677c0a04f7daf5))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))

## [0.14.1](https://github.com/marioparaschiv/unbound/compare/contracts-v0.14.0...contracts-v0.14.1) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.13.1

## [0.14.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.13.0...contracts-v0.14.0) (2026-11-09)


### Features

* **client:** filter the marketplace by tags ([#1014](https://github.com/marioparaschiv/unbound/issues/1014)) ([d822616](https://github.com/marioparaschiv/unbound/commit/d822616424f95ded34a33e4b3150f9cb38b2d648))
* **client:** redesign the addon store page ([#1016](https://github.com/marioparaschiv/unbound/issues/1016)) ([8c72fe5](https://github.com/marioparaschiv/unbound/commit/8c72fe5114c80c1178c02bf3f81928ed70870a49))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.13.0

## [0.13.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.12.0...contracts-v0.13.0) (2026-11-05)


### Features

* **client:** move fonts to a native font store with presets ([#969](https://github.com/marioparaschiv/unbound/issues/969)) ([40ff081](https://github.com/marioparaschiv/unbound/commit/40ff081f49917861523acf3e0a1ad0e8b6ec14f0))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **cli:** generate platforms and Capabilities in ubd build ([#729](https://github.com/marioparaschiv/unbound/issues/729)) ([7deb4b2](https://github.com/marioparaschiv/unbound/commit/7deb4b23cb810fa7643557613ed4d763aded3b5f))
* **cli:** measure ADDON.md media in ubd build ([#704](https://github.com/marioparaschiv/unbound/issues/704)) ([efe25d9](https://github.com/marioparaschiv/unbound/commit/efe25d92051183c8d39f4847ac71264e3702961e))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** validate addon naming, Capabilities and layout ([#699](https://github.com/marioparaschiv/unbound/issues/699)) ([a8f2704](https://github.com/marioparaschiv/unbound/commit/a8f2704b743e08a306607bd18d5717756edf09b4))
* **contracts:** add the ADDON.md page contract ([#687](https://github.com/marioparaschiv/unbound/issues/687)) ([16339c6](https://github.com/marioparaschiv/unbound/commit/16339c633867fb185a7fdf2e686824427af0b369))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **discord-bot:** v2 addon cards with gallery and author avatars ([#871](https://github.com/marioparaschiv/unbound/issues/871)) ([444fe85](https://github.com/marioparaschiv/unbound/commit/444fe854746bc7e5a0b654e0ad17ffaecb8f7bc5))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* require a minimum loader version per bundle ([#962](https://github.com/marioparaschiv/unbound/issues/962)) ([840bcfa](https://github.com/marioparaschiv/unbound/commit/840bcfa3912c370623fad8b7e810af46e5598d8f))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))
* **web,cli:** read the built manifest for publish and ubd dev ([#696](https://github.com/marioparaschiv/unbound/issues/696)) ([f417abc](https://github.com/marioparaschiv/unbound/commit/f417abc0d88f19f2144dc9a2dc5b7f8dde9b7cdd))
* **web:** allow animated GIF sponsor badges ([#912](https://github.com/marioparaschiv/unbound/issues/912)) ([77e53df](https://github.com/marioparaschiv/unbound/commit/77e53dfd28b6cc37ab7ae79996eeaef58f03ed48))
* **web:** catalog versions carry their store page URL ([#718](https://github.com/marioparaschiv/unbound/issues/718)) ([5f1f0f3](https://github.com/marioparaschiv/unbound/commit/5f1f0f31402ce2b4d9890f63a55b454f410f2d2e))
* **web:** draw :name: icon shortcodes on addon store pages ([#872](https://github.com/marioparaschiv/unbound/issues/872)) ([9d3e3f5](https://github.com/marioparaschiv/unbound/commit/9d3e3f54d096cbba4b47b9c0984e494465d7b179))
* **web:** read the measured ADDON.md page on submission ([#706](https://github.com/marioparaschiv/unbound/issues/706)) ([29627b6](https://github.com/marioparaschiv/unbound/commit/29627b6b13831e2ab949a4cfa6216f51b20ff096))
* **web:** redesign the GitHub submit flow ([#715](https://github.com/marioparaschiv/unbound/issues/715)) ([d582e06](https://github.com/marioparaschiv/unbound/commit/d582e067b9fb5839e6503e686e4e36b38744d7da))
* **web:** sponsor badges as PNGs, $5 tier and profile perks ([#809](https://github.com/marioparaschiv/unbound/issues/809)) ([c19e946](https://github.com/marioparaschiv/unbound/commit/c19e94652620ad34cb09a6c21aa91247914380a9))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **web:** limit emails to the dev team and block role escalation ([#765](https://github.com/marioparaschiv/unbound/issues/765)) ([137cc50](https://github.com/marioparaschiv/unbound/commit/137cc50253533181a22c9d1a5066b094288ec667))
* **web:** list a user's badges by their Discord id ([#913](https://github.com/marioparaschiv/unbound/issues/913)) ([28bb3a4](https://github.com/marioparaschiv/unbound/commit/28bb3a471d259e9c446beb9c54096aa1ae4551dc))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.12.0

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.11.0...contracts-v0.12.0) (2026-10-31)


### Features

* choose and downgrade addon versions from the marketplace ([#443](https://github.com/marioparaschiv/unbound/issues/443)) ([7190ac2](https://github.com/marioparaschiv/unbound/commit/7190ac2e53ecb0d49976898dee8c61bf19705ae3))
* report the verified build on both platforms ([#499](https://github.com/marioparaschiv/unbound/issues/499)) ([eda9405](https://github.com/marioparaschiv/unbound/commit/eda9405ec5a3ed911aecbe4c34be67b24537d8ca))
* **web:** redesign addon pages and let maintainers pick a website icon ([#444](https://github.com/marioparaschiv/unbound/issues/444)) ([b61e42b](https://github.com/marioparaschiv/unbound/commit/b61e42bd1166479927229b9d136247558b2fa874))
* **web:** redesign the staff area and let staff set addon icons ([#447](https://github.com/marioparaschiv/unbound/issues/447)) ([f9f764f](https://github.com/marioparaschiv/unbound/commit/f9f764f78213c53d785208ced8351ad513dc7851))


### Bug Fixes

* use one link scheme across the loader, client and site ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))


### Documentation

* match the Android install steps to the release assets ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))


### Tests

* remove tautological tests and stop pinning brittle details ([#437](https://github.com/marioparaschiv/unbound/issues/437)) ([b69ca6c](https://github.com/marioparaschiv/unbound/commit/b69ca6c97c6470ac6cb1b0fa515c6e2f79639ba7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.11.0

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.10.0...contracts-v0.11.0) (2026-10-29)


### Features

* **client:** attach scrubbed log lines to crash reports ([0f0868f](https://github.com/marioparaschiv/unbound/commit/0f0868f0657432a977a23454ba8e6225c8ccf955))
* **client:** attach scrubbed log lines to crash reports ([0733cbf](https://github.com/marioparaschiv/unbound/commit/0733cbfcd59321d8faf417367c973ecef1ff0ae2))
* **client:** hide library plugins and handle their dependents ([b24d755](https://github.com/marioparaschiv/unbound/commit/b24d755b49765190412936e0e365b04b70d0b02e))
* **client:** hide library plugins and handle their dependents ([4bf9fb5](https://github.com/marioparaschiv/unbound/commit/4bf9fb53581334a42e227a7ed20f2b9b34948325))
* **client:** send opt-in crash reports to the API ([311f957](https://github.com/marioparaschiv/unbound/commit/311f957b1172343e1474813ddc73cacbd6f6de50))
* **client:** send opt-in crash reports to the API ([9f10514](https://github.com/marioparaschiv/unbound/commit/9f10514fe9248fef7ed735b344537e02ed1f0afe))
* **discord-bot:** react to unbound.rip through Postgres triggers, delete the bot feed ([5309aa4](https://github.com/marioparaschiv/unbound/commit/5309aa431de558b29a89387c610dfe51894bf421))
* **discord-bot:** read the web's tables, woken by triggers on them ([7966354](https://github.com/marioparaschiv/unbound/commit/7966354cce30d3a58866cb8346186921a3a2e6ab))
* **discord-bot:** turn on the audit log, compact embeds, export to OpenTelemetry ([#250](https://github.com/marioparaschiv/unbound/issues/250)) ([ba42953](https://github.com/marioparaschiv/unbound/commit/ba42953697e2baef38a973ae8aa644047e828c97))
* hand off addon installs from the website through unbound:// ([#332](https://github.com/marioparaschiv/unbound/issues/332)) ([2c1e4d3](https://github.com/marioparaschiv/unbound/commit/2c1e4d384cac3e061d05e5c61756b8dacd408733))
* **plugins:** republish rebuilt plugins with bytecode ([fbd653e](https://github.com/marioparaschiv/unbound/commit/fbd653e311392eb6b691bbbf4878b0c41da7ee2f))
* **plugins:** republish rebuilt plugins with bytecode ([2574b6b](https://github.com/marioparaschiv/unbound/commit/2574b6b5b028b413a6d249fa20ab257ff1729cd3))
* **plugins:** ship plugins as Hermes bytecode for each runtime ([43da3e0](https://github.com/marioparaschiv/unbound/commit/43da3e045b00e316dd3a9682337ef2e7ad0fc6ae))
* **plugins:** ship plugins as Hermes bytecode for each runtime ([46b5422](https://github.com/marioparaschiv/unbound/commit/46b542200c3c95f369b92f3e692d5e178d2d4f3e))
* **web:** filter /plugins and /themes by tag, author and update date ([#414](https://github.com/marioparaschiv/unbound/issues/414)) ([f5b4703](https://github.com/marioparaschiv/unbound/commit/f5b4703c2da2843387a716b8f50cbd55e2e1d0a9))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))


### Bug Fixes

* **client:** keep installed addon files inside their folder ([#348](https://github.com/marioparaschiv/unbound/issues/348)) ([e102008](https://github.com/marioparaschiv/unbound/commit/e1020086f8b02ebbcc044500efd760151900bd65))
* **web:** refuse NUL in text bound for Postgres ([d2156fa](https://github.com/marioparaschiv/unbound/commit/d2156fa0adf71a58f12d40327981deb3945f4844))


### Code Refactoring

* **web:** refuse text Postgres cannot store once per boundary ([5915ffa](https://github.com/marioparaschiv/unbound/commit/5915ffae5be5b7d499c50c6baef72e8d71906dab))


### Styles

* **web:** sort imports and satisfy oxlint in the fix round ([b3b7a6d](https://github.com/marioparaschiv/unbound/commit/b3b7a6d21ddaea6fde0dfb46e8450fc201908a88))
* **web:** sort imports and shorten a comment from the fix round ([a45c158](https://github.com/marioparaschiv/unbound/commit/a45c15866016414c1b4c4594f4ff50fe86d149f7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.10.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.9.0...contracts-v0.10.0) (2026-10-25)


### Features

* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **contracts:** add repository listing and preview schemas ([85f169b](https://github.com/marioparaschiv/unbound/commit/85f169bb715a5d71356627b916b68794aecaafa5))
* **contracts:** add shared workspace discovery rules ([33531c2](https://github.com/marioparaschiv/unbound/commit/33531c2634092e1cf3dc3a48badce1ce4fc27301))
* **contracts:** add source pin and repository details schemas ([8249648](https://github.com/marioparaschiv/unbound/commit/82496486be8642d240ef7630b536cefe98ec9add))
* **contracts:** add the CHANGELOG.md parser and changelog schemas ([672df3d](https://github.com/marioparaschiv/unbound/commit/672df3d3649e0639e175a64dfb87a95d279d0f68))
* **contracts:** create submissions from a pinned GitHub source ([2882363](https://github.com/marioparaschiv/unbound/commit/288236321cbdcf1b7bf0399511306e8c0260b64d))
* **web:** add admin addon and user pages with review history ([642b31b](https://github.com/marioparaschiv/unbound/commit/642b31bbbcd24c58676f3c96a7e7734222ebc2c0))
* **web:** add GitHub Sponsors with a custom badge perk ([#190](https://github.com/marioparaschiv/unbound/issues/190)) ([85ad012](https://github.com/marioparaschiv/unbound/commit/85ad012ce92f128c025c0d7be0ae13c64e7bd2c3))
* **web:** add staff notes on users and addons ([6888d66](https://github.com/marioparaschiv/unbound/commit/6888d66e5da005bb589678a62c9c1f195802841c))
* **web:** add the moderation event log ([9350597](https://github.com/marioparaschiv/unbound/commit/9350597082194348aa948aec97847121f300c2d7))
* **web:** edit addons as staff with pinned summary fields ([d4555fb](https://github.com/marioparaschiv/unbound/commit/d4555fbf506ae697763036b3d48bc8434d40fb6a))
* **web:** edit addons as staff with TanStack Form ([44f3f6b](https://github.com/marioparaschiv/unbound/commit/44f3f6bb311802478ca370618a794d30922c203f))
* **web:** filter admin addons by type, status, maintainer and date ([e708728](https://github.com/marioparaschiv/unbound/commit/e708728db8ca0d04963317b8c9a5472742107b61))
* **web:** filter admin addons by type, status, maintainer and date ([7ba0fe5](https://github.com/marioparaschiv/unbound/commit/7ba0fe5aa30e8d1afdad5dd592944dfa207890df))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** keyset-page and search the admin users and addons lists ([4309629](https://github.com/marioparaschiv/unbound/commit/4309629c55e6883fcdd1483ea147f27aa0ffbaf4))
* **web:** keyset-page and search the admin users and addons lists ([1e6b7db](https://github.com/marioparaschiv/unbound/commit/1e6b7dbb4720019115be1d9e16fddbbb5df42206))
* **web:** load the admin addon and user views ([13d32d3](https://github.com/marioparaschiv/unbound/commit/13d32d34df5af2db6113d30dc791d4a03dfa4bbd))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read and write staff notes through server functions ([7b2c219](https://github.com/marioparaschiv/unbound/commit/7b2c2196ebba222fda9a4bec999202b64ccea9f1))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** record moderation events for addon actions and reviews ([a3c861c](https://github.com/marioparaschiv/unbound/commit/a3c861c44068e2c8a25d59f2a068663ce48b2d46))
* **web:** roll an addon back to any approved version ([799bbf9](https://github.com/marioparaschiv/unbound/commit/799bbf93dbdddb1f45dba47fdd7bf3dca8869389))
* **web:** roll an addon back to any approved version ([cc7906e](https://github.com/marioparaschiv/unbound/commit/cc7906e159daa38165da5b4e453275cf7dd30172))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))


### Bug Fixes

* **contracts:** import repositorySchema from source in admin ([465e77e](https://github.com/marioparaschiv/unbound/commit/465e77e41484a86b90943d7e2ee5ac555cd1ed4a))
* **web:** keep catalogs stored before the listing name still parseable ([93cb8b2](https://github.com/marioparaschiv/unbound/commit/93cb8b2f5ad497bb0bf281ace914ba142f7b3c2a))
* **web:** keep catalogs stored before the listing name still parseable ([1db2a60](https://github.com/marioparaschiv/unbound/commit/1db2a60b23bf76c0f29700a761f9ce2149b8f388))


### Code Refactoring

* **contracts:** give loader updates their own changelog entry ([2542bcc](https://github.com/marioparaschiv/unbound/commit/2542bcc67abacf2b331048d67371929425e7d649))
* **contracts:** name the parser's invalid states and the root check ([f795b5a](https://github.com/marioparaschiv/unbound/commit/f795b5a36eff7675713ab2a9d55af24c62a91e54))
* **web:** trim admin comments and share the search length limits ([46db19b](https://github.com/marioparaschiv/unbound/commit/46db19bdd0f220e6bef5783294e0086e6146d060))


### Styles

* **contracts:** sort admin imports ([cc8efcb](https://github.com/marioparaschiv/unbound/commit/cc8efcb0b8862ae29704e55ea97d72b824961225))
* sort imports and shorten script header comments ([d159f61](https://github.com/marioparaschiv/unbound/commit/d159f613a19f0c1eec0095f2283824e758c7a15b))
* **web:** sort imports ([7a933e2](https://github.com/marioparaschiv/unbound/commit/7a933e26b00a895ea9fcd1551066e913fba34c88))
* **web:** sort imports and exports ([3d297f5](https://github.com/marioparaschiv/unbound/commit/3d297f511aba79a490328a7033d00d6d25cdac6c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.9.0
