# Changelog

## [2.3.0](https://github.com/marioparaschiv/unbound/compare/web-v2.2.0...web-v2.3.0) (2026-11-14)


### Features

* **client:** report gateway health in /debug ([#1395](https://github.com/marioparaschiv/unbound/issues/1395)) ([b7abfc8](https://github.com/marioparaschiv/unbound/commit/b7abfc89a9817c554c23b9bc7e232e635b66da0a))
* **client:** report power, clock, DNS and notifications in /debug ([#1393](https://github.com/marioparaschiv/unbound/issues/1393)) ([1a9227f](https://github.com/marioparaschiv/unbound/commit/1a9227fa96802e73efd2293ec850db477f2355a4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.3.0
    * @unbound-app/utils bumped to 1.0.3

## [2.2.0](https://github.com/marioparaschiv/unbound/compare/web-v2.1.0...web-v2.2.0) (2026-11-14)


### Features

* **client:** add Discord experiments to /debug ([#1237](https://github.com/marioparaschiv/unbound/issues/1237)) ([d2f4622](https://github.com/marioparaschiv/unbound/commit/d2f46220f9034b50ee0568e2447b5ad9a9ae60f5))
* **client:** add errors, log, storage and patches to /debug ([#1163](https://github.com/marioparaschiv/unbound/issues/1163)) ([1cc9625](https://github.com/marioparaschiv/unbound/commit/1cc9625ccecde514a8923d57e66e2e17fd19a339))
* **client:** add network context to /debug ([#1204](https://github.com/marioparaschiv/unbound/issues/1204)) ([6fc2287](https://github.com/marioparaschiv/unbound/commit/6fc22878df442f8c0e7b0e8712cad1da3c6b1280))
* **client:** add plugin versions, display and session to /debug ([#1175](https://github.com/marioparaschiv/unbound/issues/1175)) ([8ece009](https://github.com/marioparaschiv/unbound/commit/8ece009861b7ad241ab3feb9753fd63417e228cd))
* **client:** list other tweaks loaded into Discord in /debug ([#1250](https://github.com/marioparaschiv/unbound/issues/1250)) ([dd8c109](https://github.com/marioparaschiv/unbound/commit/dd8c1091d6d94c7776b1d2b2477df47694f91493))
* **client:** move installs of renamed addons to their replacement ([#1281](https://github.com/marioparaschiv/unbound/issues/1281)) ([39a3d4b](https://github.com/marioparaschiv/unbound/commit/39a3d4b7c3882f1b3c1f1fa5ef3795217a6387fa))
* **client:** open the store page from addon install links ([#1312](https://github.com/marioparaschiv/unbound/issues/1312)) ([1e34e63](https://github.com/marioparaschiv/unbound/commit/1e34e63a0fc664f808646b81d66fefba8b45f8b2))
* **client:** report missing app extensions in /debug ([#1355](https://github.com/marioparaschiv/unbound/issues/1355)) ([a64b857](https://github.com/marioparaschiv/unbound/commit/a64b857dce2a8d6444c9514af99bdd0988f8c4a0))
* **client:** show addon updates waiting in /debug ([#1251](https://github.com/marioparaschiv/unbound/issues/1251)) ([6d11933](https://github.com/marioparaschiv/unbound/commit/6d11933f2cdaf3f1e3fc4ac041b925828249eec0))
* **client:** sort the marketplace by newest and badge new addons ([#1205](https://github.com/marioparaschiv/unbound/issues/1205)) ([9205847](https://github.com/marioparaschiv/unbound/commit/920584795d56cb98baca8f9b48b48875739a2aaa))
* **devtools:** build for Intel Macs ([#1385](https://github.com/marioparaschiv/unbound/issues/1385)) ([9d928ea](https://github.com/marioparaschiv/unbound/commit/9d928ea3cb9ffc3611add9ae9db66db96d23c89d))
* **devtools:** ship macOS as an .app, explain updates on the install page ([#1337](https://github.com/marioparaschiv/unbound/issues/1337)) ([04bc525](https://github.com/marioparaschiv/unbound/commit/04bc5258661988a4d8601ff4ec41dc914c29f72b))
* **devtools:** update the app in place and list its downloads ([#1325](https://github.com/marioparaschiv/unbound/issues/1325)) ([0848279](https://github.com/marioparaschiv/unbound/commit/084827906167b0991b86104dfa376b244e4e238f))
* **discord-bot:** diagnose notifications from /debug reports ([#1197](https://github.com/marioparaschiv/unbound/issues/1197)) ([2d540e1](https://github.com/marioparaschiv/unbound/commit/2d540e1e98dc53fe9181ed47470a07d10a3613ae))
* **loader:** report signer, binary, re-sign, device and HTTPS facts ([#1274](https://github.com/marioparaschiv/unbound/issues/1274)) ([4bb2629](https://github.com/marioparaschiv/unbound/commit/4bb2629210d6cfb5fcd9defdbb89c52fc3178cf7))
* **loader:** report update checks, bundle source and settings ([#1162](https://github.com/marioparaschiv/unbound/issues/1162)) ([fdbe58d](https://github.com/marioparaschiv/unbound/commit/fdbe58da281df988197c52f0f560bc428d8478fd))
* **loader:** skip failed builds, report crashes and pressure ([#1158](https://github.com/marioparaschiv/unbound/issues/1158)) ([dd7f6dd](https://github.com/marioparaschiv/unbound/commit/dd7f6ddc44ede8e26c5cbeeb8d07faac8c4c7d3f))
* **web:** add load skeletons and infinite scroll to add-on pages ([#1177](https://github.com/marioparaschiv/unbound/issues/1177)) ([bd2478b](https://github.com/marioparaschiv/unbound/commit/bd2478bc56f204ced6c2ac4c2ecc32df750a51f4))
* **web:** allow badges per sponsor tier ([#1168](https://github.com/marioparaschiv/unbound/issues/1168)) ([f93e012](https://github.com/marioparaschiv/unbound/commit/f93e01205034df265379d7aa82a75cbb30f9b348))
* **web:** even DevTools download columns, shorter copy ([#1381](https://github.com/marioparaschiv/unbound/issues/1381)) ([12fc670](https://github.com/marioparaschiv/unbound/commit/12fc670c227cdd949d3f34183c415e971bfd5f71))
* **web:** give hide-unusable-expressions a website icon ([#1310](https://github.com/marioparaschiv/unbound/issues/1310)) ([5ed92f6](https://github.com/marioparaschiv/unbound/commit/5ed92f64f2806e45450dcb77d5d37c5d65056975))
* **web:** give the new first-party plugins website icons ([#1308](https://github.com/marioparaschiv/unbound/issues/1308)) ([897c51d](https://github.com/marioparaschiv/unbound/commit/897c51df88b85b72c5d4906f32ce9c76b387cb90))
* **web:** mark scanned Discord builds and updates on /debug ([#1160](https://github.com/marioparaschiv/unbound/issues/1160)) ([b9344cd](https://github.com/marioparaschiv/unbound/commit/b9344cdb12ed71f19603069007a6cd76d290502d))
* **web:** scroll the Featured shelf sideways with a slow drift ([#1387](https://github.com/marioparaschiv/unbound/issues/1387)) ([def4e24](https://github.com/marioparaschiv/unbound/commit/def4e244c8ad218bf3404e64a7c8c53bdb96dff7))
* **web:** show the Featured shelf atop the addon listings ([#1339](https://github.com/marioparaschiv/unbound/issues/1339)) ([117e6f2](https://github.com/marioparaschiv/unbound/commit/117e6f26825b2a96f597efdb91270b6c4d25a2db))
* **web:** unlock the badge for good with a one-time sponsorship of $30 ([#1164](https://github.com/marioparaschiv/unbound/issues/1164)) ([5aa23cd](https://github.com/marioparaschiv/unbound/commit/5aa23cd689c857ca2d8d56bc6feb3cbc1dd8a06a))


### Bug Fixes

* **loader:** write the profile expiry as exp ([#1224](https://github.com/marioparaschiv/unbound/issues/1224)) ([f659a0f](https://github.com/marioparaschiv/unbound/commit/f659a0f6e5fb1da4f7b45c1adaa7b9a8011ba163))
* **plugins:** draw every ADDON.md page icon and flag unknown ones ([#1335](https://github.com/marioparaschiv/unbound/issues/1335)) ([cc6642c](https://github.com/marioparaschiv/unbound/commit/cc6642c50ecb6167dd9defbbdb551859526e2a5e))
* **web:** delist addons a renamed first-party addon replaces ([#1314](https://github.com/marioparaschiv/unbound/issues/1314)) ([f8aad17](https://github.com/marioparaschiv/unbound/commit/f8aad173c5c2a6c58a0e02e8ec117c0b4eedd079))
* **web:** describe everything DevTools does ([#1382](https://github.com/marioparaschiv/unbound/issues/1382)) ([e3e31f7](https://github.com/marioparaschiv/unbound/commit/e3e31f7a07ebb676047f450ef6ea85bd1bf70af4))
* **web:** drop component editing from the DevTools blurb ([#1383](https://github.com/marioparaschiv/unbound/issues/1383)) ([004629e](https://github.com/marioparaschiv/unbound/commit/004629ed30828c720b56b850bbb9f18e69122510))
* **web:** drop edge fades at a scroller's start and end ([#1390](https://github.com/marioparaschiv/unbound/issues/1390)) ([f21f5d0](https://github.com/marioparaschiv/unbound/commit/f21f5d0976e6612d10b35488ca29d82c0bbc96fe))
* **web:** fade addon card tags when they overflow ([#1178](https://github.com/marioparaschiv/unbound/issues/1178)) ([bf907eb](https://github.com/marioparaschiv/unbound/commit/bf907ebfa92a10ab642a88efed6a1311e4549134))
* **web:** fit long install lines on the debug card ([#1223](https://github.com/marioparaschiv/unbound/issues/1223)) ([843e481](https://github.com/marioparaschiv/unbound/commit/843e4815a9ccfeb2487dc7e5e88ddeb8d21144f3))
* **web:** give updates their own /debug row ([#1169](https://github.com/marioparaschiv/unbound/issues/1169)) ([c4a7f0e](https://github.com/marioparaschiv/unbound/commit/c4a7f0e57ab7cde3750166f8f8cdb20e247566e6))
* **web:** line the Featured shelf up with the toolbar on wider screens ([#1389](https://github.com/marioparaschiv/unbound/issues/1389)) ([c7ff72c](https://github.com/marioparaschiv/unbound/commit/c7ff72c080bb8fb03a139958acaaa034ded29ef3))
* **web:** mention MCP eval in the DevTools blurb ([#1384](https://github.com/marioparaschiv/unbound/issues/1384)) ([b282b6e](https://github.com/marioparaschiv/unbound/commit/b282b6e0d85b07f83460c52849f2e9c2fd7214c8))
* **web:** restore the update check's JSDoc ([#1282](https://github.com/marioparaschiv/unbound/issues/1282)) ([9d75319](https://github.com/marioparaschiv/unbound/commit/9d753197269978bcdf0ff00f0221b8205bbfb495))
* **web:** send Retry-After on 429s and rate limit exhausted API keys ([#1244](https://github.com/marioparaschiv/unbound/issues/1244)) ([1078b32](https://github.com/marioparaschiv/unbound/commit/1078b3250430f5d5f4dd5a4861f1ab81465201c2))
* **web:** show sponsorships GitHub is still processing ([#1379](https://github.com/marioparaschiv/unbound/issues/1379)) ([380900b](https://github.com/marioparaschiv/unbound/commit/380900b8642c382402bd4d059290b893a13d6938))
* **web:** strip blank filler characters from tweak names ([#1362](https://github.com/marioparaschiv/unbound/issues/1362)) ([fda92e6](https://github.com/marioparaschiv/unbound/commit/fda92e67874899a52cbefebc7b878ccea6a2bf01))
* **web:** tidy tweak names and seconds on the debug card ([#1358](https://github.com/marioparaschiv/unbound/issues/1358)) ([c1eba58](https://github.com/marioparaschiv/unbound/commit/c1eba58b0dd65814e852c0c6b61366f4546f90c1))
* **web:** trim DevTools download tiles ([#1391](https://github.com/marioparaschiv/unbound/issues/1391)) ([527347a](https://github.com/marioparaschiv/unbound/commit/527347a3e7dfd4aa5aa86debfc7a1b1339667baa))
* **web:** wrap /debug rows and tighten the environment rows ([#1275](https://github.com/marioparaschiv/unbound/issues/1275)) ([5dbf2db](https://github.com/marioparaschiv/unbound/commit/5dbf2db8edb1b6766a165fa4c5521340a6d6e868))
* **web:** write the crash window as 24h on the debug card ([#1360](https://github.com/marioparaschiv/unbound/issues/1360)) ([2b41d3a](https://github.com/marioparaschiv/unbound/commit/2b41d3a1d089dfadf3e95e52d6fa30a21ea27090))


### Tests

* **web:** render the busiest /debug card and guard its layout ([#1176](https://github.com/marioparaschiv/unbound/issues/1176)) ([e8f8184](https://github.com/marioparaschiv/unbound/commit/e8f8184faf721570270d9b13ee59004b6caf864b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.2.0
    * @unbound-app/utils bumped to 1.0.2

## [2.1.0](https://github.com/marioparaschiv/unbound/compare/web-v2.0.0...web-v2.1.0) (2026-11-12)


### Features

* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **web:** render /debug cards on the server ([#1151](https://github.com/marioparaschiv/unbound/issues/1151)) ([6e39c74](https://github.com/marioparaschiv/unbound/commit/6e39c74b8c4bf68578b1a45c9cdb13054c5d4569))


### Continuous Integration

* **client:** one bundle channel, gated on a released loader ([#1137](https://github.com/marioparaschiv/unbound/issues/1137)) ([5e7efe3](https://github.com/marioparaschiv/unbound/commit/5e7efe37934f314788dcbb4b5f6c140ded00ec0b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.1.0
    * @unbound-app/utils bumped to 1.0.1

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/web-v1.1.1...web-v2.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Bug Fixes

* **web:** never overwrite a published addon version's files ([#1109](https://github.com/marioparaschiv/unbound/issues/1109)) ([ab09d06](https://github.com/marioparaschiv/unbound/commit/ab09d06f1e65d5effec6b2ba0d2befc81463f372))
* **web:** skip legacy-manifest versions in the versions list ([#1111](https://github.com/marioparaschiv/unbound/issues/1111)) ([0176d11](https://github.com/marioparaschiv/unbound/commit/0176d11590e244b8fa09730e8d6e8c28f537b653))


### Code Refactoring

* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.0.0
    * @unbound-app/logger bumped to 1.0.0
    * @unbound-app/utils bumped to 1.0.0

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/web-v1.1.0...web-v1.1.1) (2026-11-11)


### Bug Fixes

* **web:** give themes and icon packs their own default icons ([#1089](https://github.com/marioparaschiv/unbound/issues/1089)) ([840e0b8](https://github.com/marioparaschiv/unbound/commit/840e0b8163e299fd8fe049585c2de4ce46015e38))
* **web:** reopen the open page's sidebar category on every navigation ([#1094](https://github.com/marioparaschiv/unbound/issues/1094)) ([b43a1a3](https://github.com/marioparaschiv/unbound/commit/b43a1a33360c3bb1cd1a3d156d9473e0268bea1b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.1.1
    * @unbound-app/utils bumped to 0.10.4

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/web-v1.0.0...web-v1.1.0) (2026-11-11)


### Features

* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))


### Bug Fixes

* **web:** retry a failed write of a version's extra file ([#1080](https://github.com/marioparaschiv/unbound/issues/1080)) ([c1c87b9](https://github.com/marioparaschiv/unbound/commit/c1c87b9be157601bbbd1fe8e583d6b622a100175))
* **web:** write a version's extra files 16 at a time ([#1078](https://github.com/marioparaschiv/unbound/issues/1078)) ([b37ac8d](https://github.com/marioparaschiv/unbound/commit/b37ac8daa336f8bd2d52e3ef18674cb283d4c865))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.1.0
    * @unbound-app/utils bumped to 0.10.3

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/web-v0.14.1...web-v1.0.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* **client:** show icon packs in Discord's theme picker ([#1071](https://github.com/marioparaschiv/unbound/issues/1071)) ([d47801f](https://github.com/marioparaschiv/unbound/commit/d47801f328968076b465016e35ab90cbf805f1cf))
* count anonymous addon installs, sort by popularity ([#1066](https://github.com/marioparaschiv/unbound/issues/1066)) ([9a9f188](https://github.com/marioparaschiv/unbound/commit/9a9f1887a7979f6a6275c678dd677c0a04f7daf5))
* **web:** add addon gallery lightbox with drag panning ([#1069](https://github.com/marioparaschiv/unbound/issues/1069)) ([1fd08d5](https://github.com/marioparaschiv/unbound/commit/1fd08d57bbe6737efca3f878e4a1c5fae413bd83))
* **web:** draw guide flows as a numbered rail in a recessed well ([#1067](https://github.com/marioparaschiv/unbound/issues/1067)) ([a9468b0](https://github.com/marioparaschiv/unbound/commit/a9468b0700b34f3f655261d8e0fbea2be11e8ef6))
* **web:** glide to a section from the guide's page outline ([#1068](https://github.com/marioparaschiv/unbound/issues/1068)) ([1bde501](https://github.com/marioparaschiv/unbound/commit/1bde5013425aa54458f3744e206aa71a19a8c886))
* **web:** turn FAQ rows into hover cards with expo motion ([#1055](https://github.com/marioparaschiv/unbound/issues/1055)) ([f1ce3a8](https://github.com/marioparaschiv/unbound/commit/f1ce3a8d7e44c9097782421199943afc63dbe88f))


### Bug Fixes

* **web:** nest the API search rows concentrically in its dialog ([#1057](https://github.com/marioparaschiv/unbound/issues/1057)) ([36a1d58](https://github.com/marioparaschiv/unbound/commit/36a1d58fd944c8869d0805b6e1a8251d2b942893))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))
* **web:** share one search dialog across the docs tabs ([#1059](https://github.com/marioparaschiv/unbound/issues/1059)) ([88a0d0a](https://github.com/marioparaschiv/unbound/commit/88a0d0a2427a468b0782341041b6ae0bcf9bf0c9))


### Documentation

* rewrite the guides around up-front concepts ([#1064](https://github.com/marioparaschiv/unbound/issues/1064)) ([35a35a6](https://github.com/marioparaschiv/unbound/commit/35a35a6068221e40cb4ae4ea47263ce612ab8453))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.0.0

## [0.14.1](https://github.com/marioparaschiv/unbound/compare/web-v0.14.0...web-v0.14.1) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.14.1
    * @unbound-app/utils bumped to 0.10.2

## [0.14.0](https://github.com/marioparaschiv/unbound/compare/web-v0.13.0...web-v0.14.0) (2026-11-09)


### Features

* **client:** filter the marketplace by tags ([#1014](https://github.com/marioparaschiv/unbound/issues/1014)) ([d822616](https://github.com/marioparaschiv/unbound/commit/d822616424f95ded34a33e4b3150f9cb38b2d648))
* **client:** redesign the addon store page ([#1016](https://github.com/marioparaschiv/unbound/issues/1016)) ([8c72fe5](https://github.com/marioparaschiv/unbound/commit/8c72fe5114c80c1178c02bf3f81928ed70870a49))
* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))
* **web:** add an install page with stable and nightly builds ([#998](https://github.com/marioparaschiv/unbound/issues/998)) ([560a7ee](https://github.com/marioparaschiv/unbound/commit/560a7ee03543e365af1b725cc66c08eccfc85436))
* **web:** stagger the install page's sections and tiles in ([#999](https://github.com/marioparaschiv/unbound/issues/999)) ([2667089](https://github.com/marioparaschiv/unbound/commit/2667089aad2c77b4db3428fa677902f40369bb0f))


### Bug Fixes

* **web:** animate install page downloads on load, not on scroll ([#1000](https://github.com/marioparaschiv/unbound/issues/1000)) ([1a3999d](https://github.com/marioparaschiv/unbound/commit/1a3999db8d8613887a69131bb6e4c39c42e310cd))
* **web:** centre the theme maker's preview tab labels ([#986](https://github.com/marioparaschiv/unbound/issues/986)) ([37a68e4](https://github.com/marioparaschiv/unbound/commit/37a68e43a32415ca302775c0e532d09938446e9c))


### Performance Improvements

* **web:** send only the page icons an addon page uses ([#1019](https://github.com/marioparaschiv/unbound/issues/1019)) ([2eb5a49](https://github.com/marioparaschiv/unbound/commit/2eb5a49c2d6448e7fe3ec691c8e54cb80573921b))


### Documentation

* **web:** tighten install page copy ([#1003](https://github.com/marioparaschiv/unbound/issues/1003)) ([78f0797](https://github.com/marioparaschiv/unbound/commit/78f0797fa6458dde665039ea3e629f74455d7ec3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.14.0
    * @unbound-app/utils bumped to 0.10.1

## [0.13.0](https://github.com/marioparaschiv/unbound/compare/web-v0.12.0...web-v0.13.0) (2026-11-05)


### Features

* **client:** move fonts to a native font store with presets ([#969](https://github.com/marioparaschiv/unbound/issues/969)) ([40ff081](https://github.com/marioparaschiv/unbound/commit/40ff081f49917861523acf3e0a1ad0e8b6ec14f0))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **discord-bot:** send authors their review decisions by DM ([#799](https://github.com/marioparaschiv/unbound/issues/799)) ([020ef60](https://github.com/marioparaschiv/unbound/commit/020ef60f73cf6c3a089d57dd1f82bdd297990fa9))
* **discord-bot:** v2 addon cards with gallery and author avatars ([#871](https://github.com/marioparaschiv/unbound/issues/871)) ([444fe85](https://github.com/marioparaschiv/unbound/commit/444fe854746bc7e5a0b654e0ad17ffaecb8f7bc5))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* **loader:** publish the deb and module on every loader change ([#963](https://github.com/marioparaschiv/unbound/issues/963)) ([56d848f](https://github.com/marioparaschiv/unbound/commit/56d848f0f3fe922e6658934a29eac6cff640cb1c))
* native sponsor badges in Discord and staff badges without a sponsorship ([#909](https://github.com/marioparaschiv/unbound/issues/909)) ([3fdd04f](https://github.com/marioparaschiv/unbound/commit/3fdd04fd167760332bf5a4c605509a959b9ac6e6))
* require a minimum loader version per bundle ([#962](https://github.com/marioparaschiv/unbound/issues/962)) ([840bcfa](https://github.com/marioparaschiv/unbound/commit/840bcfa3912c370623fad8b7e810af46e5598d8f))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))
* **web,cli:** read the built manifest for publish and ubd dev ([#696](https://github.com/marioparaschiv/unbound/issues/696)) ([f417abc](https://github.com/marioparaschiv/unbound/commit/f417abc0d88f19f2144dc9a2dc5b7f8dde9b7cdd))
* **web:** add HTTP docs tab from a generated OpenAPI document ([#899](https://github.com/marioparaschiv/unbound/issues/899)) ([22cfca2](https://github.com/marioparaschiv/unbound/commit/22cfca28d56bd847353dde1eb070aa7c6e035c06))
* **web:** allow animated GIF sponsor badges ([#912](https://github.com/marioparaschiv/unbound/issues/912)) ([77e53df](https://github.com/marioparaschiv/unbound/commit/77e53dfd28b6cc37ab7ae79996eeaef58f03ed48))
* **web:** catalog versions carry their store page URL ([#718](https://github.com/marioparaschiv/unbound/issues/718)) ([5f1f0f3](https://github.com/marioparaschiv/unbound/commit/5f1f0f31402ce2b4d9890f63a55b454f410f2d2e))
* **web:** custom Better Auth error page and 404 route ([#747](https://github.com/marioparaschiv/unbound/issues/747)) ([e023dea](https://github.com/marioparaschiv/unbound/commit/e023deacf17fa35adfbea49622edab6ec9d79b3e))
* **web:** draw :name: icon shortcodes on addon store pages ([#872](https://github.com/marioparaschiv/unbound/issues/872)) ([9d3e3f5](https://github.com/marioparaschiv/unbound/commit/9d3e3f54d096cbba4b47b9c0984e494465d7b179))
* **web:** merge plugins and themes into one addons page with tabs ([#800](https://github.com/marioparaschiv/unbound/issues/800)) ([fa92f7f](https://github.com/marioparaschiv/unbound/commit/fa92f7fa8d5ff542721866b37ff952eef542c7a9))
* **web:** move the SDK reference to /docs/sdk and the API to /docs/api ([#901](https://github.com/marioparaschiv/unbound/issues/901)) ([8459e02](https://github.com/marioparaschiv/unbound/commit/8459e024f5fd1e878437fabdd99ea034f2d97589))
* **web:** point Get Started at the install guide and add Browse Addons ([#970](https://github.com/marioparaschiv/unbound/issues/970)) ([8bfe545](https://github.com/marioparaschiv/unbound/commit/8bfe5450a5c484a3d80ccf24650df5129731c12f))
* **web:** publish copies the ADDON.md store page and media ([#710](https://github.com/marioparaschiv/unbound/issues/710)) ([fdaa4cf](https://github.com/marioparaschiv/unbound/commit/fdaa4cf5ab901faf80791e76795681099c3955a9))
* **web:** put addon tags beside the install button and stack overflow ([#801](https://github.com/marioparaschiv/unbound/issues/801)) ([173a9cc](https://github.com/marioparaschiv/unbound/commit/173a9cc6b44bc8e149322d5b7b1a2b0776ae52be))
* **web:** put the badge editor in the custom badge perk row ([#917](https://github.com/marioparaschiv/unbound/issues/917)) ([3055d24](https://github.com/marioparaschiv/unbound/commit/3055d24cb7a158dec714c95fec5937d9a7091767))
* **web:** read the measured ADDON.md page on submission ([#706](https://github.com/marioparaschiv/unbound/issues/706)) ([29627b6](https://github.com/marioparaschiv/unbound/commit/29627b6b13831e2ab949a4cfa6216f51b20ff096))
* **web:** redesign the GitHub submit flow ([#715](https://github.com/marioparaschiv/unbound/issues/715)) ([d582e06](https://github.com/marioparaschiv/unbound/commit/d582e067b9fb5839e6503e686e4e36b38744d7da))
* **web:** render ADDON.md banner, gallery and media ([#701](https://github.com/marioparaschiv/unbound/issues/701)) ([04dc235](https://github.com/marioparaschiv/unbound/commit/04dc23591c22ddebfb97154c982d8cf06f86d2e2))
* **web:** replace Mintlify with built-in docs tabs ([7567ced](https://github.com/marioparaschiv/unbound/commit/7567cede76ba53c11dc530709fe0a433fbbf4d50))
* **web:** show Capabilities per platform ([#700](https://github.com/marioparaschiv/unbound/issues/700)) ([73f4262](https://github.com/marioparaschiv/unbound/commit/73f4262f467f3df3e56d62ed4c7ee5113a48ff53))
* **web:** sign up without an email and delete stored emails ([#906](https://github.com/marioparaschiv/unbound/issues/906)) ([ec0df83](https://github.com/marioparaschiv/unbound/commit/ec0df83883fc48cfe18348a23cd2b4241cdef269))
* **web:** sponsor badges as PNGs, $5 tier and profile perks ([#809](https://github.com/marioparaschiv/unbound/issues/809)) ([c19e946](https://github.com/marioparaschiv/unbound/commit/c19e94652620ad34cb09a6c21aa91247914380a9))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **web:** keep rejected and superseded files off the CDN ([#933](https://github.com/marioparaschiv/unbound/issues/933)) ([daebd6a](https://github.com/marioparaschiv/unbound/commit/daebd6a8da8dad7badd2dffe3c8d77973598008b))
* **web:** keep the dotted background one viewport tall ([#791](https://github.com/marioparaschiv/unbound/issues/791)) ([0445168](https://github.com/marioparaschiv/unbound/commit/04451686395e9a183df0a98bca4d2babdaeec1da))
* **web:** lift the page noise over content and point docs links at /docs ([#804](https://github.com/marioparaschiv/unbound/issues/804)) ([74b8d73](https://github.com/marioparaschiv/unbound/commit/74b8d73cef222ed95f510855214ecb2a27255c45))
* **web:** limit emails to the dev team and block role escalation ([#765](https://github.com/marioparaschiv/unbound/issues/765)) ([137cc50](https://github.com/marioparaschiv/unbound/commit/137cc50253533181a22c9d1a5066b094288ec667))
* **web:** list a user's badges by their Discord id ([#913](https://github.com/marioparaschiv/unbound/issues/913)) ([28bb3a4](https://github.com/marioparaschiv/unbound/commit/28bb3a471d259e9c446beb9c54096aa1ae4551dc))
* **web:** say GIFs work once on the perks card ([#915](https://github.com/marioparaschiv/unbound/issues/915)) ([abdf250](https://github.com/marioparaschiv/unbound/commit/abdf25058e66575532b896ab6e39966c1fd18ee1))
* **web:** scope nested expandables and drop HTTP examples ([#900](https://github.com/marioparaschiv/unbound/issues/900)) ([f7157e3](https://github.com/marioparaschiv/unbound/commit/f7157e380295a725a2439d404f32b921915f7a94))
* **web:** show each addon's picked icon on the staff addons list ([#769](https://github.com/marioparaschiv/unbound/issues/769)) ([31ab09e](https://github.com/marioparaschiv/unbound/commit/31ab09e237b5641d638a68cc010aacd5a4f73882))
* **web:** size page icons to the surrounding text ([#875](https://github.com/marioparaschiv/unbound/issues/875)) ([7c59cf4](https://github.com/marioparaschiv/unbound/commit/7c59cf4352c5f31dcded6663d7fb46b178b010e7))
* **web:** span the hero fade across wide viewports ([#802](https://github.com/marioparaschiv/unbound/issues/802)) ([902a0d9](https://github.com/marioparaschiv/unbound/commit/902a0d973f982fc60352261562a130e5e3a76795))
* **web:** steady docs sidebar on navigation, show member signatures ([#866](https://github.com/marioparaschiv/unbound/issues/866)) ([1de3c32](https://github.com/marioparaschiv/unbound/commit/1de3c32ab870793ea243a2dc5ddc55f92953b811))
* **web:** track reading position in guide toc, debounce ⌘K ([#864](https://github.com/marioparaschiv/unbound/issues/864)) ([f9d4687](https://github.com/marioparaschiv/unbound/commit/f9d46872d934a4e6947ecc8bf96bcfeca5de356a))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))
* **web:** preload the SDK reference and pin its sidebar controls ([#865](https://github.com/marioparaschiv/unbound/issues/865)) ([5e56e71](https://github.com/marioparaschiv/unbound/commit/5e56e7161f767f4f9ce9c2bef0147305781c7726))


### Code Refactoring

* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))
* **web:** drop the status page icon, keep the logo ([#748](https://github.com/marioparaschiv/unbound/issues/748)) ([43a7cee](https://github.com/marioparaschiv/unbound/commit/43a7cee9cc0965dfa93be2c6bbf2a4f61b2b744e))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Documentation

* reorganise the developer and user guides ([#863](https://github.com/marioparaschiv/unbound/issues/863)) ([b9ea08c](https://github.com/marioparaschiv/unbound/commit/b9ea08c558ebcebe91131e3c655b294f0770e946))


### Styles

* **web:** a glowing Sponsor button and a Support Unbound card ([#908](https://github.com/marioparaschiv/unbound/issues/908)) ([039f024](https://github.com/marioparaschiv/unbound/commit/039f024831e85a517ec7c93d5354ddacc727ffeb))
* **web:** docs polish and an always-on Sponsor CTA ([#855](https://github.com/marioparaschiv/unbound/issues/855)) ([80ce7f0](https://github.com/marioparaschiv/unbound/commit/80ce7f0d1df6f7d29268832fdf0bfcc49b33dcfe))
* **web:** match nested corner shape for the key and copy button ([#858](https://github.com/marioparaschiv/unbound/issues/858)) ([01129ad](https://github.com/marioparaschiv/unbound/commit/01129ad8adbdd3e0f6a7d5795c50ae7e749683c0))
* **web:** softer docs presses and concentric corners ([#856](https://github.com/marioparaschiv/unbound/issues/856)) ([cb12c30](https://github.com/marioparaschiv/unbound/commit/cb12c30404515cb4650dc6621fe8bc19e610f7fe))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.13.0
    * @unbound-app/logger bumped to 0.7.3
    * @unbound-app/utils bumped to 0.10.0

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/web-v0.11.0...web-v0.12.0) (2026-10-31)


### Features

* choose and downgrade addon versions from the marketplace ([#443](https://github.com/marioparaschiv/unbound/issues/443)) ([7190ac2](https://github.com/marioparaschiv/unbound/commit/7190ac2e53ecb0d49976898dee8c61bf19705ae3))
* report the verified build on both platforms ([#499](https://github.com/marioparaschiv/unbound/issues/499)) ([eda9405](https://github.com/marioparaschiv/unbound/commit/eda9405ec5a3ed911aecbe4c34be67b24537d8ca))
* **web:** frosted team cards and blurred profile banners ([#440](https://github.com/marioparaschiv/unbound/issues/440)) ([0f3b75b](https://github.com/marioparaschiv/unbound/commit/0f3b75ba5d13969cf5f866cf226946bf4cee82cd))
* **web:** give every first-party addon a website icon ([#449](https://github.com/marioparaschiv/unbound/issues/449)) ([3b22e55](https://github.com/marioparaschiv/unbound/commit/3b22e55c155e5388d4b4fba93cdb34ea361324f4))
* **web:** one staff link in the menu, no single-tab switcher ([#450](https://github.com/marioparaschiv/unbound/issues/450)) ([450eb78](https://github.com/marioparaschiv/unbound/commit/450eb78cb75132bdf67e2c77af7f4620f7828b1b))
* **web:** redesign addon pages and let maintainers pick a website icon ([#444](https://github.com/marioparaschiv/unbound/issues/444)) ([b61e42b](https://github.com/marioparaschiv/unbound/commit/b61e42bd1166479927229b9d136247558b2fa874))
* **web:** redesign the staff area and let staff set addon icons ([#447](https://github.com/marioparaschiv/unbound/issues/447)) ([f9f764f](https://github.com/marioparaschiv/unbound/commit/f9f764f78213c53d785208ced8351ad513dc7851))
* **web:** sync Discord banners, names and avatars to the team pages ([#442](https://github.com/marioparaschiv/unbound/issues/442)) ([2d9697f](https://github.com/marioparaschiv/unbound/commit/2d9697f13018616e904009a8d02a8312d6842574))


### Bug Fixes

* **client:** read core settings from the loader's store ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** reach the Android module's current class names ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* use one link scheme across the loader, client and site ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))
* **web:** drop saturate-300 from team card avatar glow ([#446](https://github.com/marioparaschiv/unbound/issues/446)) ([e3316cc](https://github.com/marioparaschiv/unbound/commit/e3316cc9f664fb3d4c7a79483aadc83608cc81f6))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))
* **loader:** choose the Android build in a tested command ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** move first-party plugin ids to the new namespace ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Build System

* **deps:** bump the minor-and-patch group with 7 updates ([#607](https://github.com/marioparaschiv/unbound/issues/607)) ([e5b7afa](https://github.com/marioparaschiv/unbound/commit/e5b7afaa780f5ad6143b6f18bb71bcad712953be))
* treat Bun's empty test runs as passing in the pre-push hook ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Documentation

* match the Android install steps to the release assets ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))


### Tests

* **core:** keep sanitizer reports out of the crash attribution children ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* remove tautological tests and stop pinning brittle details ([#437](https://github.com/marioparaschiv/unbound/issues/437)) ([b69ca6c](https://github.com/marioparaschiv/unbound/commit/b69ca6c97c6470ac6cb1b0fa515c6e2f79639ba7))
* **web:** key the sync tests' core store by SYNC_CORE_STORE ([#679](https://github.com/marioparaschiv/unbound/issues/679)) ([d45b176](https://github.com/marioparaschiv/unbound/commit/d45b176f1c4fede17cc22eeb44f005823bf3fa21))


### Continuous Integration

* **deps:** fit Dependabot titles to the commit header limit ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** build PRs against the current App Store Discord ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** let main builds finish instead of cancelling each other ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** show smoke failures and the first crash in the PR comment ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** skip the Android smoke test for unattested builds ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.12.0
    * @unbound-app/logger bumped to 0.7.2
    * @unbound-app/utils bumped to 0.9.2

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/web-v0.10.0...web-v0.11.0) (2026-10-29)


### Features

* **client:** attach scrubbed log lines to crash reports ([0f0868f](https://github.com/marioparaschiv/unbound/commit/0f0868f0657432a977a23454ba8e6225c8ccf955))
* **client:** attach scrubbed log lines to crash reports ([0733cbf](https://github.com/marioparaschiv/unbound/commit/0733cbfcd59321d8faf417367c973ecef1ff0ae2))
* **client:** send opt-in crash reports to the API ([311f957](https://github.com/marioparaschiv/unbound/commit/311f957b1172343e1474813ddc73cacbd6f6de50))
* **client:** send opt-in crash reports to the API ([9f10514](https://github.com/marioparaschiv/unbound/commit/9f10514fe9248fef7ed735b344537e02ed1f0afe))
* **discord-bot:** react to unbound.rip through Postgres triggers, delete the bot feed ([5309aa4](https://github.com/marioparaschiv/unbound/commit/5309aa431de558b29a89387c610dfe51894bf421))
* **discord-bot:** read the web's tables, woken by triggers on them ([7966354](https://github.com/marioparaschiv/unbound/commit/7966354cce30d3a58866cb8346186921a3a2e6ab))
* **discord-bot:** turn on the audit log, compact embeds, export to OpenTelemetry ([#250](https://github.com/marioparaschiv/unbound/issues/250)) ([ba42953](https://github.com/marioparaschiv/unbound/commit/ba42953697e2baef38a973ae8aa644047e828c97))
* hand off addon installs from the website through unbound:// ([#332](https://github.com/marioparaschiv/unbound/issues/332)) ([2c1e4d3](https://github.com/marioparaschiv/unbound/commit/2c1e4d384cac3e061d05e5c61756b8dacd408733))
* **plugins:** republish rebuilt plugins with bytecode ([fbd653e](https://github.com/marioparaschiv/unbound/commit/fbd653e311392eb6b691bbbf4878b0c41da7ee2f))
* **plugins:** republish rebuilt plugins with bytecode ([2574b6b](https://github.com/marioparaschiv/unbound/commit/2574b6b5b028b413a6d249fa20ab257ff1729cd3))
* **web:** copy production data from SQLite into Postgres ([705f61a](https://github.com/marioparaschiv/unbound/commit/705f61a5a7a6fb6b23db110e191790e073bb11fb))
* **web:** drop the bot feed objects, its key and its locks ([b1e96e9](https://github.com/marioparaschiv/unbound/commit/b1e96e91f5ea1caa4764df8bfdb035fefd59ff2c))
* **web:** export the bot read model, delete the bot feed API ([20e4972](https://github.com/marioparaschiv/unbound/commit/20e49724b092c50db60b80f113100034dd9bd3ab))
* **web:** filter /plugins and /themes by tag, author and update date ([#414](https://github.com/marioparaschiv/unbound/issues/414)) ([f5b4703](https://github.com/marioparaschiv/unbound/commit/f5b4703c2da2843387a716b8f50cbd55e2e1d0a9))
* **web:** grant site admin to Development Team and Management ([#324](https://github.com/marioparaschiv/unbound/issues/324)) ([82b948c](https://github.com/marioparaschiv/unbound/commit/82b948c93f8ad92c307e76405d516a209442f80e))
* **web:** link every identified author to their developer page ([#303](https://github.com/marioparaschiv/unbound/issues/303)) ([4c7af2b](https://github.com/marioparaschiv/unbound/commit/4c7af2b36a32aa043976a0e80e6141edf0ae3e53))
* **web:** order staff by admin before moderator, then a manual position ([#329](https://github.com/marioparaschiv/unbound/issues/329)) ([3f870bf](https://github.com/marioparaschiv/unbound/commit/3f870bfbaf5c670a0c3cb0dbf16b40862a6b01a8))
* **web:** plump design system, Unbound red accent and Nucleo icons ([#335](https://github.com/marioparaschiv/unbound/issues/335)) ([92ed8f7](https://github.com/marioparaschiv/unbound/commit/92ed8f70f03897bc144f41165fda8dd83101d21e))
* **web:** read the newest moderation event id for the bot ([cf0b731](https://github.com/marioparaschiv/unbound/commit/cf0b7315cc54c64cdb9dfad88928a048b210ec99))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))
* **web:** show addon authors in a Discord-style avatar pile ([#299](https://github.com/marioparaschiv/unbound/issues/299)) ([5f1717b](https://github.com/marioparaschiv/unbound/commit/5f1717bd90488e2e2d05f85d742784024f1faff1))
* **web:** stagger detail page entrances and move team pages to /team and /profiles ([#435](https://github.com/marioparaschiv/unbound/issues/435)) ([768204c](https://github.com/marioparaschiv/unbound/commit/768204c23252b0a30026dc7d7cb6fd5418551171))
* **web:** sync the Addon Developer Discord role into the team ([#326](https://github.com/marioparaschiv/unbound/issues/326)) ([84abe6e](https://github.com/marioparaschiv/unbound/commit/84abe6edee5169c196928bedfc96b82dfa22cf86))
* **web:** sync the team by looking up known members, grant roles only ([#325](https://github.com/marioparaschiv/unbound/issues/325)) ([e124403](https://github.com/marioparaschiv/unbound/commit/e124403d2a9fc9cdfb4c55799261b53a6c4be2e6))
* **web:** Team page with Discord role sync and motion polish ([#322](https://github.com/marioparaschiv/unbound/issues/322)) ([9cb311c](https://github.com/marioparaschiv/unbound/commit/9cb311c1583a4314da8e02ef586e338c447fed9b))


### Bug Fixes

* **unbound-dev:** drop the catalog stub's database on SIGHUP, fully ([b1393cc](https://github.com/marioparaschiv/unbound/commit/b1393cc661040690097d3d2d45a2a074f2f1c900))
* **web:** break every ordering tie on the primary key ([6062129](https://github.com/marioparaschiv/unbound/commit/6062129442d9e29a3d96e5ac4c20484d4e8589cd))
* **web:** bring back the hero phones' slide-up entrance ([#338](https://github.com/marioparaschiv/unbound/issues/338)) ([35f7b83](https://github.com/marioparaschiv/unbound/commit/35f7b8341b9d37abb4b065400192c23f8310b3d2))
* **web:** cap cursor times at the end of year 9999 ([b5096e0](https://github.com/marioparaschiv/unbound/commit/b5096e04b32babe264bc1ff2d0ec8e514a61f803))
* **web:** copy double precision columns from SQLite ([d8515a4](https://github.com/marioparaschiv/unbound/commit/d8515a46c9495a49072c8ae1e3b7ec116cde06a9))
* **web:** copy double precision columns from SQLite ([6dd2385](https://github.com/marioparaschiv/unbound/commit/6dd2385dec4876ada534dedd855d4a6830ec5113))
* **web:** copy tables newer than the SQLite source as empty ([66bf94e](https://github.com/marioparaschiv/unbound/commit/66bf94e625a3b2db464e7b136fc75a91ee74362a))
* **web:** cover the mobile hero with dots, phones edge to edge ([#393](https://github.com/marioparaschiv/unbound/issues/393)) ([85523b1](https://github.com/marioparaschiv/unbound/commit/85523b1171fcb58ffd77fc7d2a1cf62e14e6cc04))
* **web:** decode cursor timestamps in the cursor schemas ([69b5816](https://github.com/marioparaschiv/unbound/commit/69b581637da9fbad3fcb3565b6eea86bd995271d))
* **web:** drop route view transitions so the header pill slides again ([#436](https://github.com/marioparaschiv/unbound/issues/436)) ([1d073ca](https://github.com/marioparaschiv/unbound/commit/1d073ca594c94e758f90b25def80c3dc54f1edee))
* **web:** drop the "by" from addon card bylines ([#313](https://github.com/marioparaschiv/unbound/issues/313)) ([f7d20a9](https://github.com/marioparaschiv/unbound/commit/f7d20a9aa47aaed40092fe0db515d1012a2812a5))
* **web:** ellipsize author names that overflow the byline ([#301](https://github.com/marioparaschiv/unbound/issues/301)) ([154e348](https://github.com/marioparaschiv/unbound/commit/154e34814537eaa76a52d48752e078e31eda77ee))
* **web:** generate the crash report log migration with drizzle-kit ([3b76757](https://github.com/marioparaschiv/unbound/commit/3b76757a87b4f2bba228e67048aee7a40d8dbd13))
* **web:** glide a hovered menu row into view instead of jumping ([#417](https://github.com/marioparaschiv/unbound/issues/417)) ([ad814dc](https://github.com/marioparaschiv/unbound/commit/ad814dc809941f9c704ea6074a4c1f69a7f74121))
* **web:** locate Postgres refusals and stop --replace cascading ([b42f27a](https://github.com/marioparaschiv/unbound/commit/b42f27ac6ab9fb7772294792fdeceb2a8f710f5e))
* **web:** lock account before a user delete draws an ordered id ([ef57b67](https://github.com/marioparaschiv/unbound/commit/ef57b67ba162dd413f83c169256a261beba8dd05))
* **web:** mark the developer search navigations as fire-and-forget ([ce4e499](https://github.com/marioparaschiv/unbound/commit/ce4e499c6d5710d2ba40f691f7508e70ef0d4fe7))
* **web:** pad the mobile hero phones and preload the image ([#394](https://github.com/marioparaschiv/unbound/issues/394)) ([2c386a9](https://github.com/marioparaschiv/unbound/commit/2c386a9773d599b9d1a04e8149b682f6f2cc6e59))
* **web:** refuse a foreign SQLite source and unreadable text ([28f320b](https://github.com/marioparaschiv/unbound/commit/28f320bd0b20e8feb970ce1aaad7a126e31da7b9))
* **web:** refuse NUL in copied text and json, naming the row by its key ([4f1c6f5](https://github.com/marioparaschiv/unbound/commit/4f1c6f52f846a08674099a79c30ce7589ce062b4))
* **web:** refuse NUL in text bound for Postgres ([d2156fa](https://github.com/marioparaschiv/unbound/commit/d2156fa0adf71a58f12d40327981deb3945f4844))
* **web:** refuse text Postgres cannot store in Better Auth requests ([e13033a](https://github.com/marioparaschiv/unbound/commit/e13033a98d9e49c9ba860a6338ff3990207acbf8))
* **web:** search transfer targets case-insensitively ([16fd17f](https://github.com/marioparaschiv/unbound/commit/16fd17f2efb600c4db0e3dc1cbf040b1421c24bf))
* **web:** skip empty relational filters for drizzle-orm rc.5 ([c7657ce](https://github.com/marioparaschiv/unbound/commit/c7657ce30454beeba43c76ca05b15356cf488301))
* **web:** skip the retired bot feed table when copying SQLite ([e254626](https://github.com/marioparaschiv/unbound/commit/e25462656c5996d0d40e052429c3db4b364dc72a))
* **web:** stamp a bot feed change after the ordering lock ([7184022](https://github.com/marioparaschiv/unbound/commit/718402224a8751c84335a36354f113eb1e6e4369))
* **web:** upgrade migration snapshots so drizzle-kit generates again ([efd9426](https://github.com/marioparaschiv/unbound/commit/efd9426ec306e40a7108853a1d55fb1346d53a5c))
* **web:** upgrade migration snapshots so drizzle-kit generates again ([a6b4bb5](https://github.com/marioparaschiv/unbound/commit/a6b4bb5de625fa042925a45a5f1ae9d88a0452cb))


### Code Refactoring

* **web:** default the bot reads' grace and read one addon by key ([a50f1d3](https://github.com/marioparaschiv/unbound/commit/a50f1d390731f457e455c0fd4d6b0975a811481c))
* **web:** load page data through TanStack Query ([#434](https://github.com/marioparaschiv/unbound/issues/434)) ([199ca67](https://github.com/marioparaschiv/unbound/commit/199ca673af2b6790ad116e21572199fe2f9c5d44))
* **web:** match admin search on the listed table itself ([7e49ac1](https://github.com/marioparaschiv/unbound/commit/7e49ac1caf116e0b94e16124185e0a1a3e647800))
* **web:** move hand-written SQL into custom migrations ([4d7f592](https://github.com/marioparaschiv/unbound/commit/4d7f592c52ce466d87389d6d9950761e67a05d84))
* **web:** move LIVE_VERSIONS and the grace default to leaf modules ([32deb0f](https://github.com/marioparaschiv/unbound/commit/32deb0f597729b874320a2f421a027099fbde8cb))
* **web:** move the SQLite copy out of src into scripts ([ded3674](https://github.com/marioparaschiv/unbound/commit/ded3674f0c4b0a7ce0958b987a14059a2a1ad5e4))
* **web:** refuse text Postgres cannot store once per boundary ([5915ffa](https://github.com/marioparaschiv/unbound/commit/5915ffae5be5b7d499c50c6baef72e8d71906dab))
* **web:** take only a sponsorship transaction in the upsert ([c834514](https://github.com/marioparaschiv/unbound/commit/c834514fcd46297c8d66d03642953d5f5211178d))
* **web:** tidy isRetryable, a test title and one source insert ([3a1c94c](https://github.com/marioparaschiv/unbound/commit/3a1c94c89605a5ea2817869382377cac93968521))


### Build System

* **deps:** bump drizzle-kit from 1.0.0-rc.4 to 1.0.0-rc.5 ([56aed55](https://github.com/marioparaschiv/unbound/commit/56aed556f95b84cb3fc3de4ce4f6311d0fc2f004))
* **deps:** bump drizzle-orm from 1.0.0-rc.4 to 1.0.0-rc.5 ([dbbc5d1](https://github.com/marioparaschiv/unbound/commit/dbbc5d166fe58fe7d106188769b484a2c503856d))
* **deps:** eslint-plugin-jsdoc 65 with the JSDoc it requires ([e4b303a](https://github.com/marioparaschiv/unbound/commit/e4b303a9d547a703e992955e1447c821922efb24))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))


### Documentation

* add the JSDoc eslint-plugin-jsdoc 65 requires ([d5632e8](https://github.com/marioparaschiv/unbound/commit/d5632e824e43cad5a88d15a5083b7cfc0097346c))


### Styles

* sort imports and fix the lint findings from the bot switch ([95d4dd1](https://github.com/marioparaschiv/unbound/commit/95d4dd1afde5aac343b7b04d3b0110b5f2a7b096))
* sort imports from the audit floor round ([07867f9](https://github.com/marioparaschiv/unbound/commit/07867f9a484f440fc299b32794d6b8fac5992a6f))
* sort imports from the fix round ([9c2c4ca](https://github.com/marioparaschiv/unbound/commit/9c2c4ca53c84bdbeef899cd66e312bb85c384110))
* **web:** keep readAddonSource's doc above it ([e281bf2](https://github.com/marioparaschiv/unbound/commit/e281bf2064df70fbd13eb38ab5008084573ad1e6))
* **web:** let more avatar colour through the team card backdrop ([#323](https://github.com/marioparaschiv/unbound/issues/323)) ([ff3a968](https://github.com/marioparaschiv/unbound/commit/ff3a968302468833f4ba148e52950812dd49ce63))
* **web:** sort imports and satisfy oxlint in the fix round ([b3b7a6d](https://github.com/marioparaschiv/unbound/commit/b3b7a6d21ddaea6fde0dfb46e8450fc201908a88))
* **web:** sort imports and shorten a comment from the fix round ([a45c158](https://github.com/marioparaschiv/unbound/commit/a45c15866016414c1b4c4594f4ff50fe86d149f7))
* **web:** sort the SQLite copy imports ([426fd60](https://github.com/marioparaschiv/unbound/commit/426fd60adb7f24b1dea88684afcfae44be2ae168))
* **web:** sort the SQLite copy test imports ([cfb6ccf](https://github.com/marioparaschiv/unbound/commit/cfb6ccf7950bdf4a7e91f360e87ecbac5c216e04))


### Tests

* **web:** assert the seek predicate of each planned index scan ([67947f1](https://github.com/marioparaschiv/unbound/commit/67947f1e1d8060add1802a32d33225e175634236))
* **web:** check only the failed context's own database is dropped ([0ed9b36](https://github.com/marioparaschiv/unbound/commit/0ed9b365270d789adf228c51cad83dcea5cce61b))
* **web:** count only this database's ordering-lock waiters ([7645884](https://github.com/marioparaschiv/unbound/commit/76458843955617fa41405a303cee4212e492ae29))
* **web:** drop the test database when a context fails to start ([ffe41a7](https://github.com/marioparaschiv/unbound/commit/ffe41a7ad107202baf29fcfc1055afb4bfeb1a13))
* **web:** expect no source rows for tables newer than SQLite ([150392b](https://github.com/marioparaschiv/unbound/commit/150392b9b878f22a434368af217f9669b3f3f3b1))
* **web:** expect the live digest in the first-party list ([3fa1c6e](https://github.com/marioparaschiv/unbound/commit/3fa1c6e61489a673b2ef3ff871ac778e141b639b))
* **web:** keep the SQLite fixture frozen at the pre-Postgres schema ([c9c1563](https://github.com/marioparaschiv/unbound/commit/c9c1563de5ea31b30045b50b8fe2201ea939a897))
* **web:** keep the SQLite fixture frozen at the pre-Postgres schema ([46c663a](https://github.com/marioparaschiv/unbound/commit/46c663a57b1546cbe335aefe55153f223b6b8950))
* **web:** plan the addon search seek without a cursor only ([294bb11](https://github.com/marioparaschiv/unbound/commit/294bb11bd468753c37e925b9a44ddcc2fe8a7abe))
* **web:** restore the time zone by name instead of deleting it ([6b49a8a](https://github.com/marioparaschiv/unbound/commit/6b49a8a5ea1612bd60374fdec200f71d4b38641b))
* **web:** seed crash reports and team members in the SQLite fixture ([1e00df7](https://github.com/marioparaschiv/unbound/commit/1e00df70fcd59785ea05b73582809603050f3681))
* **web:** wait out a slow drop of a failed test context ([2fd98e4](https://github.com/marioparaschiv/unbound/commit/2fd98e43d079a8f47cddd867d1e801f11d10841c))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.11.0
    * @unbound-app/logger bumped to 0.7.1
    * @unbound-app/utils bumped to 0.9.1

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/web-v0.9.0...web-v0.10.0) (2026-10-25)


### Features

* **contracts:** add source pin and repository details schemas ([8249648](https://github.com/marioparaschiv/unbound/commit/82496486be8642d240ef7630b536cefe98ec9add))
* **web:** add admin addon and user pages ([d7db1b5](https://github.com/marioparaschiv/unbound/commit/d7db1b591a23e3ac07ca9b413af188d3beb18d54))
* **web:** add admin addon and user pages with review history ([642b31b](https://github.com/marioparaschiv/unbound/commit/642b31bbbcd24c58676f3c96a7e7734222ebc2c0))
* **web:** add base ui primitives and redesign admin addon pages ([#205](https://github.com/marioparaschiv/unbound/issues/205)) ([86a219b](https://github.com/marioparaschiv/unbound/commit/86a219be5d57cb36d44f7723ec4ce9781b74e0b0))
* **web:** add GitHub listing endpoints and submission preview ([33e3992](https://github.com/marioparaschiv/unbound/commit/33e3992455f44375db8f9a4cae75bd0d0b6cb351))
* **web:** add GitHub Sponsors with a custom badge perk ([#190](https://github.com/marioparaschiv/unbound/issues/190)) ([85ad012](https://github.com/marioparaschiv/unbound/commit/85ad012ce92f128c025c0d7be0ae13c64e7bd2c3))
* **web:** add staff notes on users and addons ([6888d66](https://github.com/marioparaschiv/unbound/commit/6888d66e5da005bb589678a62c9c1f195802841c))
* **web:** add the ADDON.md URL policy and markdown dependencies ([b581f2b](https://github.com/marioparaschiv/unbound/commit/b581f2b930f10045538354d904f89bdad8e2c68c))
* **web:** add the moderation event log ([9350597](https://github.com/marioparaschiv/unbound/commit/9350597082194348aa948aec97847121f300c2d7))
* **web:** add the staff addon edit form ([2b788c8](https://github.com/marioparaschiv/unbound/commit/2b788c8884284c27a3ebc7ea36ee709a22be7f71))
* **web:** add the staff_note table and note permissions ([0664d5c](https://github.com/marioparaschiv/unbound/commit/0664d5cbc383148cb4fc0679319465303b1549d7))
* **web:** add the submission_source table ([b38de9c](https://github.com/marioparaschiv/unbound/commit/b38de9c60b517cddc64fb900f6edff35a28c7f17))
* **web:** carry the ADDON.md diff on review entries ([a944266](https://github.com/marioparaschiv/unbound/commit/a94426644da86c43e5fdc50dc808147d44c10688))
* **web:** create submissions from GitHub, staging bundles server-side ([aeff80f](https://github.com/marioparaschiv/unbound/commit/aeff80fe173452d22f1a49ea3f8156772ca5c471))
* **web:** diff a submission's ADDON.md against the approved copy ([caa9514](https://github.com/marioparaschiv/unbound/commit/caa9514b47eabf6d23ed58a0f875fcff3a60d3e5))
* **web:** edit addons as staff with pinned summary fields ([d4555fb](https://github.com/marioparaschiv/unbound/commit/d4555fbf506ae697763036b3d48bc8434d40fb6a))
* **web:** edit addons as staff with TanStack Form ([44f3f6b](https://github.com/marioparaschiv/unbound/commit/44f3f6bb311802478ca370618a794d30922c203f))
* **web:** filter admin addons by type, status, maintainer and date ([e708728](https://github.com/marioparaschiv/unbound/commit/e708728db8ca0d04963317b8c9a5472742107b61))
* **web:** filter admin addons by type, status, maintainer and date ([7ba0fe5](https://github.com/marioparaschiv/unbound/commit/7ba0fe5aa30e8d1afdad5dd592944dfa207890df))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** keyset-page and search the admin users and addons lists ([4309629](https://github.com/marioparaschiv/unbound/commit/4309629c55e6883fcdd1483ea147f27aa0ffbaf4))
* **web:** keyset-page and search the admin users and addons lists ([1e6b7db](https://github.com/marioparaschiv/unbound/commit/1e6b7dbb4720019115be1d9e16fddbbb5df42206))
* **web:** load the admin addon and user views ([13d32d3](https://github.com/marioparaschiv/unbound/commit/13d32d34df5af2db6113d30dc791d4a03dfa4bbd))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))
* **web:** read a lost staged bundle again from its pin at approval ([00f3547](https://github.com/marioparaschiv/unbound/commit/00f35478fe0f017ada5d325d54a07c473ac97dc7))
* **web:** read addons from GitHub at a pinned commit ([b1525a3](https://github.com/marioparaschiv/unbound/commit/b1525a3e33b8781681f1cb7ecfdca38d6f9926c7))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read and write staff notes through server functions ([7b2c219](https://github.com/marioparaschiv/unbound/commit/7b2c2196ebba222fda9a4bec999202b64ccea9f1))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** record delist, relist and maintainer changes ([b6ef805](https://github.com/marioparaschiv/unbound/commit/b6ef805a7b29021c678d0d668105944b4d2a3400))
* **web:** record moderation events for addon actions and reviews ([a3c861c](https://github.com/marioparaschiv/unbound/commit/a3c861c44068e2c8a25d59f2a068663ce48b2d46))
* **web:** record review decisions as moderation events ([08244eb](https://github.com/marioparaschiv/unbound/commit/08244eb4d3a20b8bf12f63ca625f019eb72bd6ec))
* **web:** redesign the developer dashboard around addon rows and a review timeline ([#189](https://github.com/marioparaschiv/unbound/issues/189)) ([0d2c619](https://github.com/marioparaschiv/unbound/commit/0d2c61978b33ec92cea3fede19c4740e9b0a3098))
* **web:** render ADDON.md in the submission preview ([633b4d4](https://github.com/marioparaschiv/unbound/commit/633b4d43aab6e15aa88d795f54b8776934bf3ffc))
* **web:** render ADDON.md on the addon page and diff it in review ([f01b1cd](https://github.com/marioparaschiv/unbound/commit/f01b1cdd10ae17f95445b7615544a477e4cb4f0c))
* **web:** render ADDON.md with a safe markdown component ([cf19d55](https://github.com/marioparaschiv/unbound/commit/cf19d55abe20a7d48735b58f11f113709f0c5cfc))
* **web:** retire awaiting_upload with a cutover migration ([bb1049c](https://github.com/marioparaschiv/unbound/commit/bb1049cda36d7abc05c89f07846dea019a935657))
* **web:** roll an addon back to any approved version ([799bbf9](https://github.com/marioparaschiv/unbound/commit/799bbf93dbdddb1f45dba47fdd7bf3dca8869389))
* **web:** roll an addon back to any approved version ([cc7906e](https://github.com/marioparaschiv/unbound/commit/cc7906e159daa38165da5b4e453275cf7dd30172))
* **web:** serve a version from the admin addon page ([b67b9ad](https://github.com/marioparaschiv/unbound/commit/b67b9ad0e103d19bf303372acd2b6d53f5770690))
* **web:** serve only versions no rollback withdrew ([aedc7ff](https://github.com/marioparaschiv/unbound/commit/aedc7ff3820b09c195a294114ee2eb7af527216f))
* **web:** show ADDON.md rendered and as a diff in review ([0d03b1e](https://github.com/marioparaschiv/unbound/commit/0d03b1e04b9ae0cd8b5487458b7317180f505693))
* **web:** show ADDON.md, source and typed changelogs on the addon page ([c14b3e2](https://github.com/marioparaschiv/unbound/commit/c14b3e23ab6a01d7fd164f3f546d3bd762bc36f5))
* **web:** show staff notes on the admin addon and user pages ([3e5993c](https://github.com/marioparaschiv/unbound/commit/3e5993c8ef273d52c27ebfadf4376a5b802343d4))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))
* **web:** submit from a GitHub repository on /submit ([6577e20](https://github.com/marioparaschiv/unbound/commit/6577e20c280073bdd9b7b3d3c18f7b7323072aae))


### Bug Fixes

* **web:** align diff signs and line numbers in wrapped rows ([591c312](https://github.com/marioparaschiv/unbound/commit/591c312be23d15528846ae2fb1be80f6efc370e9))
* **web:** keep catalogs stored before the listing name still parseable ([93cb8b2](https://github.com/marioparaschiv/unbound/commit/93cb8b2f5ad497bb0bf281ace914ba142f7b3c2a))
* **web:** keep catalogs stored before the listing name still parseable ([1db2a60](https://github.com/marioparaschiv/unbound/commit/1db2a60b23bf76c0f29700a761f9ce2149b8f388))
* **web:** keep sessions and the GitHub link usable ([8376b2c](https://github.com/marioparaschiv/unbound/commit/8376b2c272985df37e96c14b66189d2d30a76143))
* **web:** keep sessions and the GitHub link usable ([c5058b6](https://github.com/marioparaschiv/unbound/commit/c5058b683b88936bad9745d5261c83d4ef55bb88))
* **web:** refetch a lost bundle without the author's token if it lapsed ([abab19d](https://github.com/marioparaschiv/unbound/commit/abab19d824852d457c586cbcc47d471634dca34d))
* **web:** wrap long diff lines at word boundaries ([36c2ff2](https://github.com/marioparaschiv/unbound/commit/36c2ff29fe0816200dfd8f1560d1aafe7ed819a9))


### Code Refactoring

* **web:** delete the browser upload path ([ca23b2c](https://github.com/marioparaschiv/unbound/commit/ca23b2c44cc145d77ff28c5b3a92c861332353f5))
* **web:** encode the claim and discovery rules in types ([b3d736f](https://github.com/marioparaschiv/unbound/commit/b3d736f2aed0b8ea8db4ac255d0f6966c8dcffc0))
* **web:** move maintainer functions to lib/maintainers ([f643d3e](https://github.com/marioparaschiv/unbound/commit/f643d3e22d82cd90097b92624dd41bd82c4eaeed))
* **web:** name the ADDON.md line-ending normalizer ([b06f7b8](https://github.com/marioparaschiv/unbound/commit/b06f7b8b6b4cda025657bd48aa8a74e0642005c9))
* **web:** name the numbered diff line type ([706dd64](https://github.com/marioparaschiv/unbound/commit/706dd6482bc253f83636f5973786f6f72e91bf65))
* **web:** rename submit form props to say what they do ([a359c33](https://github.com/marioparaschiv/unbound/commit/a359c338e6d1dacaa0fcb781c36e9198b3e66479))
* **web:** share the marked changelog sections with the public page ([3f9ff86](https://github.com/marioparaschiv/unbound/commit/3f9ff865e590d36cbb8e49e39145c3269b69dd2d))
* **web:** trim admin comments and share the search length limits ([46db19b](https://github.com/marioparaschiv/unbound/commit/46db19bdd0f220e6bef5783294e0086e6146d060))
* **web:** trim rollback, edit and notes comments ([ae8ef66](https://github.com/marioparaschiv/unbound/commit/ae8ef669b7c4c272bb2c791589fc5a111ad1a44b))
* **web:** type submissions the API returns as sourced ([e36193b](https://github.com/marioparaschiv/unbound/commit/e36193b7f68d764ee7e9c5c69791d844c66b498e))


### Styles

* sort imports and shorten script header comments ([d159f61](https://github.com/marioparaschiv/unbound/commit/d159f613a19f0c1eec0095f2283824e758c7a15b))
* **web:** brace the control-character guard ([f1236fb](https://github.com/marioparaschiv/unbound/commit/f1236fbec833c66063e847910cf368a0e7b511e9))
* **web:** drop a type-only sibling import from the review tests ([fda02ce](https://github.com/marioparaschiv/unbound/commit/fda02cec62e6cb1fb2c3785b304a7329bff87e64))
* **web:** sort imports ([9cdc8e1](https://github.com/marioparaschiv/unbound/commit/9cdc8e1836a89f51614fbc9322a43c5736ba3823))
* **web:** sort imports ([7a933e2](https://github.com/marioparaschiv/unbound/commit/7a933e26b00a895ea9fcd1551066e913fba34c88))
* **web:** sort imports and exports ([3d297f5](https://github.com/marioparaschiv/unbound/commit/3d297f511aba79a490328a7033d00d6d25cdac6c))
* **web:** sort review imports ([d5087a9](https://github.com/marioparaschiv/unbound/commit/d5087a90fdeda308bafc83c3b9d9ef1cbae3b0e8))
* **web:** sort test imports ([b0d8839](https://github.com/marioparaschiv/unbound/commit/b0d883951bfa2fc7f206820db44368e924c1c113))


### Tests

* **web:** add a git-backed fake GitHub and cover the reader ([d32e580](https://github.com/marioparaschiv/unbound/commit/d32e580bc44f821322b4b9bad3b83fd2ea86ae42))
* **web:** reproduce stale-session unlink and expired GitHub tokens ([d79e18e](https://github.com/marioparaschiv/unbound/commit/d79e18e5d7bac08d18ba26a0d23ba4fa6bcb3811))
* **web:** share the in-memory S3 server between tests ([b6e779f](https://github.com/marioparaschiv/unbound/commit/b6e779fa84637b2cf840f7ca3c3151c633728eee))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.10.0
    * @unbound-app/utils bumped to 0.9.0
