# Changelog

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
