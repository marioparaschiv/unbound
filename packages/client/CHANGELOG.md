# Changelog

## [3.3.0](https://github.com/marioparaschiv/unbound/compare/client-v3.2.0...client-v3.3.0) (2026-11-14)


### Features

* **client:** report gateway health in /debug ([#1395](https://github.com/marioparaschiv/unbound/issues/1395)) ([b7abfc8](https://github.com/marioparaschiv/unbound/commit/b7abfc89a9817c554c23b9bc7e232e635b66da0a))
* **client:** report power, clock, DNS and notifications in /debug ([#1393](https://github.com/marioparaschiv/unbound/issues/1393)) ([1a9227f](https://github.com/marioparaschiv/unbound/commit/1a9227fa96802e73efd2293ec850db477f2355a4))
* **client:** scrub IDs, tokens and addresses from /debug ([#1396](https://github.com/marioparaschiv/unbound/issues/1396)) ([ce13f61](https://github.com/marioparaschiv/unbound/commit/ce13f61079fd9e510cd4a7f93e45a22439c810b7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.3.0
    * @unbound-app/debugger-protocol bumped to 2.1.1
    * @unbound-app/types bumped to 1.3.0
    * @unbound-app/utils bumped to 1.0.3
    * @unbound-app/web bumped to 2.3.0

## [3.2.0](https://github.com/marioparaschiv/unbound/compare/client-v3.1.0...client-v3.2.0) (2026-11-14)


### Features

* **cli:** add ubd debug report ([#1182](https://github.com/marioparaschiv/unbound/issues/1182)) ([b66397a](https://github.com/marioparaschiv/unbound/commit/b66397a9dbea1b365d28c1454988a5d6ce026b26))
* **client:** add Discord experiments to /debug ([#1237](https://github.com/marioparaschiv/unbound/issues/1237)) ([d2f4622](https://github.com/marioparaschiv/unbound/commit/d2f46220f9034b50ee0568e2447b5ad9a9ae60f5))
* **client:** add errors, log, storage and patches to /debug ([#1163](https://github.com/marioparaschiv/unbound/issues/1163)) ([1cc9625](https://github.com/marioparaschiv/unbound/commit/1cc9625ccecde514a8923d57e66e2e17fd19a339))
* **client:** add network context to /debug ([#1204](https://github.com/marioparaschiv/unbound/issues/1204)) ([6fc2287](https://github.com/marioparaschiv/unbound/commit/6fc22878df442f8c0e7b0e8712cad1da3c6b1280))
* **client:** add plugin versions, display and session to /debug ([#1175](https://github.com/marioparaschiv/unbound/issues/1175)) ([8ece009](https://github.com/marioparaschiv/unbound/commit/8ece009861b7ad241ab3feb9753fd63417e228cd))
* **client:** add weak native handles for plugins ([#1264](https://github.com/marioparaschiv/unbound/issues/1264)) ([7760379](https://github.com/marioparaschiv/unbound/commit/776037991e5b9186edca445dc00f227401c4678f))
* **client:** attach entitlements to /debug only on request ([#1186](https://github.com/marioparaschiv/unbound/issues/1186)) ([2095869](https://github.com/marioparaschiv/unbound/commit/20958695f1fe68ad271c19eea7d9e2d1d48858e6))
* **client:** finish the theme editor ([#1257](https://github.com/marioparaschiv/unbound/issues/1257)) ([a83193b](https://github.com/marioparaschiv/unbound/commit/a83193b3fcf4a31e75e9bac6cbb1b7bbf76c119c))
* **client:** list other tweaks loaded into Discord in /debug ([#1250](https://github.com/marioparaschiv/unbound/issues/1250)) ([dd8c109](https://github.com/marioparaschiv/unbound/commit/dd8c1091d6d94c7776b1d2b2477df47694f91493))
* **client:** move installs of renamed addons to their replacement ([#1281](https://github.com/marioparaschiv/unbound/issues/1281)) ([39a3d4b](https://github.com/marioparaschiv/unbound/commit/39a3d4b7c3882f1b3c1f1fa5ef3795217a6387fa))
* **client:** open the installed addon from its Installed button ([#1188](https://github.com/marioparaschiv/unbound/issues/1188)) ([f314f4c](https://github.com/marioparaschiv/unbound/commit/f314f4c34d2c3a770dfa46266e90d35d7c347ff9))
* **client:** open the store page from addon install links ([#1312](https://github.com/marioparaschiv/unbound/issues/1312)) ([1e34e63](https://github.com/marioparaschiv/unbound/commit/1e34e63a0fc664f808646b81d66fefba8b45f8b2))
* **client:** reconnect a closed gateway on app resume ([#1326](https://github.com/marioparaschiv/unbound/issues/1326)) ([d42e7ba](https://github.com/marioparaschiv/unbound/commit/d42e7baadd98514ff5a155d14fb17dd8949228b6))
* **client:** report missing app extensions in /debug ([#1355](https://github.com/marioparaschiv/unbound/issues/1355)) ([a64b857](https://github.com/marioparaschiv/unbound/commit/a64b857dce2a8d6444c9514af99bdd0988f8c4a0))
* **client:** restart prompt for React DevTools, crash screen fits the screen ([#1380](https://github.com/marioparaschiv/unbound/issues/1380)) ([9e49f5e](https://github.com/marioparaschiv/unbound/commit/9e49f5e75583d7fe336e663af79eca02c1cc7860))
* **client:** share text and links to Discord ([#1353](https://github.com/marioparaschiv/unbound/issues/1353)) ([1e23d41](https://github.com/marioparaschiv/unbound/commit/1e23d41f3de3f162037a9e990c0fd3bea9ae32d6))
* **client:** show addon updates waiting in /debug ([#1251](https://github.com/marioparaschiv/unbound/issues/1251)) ([6d11933](https://github.com/marioparaschiv/unbound/commit/6d11933f2cdaf3f1e3fc4ac041b925828249eec0))
* **client:** sort the marketplace by newest and badge new addons ([#1205](https://github.com/marioparaschiv/unbound/issues/1205)) ([9205847](https://github.com/marioparaschiv/unbound/commit/920584795d56cb98baca8f9b48b48875739a2aaa))
* **client:** turn crash-disabled plugins back on after an update ([#1236](https://github.com/marioparaschiv/unbound/issues/1236)) ([5ebf64d](https://github.com/marioparaschiv/unbound/commit/5ebf64d586f90730649e2e0d03da0d3a698b06a2))
* **devtools:** add a Metro page to browse, load and search modules ([#1273](https://github.com/marioparaschiv/unbound/issues/1273)) ([2e9eb6b](https://github.com/marioparaschiv/unbound/commit/2e9eb6b6d76577a9539b30040aa73ad0e58b5897))
* **devtools:** add an object explorer and structured ubd errors ([#1206](https://github.com/marioparaschiv/unbound/issues/1206)) ([cf37e2b](https://github.com/marioparaschiv/unbound/commit/cf37e2beccf364eb3d4a22842d5c1538c8a5c683))
* **devtools:** find the bridge over Bonjour and add MCP to agents ([#1309](https://github.com/marioparaschiv/unbound/issues/1309)) ([03f4c20](https://github.com/marioparaschiv/unbound/commit/03f4c2016c7064fabb25c853ea766f0f1f9c962d))
* **discord-bot:** diagnose notifications from /debug reports ([#1197](https://github.com/marioparaschiv/unbound/issues/1197)) ([2d540e1](https://github.com/marioparaschiv/unbound/commit/2d540e1e98dc53fe9181ed47470a07d10a3613ae))
* **loader:** add FFI memory, C callbacks and import rebinding ([#1266](https://github.com/marioparaschiv/unbound/issues/1266)) ([5965be8](https://github.com/marioparaschiv/unbound/commit/5965be8306b61099675305e629e79d2fd160b203))
* **loader:** find classes by shape and hook subclasses or late classes ([#1267](https://github.com/marioparaschiv/unbound/issues/1267)) ([c0347ac](https://github.com/marioparaschiv/unbound/commit/c0347ace0a3a57e226b32f88ef3eb25fe3070f8b))
* **loader:** let plugins make Objective-C blocks and classes ([#1265](https://github.com/marioparaschiv/unbound/issues/1265)) ([f23f69b](https://github.com/marioparaschiv/unbound/commit/f23f69b7aa52db68878fd0d06a14b7400a3ba0a4))
* **loader:** report MetricKit hangs and system kills in /debug ([#1271](https://github.com/marioparaschiv/unbound/issues/1271)) ([8a8137a](https://github.com/marioparaschiv/unbound/commit/8a8137ab67e52076ef105555308a6b79bb342f23))
* **loader:** report signer, binary, re-sign, device and HTTPS facts ([#1274](https://github.com/marioparaschiv/unbound/issues/1274)) ([4bb2629](https://github.com/marioparaschiv/unbound/commit/4bb2629210d6cfb5fcd9defdbb89c52fc3178cf7))
* **loader:** report update checks, bundle source and settings ([#1162](https://github.com/marioparaschiv/unbound/issues/1162)) ([fdbe58d](https://github.com/marioparaschiv/unbound/commit/fdbe58da281df988197c52f0f560bc428d8478fd))
* **loader:** skip failed builds, report crashes and pressure ([#1158](https://github.com/marioparaschiv/unbound/issues/1158)) ([dd7f6dd](https://github.com/marioparaschiv/unbound/commit/dd7f6ddc44ede8e26c5cbeeb8d07faac8c4c7d3f))
* **loader:** use Discord's own share extension ([#1367](https://github.com/marioparaschiv/unbound/issues/1367)) ([7f33394](https://github.com/marioparaschiv/unbound/commit/7f33394f23d09da4a5d841e98fc7df0ed5c777ba))
* **plugins:** pick users, channels and servers in settings ([#1259](https://github.com/marioparaschiv/unbound/issues/1259)) ([2de0aa6](https://github.com/marioparaschiv/unbound/commit/2de0aa6db1e861408f973894cf0df17d4be3ff2b))
* **web:** mark scanned Discord builds and updates on /debug ([#1160](https://github.com/marioparaschiv/unbound/issues/1160)) ([b9344cd](https://github.com/marioparaschiv/unbound/commit/b9344cdb12ed71f19603069007a6cd76d290502d))
* **web:** show the Featured shelf atop the addon listings ([#1339](https://github.com/marioparaschiv/unbound/issues/1339)) ([117e6f2](https://github.com/marioparaschiv/unbound/commit/117e6f26825b2a96f597efdb91270b6c4d25a2db))


### Bug Fixes

* **client:** build Reanimated's module before checking its version ([#1222](https://github.com/marioparaschiv/unbound/issues/1222)) ([d1cd985](https://github.com/marioparaschiv/unbound/commit/d1cd985d483d820515c0855815c7321f41e9188d))
* **client:** centre install count icon on iOS ([#1170](https://github.com/marioparaschiv/unbound/issues/1170)) ([8d47245](https://github.com/marioparaschiv/unbound/commit/8d4724556392e003edca4ecd8f380866dc8fa82b))
* **client:** draw empty states with Unbound's hero badge ([#1333](https://github.com/marioparaschiv/unbound/issues/1333)) ([54e39e5](https://github.com/marioparaschiv/unbound/commit/54e39e57a4256e7e062823f9a685d109e777cd47))
* **client:** find the staff experiment handler on Discord's dispatcher ([#1216](https://github.com/marioparaschiv/unbound/issues/1216)) ([7484d81](https://github.com/marioparaschiv/unbound/commit/7484d81dcba31675d5ae5f1dd70cfe33337a6083))
* **client:** hide font groups that duplicate Body ([#1181](https://github.com/marioparaschiv/unbound/issues/1181)) ([5c7c227](https://github.com/marioparaschiv/unbound/commit/5c7c227f6e3ff147a69910ff7ac692cf53dff0b5))
* **client:** log which shared files Discord cannot open ([#1330](https://github.com/marioparaschiv/unbound/issues/1330)) ([d856474](https://github.com/marioparaschiv/unbound/commit/d8564743c1d656eab235f9de689d034e9aa33ea4))
* **client:** mark marketplace addons new only since the last visit ([#1287](https://github.com/marioparaschiv/unbound/issues/1287)) ([2e51988](https://github.com/marioparaschiv/unbound/commit/2e51988347dc89ad3775e15a9aae5d6c173583b2))
* **client:** read the clock outside the marketplace card render ([#1289](https://github.com/marioparaschiv/unbound/issues/1289)) ([be1620b](https://github.com/marioparaschiv/unbound/commit/be1620b49dcb550bd6833f8729d27234027bb513))
* **client:** satisfy lint in the new-badge change ([#1288](https://github.com/marioparaschiv/unbound/issues/1288)) ([171b636](https://github.com/marioparaschiv/unbound/commit/171b636b2e1cc2b897bdbf5135cb9b2d2ba47348))
* **client:** say which filter left a list empty instead of no results ([#1336](https://github.com/marioparaschiv/unbound/issues/1336)) ([55bb8df](https://github.com/marioparaschiv/unbound/commit/55bb8df6c3f8e12a71ed60c3cb91af106bc86d69))
* **client:** serve the dev flavour from the hot build ([#1183](https://github.com/marioparaschiv/unbound/issues/1183)) ([ef25fe7](https://github.com/marioparaschiv/unbound/commit/ef25fe761462cee1568df1bcacf3b6e656962ce9))
* **client:** stamp dev rebuilds with the current revision ([#1161](https://github.com/marioparaschiv/unbound/issues/1161)) ([e7e5e90](https://github.com/marioparaschiv/unbound/commit/e7e5e90e7cccce0f5727b5c9c1fc6005c047e027))
* **client:** stretch the crash screen to full height ([#1256](https://github.com/marioparaschiv/unbound/issues/1256)) ([6a8ce0e](https://github.com/marioparaschiv/unbound/commit/6a8ce0e1a96904e446154668c4ecbf4b735452c4))
* **loader:** write the profile expiry as exp ([#1224](https://github.com/marioparaschiv/unbound/issues/1224)) ([f659a0f](https://github.com/marioparaschiv/unbound/commit/f659a0f6e5fb1da4f7b45c1adaa7b9a8011ba163))
* **web:** strip blank filler characters from tweak names ([#1362](https://github.com/marioparaschiv/unbound/issues/1362)) ([fda92e6](https://github.com/marioparaschiv/unbound/commit/fda92e67874899a52cbefebc7b878ccea6a2bf01))
* **web:** tidy tweak names and seconds on the debug card ([#1358](https://github.com/marioparaschiv/unbound/issues/1358)) ([c1eba58](https://github.com/marioparaschiv/unbound/commit/c1eba58b0dd65814e852c0c6b61366f4546f90c1))


### Performance Improvements

* **client:** skip hidden accordion rows and cut settings page renders ([#1258](https://github.com/marioparaschiv/unbound/issues/1258)) ([923dc6c](https://github.com/marioparaschiv/unbound/commit/923dc6c9091b4032180efd53739143d745c1157a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.2.0
    * @unbound-app/debugger-protocol bumped to 2.1.0
    * @unbound-app/types bumped to 1.2.0
    * @unbound-app/utils bumped to 1.0.2
    * @unbound-app/web bumped to 2.2.0

## [3.1.0](https://github.com/marioparaschiv/unbound/compare/client-v3.0.0...client-v3.1.0) (2026-11-12)


### Features

* **client:** add support, issues and context to /debug ([#1147](https://github.com/marioparaschiv/unbound/issues/1147)) ([05b2839](https://github.com/marioparaschiv/unbound/commit/05b2839cb43f575aaad7bd2b96cbe9580c374815))
* **client:** send /debug as a rendered card ([#1144](https://github.com/marioparaschiv/unbound/issues/1144)) ([6a4b847](https://github.com/marioparaschiv/unbound/commit/6a4b8474da557280ed9771ddeecc54261ad6dc4d))
* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **loader:** let UI scopes implement Java interfaces ([f8ca349](https://github.com/marioparaschiv/unbound/commit/f8ca3499ea8627dfc5f57560928676278b65dea9))
* **loader:** let UI-scope Java hooks rewrite their arguments ([#1130](https://github.com/marioparaschiv/unbound/issues/1130)) ([20893e2](https://github.com/marioparaschiv/unbound/commit/20893e2e907eec6a81f2279ac714eb01aab100e9))
* **loader:** name the Android root manager and bridge failures ([#1150](https://github.com/marioparaschiv/unbound/issues/1150)) ([aa68889](https://github.com/marioparaschiv/unbound/commit/aa68889f9085501378b1d5e4b09728fe6ef12edc))
* **loader:** report bundle state, launches and native crashes ([#1148](https://github.com/marioparaschiv/unbound/issues/1148)) ([f0a0e86](https://github.com/marioparaschiv/unbound/commit/f0a0e8625bfce64c1bbb6133ff154bb5eabee047))
* **web:** render /debug cards on the server ([#1151](https://github.com/marioparaschiv/unbound/issues/1151)) ([6e39c74](https://github.com/marioparaschiv/unbound/commit/6e39c74b8c4bf68578b1a45c9cdb13054c5d4569))


### Bug Fixes

* **client:** name plugin source in stack frames ([#1116](https://github.com/marioparaschiv/unbound/issues/1116)) ([ab03e95](https://github.com/marioparaschiv/unbound/commit/ab03e95d159bc837d1575a8b12fe5c5281c4980c))
* **client:** restore the debug card size and seat the ALT badge ([#1145](https://github.com/marioparaschiv/unbound/issues/1145)) ([418cd0d](https://github.com/marioparaschiv/unbound/commit/418cd0ddb8508f79e0595b3dfb3ea1beb46bbafa))
* **loader:** warn when the loader lacks native bridge API 1.3.0 ([#1136](https://github.com/marioparaschiv/unbound/issues/1136)) ([7e15ee3](https://github.com/marioparaschiv/unbound/commit/7e15ee37dcb9c48e7d07d765e11d63c60bccd855))
* tidy the install and state debug lines ([#1143](https://github.com/marioparaschiv/unbound/issues/1143)) ([f1a2a2f](https://github.com/marioparaschiv/unbound/commit/f1a2a2f3999db8da506373b0248eef644b11bcef))


### Performance Improvements

* **client:** swap icon packs in place with fewer re-renders ([#1133](https://github.com/marioparaschiv/unbound/issues/1133)) ([e859eca](https://github.com/marioparaschiv/unbound/commit/e859eca7f2dafbf44def62deda3e3ea4c58ed469))


### Continuous Integration

* **client:** one bundle channel, gated on a released loader ([#1137](https://github.com/marioparaschiv/unbound/issues/1137)) ([5e7efe3](https://github.com/marioparaschiv/unbound/commit/5e7efe37934f314788dcbb4b5f6c140ded00ec0b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.1.0
    * @unbound-app/debugger-protocol bumped to 2.0.1
    * @unbound-app/types bumped to 1.1.0
    * @unbound-app/utils bumped to 1.0.1
    * @unbound-app/web bumped to 2.1.0

## [3.0.0](https://github.com/marioparaschiv/unbound/compare/client-v2.2.0...client-v3.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Features

* **devtools:** inspect React and native views over the debugger ([#1098](https://github.com/marioparaschiv/unbound/issues/1098)) ([c03a7a9](https://github.com/marioparaschiv/unbound/commit/c03a7a96341f756e992bb5c39fbc74cb73dafb4d))
* **icon-packs:** cover 129 more of Discord's icons ([#1096](https://github.com/marioparaschiv/unbound/issues/1096)) ([817e319](https://github.com/marioparaschiv/unbound/commit/817e3190565ead2f76850ecf1458fef053c6ceb7))
* **loader:** catch frozen starts and show how installs were signed ([#1113](https://github.com/marioparaschiv/unbound/issues/1113)) ([562aa90](https://github.com/marioparaschiv/unbound/commit/562aa9051c36e82d4e3577697d73a64e3397d4db))


### Bug Fixes

* **client:** install the newest version the client can run ([#1108](https://github.com/marioparaschiv/unbound/issues/1108)) ([fd88095](https://github.com/marioparaschiv/unbound/commit/fd880956f1891ce97e682897194afa8d3389fb8d))
* **client:** keep icon marquee across packs, credit Discord ([#1105](https://github.com/marioparaschiv/unbound/issues/1105)) ([e1a2d5f](https://github.com/marioparaschiv/unbound/commit/e1a2d5f97d4eee73a7ac647f79f0e1a51650e59e))
* **cli:** fix four ubd bugs found during device proofs ([#1102](https://github.com/marioparaschiv/unbound/issues/1102)) ([51fb516](https://github.com/marioparaschiv/unbound/commit/51fb516a16b31f44d220e358a54d5248adddcc02))


### Code Refactoring

* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 2.0.0
    * @unbound-app/debugger-protocol bumped to 2.0.0
    * @unbound-app/logger bumped to 1.0.0
    * @unbound-app/types bumped to 1.0.0
    * @unbound-app/utils bumped to 1.0.0
    * @unbound-app/web bumped to 2.0.0

## [2.2.0](https://github.com/marioparaschiv/unbound/compare/client-v2.1.0...client-v2.2.0) (2026-11-11)


### Features

* **icon-packs:** add Lucide, Phosphor and Tabler packs ([#1087](https://github.com/marioparaschiv/unbound/issues/1087)) ([f511100](https://github.com/marioparaschiv/unbound/commit/f511100d837c652d6b24f8eb2f44483d09d5a810))
* **loader:** judge launches by render and exit, retry updates ([#1086](https://github.com/marioparaschiv/unbound/issues/1086)) ([cd39991](https://github.com/marioparaschiv/unbound/commit/cd399911d22a11fe8fbf4db09d6ad3184302eb3b))


### Bug Fixes

* **client:** draw pack icons whose assets register mid-render ([#1095](https://github.com/marioparaschiv/unbound/issues/1095)) ([3a9cc5b](https://github.com/marioparaschiv/unbound/commit/3a9cc5b9ce4bd9054515fad3963293fb043331a7))
* **client:** stop repeat icon pack updates and smooth pack switching ([#1091](https://github.com/marioparaschiv/unbound/issues/1091)) ([383798c](https://github.com/marioparaschiv/unbound/commit/383798ce69efb46b953a973f1a70002e4f120320))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.1.1
    * @unbound-app/debugger-protocol bumped to 1.0.2
    * @unbound-app/types bumped to 0.15.0
    * @unbound-app/utils bumped to 0.10.4
    * @unbound-app/web bumped to 1.1.1

## [2.1.0](https://github.com/marioparaschiv/unbound/compare/client-v2.0.0...client-v2.1.0) (2026-11-11)


### Features

* **client:** draw settings-kit rows with Discord's built-ins ([#1084](https://github.com/marioparaschiv/unbound/issues/1084)) ([cb3b9e2](https://github.com/marioparaschiv/unbound/commit/cb3b9e285094a1f55d4eb75ed8e19826e61758fa))
* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))
* **loader:** health-gated updates and crash recovery ([#1063](https://github.com/marioparaschiv/unbound/issues/1063)) ([0cd3772](https://github.com/marioparaschiv/unbound/commit/0cd37726daa68a2a8c4a2cae49c01e881649ce2e))


### Bug Fixes

* **client:** install icon packs and preview all their icons ([#1081](https://github.com/marioparaschiv/unbound/issues/1081)) ([5a46882](https://github.com/marioparaschiv/unbound/commit/5a46882d62dc311810b5c34ba513a91521a3eff6))
* **client:** keep the last client version off Sync ([#1075](https://github.com/marioparaschiv/unbound/issues/1075)) ([47d9827](https://github.com/marioparaschiv/unbound/commit/47d982795856e4f6fbb306980cd048f44918c43c))
* **client:** select any app icon and show the applied one ([#1076](https://github.com/marioparaschiv/unbound/issues/1076)) ([e598575](https://github.com/marioparaschiv/unbound/commit/e5985759c11b070c37ac5c6929a813ae841429c3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.1.0
    * @unbound-app/debugger-protocol bumped to 1.0.1
    * @unbound-app/types bumped to 0.14.0
    * @unbound-app/utils bumped to 0.10.3
    * @unbound-app/web bumped to 1.1.0

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/client-v1.1.1...client-v2.0.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* **client:** name the install kind in loader update warnings ([#1042](https://github.com/marioparaschiv/unbound/issues/1042)) ([472e3ec](https://github.com/marioparaschiv/unbound/commit/472e3ec1c784ff4a1979f025ee2501b44c010ecb))
* **client:** polish the Plugins, Sync and Updates pages ([#1046](https://github.com/marioparaschiv/unbound/issues/1046)) ([aba402c](https://github.com/marioparaschiv/unbound/commit/aba402c2d905abd6819ab67630f3a5e11d79203f))
* **client:** show icon packs in Discord's theme picker ([#1071](https://github.com/marioparaschiv/unbound/issues/1071)) ([d47801f](https://github.com/marioparaschiv/unbound/commit/d47801f328968076b465016e35ab90cbf805f1cf))
* count anonymous addon installs, sort by popularity ([#1066](https://github.com/marioparaschiv/unbound/issues/1066)) ([9a9f188](https://github.com/marioparaschiv/unbound/commit/9a9f1887a7979f6a6275c678dd677c0a04f7daf5))
* **i18n:** translate Unbound into every Discord locale ([#1070](https://github.com/marioparaschiv/unbound/issues/1070)) ([7ded2cb](https://github.com/marioparaschiv/unbound/commit/7ded2cb0a8b2ebc0a2d9a115029252d7ad70862e))
* **web:** add addon gallery lightbox with drag panning ([#1069](https://github.com/marioparaschiv/unbound/issues/1069)) ([1fd08d5](https://github.com/marioparaschiv/unbound/commit/1fd08d57bbe6737efca3f878e4a1c5fae413bd83))


### Bug Fixes

* **client:** download the IPA for sideloaded loader updates ([#1048](https://github.com/marioparaschiv/unbound/issues/1048)) ([880fa81](https://github.com/marioparaschiv/unbound/commit/880fa812b96d85b4ec6f1f436b6d47e0ccb5f552))
* **client:** mount Design pages as they slide in ([#1061](https://github.com/marioparaschiv/unbound/issues/1061)) ([1830d80](https://github.com/marioparaschiv/unbound/commit/1830d80869e740badb3663bf7514f24e0008e876))
* **loader:** republish the sideloaded IPA on loader updates ([#1050](https://github.com/marioparaschiv/unbound/issues/1050)) ([5664844](https://github.com/marioparaschiv/unbound/commit/5664844740e43449ce55dc1caa4dc05e2bec9d2f))


### Performance Improvements

* **client:** cut Android startup hold from 46 ms to 8 ms ([#1037](https://github.com/marioparaschiv/unbound/issues/1037)) ([88738f1](https://github.com/marioparaschiv/unbound/commit/88738f14ddff40314c76d8da114add2d24569c54))
* **client:** read React Native's Linking instead of a metro search ([#1053](https://github.com/marioparaschiv/unbound/issues/1053)) ([bc826c5](https://github.com/marioparaschiv/unbound/commit/bc826c5f0d37250b12c6679abbc3b7225095275e))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 1.0.0
    * @unbound-app/debugger-protocol bumped to 1.0.0
    * @unbound-app/web bumped to 1.0.0

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/client-v1.1.0...client-v1.1.1) (2026-11-09)


### Bug Fixes

* **client:** run UI worklets on Reanimated 4's worklets runtime ([#1028](https://github.com/marioparaschiv/unbound/issues/1028)) ([269995c](https://github.com/marioparaschiv/unbound/commit/269995c755d6b186af09fa5807cecb29b9411a4b))


### Performance Improvements

* **loader:** lazy settings cache, metro cache file, plugin bytecode installs ([#1032](https://github.com/marioparaschiv/unbound/issues/1032)) ([87179aa](https://github.com/marioparaschiv/unbound/commit/87179aad6016c4e019546bb9ae0ba9d19147f614))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.14.1
    * @unbound-app/debugger-protocol bumped to 0.11.1
    * @unbound-app/types bumped to 0.13.1
    * @unbound-app/utils bumped to 0.10.2
    * @unbound-app/web bumped to 0.14.1

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/client-v1.0.0...client-v1.1.0) (2026-11-09)


### Features

* **app-icons:** custom app icons on every platform ([#987](https://github.com/marioparaschiv/unbound/issues/987)) ([9dbbcf8](https://github.com/marioparaschiv/unbound/commit/9dbbcf8bba4b7abcef6a27d99bb004d3c2a837ef))
* **client:** filter the marketplace by tags ([#1014](https://github.com/marioparaschiv/unbound/issues/1014)) ([d822616](https://github.com/marioparaschiv/unbound/commit/d822616424f95ded34a33e4b3150f9cb38b2d648))
* **client:** park the Icons tab and centre the empty Plugins list ([#976](https://github.com/marioparaschiv/unbound/issues/976)) ([97565f5](https://github.com/marioparaschiv/unbound/commit/97565f57c6bcd7be86e66f91e6d3601575ccabdb))
* **client:** port the restyled crash screen from v2.5 ([#1007](https://github.com/marioparaschiv/unbound/issues/1007)) ([c6a8239](https://github.com/marioparaschiv/unbound/commit/c6a8239b5176357af200a5d819a4f419a569edee))
* **client:** redesign the addon store page ([#1016](https://github.com/marioparaschiv/unbound/issues/1016)) ([8c72fe5](https://github.com/marioparaschiv/unbound/commit/8c72fe5114c80c1178c02bf3f81928ed70870a49))
* **client:** redesign the marketplace with filters and a Featured shelf ([#1010](https://github.com/marioparaschiv/unbound/issues/1010)) ([394caab](https://github.com/marioparaschiv/unbound/commit/394caab113bbcc168820e7cf0826862f89aace23))
* **client:** redesign the updater screen ([#1022](https://github.com/marioparaschiv/unbound/issues/1022)) ([f0677df](https://github.com/marioparaschiv/unbound/commit/f0677df1860f88f609d6beca7016cd9db0ae9b36))
* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Bug Fixes

* **ci:** repair local validation failures ([#988](https://github.com/marioparaschiv/unbound/issues/988)) ([833aa4b](https://github.com/marioparaschiv/unbound/commit/833aa4b55980b791ae306679c20b2d3f1ab63ed0))
* **client:** border every theme swatch and follow Discord's theme ([#1001](https://github.com/marioparaschiv/unbound/issues/1001)) ([c6a6b0f](https://github.com/marioparaschiv/unbound/commit/c6a6b0f57f60ac5bdfd77bc58ebd4ccc4d78b620))
* **client:** draw theme picker swatches and backdrop in real colours ([e0bdb50](https://github.com/marioparaschiv/unbound/commit/e0bdb5028a323cb1a2de1b484664a0ca73099f97))
* **client:** draw theme swatches from their own background colours ([#993](https://github.com/marioparaschiv/unbound/issues/993)) ([473e086](https://github.com/marioparaschiv/unbound/commit/473e0867531c7351e29dac7ca56fe89f806bdf7e))
* **client:** enable staff experiments reliably ([#989](https://github.com/marioparaschiv/unbound/issues/989)) ([74f2295](https://github.com/marioparaschiv/unbound/commit/74f22959c9bd0896b725b62baf41277b97a223ff))
* **client:** fall back to Discord's render when a React patch crashes ([#1008](https://github.com/marioparaschiv/unbound/issues/1008)) ([c4862e9](https://github.com/marioparaschiv/unbound/commit/c4862e90d48b98c5d0089e7a3af1817d9b3bb43f))
* **client:** hide the chat input shadow while a chat background is drawn ([#973](https://github.com/marioparaschiv/unbound/issues/973)) ([5a5cc69](https://github.com/marioparaschiv/unbound/commit/5a5cc692fa5705ca90cf2761b7afcb03482273cd))
* **client:** keep Discord's fibers when a patch-added element crashes ([#1011](https://github.com/marioparaschiv/unbound/issues/1011)) ([9d37735](https://github.com/marioparaschiv/unbound/commit/9d3773596d3ec6954c25833d9fad8f19b1b0b446))
* **client:** keep Discord's own swatch in the theme picker ([#997](https://github.com/marioparaschiv/unbound/issues/997)) ([798f729](https://github.com/marioparaschiv/unbound/commit/798f72950d786c8cec05f5136f9b62fa99949ef9))
* **client:** keep patched components' hooks in one fiber on fallback ([#1009](https://github.com/marioparaschiv/unbound/issues/1009)) ([fa9e03d](https://github.com/marioparaschiv/unbound/commit/fa9e03d16f83c35dfb629e37b83ae4953b40ebf3))
* **client:** lay theme authors over the carousel's hidden caption ([#1002](https://github.com/marioparaschiv/unbound/issues/1002)) ([bd5b711](https://github.com/marioparaschiv/unbound/commit/bd5b711d79df8307dcb4340a60c6ab77fb97f57e))
* **client:** sort updater imports and regenerate the SDK ([#1023](https://github.com/marioparaschiv/unbound/issues/1023)) ([a2abf3a](https://github.com/marioparaschiv/unbound/commit/a2abf3a54729e3b22f1e4632963872fe00d68057))
* **client:** speed up the marketplace and settle its list ([#1020](https://github.com/marioparaschiv/unbound/issues/1020)) ([697d440](https://github.com/marioparaschiv/unbound/commit/697d4407c8ae7fe997cf7728037b8ba22d90ae3a))
* **client:** tidy the updater page ([#1024](https://github.com/marioparaschiv/unbound/issues/1024)) ([f3f94f6](https://github.com/marioparaschiv/unbound/commit/f3f94f6f25ac24cdf30e4cf8a246888bdd1d58d9))


### Performance Improvements

* **loader:** reread only themes after a theme changes on disk ([#977](https://github.com/marioparaschiv/unbound/issues/977)) ([d7c5fa7](https://github.com/marioparaschiv/unbound/commit/d7c5fa708a680ea822b8a895f42c4e41e93cd39e))
* **web:** send only the page icons an addon page uses ([#1019](https://github.com/marioparaschiv/unbound/issues/1019)) ([2eb5a49](https://github.com/marioparaschiv/unbound/commit/2eb5a49c2d6448e7fe3ec691c8e54cb80573921b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.14.0
    * @unbound-app/debugger-protocol bumped to 0.11.0
    * @unbound-app/types bumped to 0.13.0
    * @unbound-app/utils bumped to 0.10.1
    * @unbound-app/web bumped to 0.14.0

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/client-v0.12.0...client-v1.0.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* **rollup-plugin-hermes:** the plugin is ESM-only, `manifestUrl` is now `registryUrl`, and the manifest helpers moved from dist/manifest.js to the `./manifest` export.

### Features

* **avatar-radius:** round avatars from UI-thread hooks ([4809639](https://github.com/marioparaschiv/unbound/commit/480963908b2f13cbafee1d4abce5c6618bf959fa))
* **cli:** add ubd profile for Hermes' sampling profiler ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **client:** add a typed native.objc.create ([#726](https://github.com/marioparaschiv/unbound/issues/726)) ([6dca897](https://github.com/marioparaschiv/unbound/commit/6dca89729b4efc0f5022147145e5515b522c52d4))
* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** add chat backgrounds that themes can recommend ([#966](https://github.com/marioparaschiv/unbound/issues/966)) ([4b72e6e](https://github.com/marioparaschiv/unbound/commit/4b72e6e9f7d29608901ec4320985685fd3cd1069))
* **client:** add commands.register and commands.unregister ([#708](https://github.com/marioparaschiv/unbound/issues/708)) ([2ea9a39](https://github.com/marioparaschiv/unbound/commit/2ea9a390863152c23586e3838e72e63cf013a543))
* **client:** add metro.onModuleLoad and hide internal members ([#695](https://github.com/marioparaschiv/unbound/issues/695)) ([ad49b36](https://github.com/marioparaschiv/unbound/commit/ad49b36ed1988770143efc97c2009459cab784ac))
* **client:** add new names for fs, assets, toasts, i18n and settings ([#693](https://github.com/marioparaschiv/unbound/issues/693)) ([968a5d4](https://github.com/marioparaschiv/unbound/commit/968a5d4b7ffc26a1a0d0bde605da210b642b230c))
* **client:** add the Bucket API to storage ([#694](https://github.com/marioparaschiv/unbound/issues/694)) ([e0be2df](https://github.com/marioparaschiv/unbound/commit/e0be2dfe91c70bd3c431316dad008d20c44f6f44))
* **client:** add the domain-move codemod ([#690](https://github.com/marioparaschiv/unbound/issues/690)) ([95bc097](https://github.com/marioparaschiv/unbound/commit/95bc0979881b875875e0fa04ce3b688153977c58))
* **client:** add the flux namespace ([#722](https://github.com/marioparaschiv/unbound/issues/722)) ([f0213f2](https://github.com/marioparaschiv/unbound/commit/f0213f2d78a309964be60f3101803b8a750b9f8c))
* **client:** add the ui namespace for addon settings ([#728](https://github.com/marioparaschiv/unbound/issues/728)) ([26840c9](https://github.com/marioparaschiv/unbound/commit/26840c943c39a5412dda1a30376faf066fae0cd3))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** expose plugin start durations ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **client:** lazy patch targets and lazy addon lookups ([#714](https://github.com/marioparaschiv/unbound/issues/714)) ([e7c1cd9](https://github.com/marioparaschiv/unbound/commit/e7c1cd9a7c788bf1f6a3d58a63591a91df36cdf4))
* **client:** let worklets call back into JS ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** log unhandled promise rejections ([833b739](https://github.com/marioparaschiv/unbound/commit/833b739b4d58ec47c5b56ea33f5266edef35ebd3))
* **client:** move fonts to a native font store with presets ([#969](https://github.com/marioparaschiv/unbound/issues/969)) ([40ff081](https://github.com/marioparaschiv/unbound/commit/40ff081f49917861523acf3e0a1ad0e8b6ec14f0))
* **client:** read and write settings through the loader ([e2651a2](https://github.com/marioparaschiv/unbound/commit/e2651a29c0ac9f37459f20033d67aa184144988e))
* **client:** read manifest platforms, add definePlatform and has ([#723](https://github.com/marioparaschiv/unbound/issues/723)) ([9c31acf](https://github.com/marioparaschiv/unbound/commit/9c31acf0591982314e8c35457b91740d45f3d67a))
* **client:** rebuild Plugins and Design settings on Discord primitives ([#964](https://github.com/marioparaschiv/unbound/issues/964)) ([cd4349f](https://github.com/marioparaschiv/unbound/commit/cd4349fdd5b74ede4f267d7716ad16380c51fc9c))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **client:** scope module listeners, buckets, flux and commands ([#731](https://github.com/marioparaschiv/unbound/issues/731)) ([e8e913c](https://github.com/marioparaschiv/unbound/commit/e8e913cb68d341bb0dd75614b390b35bec805555))
* **client:** show an addon's store page from the marketplace ([#725](https://github.com/marioparaschiv/unbound/issues/725)) ([6f87e74](https://github.com/marioparaschiv/unbound/commit/6f87e74b5b712d210d9e449c8ad33dee330badeb))
* **client:** splice hook changes in place during hot refresh ([#890](https://github.com/marioparaschiv/unbound/issues/890)) ([ab1355c](https://github.com/marioparaschiv/unbound/commit/ab1355c493239e287dcd9c2f6a6895aeae7fb39d))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** show plugin start times in ubd status ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **discord-bot:** v2 addon cards with gallery and author avatars ([#871](https://github.com/marioparaschiv/unbound/issues/871)) ([444fe85](https://github.com/marioparaschiv/unbound/commit/444fe854746bc7e5a0b654e0ad17ffaecb8f7bc5))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* **loader:** keep settings native and read them on demand ([e2651a2](https://github.com/marioparaschiv/unbound/commit/e2651a29c0ac9f37459f20033d67aa184144988e))
* **loader:** replace preload.js with the UnboundNative bridge ([#902](https://github.com/marioparaschiv/unbound/issues/902)) ([4d7a469](https://github.com/marioparaschiv/unbound/commit/4d7a469e0cad7791c731e0f2b156bde960722406))
* **loader:** report active iOS jailbreak in diagnostics ([#905](https://github.com/marioparaschiv/unbound/issues/905)) ([b00057b](https://github.com/marioparaschiv/unbound/commit/b00057bb2208c4b5b080a9a5251bf1aed5ce81c1))
* **loader:** ship the React DevTools backend as signed bytecode ([#919](https://github.com/marioparaschiv/unbound/issues/919)) ([d940256](https://github.com/marioparaschiv/unbound/commit/d940256443edfc12fb0fd5bb6ae0eb013f4aadcb))
* native sponsor badges in Discord and staff badges without a sponsorship ([#909](https://github.com/marioparaschiv/unbound/issues/909)) ([3fdd04f](https://github.com/marioparaschiv/unbound/commit/3fdd04fd167760332bf5a4c605509a959b9ac6e6))
* **native:** run plugin hooks on the UI thread ([4dde7a6](https://github.com/marioparaschiv/unbound/commit/4dde7a66bc26463ebc0e043c6c630727f3dba730))
* **plugins:** add Aussie Mode and Aussie Speech ([00a6123](https://github.com/marioparaschiv/unbound/commit/00a61233243e389c9cc1006f847f79a4a4b2b374))
* require a minimum loader version per bundle ([#962](https://github.com/marioparaschiv/unbound/issues/962)) ([840bcfa](https://github.com/marioparaschiv/unbound/commit/840bcfa3912c370623fad8b7e810af46e5598d8f))
* **rollup-plugin-hermes:** move hermes tooling into the repo ([#957](https://github.com/marioparaschiv/unbound/issues/957)) ([b91ec1e](https://github.com/marioparaschiv/unbound/commit/b91ec1e283e51ddf94a5296872181856e68655b8))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **client:** animate GIF sponsor badges in the directory and sheet ([#914](https://github.com/marioparaschiv/unbound/issues/914)) ([172d1de](https://github.com/marioparaschiv/unbound/commit/172d1de02fba90373324ac43ade6a3d7834ee124))
* **client:** apply icon packs on Discord 349 ([#730](https://github.com/marioparaschiv/unbound/issues/730)) ([b4f7310](https://github.com/marioparaschiv/unbound/commit/b4f73109ad4e430402851d5a7e3be884ebdb7eaa))
* **client:** drop the input guard underlay over a chat background ([#968](https://github.com/marioparaschiv/unbound/issues/968)) ([c1e3af5](https://github.com/marioparaschiv/unbound/commit/c1e3af5ba36dee2eaeb51c61e80c7afd7afe3c66))
* **client:** let native calls made during a plugin's stop finish ([c461211](https://github.com/marioparaschiv/unbound/commit/c461211309bd17d6fdf706572a59ad467946ba76))
* **client:** log promise rejections from before Discord's bundle runs ([496e33b](https://github.com/marioparaschiv/unbound/commit/496e33b8b1c6adfe8f46f617f6f05fd9c5c25577))
* **client:** render mid-sentence page media uncropped ([#740](https://github.com/marioparaschiv/unbound/issues/740)) ([0c8f2aa](https://github.com/marioparaschiv/unbound/commit/0c8f2aad99503ef16b7132e6904fecd5dfea746b))
* **client:** render store page media and bold on Discord 349 ([#732](https://github.com/marioparaschiv/unbound/issues/732)) ([bc19683](https://github.com/marioparaschiv/unbound/commit/bc1968388911bc769286854a12d725ce5e21f9cf))
* **client:** show sponsor badges before Discord's own badges ([#958](https://github.com/marioparaschiv/unbound/issues/958)) ([68e2c24](https://github.com/marioparaschiv/unbound/commit/68e2c24fdb0d8dd2e02c8d3f0c913370d05a8c3e))
* **client:** track rejections through Hermes alone, not Sentry ([b3c2979](https://github.com/marioparaschiv/unbound/commit/b3c2979bda99228eb39c483bb9e1124811bd5184))
* **client:** trim isRenderable and the design audit from the SDK ([#867](https://github.com/marioparaschiv/unbound/issues/867)) ([e47bd64](https://github.com/marioparaschiv/unbound/commit/e47bd646d89fb4fd6461164c4a8c6c9acf8d7126))
* **loader:** report why the smoke crash fixture could not be armed ([00a6123](https://github.com/marioparaschiv/unbound/commit/00a61233243e389c9cc1006f847f79a4a4b2b374))
* **native:** follow Cocoa ownership in the iOS bridge and create ([#904](https://github.com/marioparaschiv/unbound/issues/904)) ([d17f03c](https://github.com/marioparaschiv/unbound/commit/d17f03c15fef7d0dfcb57ca37970e806371a35b8))
* **plugins:** keep Reaction Avatars pills intact across restarts ([c461211](https://github.com/marioparaschiv/unbound/commit/c461211309bd17d6fdf706572a59ad467946ba76))


### Performance Improvements

* **chat-bubbles:** wake JS only for Android rows that need measuring ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** add a cached byTypeName metro filter ([45ce33c](https://github.com/marioparaschiv/unbound/commit/45ce33c0a17bf1aa83955410bab0811019d0d49e))
* **client:** create UIKit objects on the main thread ([f83f796](https://github.com/marioparaschiv/unbound/commit/f83f796ab270d59c7c3d993401e19bf389e230ec))
* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **client:** load modules on demand, import Discord's libraries ([#789](https://github.com/marioparaschiv/unbound/issues/789)) ([d732248](https://github.com/marioparaschiv/unbound/commit/d7322488f7019307615246b4fc29d60fa5d85330))
* **client:** look up file-path searches and waits by path ([#806](https://github.com/marioparaschiv/unbound/issues/806)) ([8c17656](https://github.com/marioparaschiv/unbound/commit/8c17656d0990b9e88e68457458363e37dfe65c27))
* **client:** start late plugins after Discord's first frame ([94c7428](https://github.com/marioparaschiv/unbound/commit/94c7428c663d707ab72ba54cb7dc102726484072))
* **loader:** harden the native runtime and add cheaper native paths ([#879](https://github.com/marioparaschiv/unbound/issues/879)) ([3686732](https://github.com/marioparaschiv/unbound/commit/36867326491240cc5ab27082a795537df282de27))
* **loader:** hash bundles and download addon files natively ([#903](https://github.com/marioparaschiv/unbound/issues/903)) ([8e9d4e6](https://github.com/marioparaschiv/unbound/commit/8e9d4e6b84564f3944b5c325cff42717829ee741))
* **loader:** keep compiled plugin sources off the JS heap ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))
* **plugins:** find Mention Avatars text views with one native search ([f83f796](https://github.com/marioparaschiv/unbound/commit/f83f796ab270d59c7c3d993401e19bf389e230ec))
* **plugins:** restore Reaction Avatars layouts asynchronously ([f83f796](https://github.com/marioparaschiv/unbound/commit/f83f796ab270d59c7c3d993401e19bf389e230ec))
* **plugins:** share one async table update across Shiki rows ([f83f796](https://github.com/marioparaschiv/unbound/commit/f83f796ab270d59c7c3d993401e19bf389e230ec))
* **plugins:** stop Chat Bubbles from blocking UIKit on JavaScript ([f83f796](https://github.com/marioparaschiv/unbound/commit/f83f796ab270d59c7c3d993401e19bf389e230ec))
* run Unbound before Discord's bundle and hook Metro's define ([#803](https://github.com/marioparaschiv/unbound/issues/803)) ([e84491b](https://github.com/marioparaschiv/unbound/commit/e84491bfa033dfadd42ad58310826771ac9e1959))
* **sdk-generator:** skip type checking while bundling the SDK ([7171793](https://github.com/marioparaschiv/unbound/commit/7171793a4c6c47b26ca27e187b57aa47e38e7533))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **client:** add the Addon class and per-kind behaviour ([#705](https://github.com/marioparaschiv/unbound/issues/705)) ([3195a68](https://github.com/marioparaschiv/unbound/commit/3195a68bb18b726d8e7c6e2e1ef033d58fb387a6))
* **client:** delete old-path stubs and ui barrels ([#719](https://github.com/marioparaschiv/unbound/issues/719)) ([ddbd151](https://github.com/marioparaschiv/unbound/commit/ddbd151def57542a55b3dd8f5b3c283206d29ea9))
* **client:** import domains directly from ui addon folders ([#711](https://github.com/marioparaschiv/unbound/issues/711)) ([e087100](https://github.com/marioparaschiv/unbound/commit/e087100971d6f26809a2e37ac99b0fdc1eb643cc))
* **client:** import domains directly in ui/settings ([#709](https://github.com/marioparaschiv/unbound/issues/709)) ([537002d](https://github.com/marioparaschiv/unbound/commit/537002d7304299ad0ec700b7d93e73ec16455c6d))
* **client:** move client modules into domain folders ([#707](https://github.com/marioparaschiv/unbound/issues/707)) ([6aa56a9](https://github.com/marioparaschiv/unbound/commit/6aa56a930028d426a3d5b3e46be5a0c2a47ccff7))
* **client:** move the promise rejection built-in into diagnostics ([e6d435d](https://github.com/marioparaschiv/unbound/commit/e6d435dade963e497728cf6e58f832cd0e65b6c5))
* **client:** pass the built-ins to the registry from core ([#680](https://github.com/marioparaschiv/unbound/issues/680)) ([e5fc5cb](https://github.com/marioparaschiv/unbound/commit/e5fc5cb6cd592b7c63e7ea758ae9ec1881eac1e2))
* **client:** register settings sections from each domain ([#713](https://github.com/marioparaschiv/unbound/issues/713)) ([ec7724d](https://github.com/marioparaschiv/unbound/commit/ec7724d34b4fcd0dc7bcb1738b3fa00c0390c18f))
* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
* **client:** share the native method-to-Capability map ([#681](https://github.com/marioparaschiv/unbound/issues/681)) ([cbfa587](https://github.com/marioparaschiv/unbound/commit/cbfa5873fc4ee69f24d2719eccf672f40dd9ce13))
* **client:** split the native runtime by concern ([#712](https://github.com/marioparaschiv/unbound/issues/712)) ([f00a8f7](https://github.com/marioparaschiv/unbound/commit/f00a8f724f37c362f2075e9398b2fc128ee41460))
* **client:** type each patcher callback by its patch kind ([#682](https://github.com/marioparaschiv/unbound/issues/682)) ([a6e2744](https://github.com/marioparaschiv/unbound/commit/a6e2744af84e3f051731bd6f7df6d5f0b9c67e03))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Documentation

* move task-specific rules from AGENTS.md into skills ([#735](https://github.com/marioparaschiv/unbound/issues/735)) ([4289367](https://github.com/marioparaschiv/unbound/commit/428936749c7334884a3c60d643f9961e56068ea6))


### Tests

* **client:** type the createStyles stub's sheet as view styles ([#965](https://github.com/marioparaschiv/unbound/issues/965)) ([176c5f7](https://github.com/marioparaschiv/unbound/commit/176c5f761dff1e464f48d6b37cd4e576c1588e02))
* **loader:** run the smoke fault scripts against the real client ([00a6123](https://github.com/marioparaschiv/unbound/commit/00a61233243e389c9cc1006f847f79a4a4b2b374))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **loader:** flag main loader commits that never got a build ([00a6123](https://github.com/marioparaschiv/unbound/commit/00a61233243e389c9cc1006f847f79a4a4b2b374))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.13.0
    * @unbound-app/debugger-protocol bumped to 0.10.0
    * @unbound-app/logger bumped to 0.7.3
    * @unbound-app/types bumped to 0.12.0
    * @unbound-app/utils bumped to 0.10.0
    * @unbound-app/web bumped to 0.13.0

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/client-v0.11.0...client-v0.12.0) (2026-10-31)


### Features

* **android:** search plugin views on the main thread ([#509](https://github.com/marioparaschiv/unbound/issues/509)) ([4616a75](https://github.com/marioparaschiv/unbound/commit/4616a75e2f79abd325146e7cc1f49cf0bb856317))
* choose and downgrade addon versions from the marketplace ([#443](https://github.com/marioparaschiv/unbound/issues/443)) ([7190ac2](https://github.com/marioparaschiv/unbound/commit/7190ac2e53ecb0d49976898dee8c61bf19705ae3))
* **client:** give the loader file and framework their own parentheses ([#505](https://github.com/marioparaschiv/unbound/issues/505)) ([b2da5fb](https://github.com/marioparaschiv/unbound/commit/b2da5fbe8c00cbf36e0e6e3eb8d98486de8a38de))
* **client:** name every /debug state and source the same way ([#477](https://github.com/marioparaschiv/unbound/issues/477)) ([18ca42a](https://github.com/marioparaschiv/unbound/commit/18ca42ab6dad7945347982bc44a4f8d44fa2cdf3))
* **client:** name the Discord channel in /debug ([#483](https://github.com/marioparaschiv/unbound/issues/483)) ([5726d1b](https://github.com/marioparaschiv/unbound/commit/5726d1b9b7d707ebf011e1484a04399e9e762b04))
* **client:** open a prefilled GitHub issue from Unbound's settings ([#480](https://github.com/marioparaschiv/unbound/issues/480)) ([84b69a3](https://github.com/marioparaschiv/unbound/commit/84b69a3984a3aaf4b00faf602f9251ad5e6d473e))
* **client:** say when /debug could not attach entitlements ([#489](https://github.com/marioparaschiv/unbound/issues/489)) ([415f5df](https://github.com/marioparaschiv/unbound/commit/415f5dff6111c40e03e688264feba3c2f827658c))
* **client:** send a fuller /debug report with iOS entitlements ([#472](https://github.com/marioparaschiv/unbound/issues/472)) ([699c8f2](https://github.com/marioparaschiv/unbound/commit/699c8f2913ad1cfa02288e385b26ea4acb89410b))
* **client:** send where a plugin froze with its crash report ([#485](https://github.com/marioparaschiv/unbound/issues/485)) ([4760beb](https://github.com/marioparaschiv/unbound/commit/4760beb5cf7b6a0dc44333684b0f8dddf58f6061))
* **client:** show one toast for plugins that hot reload together ([#482](https://github.com/marioparaschiv/unbound/issues/482)) ([cd34edf](https://github.com/marioparaschiv/unbound/commit/cd34edf1c869581aa3b15a95453587aa116c22a3))
* **client:** show where a frozen plugin was stuck ([#467](https://github.com/marioparaschiv/unbound/issues/467)) ([10d4cab](https://github.com/marioparaschiv/unbound/commit/10d4cabb812a39b83d41a13e7bb04ff12680f9c6))
* give /debug the same shape on Android and iOS ([#476](https://github.com/marioparaschiv/unbound/issues/476)) ([73d89f4](https://github.com/marioparaschiv/unbound/commit/73d89f4962a43dff91bb91aef6f85e13d1a72afa))
* lowercase the Discord channel in debug and issue reports ([#506](https://github.com/marioparaschiv/unbound/issues/506)) ([6874a72](https://github.com/marioparaschiv/unbound/commit/6874a723cee17922d617845015b755c9d1f5426e))
* open the issue forms prefilled from the app and toolbox ([6d53912](https://github.com/marioparaschiv/unbound/commit/6d5391293ad2e7d2e886eab16dedbe80e657a29c))
* **plugin-scripts:** fail the matrix on any empty toast ([#547](https://github.com/marioparaschiv/unbound/issues/547)) ([0c257d1](https://github.com/marioparaschiv/unbound/commit/0c257d1a77576c9e9595b59a3a2127833b80864a))
* **plugin-scripts:** stress-scroll every device in the matrix ([#543](https://github.com/marioparaschiv/unbound/issues/543)) ([a5c9461](https://github.com/marioparaschiv/unbound/commit/a5c946112954ad3e2e52d26c66931050c7a7b3b8))
* polish /debug and name Android devices properly ([#475](https://github.com/marioparaschiv/unbound/issues/475)) ([44d27e7](https://github.com/marioparaschiv/unbound/commit/44d27e7741628664bac2affbba80bf1f1dd06851))
* report the verified build on both platforms ([#499](https://github.com/marioparaschiv/unbound/issues/499)) ([eda9405](https://github.com/marioparaschiv/unbound/commit/eda9405ec5a3ed911aecbe4c34be67b24537d8ca))
* send the sampled freeze stack as the report stack ([#490](https://github.com/marioparaschiv/unbound/issues/490)) ([0fc8e1e](https://github.com/marioparaschiv/unbound/commit/0fc8e1e043b25712311c5fa1bc98c9deda205e4d))


### Bug Fixes

* **client:** read core settings from the loader's store ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **client:** remove settings at nested key paths ([#581](https://github.com/marioparaschiv/unbound/issues/581)) ([b1f1f6e](https://github.com/marioparaschiv/unbound/commit/b1f1f6e615401b638ed798b8eae597790bc32d4a))
* **client:** render Android toasts without FullWindowOverlay ([#536](https://github.com/marioparaschiv/unbound/issues/536)) ([e9b6e53](https://github.com/marioparaschiv/unbound/commit/e9b6e535d2a6f0e81ac365bcbdc0546d21bdc7eb))
* **client:** show the install source in /debug as plain text ([#481](https://github.com/marioparaschiv/unbound/issues/481)) ([c72496e](https://github.com/marioparaschiv/unbound/commit/c72496e90bec47cfa569c170d4af1a58b1a19d29))
* **client:** stop showing empty toasts ([#529](https://github.com/marioparaschiv/unbound/issues/529)) ([dc34876](https://github.com/marioparaschiv/unbound/commit/dc3487688646e5d65efbb7dc822a1aa7df7c3431))
* **plugins:** reach the Android module's current class names ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* settings controls, bubble layout and compat scan cleanup ([#582](https://github.com/marioparaschiv/unbound/issues/582)) ([d685226](https://github.com/marioparaschiv/unbound/commit/d6852266f2ea8ee6301bc43e4cc4e6f1dfa686ec))
* use one link scheme across the loader, client and site ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))
* **loader:** choose the Android build in a tested command ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** move first-party plugin ids to the new namespace ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Build System

* treat Bun's empty test runs as passing in the pre-push hook ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Documentation

* match the Android install steps to the release assets ([260d1e1](https://github.com/marioparaschiv/unbound/commit/260d1e1d70b36185d780a202052f577c0ac5fe9a))


### Tests

* **core:** keep sanitizer reports out of the crash attribution children ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* remove tautological tests and stop pinning brittle details ([#437](https://github.com/marioparaschiv/unbound/issues/437)) ([b69ca6c](https://github.com/marioparaschiv/unbound/commit/b69ca6c97c6470ac6cb1b0fa515c6e2f79639ba7))


### Continuous Integration

* **deps:** fit Dependabot titles to the commit header limit ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* label new issues and ask for missing details ([6d53912](https://github.com/marioparaschiv/unbound/commit/6d5391293ad2e7d2e886eab16dedbe80e657a29c))
* **loader:** build PRs against the current App Store Discord ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** let main builds finish instead of cancelling each other ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** scan and release sensibly when dkrypt stalls ([6d53912](https://github.com/marioparaschiv/unbound/commit/6d5391293ad2e7d2e886eab16dedbe80e657a29c))
* **loader:** show smoke failures and the first crash in the PR comment ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** skip the Android smoke test for unattested builds ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.12.0
    * @unbound-app/debugger-protocol bumped to 0.9.1
    * @unbound-app/logger bumped to 0.7.2
    * @unbound-app/types bumped to 0.11.0
    * @unbound-app/utils bumped to 0.9.2
    * @unbound-app/web bumped to 0.12.0

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/client-v0.10.0...client-v0.11.0) (2026-10-29)


### Features

* **android:** let plugins describe Java classes ([b7a4898](https://github.com/marioparaschiv/unbound/commit/b7a4898889b4143c37861c94a5b3de6619c4d520))
* **api:** expose Java class descriptions to plugins ([dc005c7](https://github.com/marioparaschiv/unbound/commit/dc005c794d4d6df4b4125aa4863a8106435b99be))
* attribute crashes inside plugin callbacks to the plugin ([aca4ff2](https://github.com/marioparaschiv/unbound/commit/aca4ff217a0b083a474884c8de44c99b7552f5fc))
* **cli:** add ubd logs and ubd inspect, kill timed-out step trees ([b2c6307](https://github.com/marioparaschiv/unbound/commit/b2c630739d7b8fb5b68d8fc0f53d18dd54c63880))
* **cli:** add ubd status and ubd bridge restart ([#413](https://github.com/marioparaschiv/unbound/issues/413)) ([ca2a235](https://github.com/marioparaschiv/unbound/commit/ca2a235a73f37f6425fc91dfb6a2dd9dc953805d))
* **client:** add a commands API for plugins and built-ins ([#336](https://github.com/marioparaschiv/unbound/issues/336)) ([0086dff](https://github.com/marioparaschiv/unbound/commit/0086dff6eb2eb475278c3e4d041e7e2840c73e4e))
* **client:** add a Dialogs API ([#381](https://github.com/marioparaschiv/unbound/issues/381)) ([525bbfb](https://github.com/marioparaschiv/unbound/commit/525bbfb0bf035673a298ca96868a417314a3eee0)), closes [#33](https://github.com/marioparaschiv/unbound/issues/33)
* **client:** attach scrubbed log lines to crash reports ([0f0868f](https://github.com/marioparaschiv/unbound/commit/0f0868f0657432a977a23454ba8e6225c8ccf955))
* **client:** attach scrubbed log lines to crash reports ([0733cbf](https://github.com/marioparaschiv/unbound/commit/0733cbfcd59321d8faf417367c973ecef1ff0ae2))
* **client:** backfill signatures of published release bundles ([18e37cb](https://github.com/marioparaschiv/unbound/commit/18e37cb2320ae26691977357b47f06ca5a86602f))
* **client:** fall back to Unbound components Discord drops ([7c26070](https://github.com/marioparaschiv/unbound/commit/7c2607053c31e2bcda3d971f98ddc167f70728bf))
* **client:** fall back to Unbound components Discord drops ([1b517c4](https://github.com/marioparaschiv/unbound/commit/1b517c486252817f6947c5b70ec2751ffdc2c39e))
* **client:** hide library plugins and handle their dependents ([b24d755](https://github.com/marioparaschiv/unbound/commit/b24d755b49765190412936e0e365b04b70d0b02e))
* **client:** hide library plugins and handle their dependents ([4bf9fb5](https://github.com/marioparaschiv/unbound/commit/4bf9fb53581334a42e227a7ed20f2b9b34948325))
* **client:** leave plugins pushed with ubd out of update checks ([#407](https://github.com/marioparaschiv/unbound/issues/407)) ([0c96a57](https://github.com/marioparaschiv/unbound/commit/0c96a57ae67fafba0c9ca378763f86e0d5183464))
* **client:** mark which plugin runs native work for the crash guard ([1aff9a6](https://github.com/marioparaschiv/unbound/commit/1aff9a68e6e00948aae82566460fc0f948eea443))
* **client:** register Unbound's own slash commands ([#337](https://github.com/marioparaschiv/unbound/issues/337)) ([a226054](https://github.com/marioparaschiv/unbound/commit/a2260540700c9125abb9c6df0b77171e942de5e4))
* **client:** send files from the share extension to a channel ([2e0b580](https://github.com/marioparaschiv/unbound/commit/2e0b580c290320079a785678d3de7a53c9cf86c5))
* **client:** send files from the share extension to a channel ([ff93e74](https://github.com/marioparaschiv/unbound/commit/ff93e74b57ad668d751261777468bad02ca88f30))
* **client:** send opt-in crash reports to the API ([311f957](https://github.com/marioparaschiv/unbound/commit/311f957b1172343e1474813ddc73cacbd6f6de50))
* **client:** send opt-in crash reports to the API ([9f10514](https://github.com/marioparaschiv/unbound/commit/9f10514fe9248fef7ed735b344537e02ed1f0afe))
* **client:** show a recoverable screen when Discord crashes ([248c550](https://github.com/marioparaschiv/unbound/commit/248c55059d5eb030d3e41ab8671cf7da83c2adbe))
* **client:** show a recoverable screen when Discord crashes ([b002a81](https://github.com/marioparaschiv/unbound/commit/b002a811fa08a3271681a08a3d3e3779ac1e1f59))
* **client:** sign a manifest that hashes every bundle ([94c42c8](https://github.com/marioparaschiv/unbound/commit/94c42c8c8ad308f39169c857f000e4a60472fa5e))
* **client:** sign bundles at build time ([805943d](https://github.com/marioparaschiv/unbound/commit/805943df5a04b3aeee78236f2f44450376dc4d42))
* **client:** skip addons the loader disabled after crashes ([dccfc36](https://github.com/marioparaschiv/unbound/commit/dccfc36fe814b945cc4e2dd361f982626f092f50))
* **client:** tag dev copies and reinstall them from the store ([#412](https://github.com/marioparaschiv/unbound/issues/412)) ([b0ad554](https://github.com/marioparaschiv/unbound/commit/b0ad5543c78c544cba641e9186a94fffaaf0e2e8))
* **client:** upload pull request builds to the public bucket ([47639e0](https://github.com/marioparaschiv/unbound/commit/47639e0b23a20736b0fcca79a2a584fd7ea1e767))
* **client:** warn when Discord is older than supported ([217d4d0](https://github.com/marioparaschiv/unbound/commit/217d4d08b88104c41131c57f748dc37568e39cbe))
* **cli:** push compiled bytecode with a plugin ([#425](https://github.com/marioparaschiv/unbound/issues/425)) ([87624bb](https://github.com/marioparaschiv/unbound/commit/87624bb81463b9eb529c82cca3dda1fef8b9b581))
* **cli:** tail Discord's filtered log with ubd logs ([3a0693a](https://github.com/marioparaschiv/unbound/commit/3a0693acb7848effbc35ea8ffcce215f59f51340))
* **debugger:** timestamp the bridge log and name the connected device ([#401](https://github.com/marioparaschiv/unbound/issues/401)) ([61ba33f](https://github.com/marioparaschiv/unbound/commit/61ba33f333f939dac9e8c0f98c40d2b468a2c604))
* disable addons that crash Discord on start ([3b1ae7f](https://github.com/marioparaschiv/unbound/commit/3b1ae7f775397cbdd3307ebfa0068da709fee3fc))
* **discord-types:** generated Discord component types, published as @unbound-app/discord-types ([#342](https://github.com/marioparaschiv/unbound/issues/342)) ([a4fde85](https://github.com/marioparaschiv/unbound/commit/a4fde8581b4b1de9d10c9cbdbae691c5c0f3c36a))
* hand off addon installs from the website through unbound:// ([#332](https://github.com/marioparaschiv/unbound/issues/332)) ([2c1e4d3](https://github.com/marioparaschiv/unbound/commit/2c1e4d384cac3e061d05e5c61756b8dacd408733))
* harden bundle signatures with a signed manifest ([b5749ca](https://github.com/marioparaschiv/unbound/commit/b5749ca056ba1ea74fdef5346c07f7d2df3ea4e8))
* **loader:** accept bundles only through a signed manifest ([0abc245](https://github.com/marioparaschiv/unbound/commit/0abc245ec50d32da2c5eb54d50a9cd3cafece2b1))
* **loader:** accept bundles only through a signed manifest ([d83582e](https://github.com/marioparaschiv/unbound/commit/d83582e9d173da6c009313adbb7cdf149f9ab8d0))
* **loader:** disable plugins that freeze Discord ([8e7aa8c](https://github.com/marioparaschiv/unbound/commit/8e7aa8c6097e628a322a8138ad9d176ec1cfd817))
* **loader:** disable plugins that freeze Discord ([2ec9ea1](https://github.com/marioparaschiv/unbound/commit/2ec9ea1fb083d0ea46192e84f486445d99efb605))
* **loader:** gate compat scans on Hermes bytecode and support policy ([805daed](https://github.com/marioparaschiv/unbound/commit/805daedeae77d3d9bc447ba1fcca3b2fff8ad759))
* **loader:** gate compat scans on Hermes bytecode and support policy ([523d737](https://github.com/marioparaschiv/unbound/commit/523d737c08a4dfac6b31f4ee90e157fe379251fa))
* **loader:** refuse bundles built for another native bridge ([1e9dcb4](https://github.com/marioparaschiv/unbound/commit/1e9dcb41581689affc6d5f8b0d47c9ed4ced6b53))
* **loader:** refuse bundles built for another native bridge ([090c32c](https://github.com/marioparaschiv/unbound/commit/090c32c6c89416e71ba4f6a3b99aee0d0fa3f040))
* **loader:** release Java handles when JavaScript drops them ([#403](https://github.com/marioparaschiv/unbound/issues/403)) ([db52c3a](https://github.com/marioparaschiv/unbound/commit/db52c3ab31510eee2292ab5c2a11f573021e2eff))
* **loader:** report native resources in the smoke test ([#405](https://github.com/marioparaschiv/unbound/issues/405)) ([436d879](https://github.com/marioparaschiv/unbound/commit/436d879b4cdaa58a72d7a139ba98a5a038cbf5d8))
* **plugins:** ask before unsigned plugins get FFI access ([b0c6f62](https://github.com/marioparaschiv/unbound/commit/b0c6f626504f3b56002d51d15e0fa3931963586f))
* **plugins:** ask before unsigned plugins get FFI access ([caa4a6c](https://github.com/marioparaschiv/unbound/commit/caa4a6c5e62ad24b84832acce903a4f271a6b602))
* **plugins:** republish rebuilt plugins with bytecode ([fbd653e](https://github.com/marioparaschiv/unbound/commit/fbd653e311392eb6b691bbbf4878b0c41da7ee2f))
* **plugins:** republish rebuilt plugins with bytecode ([2574b6b](https://github.com/marioparaschiv/unbound/commit/2574b6b5b028b413a6d249fa20ab257ff1729cd3))
* **plugins:** ship plugins as Hermes bytecode for each runtime ([43da3e0](https://github.com/marioparaschiv/unbound/commit/43da3e045b00e316dd3a9682337ef2e7ad0fc6ae))
* **plugins:** ship plugins as Hermes bytecode for each runtime ([46b5422](https://github.com/marioparaschiv/unbound/commit/46b542200c3c95f369b92f3e692d5e178d2d4f3e))
* **plugins:** sign first-party plugins and verify them on load ([2b07ddc](https://github.com/marioparaschiv/unbound/commit/2b07ddc2531d20e659c692ae416f049818ada6da))
* **plugins:** sign first-party plugins and verify them on load ([15cba9a](https://github.com/marioparaschiv/unbound/commit/15cba9aba69920de52048934e36729fdcb9f0b87))
* sign client bundles and verify them in the loader ([98513a9](https://github.com/marioparaschiv/unbound/commit/98513a9d65ed92dc90b2c0a4d0c389751257dd2f))
* **tools:** show each plugin's start time in the smoke report ([422c516](https://github.com/marioparaschiv/unbound/commit/422c516449a2ff2a2bd515e3adf609cefbd717b2))
* **tools:** show each plugin's start time in the smoke report ([5301d4e](https://github.com/marioparaschiv/unbound/commit/5301d4e31d2f9a54f5eb48a15198eb241b188cda))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))


### Bug Fixes

* **android:** support Discord 352 ([a5063fa](https://github.com/marioparaschiv/unbound/commit/a5063fad4760e1ba92af56bfceda21fa2dd15cbe))
* **client:** accept the built-in and GitHub icon packs again ([92416a8](https://github.com/marioparaschiv/unbound/commit/92416a83e2057c2ed7e8f893938c3712fa62f571))
* **client:** accept the built-in and GitHub icon packs again ([4163636](https://github.com/marioparaschiv/unbound/commit/41636366e40cc6f3a2dfe5da814a9c7b5c59db39))
* **client:** fall back to the Forms module Discord 353 still ships ([6f25cae](https://github.com/marioparaschiv/unbound/commit/6f25cae07c15d3579927b5e3d3d97ab7bad05456))
* **client:** fall back to Unbound's HelpMessage on Discord 353 ([cc39bf3](https://github.com/marioparaschiv/unbound/commit/cc39bf3f12eafb2cf34e1d542033354f2c4c4603))
* **client:** fall back to Unbound's HelpMessage on Discord 353 ([ebdc0a4](https://github.com/marioparaschiv/unbound/commit/ebdc0a4e614a730b66997e29de731b963181f5dd))
* **client:** fill the install button with StyleSheet.absoluteFill ([1d4bfa7](https://github.com/marioparaschiv/unbound/commit/1d4bfa798b889c87cf77a1c98347fe7ae45eddf0))
* **client:** keep Forms typed as before in the plugin SDK ([5632b3d](https://github.com/marioparaschiv/unbound/commit/5632b3dfb7e5fe544e97f88ea97b633c7487dca9))
* **client:** keep installed addon files inside their folder ([#348](https://github.com/marioparaschiv/unbound/issues/348)) ([e102008](https://github.com/marioparaschiv/unbound/commit/e1020086f8b02ebbcc044500efd760151900bd65))
* **client:** render toasts in Discord's Android toast container ([ab0054f](https://github.com/marioparaschiv/unbound/commit/ab0054f372335f424cb1e5696e4ab99d3dc6b120))
* **client:** render toasts on Android ([638b5b3](https://github.com/marioparaschiv/unbound/commit/638b5b3a179160e61699ec0ab67893417e568565))
* **client:** unpatch stopped addons on Hermes without iterator helpers ([b3798c1](https://github.com/marioparaschiv/unbound/commit/b3798c14e2430ada338555d6b6ddb82667b9565e))
* **client:** unpatch stopped addons on Hermes without iterator helpers ([533d40f](https://github.com/marioparaschiv/unbound/commit/533d40f0fe6f55dfe495f5c5b1ffe100eba7a8af))
* **debugger:** reject malformed device frames instead of crashing ([a725efe](https://github.com/marioparaschiv/unbound/commit/a725efef5d8967a4719cfbd1cd3c1ee8ec49d9d1))
* **debugger:** reject malformed device frames instead of crashing ([202e671](https://github.com/marioparaschiv/unbound/commit/202e6718b301053b5f6bc5c0148d6d63b1a5be85))
* **loader:** regenerate the SDK and unstarve the watchdog test ([7df48d4](https://github.com/marioparaschiv/unbound/commit/7df48d4ef263ce3dcc0fae4e8c846726f6e29453))


### Performance Improvements

* **client:** reuse a plugin's evaluated bundle when it restarts ([#419](https://github.com/marioparaschiv/unbound/issues/419)) ([1081e73](https://github.com/marioparaschiv/unbound/commit/1081e734f389f1b6ed64793ae65b99050ae7a79c))


### Code Refactoring

* **client:** name the native bridge version type ([937e1c8](https://github.com/marioparaschiv/unbound/commit/937e1c81a88eca7e8749e44170552e8d053f8690))
* **client:** read bridge versions with a function declaration ([39e5967](https://github.com/marioparaschiv/unbound/commit/39e59674577d397e1c81b71a346e266f79904ff2))
* **client:** remove the client's circular imports ([ed0ed56](https://github.com/marioparaschiv/unbound/commit/ed0ed56738ba907fe4103f6c6f1161a10eb64685))
* **client:** remove the client's circular imports ([2d8b330](https://github.com/marioparaschiv/unbound/commit/2d8b330e8732517e443897e9f9ec4de7eb5ebb67))
* **ios:** drop hook size height floors ([#429](https://github.com/marioparaschiv/unbound/issues/429)) ([778fd98](https://github.com/marioparaschiv/unbound/commit/778fd9868207330896a009d04b234ffe9c291636))
* **native:** drop the unused ui namespace ([#430](https://github.com/marioparaschiv/unbound/issues/430)) ([7d872e3](https://github.com/marioparaschiv/unbound/commit/7d872e3c85db7770d2af8db725c18eacd43f0462))
* remove unused code and needless exports ([#433](https://github.com/marioparaschiv/unbound/issues/433)) ([0d44d8c](https://github.com/marioparaschiv/unbound/commit/0d44d8cd896965f7da484f5e83c5f0b711677fdc))


### Build System

* **deps:** bump @babel/plugin-transform-block-scoping ([416595f](https://github.com/marioparaschiv/unbound/commit/416595f9292825ba1869f211b5548092d0d827d2))
* **deps:** bump @babel/plugin-transform-block-scoping ([a7cd6f2](https://github.com/marioparaschiv/unbound/commit/a7cd6f2bed3e940b77ca6fb08f577c812ed806ca))
* **deps:** bump react-native-gesture-handler from 2.33.1 to 3.4.0 ([c2e48cc](https://github.com/marioparaschiv/unbound/commit/c2e48cca0348001163614abaf34fcd79385fb8f3))
* **deps:** eslint-plugin-jsdoc 65 with the JSDoc it requires ([e4b303a](https://github.com/marioparaschiv/unbound/commit/e4b303a9d547a703e992955e1447c821922efb24))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))
* **deps:** merge the safe Dependabot updates ([f987306](https://github.com/marioparaschiv/unbound/commit/f98730620b99a31a40eab071db547477c1dbbd0b))
* **deps:** merge tsdown 0.23.2 and block scoping 8 ([463b6c4](https://github.com/marioparaschiv/unbound/commit/463b6c478ea512a73b685275d03582758f362a6c))
* **deps:** merge unicorn 79 and block scoping 8.0.8, fix typecheck race ([a0b84ec](https://github.com/marioparaschiv/unbound/commit/a0b84ecbcc8f7cc49e520b9739f7aae5e0109e13))
* ship Hermes bytecode 98 only ([faefe95](https://github.com/marioparaschiv/unbound/commit/faefe958dab1bb8952ec5c8c61832c82426b57df))
* ship Hermes bytecode 98 only ([c09da08](https://github.com/marioparaschiv/unbound/commit/c09da088c48cfda94e0fb514b539a1c74b19d39a))
* type the hermes wrapper and sort its import ([92839a8](https://github.com/marioparaschiv/unbound/commit/92839a8b6a8e2c9f4bf7eb1d79a5a1db2197923e))
* type the hermes wrapper and sort its import ([97cf68f](https://github.com/marioparaschiv/unbound/commit/97cf68f98ed57861fa7e6d6e21a53d7f5e0b2598))


### Documentation

* add the JSDoc eslint-plugin-jsdoc 65 requires ([d5632e8](https://github.com/marioparaschiv/unbound/commit/d5632e824e43cad5a88d15a5083b7cfc0097346c))


### Tests

* **client:** name the freeze test's receiver type ([60f0f65](https://github.com/marioparaschiv/unbound/commit/60f0f65684dadd4e69b48bc545474077aa6af7db))
* **client:** satisfy lint in the freeze test ([c841723](https://github.com/marioparaschiv/unbound/commit/c841723977917d63afb3b3527d3404a514338a09))
* **client:** seed installed bundles that match the published ones ([ba143f2](https://github.com/marioparaschiv/unbound/commit/ba143f29f69bedc13c036f2200e1774dc9811adc))
* **client:** skip the updater tests without a database ([874a351](https://github.com/marioparaschiv/unbound/commit/874a351effba77a513a5e008630658f41faaff48))
* **client:** skip the updater tests without a database ([9c4f157](https://github.com/marioparaschiv/unbound/commit/9c4f15781c1ad23729d2f06910fdd28cdd2889bc))
* **client:** type the freeze test's disable override ([5bf48fd](https://github.com/marioparaschiv/unbound/commit/5bf48fd459861d5784bedc1a75d3de1c1e141614))


### Continuous Integration

* **client:** open a pull request when hermesc publishes new bytecode ([57caeb3](https://github.com/marioparaschiv/unbound/commit/57caeb3ab7a96d7b2fa5ffc6c6ba4db891de79e2))
* **client:** open a pull request when hermesc publishes new bytecode ([a74f05e](https://github.com/marioparaschiv/unbound/commit/a74f05e8dc63be2df44becd914b4daa8efe40899))
* delete the per-bundle signatures nothing reads ([98368b3](https://github.com/marioparaschiv/unbound/commit/98368b3afc9a0cb14b8de2caa01cb1c26eab4b2a))
* delete the per-bundle signatures nothing reads ([e055909](https://github.com/marioparaschiv/unbound/commit/e055909073a4c2e5fb3ff2fa1389142a95862960))
* **loader:** flag startup regressions against recent main runs ([28019aa](https://github.com/marioparaschiv/unbound/commit/28019aa2fc9465a026e03ecbe62951d15b09e107))
* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))
* publish pull request builds to S3, signed for forks too ([744dcb2](https://github.com/marioparaschiv/unbound/commit/744dcb2cdb2a13c6c41b93a3968670927aac67ff))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.11.0
    * @unbound-app/debugger-protocol bumped to 0.9.0
    * @unbound-app/logger bumped to 0.7.1
    * @unbound-app/types bumped to 0.10.0
    * @unbound-app/utils bumped to 0.9.1
    * @unbound-app/web bumped to 0.11.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/client-v0.9.0...client-v0.10.0) (2026-10-25)


### Features

* **android:** call native functions through libffi ([04523b0](https://github.com/marioparaschiv/unbound/commit/04523b0bf61dd8667f17da5945b385812742c7d1))
* **client:** apply themes to Discord's JavaScript colours ([037c5ab](https://github.com/marioparaschiv/unbound/commit/037c5ab6e399a2b65188beea039282307f1cee35))
* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **client:** offer a restart after switching themes ([a07fe97](https://github.com/marioparaschiv/unbound/commit/a07fe97acdbaa722ac459be423c87e536a2746b4))
* move the native loaders into the monorepo and reach Android plugin parity ([98347e6](https://github.com/marioparaschiv/unbound/commit/98347e6c109a74ace67bb9b951ac32c2a7a7650f))
* **native:** accept Java results as targets and arguments ([b1d25a6](https://github.com/marioparaschiv/unbound/commit/b1d25a60d03f7aba4351fad82ded5d67be406ebf))
* **native:** compose the fabric bridge on Android ([d09c309](https://github.com/marioparaschiv/unbound/commit/d09c309a6d4e4032df936656772add5fc81a2422))
* **native:** expose Android batching, associations and debug ([8e988be](https://github.com/marioparaschiv/unbound/commit/8e988be8e7950bee684315a30ebe5deee698bba7))
* **native:** expose Android method hooks to plugins ([d3327ee](https://github.com/marioparaschiv/unbound/commit/d3327eef555674e8a7e7b9c35f80123ea29aa200))
* **native:** expose the Android Java bridge to plugins ([8d18abd](https://github.com/marioparaschiv/unbound/commit/8d18abda22f2e448b656e2ccebeec37836e1cff6))
* **native:** scope plugin capabilities by platform ([b7b83dd](https://github.com/marioparaschiv/unbound/commit/b7b83ddc079c5ddce06c5eda5cb0a3ddc3c2ab3f))
* **native:** surface Android Java failures as errors ([ee45d48](https://github.com/marioparaschiv/unbound/commit/ee45d48ed3fca244bb650f2d7e5f07da82e781fd))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))


### Bug Fixes

* **client:** declare the global `global` outside the downlevel wrapper ([#183](https://github.com/marioparaschiv/unbound/issues/183)) ([7ee029d](https://github.com/marioparaschiv/unbound/commit/7ee029d708c8d60d3a04a241e4b7abc18a2fec55))
* **client:** delete addons from the folder they were installed to ([e1cff1b](https://github.com/marioparaschiv/unbound/commit/e1cff1b6c53c20320a224f659f88676824d3d872))
* **client:** fall back to bundled strings for keys a locale lacks ([d8ba374](https://github.com/marioparaschiv/unbound/commit/d8ba374763aaef865d204b70f720f152bba30f5a))
* **client:** give the toast behavior section its own title ([de83838](https://github.com/marioparaschiv/unbound/commit/de83838bd0f149f2a56322b73726b7989f2b7f39))
* **client:** keep the moment locale when Discord defines another ([aacdc99](https://github.com/marioparaschiv/unbound/commit/aacdc9917d11b47487a4aca3e374657ce12412b5))
* **client:** keep theme colour lookups null-safe ([6c4f1ed](https://github.com/marioparaschiv/unbound/commit/6c4f1ed61ae4e64b838d7b8953450fa8fa6e1f87))
* **client:** show Unbound toasts through the app toast container ([5822776](https://github.com/marioparaschiv/unbound/commit/58227767a8b3fb50d9d2fbfb177fafce696802f3))
* **client:** start the toast and staff mode built-ins on Android ([004e623](https://github.com/marioparaschiv/unbound/commit/004e6235c35fdf8f7a3e32275dd67d6fcb172d0b))
* **client:** type the toast patch target by its method ([a770526](https://github.com/marioparaschiv/unbound/commit/a770526e8790ff2db8ea011b0e6ba34ea2390304))
* **client:** wrap lowered hot patches so swc helpers stay scoped ([#185](https://github.com/marioparaschiv/unbound/issues/185)) ([3285172](https://github.com/marioparaschiv/unbound/commit/3285172ee9074aac408d67d81c8915fc409ab9f6))
* **patcher:** share patches made through different lazy proxies ([873150b](https://github.com/marioparaschiv/unbound/commit/873150b6f1bdc806ac8541bfe12ab7f8cf6f0dda))


### Performance Improvements

* **client:** bake arity-specific emit callers without eval ([#186](https://github.com/marioparaschiv/unbound/issues/186)) ([a8f2a8b](https://github.com/marioparaschiv/unbound/commit/a8f2a8b8056dd575879516edd27ee6622a8500ec))
* **client:** compile Hermes bundles with -g0 and unpublished maps ([#187](https://github.com/marioparaschiv/unbound/issues/187)) ([b22ca9a](https://github.com/marioparaschiv/unbound/commit/b22ca9aef4f8e7e067e4f8ede55416fec516fb6a))


### Code Refactoring

* **plugins:** rewrite sample plugins into a shared layout ([#206](https://github.com/marioparaschiv/unbound/issues/206)) ([a50a473](https://github.com/marioparaschiv/unbound/commit/a50a473a2eff3ab812d8bfd7c249b27b8298c405))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.10.0
    * @unbound-app/debugger-protocol bumped to 0.8.1
    * @unbound-app/types bumped to 0.9.0
    * @unbound-app/utils bumped to 0.9.0
    * @unbound-app/web bumped to 0.10.0
