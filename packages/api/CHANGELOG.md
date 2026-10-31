# Changelog

## [0.13.0](https://github.com/marioparaschiv/unbound/compare/api-v0.12.0...api-v0.13.0) (2026-10-31)


### Features

* **client:** add a typed native.objc.create ([#726](https://github.com/marioparaschiv/unbound/issues/726)) ([6dca897](https://github.com/marioparaschiv/unbound/commit/6dca89729b4efc0f5022147145e5515b522c52d4))
* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** add commands.register and commands.unregister ([#708](https://github.com/marioparaschiv/unbound/issues/708)) ([2ea9a39](https://github.com/marioparaschiv/unbound/commit/2ea9a390863152c23586e3838e72e63cf013a543))
* **client:** add metro.onModuleLoad and hide internal members ([#695](https://github.com/marioparaschiv/unbound/issues/695)) ([ad49b36](https://github.com/marioparaschiv/unbound/commit/ad49b36ed1988770143efc97c2009459cab784ac))
* **client:** add new names for fs, assets, toasts, i18n and settings ([#693](https://github.com/marioparaschiv/unbound/issues/693)) ([968a5d4](https://github.com/marioparaschiv/unbound/commit/968a5d4b7ffc26a1a0d0bde605da210b642b230c))
* **client:** add the Bucket API to storage ([#694](https://github.com/marioparaschiv/unbound/issues/694)) ([e0be2df](https://github.com/marioparaschiv/unbound/commit/e0be2dfe91c70bd3c431316dad008d20c44f6f44))
* **client:** add the flux namespace ([#722](https://github.com/marioparaschiv/unbound/issues/722)) ([f0213f2](https://github.com/marioparaschiv/unbound/commit/f0213f2d78a309964be60f3101803b8a750b9f8c))
* **client:** add the ui namespace for addon settings ([#728](https://github.com/marioparaschiv/unbound/issues/728)) ([26840c9](https://github.com/marioparaschiv/unbound/commit/26840c943c39a5412dda1a30376faf066fae0cd3))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** lazy patch targets and lazy addon lookups ([#714](https://github.com/marioparaschiv/unbound/issues/714)) ([e7c1cd9](https://github.com/marioparaschiv/unbound/commit/e7c1cd9a7c788bf1f6a3d58a63591a91df36cdf4))
* **client:** read manifest platforms, add definePlatform and has ([#723](https://github.com/marioparaschiv/unbound/issues/723)) ([9c31acf](https://github.com/marioparaschiv/unbound/commit/9c31acf0591982314e8c35457b91740d45f3d67a))
* **client:** scope module listeners, buckets, flux and commands ([#731](https://github.com/marioparaschiv/unbound/issues/731)) ([e8e913c](https://github.com/marioparaschiv/unbound/commit/e8e913cb68d341bb0dd75614b390b35bec805555))
* **client:** show an addon's store page from the marketplace ([#725](https://github.com/marioparaschiv/unbound/issues/725)) ([6f87e74](https://github.com/marioparaschiv/unbound/commit/6f87e74b5b712d210d9e449c8ad33dee330badeb))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **sdk:** add the @unbound-app/api/testing kit ([#738](https://github.com/marioparaschiv/unbound/issues/738)) ([2ebe700](https://github.com/marioparaschiv/unbound/commit/2ebe70055d7801dfdaeb1b2c26bcfa822734a510))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))


### Bug Fixes

* **client:** apply icon packs on Discord 349 ([#730](https://github.com/marioparaschiv/unbound/issues/730)) ([b4f7310](https://github.com/marioparaschiv/unbound/commit/b4f73109ad4e430402851d5a7e3be884ebdb7eaa))
* **client:** render store page media and bold on Discord 349 ([#732](https://github.com/marioparaschiv/unbound/issues/732)) ([bc19683](https://github.com/marioparaschiv/unbound/commit/bc1968388911bc769286854a12d725ce5e21f9cf))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **client:** add the Addon class and per-kind behaviour ([#705](https://github.com/marioparaschiv/unbound/issues/705)) ([3195a68](https://github.com/marioparaschiv/unbound/commit/3195a68bb18b726d8e7c6e2e1ef033d58fb387a6))
* **client:** share the native method-to-Capability map ([#681](https://github.com/marioparaschiv/unbound/issues/681)) ([cbfa587](https://github.com/marioparaschiv/unbound/commit/cbfa5873fc4ee69f24d2719eccf672f40dd9ce13))
* **client:** type each patcher callback by its patch kind ([#682](https://github.com/marioparaschiv/unbound/issues/682)) ([a6e2744](https://github.com/marioparaschiv/unbound/commit/a6e2744af84e3f051731bd6f7df6d5f0b9c67e03))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/client bumped to 0.13.0
    * @unbound-app/sdk-generator bumped to 0.11.0

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/api-v0.11.0...api-v0.12.0) (2026-10-31)


### Features

* **android:** search plugin views on the main thread ([#509](https://github.com/marioparaschiv/unbound/issues/509)) ([4616a75](https://github.com/marioparaschiv/unbound/commit/4616a75e2f79abd325146e7cc1f49cf0bb856317))
* give /debug the same shape on Android and iOS ([#476](https://github.com/marioparaschiv/unbound/issues/476)) ([73d89f4](https://github.com/marioparaschiv/unbound/commit/73d89f4962a43dff91bb91aef6f85e13d1a72afa))
* **loader:** log the JavaScript stack of a plugin that freezes Discord ([#478](https://github.com/marioparaschiv/unbound/issues/478)) ([ca61ca2](https://github.com/marioparaschiv/unbound/commit/ca61ca2a431de41d9b0e5cd5d977b28c5e2cc67a))
* **plugins:** let plugins check themselves for the device matrix ([#464](https://github.com/marioparaschiv/unbound/issues/464)) ([fa74c7f](https://github.com/marioparaschiv/unbound/commit/fa74c7f70d40d29abadb22e4a5234950ec162d2f))
* report the verified build on both platforms ([#499](https://github.com/marioparaschiv/unbound/issues/499)) ([eda9405](https://github.com/marioparaschiv/unbound/commit/eda9405ec5a3ed911aecbe4c34be67b24537d8ca))
* **sdk-generator:** drop module default objects ([#678](https://github.com/marioparaschiv/unbound/issues/678)) ([a5b000d](https://github.com/marioparaschiv/unbound/commit/a5b000dbe706c62debd54397f59eeba8476358f7))


### Bug Fixes

* **client:** read core settings from the loader's store ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** reach the Android module's current class names ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** read every Android view on the main thread ([#515](https://github.com/marioparaschiv/unbound/issues/515)) ([45b3423](https://github.com/marioparaschiv/unbound/commit/45b34237d12dd97ffe8517c56f3723b21333e082))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))
* **loader:** choose the Android build in a tested command ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** move first-party plugin ids to the new namespace ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Build System

* treat Bun's empty test runs as passing in the pre-push hook ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Tests

* **core:** keep sanitizer reports out of the crash attribution children ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Continuous Integration

* **deps:** fit Dependabot titles to the commit header limit ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** build PRs against the current App Store Discord ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** let main builds finish instead of cancelling each other ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** show smoke failures and the first crash in the PR comment ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** skip the Android smoke test for unattested builds ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/client bumped to 0.12.0
    * @unbound-app/sdk-generator bumped to 0.10.0

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/api-v0.10.0...api-v0.11.0) (2026-10-29)


### Features

* **api:** expose Java class descriptions to plugins ([dc005c7](https://github.com/marioparaschiv/unbound/commit/dc005c794d4d6df4b4125aa4863a8106435b99be))
* attribute crashes inside plugin callbacks to the plugin ([aca4ff2](https://github.com/marioparaschiv/unbound/commit/aca4ff217a0b083a474884c8de44c99b7552f5fc))
* **client:** add a commands API for plugins and built-ins ([#336](https://github.com/marioparaschiv/unbound/issues/336)) ([0086dff](https://github.com/marioparaschiv/unbound/commit/0086dff6eb2eb475278c3e4d041e7e2840c73e4e))
* **client:** add a Dialogs API ([#381](https://github.com/marioparaschiv/unbound/issues/381)) ([525bbfb](https://github.com/marioparaschiv/unbound/commit/525bbfb0bf035673a298ca96868a417314a3eee0)), closes [#33](https://github.com/marioparaschiv/unbound/issues/33)
* **client:** fall back to Unbound components Discord drops ([7c26070](https://github.com/marioparaschiv/unbound/commit/7c2607053c31e2bcda3d971f98ddc167f70728bf))
* **client:** fall back to Unbound components Discord drops ([1b517c4](https://github.com/marioparaschiv/unbound/commit/1b517c486252817f6947c5b70ec2751ffdc2c39e))
* **client:** hide library plugins and handle their dependents ([b24d755](https://github.com/marioparaschiv/unbound/commit/b24d755b49765190412936e0e365b04b70d0b02e))
* **client:** hide library plugins and handle their dependents ([4bf9fb5](https://github.com/marioparaschiv/unbound/commit/4bf9fb53581334a42e227a7ed20f2b9b34948325))
* **client:** mark which plugin runs native work for the crash guard ([1aff9a6](https://github.com/marioparaschiv/unbound/commit/1aff9a68e6e00948aae82566460fc0f948eea443))
* **client:** skip addons the loader disabled after crashes ([dccfc36](https://github.com/marioparaschiv/unbound/commit/dccfc36fe814b945cc4e2dd361f982626f092f50))
* disable addons that crash Discord on start ([3b1ae7f](https://github.com/marioparaschiv/unbound/commit/3b1ae7f775397cbdd3307ebfa0068da709fee3fc))
* **discord-types:** generated Discord component types, published as @unbound-app/discord-types ([#342](https://github.com/marioparaschiv/unbound/issues/342)) ([a4fde85](https://github.com/marioparaschiv/unbound/commit/a4fde8581b4b1de9d10c9cbdbae691c5c0f3c36a))
* **loader:** count live Objective-C handles in native resources ([#410](https://github.com/marioparaschiv/unbound/issues/410)) ([5897bb7](https://github.com/marioparaschiv/unbound/commit/5897bb7fd77579dd59ce0a66b22f2c1b9bce34ee))
* **loader:** disable plugins that freeze Discord ([8e7aa8c](https://github.com/marioparaschiv/unbound/commit/8e7aa8c6097e628a322a8138ad9d176ec1cfd817))
* **loader:** report native resources in the smoke test ([#405](https://github.com/marioparaschiv/unbound/issues/405)) ([436d879](https://github.com/marioparaschiv/unbound/commit/436d879b4cdaa58a72d7a139ba98a5a038cbf5d8))
* **plugins:** ask before unsigned plugins get FFI access ([b0c6f62](https://github.com/marioparaschiv/unbound/commit/b0c6f626504f3b56002d51d15e0fa3931963586f))
* **plugins:** move chat bubbles and avatar radius out of the loader ([#432](https://github.com/marioparaschiv/unbound/issues/432)) ([8a49209](https://github.com/marioparaschiv/unbound/commit/8a49209d0075a7a4051561bccc904166293f1a28))
* **plugins:** sign first-party plugins and verify them on load ([2b07ddc](https://github.com/marioparaschiv/unbound/commit/2b07ddc2531d20e659c692ae416f049818ada6da))
* **plugins:** sign first-party plugins and verify them on load ([15cba9a](https://github.com/marioparaschiv/unbound/commit/15cba9aba69920de52048934e36729fdcb9f0b87))


### Bug Fixes

* **android:** support Discord 352 ([a5063fa](https://github.com/marioparaschiv/unbound/commit/a5063fad4760e1ba92af56bfceda21fa2dd15cbe))
* **client:** fall back to Unbound's HelpMessage on Discord 353 ([cc39bf3](https://github.com/marioparaschiv/unbound/commit/cc39bf3f12eafb2cf34e1d542033354f2c4c4603))
* **client:** fall back to Unbound's HelpMessage on Discord 353 ([ebdc0a4](https://github.com/marioparaschiv/unbound/commit/ebdc0a4e614a730b66997e29de731b963181f5dd))
* **client:** keep installed addon files inside their folder ([#348](https://github.com/marioparaschiv/unbound/issues/348)) ([e102008](https://github.com/marioparaschiv/unbound/commit/e1020086f8b02ebbcc044500efd760151900bd65))
* **loader:** regenerate the SDK and unstarve the watchdog test ([7df48d4](https://github.com/marioparaschiv/unbound/commit/7df48d4ef263ce3dcc0fae4e8c846726f6e29453))
* **web:** copy double precision columns from SQLite ([d8515a4](https://github.com/marioparaschiv/unbound/commit/d8515a46c9495a49072c8ae1e3b7ec116cde06a9))


### Code Refactoring

* **client:** remove the client's circular imports ([ed0ed56](https://github.com/marioparaschiv/unbound/commit/ed0ed56738ba907fe4103f6c6f1161a10eb64685))
* **client:** remove the client's circular imports ([2d8b330](https://github.com/marioparaschiv/unbound/commit/2d8b330e8732517e443897e9f9ec4de7eb5ebb67))
* **ios:** drop hook size height floors ([#429](https://github.com/marioparaschiv/unbound/issues/429)) ([778fd98](https://github.com/marioparaschiv/unbound/commit/778fd9868207330896a009d04b234ffe9c291636))
* **native:** drop the unused ui namespace ([#430](https://github.com/marioparaschiv/unbound/issues/430)) ([7d872e3](https://github.com/marioparaschiv/unbound/commit/7d872e3c85db7770d2af8db725c18eacd43f0462))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/client bumped to 0.11.0
    * @unbound-app/sdk-generator bumped to 0.9.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/api-v0.9.0...api-v0.10.0) (2026-10-25)


### Features

* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **loader:** remove folders inside Unbound from the shared core ([84c37af](https://github.com/marioparaschiv/unbound/commit/84c37afa20be6ac18cfbdcf8a2bbab807606ec37))
* move the native loaders into the monorepo and reach Android plugin parity ([98347e6](https://github.com/marioparaschiv/unbound/commit/98347e6c109a74ace67bb9b951ac32c2a7a7650f))
* **native:** accept Java results as targets and arguments ([b1d25a6](https://github.com/marioparaschiv/unbound/commit/b1d25a60d03f7aba4351fad82ded5d67be406ebf))
* **native:** compose the fabric bridge on Android ([d09c309](https://github.com/marioparaschiv/unbound/commit/d09c309a6d4e4032df936656772add5fc81a2422))
* **native:** expose Android batching, associations and debug ([8e988be](https://github.com/marioparaschiv/unbound/commit/8e988be8e7950bee684315a30ebe5deee698bba7))
* **native:** expose Android method hooks to plugins ([d3327ee](https://github.com/marioparaschiv/unbound/commit/d3327eef555674e8a7e7b9c35f80123ea29aa200))
* **native:** expose the Android Java bridge to plugins ([8d18abd](https://github.com/marioparaschiv/unbound/commit/8d18abda22f2e448b656e2ccebeec37836e1cff6))
* **native:** scope plugin capabilities by platform ([b7b83dd](https://github.com/marioparaschiv/unbound/commit/b7b83ddc079c5ddce06c5eda5cb0a3ddc3c2ab3f))
* **native:** surface Android Java failures as errors ([ee45d48](https://github.com/marioparaschiv/unbound/commit/ee45d48ed3fca244bb650f2d7e5f07da82e781fd))


### Code Refactoring

* **plugins:** rewrite sample plugins into a shared layout ([#206](https://github.com/marioparaschiv/unbound/issues/206)) ([a50a473](https://github.com/marioparaschiv/unbound/commit/a50a473a2eff3ab812d8bfd7c249b27b8298c405))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/client bumped to 0.10.0
