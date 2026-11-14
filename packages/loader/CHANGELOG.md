# Changelog

## [1.4.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.4.0...loader-v1.4.0) (2026-11-14)


### Features

* **client:** report power, clock, DNS and notifications in /debug ([#1393](https://github.com/marioparaschiv/unbound/issues/1393)) ([1a9227f](https://github.com/marioparaschiv/unbound/commit/1a9227fa96802e73efd2293ec850db477f2355a4))
* **client:** send native crashes with opt-in crash reports ([#1403](https://github.com/marioparaschiv/unbound/issues/1403)) ([c3b7f91](https://github.com/marioparaschiv/unbound/commit/c3b7f916ce070ffa1d64e0860ab5dae2f5660396))
* **client:** share text and links to Discord ([#1353](https://github.com/marioparaschiv/unbound/issues/1353)) ([1e23d41](https://github.com/marioparaschiv/unbound/commit/1e23d41f3de3f162037a9e990c0fd3bea9ae32d6))
* **devtools:** find the bridge over Bonjour and add MCP to agents ([#1309](https://github.com/marioparaschiv/unbound/issues/1309)) ([03f4c20](https://github.com/marioparaschiv/unbound/commit/03f4c2016c7064fabb25c853ea766f0f1f9c962d))
* **loader:** add FFI memory, C callbacks and import rebinding ([#1266](https://github.com/marioparaschiv/unbound/issues/1266)) ([5965be8](https://github.com/marioparaschiv/unbound/commit/5965be8306b61099675305e629e79d2fd160b203))
* **loader:** find classes by shape and hook subclasses or late classes ([#1267](https://github.com/marioparaschiv/unbound/issues/1267)) ([c0347ac](https://github.com/marioparaschiv/unbound/commit/c0347ace0a3a57e226b32f88ef3eb25fe3070f8b))
* **loader:** finish bundle downloads in the background ([#1270](https://github.com/marioparaschiv/unbound/issues/1270)) ([c003e0e](https://github.com/marioparaschiv/unbound/commit/c003e0e8d414c6e0fe41f0955496230d3c0c233a))
* **loader:** let plugins make Objective-C blocks and classes ([#1265](https://github.com/marioparaschiv/unbound/issues/1265)) ([f23f69b](https://github.com/marioparaschiv/unbound/commit/f23f69b7aa52db68878fd0d06a14b7400a3ba0a4))
* **loader:** open Safari extension settings from the disabled alert ([#1332](https://github.com/marioparaschiv/unbound/issues/1332)) ([0a19732](https://github.com/marioparaschiv/unbound/commit/0a19732609d5889085717c320439ffdacaf348be))
* **loader:** patch the bundle instead of downloading it whole ([#1401](https://github.com/marioparaschiv/unbound/issues/1401)) ([b041041](https://github.com/marioparaschiv/unbound/commit/b04104115928d635cdec4722b86b42227a7a553a))
* **loader:** report MetricKit hangs and system kills in /debug ([#1271](https://github.com/marioparaschiv/unbound/issues/1271)) ([8a8137a](https://github.com/marioparaschiv/unbound/commit/8a8137ab67e52076ef105555308a6b79bb342f23))
* **loader:** report signer, binary, re-sign, device and HTTPS facts ([#1274](https://github.com/marioparaschiv/unbound/issues/1274)) ([4bb2629](https://github.com/marioparaschiv/unbound/commit/4bb2629210d6cfb5fcd9defdbb89c52fc3178cf7))
* **loader:** trust every listed bundle signing key ([#1399](https://github.com/marioparaschiv/unbound/issues/1399)) ([7dbb25a](https://github.com/marioparaschiv/unbound/commit/7dbb25aef9ec29f3dda2a3a70674e257e0fd0dc5))
* **loader:** use Discord's own share extension ([#1367](https://github.com/marioparaschiv/unbound/issues/1367)) ([7f33394](https://github.com/marioparaschiv/unbound/commit/7f33394f23d09da4a5d841e98fc7df0ed5c777ba))


### Bug Fixes

* **loader:** build the iOS tweak with the sampler off ([#1365](https://github.com/marioparaschiv/unbound/issues/1365)) ([7493d11](https://github.com/marioparaschiv/unbound/commit/7493d118a0cc16013ccdd87ba1b597a8ec3f2482))
* **loader:** hand shared files to Discord through the app group ([#1331](https://github.com/marioparaschiv/unbound/issues/1331)) ([d3d740d](https://github.com/marioparaschiv/unbound/commit/d3d740d752109056728af4bfe5d99e7c22dc6dcd))
* **loader:** keep outside settings edits made while changes are pending ([#1370](https://github.com/marioparaschiv/unbound/issues/1370)) ([73468c8](https://github.com/marioparaschiv/unbound/commit/73468c8d10c10249558c939215ff21bee7bf3405))
* **loader:** keep the Hermes sampler off on iOS ([#1357](https://github.com/marioparaschiv/unbound/issues/1357)) ([625684e](https://github.com/marioparaschiv/unbound/commit/625684eb689f54fdfe35ce3473b693f3057134ab))
* **loader:** leave background and locked launches out of the guard ([#1261](https://github.com/marioparaschiv/unbound/issues/1261)) ([566aa86](https://github.com/marioparaschiv/unbound/commit/566aa860622f98ef8b6a2a464d6ec32cc3edaae0))
* **loader:** save staged settings when Discord backgrounds ([#1356](https://github.com/marioparaschiv/unbound/issues/1356)) ([6727ded](https://github.com/marioparaschiv/unbound/commit/6727ded4e235c89655afac58d4357ff746a7d9a4))
* **loader:** share the app group with extensions when sideloaded ([#1366](https://github.com/marioparaschiv/unbound/issues/1366)) ([911134e](https://github.com/marioparaschiv/unbound/commit/911134e74dace20f10013b9a2648f062a8b3c2e5))
* **loader:** sign the share extension with codesign ([#1354](https://github.com/marioparaschiv/unbound/issues/1354)) ([664fe0e](https://github.com/marioparaschiv/unbound/commit/664fe0e5a96a6f5c2b005c4cb223d4c3d708b8ba))
* **web:** wrap /debug rows and tighten the environment rows ([#1275](https://github.com/marioparaschiv/unbound/issues/1275)) ([5dbf2db](https://github.com/marioparaschiv/unbound/commit/5dbf2db8edb1b6766a165fa4c5521340a6d6e868))

## [1.4.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.3.0...loader-v1.4.0) (2026-11-13)


### Features

* **client:** add errors, log, storage and patches to /debug ([#1163](https://github.com/marioparaschiv/unbound/issues/1163)) ([1cc9625](https://github.com/marioparaschiv/unbound/commit/1cc9625ccecde514a8923d57e66e2e17fd19a339))
* **client:** add network context to /debug ([#1204](https://github.com/marioparaschiv/unbound/issues/1204)) ([6fc2287](https://github.com/marioparaschiv/unbound/commit/6fc22878df442f8c0e7b0e8712cad1da3c6b1280))
* **client:** list other tweaks loaded into Discord in /debug ([#1250](https://github.com/marioparaschiv/unbound/issues/1250)) ([dd8c109](https://github.com/marioparaschiv/unbound/commit/dd8c1091d6d94c7776b1d2b2477df47694f91493))
* **devtools:** add an object explorer and structured ubd errors ([#1206](https://github.com/marioparaschiv/unbound/issues/1206)) ([cf37e2b](https://github.com/marioparaschiv/unbound/commit/cf37e2beccf364eb3d4a22842d5c1538c8a5c683))
* **loader:** check for a bundle each time Discord backgrounds ([#1201](https://github.com/marioparaschiv/unbound/issues/1201)) ([67bb22d](https://github.com/marioparaschiv/unbound/commit/67bb22d7c8ae04a2bbf288cbb7f78e63e71a7644))
* **loader:** heal a damaged saved bundle at launch ([#1200](https://github.com/marioparaschiv/unbound/issues/1200)) ([a9056c0](https://github.com/marioparaschiv/unbound/commit/a9056c0e5444d739a73be9b24dc8e9f90c67ddc2))
* **loader:** leave auto Recovery Mode after a fix, check space ([#1173](https://github.com/marioparaschiv/unbound/issues/1173)) ([f5d43df](https://github.com/marioparaschiv/unbound/commit/f5d43df25c00ab89805a9e15dc704fe4e8b732b4))
* **loader:** name the Android root manager and bridge failures ([#1150](https://github.com/marioparaschiv/unbound/issues/1150)) ([aa68889](https://github.com/marioparaschiv/unbound/commit/aa68889f9085501378b1d5e4b09728fe6ef12edc))
* **loader:** name the crashing addon in Android tombstones ([#1165](https://github.com/marioparaschiv/unbound/issues/1165)) ([55a6c98](https://github.com/marioparaschiv/unbound/commit/55a6c983a520c81579b350652d33267a7e8880bd))
* **loader:** offer the previous client bundle in the Toolbox ([#1249](https://github.com/marioparaschiv/unbound/issues/1249)) ([7699805](https://github.com/marioparaschiv/unbound/commit/76998054425a6cc1a6b4524bf36491a3c1ad0fe7))
* **loader:** offer the Toolbox when Discord never renders ([#1202](https://github.com/marioparaschiv/unbound/issues/1202)) ([1918924](https://github.com/marioparaschiv/unbound/commit/19189247b40c3e36f752e6e48066d3e770d3f16d))
* **loader:** record Android ANRs with the main thread's stack ([#1203](https://github.com/marioparaschiv/unbound/issues/1203)) ([33917dd](https://github.com/marioparaschiv/unbound/commit/33917dd413427f8398859b4a2319572c8c6a16f9))
* **loader:** report bundle state, launches and native crashes ([#1148](https://github.com/marioparaschiv/unbound/issues/1148)) ([f0a0e86](https://github.com/marioparaschiv/unbound/commit/f0a0e8625bfce64c1bbb6133ff154bb5eabee047))
* **loader:** report update checks, bundle source and settings ([#1162](https://github.com/marioparaschiv/unbound/issues/1162)) ([fdbe58d](https://github.com/marioparaschiv/unbound/commit/fdbe58da281df988197c52f0f560bc428d8478fd))
* **loader:** resume interrupted bundle downloads ([#1166](https://github.com/marioparaschiv/unbound/issues/1166)) ([85af3ea](https://github.com/marioparaschiv/unbound/commit/85af3ea154cc275d187ab0731f1c599df760ec99))
* **loader:** skip failed builds, report crashes and pressure ([#1158](https://github.com/marioparaschiv/unbound/issues/1158)) ([dd7f6dd](https://github.com/marioparaschiv/unbound/commit/dd7f6ddc44ede8e26c5cbeeb8d07faac8c4c7d3f))
* **loader:** stamp crash stacks with the image's build ID ([#1179](https://github.com/marioparaschiv/unbound/issues/1179)) ([fbcd97b](https://github.com/marioparaschiv/unbound/commit/fbcd97b80e66d1fed2e4dec1cf4af54595804885))
* **loader:** tell how the previous iOS launch ended ([#1149](https://github.com/marioparaschiv/unbound/issues/1149)) ([c8d17e8](https://github.com/marioparaschiv/unbound/commit/c8d17e823875b04b9c8973d67d85b81ef5979b44))


### Bug Fixes

* **loader:** find Magisk where Discord can see it ([#1153](https://github.com/marioparaschiv/unbound/issues/1153)) ([122c4ea](https://github.com/marioparaschiv/unbound/commit/122c4eaa14dde1d701aef928c8251f5ecd4ff79f))
* **loader:** load the Android library on 16 KB page devices ([#1246](https://github.com/marioparaschiv/unbound/issues/1246)) ([4fcab52](https://github.com/marioparaschiv/unbound/commit/4fcab521d4dd4f4e38be62bfd13a750ace67f197))
* **loader:** read hidden Android and private iOS APIs in the compat scan ([#1238](https://github.com/marioparaschiv/unbound/issues/1238)) ([99d0e4c](https://github.com/marioparaschiv/unbound/commit/99d0e4cf543ad1197cd04eedd8e2d57a998dc936))
* **loader:** skip Kotlin formatting locally when Java won't start ([#1247](https://github.com/marioparaschiv/unbound/issues/1247)) ([b8131ff](https://github.com/marioparaschiv/unbound/commit/b8131ffbb9c7958ecdcff16b34cbe6eff15d11b6))
* **loader:** treat UIKit's private effectWithBlurRadius: as external ([#1155](https://github.com/marioparaschiv/unbound/issues/1155)) ([90805d8](https://github.com/marioparaschiv/unbound/commit/90805d8991be3b8774934478a85e7fe18b4441d5))
* **loader:** write the profile expiry as exp ([#1224](https://github.com/marioparaschiv/unbound/issues/1224)) ([f659a0f](https://github.com/marioparaschiv/unbound/commit/f659a0f6e5fb1da4f7b45c1adaa7b9a8011ba163))

## [1.3.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.2.0...loader-v1.3.0) (2026-11-12)


### Features

* **client:** add support, issues and context to /debug ([#1147](https://github.com/marioparaschiv/unbound/issues/1147)) ([05b2839](https://github.com/marioparaschiv/unbound/commit/05b2839cb43f575aaad7bd2b96cbe9580c374815))
* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **loader:** let UI scopes implement Java interfaces ([f8ca349](https://github.com/marioparaschiv/unbound/commit/f8ca3499ea8627dfc5f57560928676278b65dea9))


### Bug Fixes

* **loader:** return from off-main Android hook dispatch ([#1139](https://github.com/marioparaschiv/unbound/issues/1139)) ([050f74f](https://github.com/marioparaschiv/unbound/commit/050f74f10ac66a468e1657226bd592d8f3f7b3ab))
* tidy the install and state debug lines ([#1143](https://github.com/marioparaschiv/unbound/issues/1143)) ([f1a2a2f](https://github.com/marioparaschiv/unbound/commit/f1a2a2f3999db8da506373b0248eef644b11bcef))

## [1.2.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.1...loader-v1.2.0) (2026-11-12)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).
* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))
* **loader:** catch frozen starts and show how installs were signed ([#1113](https://github.com/marioparaschiv/unbound/issues/1113)) ([562aa90](https://github.com/marioparaschiv/unbound/commit/562aa9051c36e82d4e3577697d73a64e3397d4db))
* **loader:** health-gated updates and crash recovery ([#1063](https://github.com/marioparaschiv/unbound/issues/1063)) ([0cd3772](https://github.com/marioparaschiv/unbound/commit/0cd37726daa68a2a8c4a2cae49c01e881649ce2e))
* **loader:** judge launches by render and exit, retry updates ([#1086](https://github.com/marioparaschiv/unbound/issues/1086)) ([cd39991](https://github.com/marioparaschiv/unbound/commit/cd399911d22a11fe8fbf4db09d6ad3184302eb3b))
* **loader:** let UI-scope Java hooks rewrite their arguments ([#1130](https://github.com/marioparaschiv/unbound/issues/1130)) ([20893e2](https://github.com/marioparaschiv/unbound/commit/20893e2e907eec6a81f2279ac714eb01aab100e9))
* **loader:** show the iOS toolbox as a sheet with a microbold wrench ([#1131](https://github.com/marioparaschiv/unbound/issues/1131)) ([8aa3174](https://github.com/marioparaschiv/unbound/commit/8aa3174e233d3008f26065bd18fbce4c854d7514))


### Bug Fixes

* **client:** download the IPA for sideloaded loader updates ([#1048](https://github.com/marioparaschiv/unbound/issues/1048)) ([880fa81](https://github.com/marioparaschiv/unbound/commit/880fa812b96d85b4ec6f1f436b6d47e0ccb5f552))
* **loader:** keep addon start markers across iOS static init ([#1110](https://github.com/marioparaschiv/unbound/issues/1110)) ([a238e8a](https://github.com/marioparaschiv/unbound/commit/a238e8aa6eef4e026efabc019cf47f9f78a7cbc8))
* **loader:** keep bootstrap scripts across iOS static init ([#1107](https://github.com/marioparaschiv/unbound/issues/1107)) ([c23d042](https://github.com/marioparaschiv/unbound/commit/c23d0424ec9e0bdf3be909c90c5579cdb0502541))
* **loader:** keep the release changelog under the API limit ([#1115](https://github.com/marioparaschiv/unbound/issues/1115)) ([638b698](https://github.com/marioparaschiv/unbound/commit/638b698a71d864b252b37b36f78bf8c4f2e8e0d1))
* **loader:** let the compat gate pass LiveContainer LCAppInfo ([#1129](https://github.com/marioparaschiv/unbound/issues/1129)) ([46e85a0](https://github.com/marioparaschiv/unbound/commit/46e85a061ce4ef2785531b956bd39c3ffadd3122))
* **loader:** read entitlements from the kernel inside LiveContainer ([#1112](https://github.com/marioparaschiv/unbound/issues/1112)) ([50d53d0](https://github.com/marioparaschiv/unbound/commit/50d53d0ee823876b9faea50ca28e34fe347d1dbf))
* **loader:** republish the sideloaded IPA on loader updates ([#1050](https://github.com/marioparaschiv/unbound/issues/1050)) ([5664844](https://github.com/marioparaschiv/unbound/commit/5664844740e43449ce55dc1caa4dc05e2bec9d2f))
* **loader:** warn when the loader lacks native bridge API 1.3.0 ([#1136](https://github.com/marioparaschiv/unbound/issues/1136)) ([7e15ee3](https://github.com/marioparaschiv/unbound/commit/7e15ee37dcb9c48e7d07d765e11d63c60bccd855))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))
* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.0...loader-v1.1.1) (2026-11-10)


### Bug Fixes

* **loader:** cross-check iTunes with dkrypt in the stable poll ([#1045](https://github.com/marioparaschiv/unbound/issues/1045)) ([dc77dc9](https://github.com/marioparaschiv/unbound/commit/dc77dc9ecb9f5fcd09cd4316b4dfcb98e65f73ea))
* **loader:** let the compat gate pass the private UIPlaceholderColor ([#1043](https://github.com/marioparaschiv/unbound/issues/1043)) ([7663da1](https://github.com/marioparaschiv/unbound/commit/7663da12f80f842517f4df8eba5df2b028fbc0cf))
* **loader:** point release-please at the loader's version.json ([#1039](https://github.com/marioparaschiv/unbound/issues/1039)) ([e401981](https://github.com/marioparaschiv/unbound/commit/e401981b28802d446f1d43a8525e2cb7e557b1a1))
* **loader:** stop patching the App Store Discord bundle on jailbreak ([#1047](https://github.com/marioparaschiv/unbound/issues/1047)) ([f24c091](https://github.com/marioparaschiv/unbound/commit/f24c0919c5f8950eada54df6d2814a7ddf385c09))

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.0.971...loader-v1.1.0) (2026-11-10)


### Features

* **app-icons:** custom app icons on every platform ([#987](https://github.com/marioparaschiv/unbound/issues/987)) ([9dbbcf8](https://github.com/marioparaschiv/unbound/commit/9dbbcf8bba4b7abcef6a27d99bb004d3c2a837ef))
* **client:** redesign the updater screen ([#1022](https://github.com/marioparaschiv/unbound/issues/1022)) ([f0677df](https://github.com/marioparaschiv/unbound/commit/f0677df1860f88f609d6beca7016cd9db0ae9b36))
* **loader:** draw the new Unbound icon in the Dynamic Island and notch ([#978](https://github.com/marioparaschiv/unbound/issues/978)) ([e23123d](https://github.com/marioparaschiv/unbound/commit/e23123d064070aada10aa20516127db23f140050))
* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Bug Fixes

* **ci:** finish npm publish, skip unnamed TestFlight releases ([#1026](https://github.com/marioparaschiv/unbound/issues/1026)) ([db758dc](https://github.com/marioparaschiv/unbound/commit/db758dcbbeb3429a1bf84484fe843d62e5956087))
* **ci:** unblock loader publishes after the billing pause ([#1018](https://github.com/marioparaschiv/unbound/issues/1018)) ([a8b0ad4](https://github.com/marioparaschiv/unbound/commit/a8b0ad4970bec504eb9ee63d5e2b6b975dd37762))
* **client:** run UI worklets on Reanimated 4's worklets runtime ([#1028](https://github.com/marioparaschiv/unbound/issues/1028)) ([269995c](https://github.com/marioparaschiv/unbound/commit/269995c755d6b186af09fa5807cecb29b9411a4b))
* **loader:** use semantic release versions ([#990](https://github.com/marioparaschiv/unbound/issues/990)) ([f4b0acd](https://github.com/marioparaschiv/unbound/commit/f4b0acd6cf9c577e767fc10a6561cf2b67f10a72))


### Performance Improvements

* **ci:** cut pull request CI wall time ([#1021](https://github.com/marioparaschiv/unbound/issues/1021)) ([0e5e0a7](https://github.com/marioparaschiv/unbound/commit/0e5e0a7ec4f6c107e78f6afca3409eca3b953be0))
* **loader:** lazy settings cache, metro cache file, plugin bytecode installs ([#1032](https://github.com/marioparaschiv/unbound/issues/1032)) ([87179aa](https://github.com/marioparaschiv/unbound/commit/87179aad6016c4e019546bb9ae0ba9d19147f614))
