# Changelog

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.10.0...cli-v0.11.0) (2026-10-29)


### Features

* **cli:** add ubd logs and ubd inspect, kill timed-out step trees ([b2c6307](https://github.com/marioparaschiv/unbound/commit/b2c630739d7b8fb5b68d8fc0f53d18dd54c63880))
* **cli:** add ubd status and ubd bridge restart ([#413](https://github.com/marioparaschiv/unbound/issues/413)) ([ca2a235](https://github.com/marioparaschiv/unbound/commit/ca2a235a73f37f6425fc91dfb6a2dd9dc953805d))
* **cli:** device tooling for install, eval and discord-apk ([b394139](https://github.com/marioparaschiv/unbound/commit/b3941395ea031958504e3530bd0747465a6c1a1f))
* **client:** tag dev copies and reinstall them from the store ([#412](https://github.com/marioparaschiv/unbound/issues/412)) ([b0ad554](https://github.com/marioparaschiv/unbound/commit/b0ad5543c78c544cba641e9186a94fffaaf0e2e8))
* **cli:** inspect native classes and views with ubd inspect ([fa3ed0b](https://github.com/marioparaschiv/unbound/commit/fa3ed0b9b5896b84434b52929528025e4c4419ac))
* **cli:** install plugins on jailbroken iPhones ([a5a5f62](https://github.com/marioparaschiv/unbound/commit/a5a5f6233e29927304ca32d058a98e5e31d4d852))
* **cli:** push compiled bytecode with a plugin ([#425](https://github.com/marioparaschiv/unbound/issues/425)) ([87624bb](https://github.com/marioparaschiv/unbound/commit/87624bb81463b9eb529c82cca3dda1fef8b9b581))
* **cli:** reset, snapshot and restore Unbound state on a device ([42494b0](https://github.com/marioparaschiv/unbound/commit/42494b0bddda63788a8fa4bc2cfbc3b05930fc84))
* **cli:** reset, snapshot and restore Unbound state on a device ([31dc9f4](https://github.com/marioparaschiv/unbound/commit/31dc9f4e52c0168bfa6852d2776235e8ed7000b7))
* **cli:** symbolicate pulled log files with --symbolicate ([29b0c72](https://github.com/marioparaschiv/unbound/commit/29b0c723e323708258e455ab997e113b12b97ddb))
* **cli:** symbolicate pulled log files with --symbolicate ([57ee338](https://github.com/marioparaschiv/unbound/commit/57ee3388e132cf345325139dd11d2f3d01f5aa3b))
* **cli:** tail Discord's filtered log with ubd logs ([3a0693a](https://github.com/marioparaschiv/unbound/commit/3a0693acb7848effbc35ea8ffcce215f59f51340))
* **cli:** watch native resources with ubd status --watch ([#418](https://github.com/marioparaschiv/unbound/issues/418)) ([ffd5e3c](https://github.com/marioparaschiv/unbound/commit/ffd5e3ca32d17e34a70644710c8d126ff80aaabb))
* **debugger:** let eval callers choose the timeout ([0ce5a66](https://github.com/marioparaschiv/unbound/commit/0ce5a66664e4086087c1d5371bb8e8f4fc676e0d))
* **loader:** keep rotating log files on device, pull with ubd logs ([e1aa570](https://github.com/marioparaschiv/unbound/commit/e1aa5707f86d2f4200ebf15e6791ee549879b08d))
* **loader:** keep rotating log files on device, pull with ubd logs ([0206e8e](https://github.com/marioparaschiv/unbound/commit/0206e8eb09d18681263d3709d84ba7009a95b7ac))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))


### Bug Fixes

* **cli:** kill a timed-out step's whole process group ([2761cca](https://github.com/marioparaschiv/unbound/commit/2761ccaa7b008b892d0f96c76b681c0757c81390))
* **cli:** show each command's summary in ubd help ([d722935](https://github.com/marioparaschiv/unbound/commit/d7229355a31620fd30fb6a6ee8c5af65080c9302))
* **cli:** unlock the iPhone before relaunching Discord ([5232ba0](https://github.com/marioparaschiv/unbound/commit/5232ba01d6f302eeef37b52ce134b89403d27892))
* **cli:** wake the iPhone without lifting its blackout ([e9e1c64](https://github.com/marioparaschiv/unbound/commit/e9e1c642f565a72a6c83d3c53adc3f2fa74028c3))
* **cli:** wake the iPhone without lifting its blackout ([98092b3](https://github.com/marioparaschiv/unbound/commit/98092b3ec53102da269a799c44c1ed9e80a40c02))


### Performance Improvements

* **cli:** find addons without walking node_modules ([695ddc4](https://github.com/marioparaschiv/unbound/commit/695ddc4c045be8b898400db430a205b7a09ea1ec))
* **shiki-codeblocks:** load grammars from files on first use ([#426](https://github.com/marioparaschiv/unbound/issues/426)) ([195f8a7](https://github.com/marioparaschiv/unbound/commit/195f8a792064d38645f4a5dd03e9d6c9339d5095))


### Code Refactoring

* remove unused code and needless exports ([#433](https://github.com/marioparaschiv/unbound/issues/433)) ([0d44d8c](https://github.com/marioparaschiv/unbound/commit/0d44d8cd896965f7da484f5e83c5f0b711677fdc))


### Build System

* **deps:** bump cleye from 1.3.4 to 2.7.0 ([c963901](https://github.com/marioparaschiv/unbound/commit/c9639019e64cf4607bff0bc3ea048d70491d884c))
* **deps:** bump tsdown ([e5cbf89](https://github.com/marioparaschiv/unbound/commit/e5cbf8969f698875d454d12b5d0250764ae9154c))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))
* **deps:** merge the safe Dependabot updates ([f987306](https://github.com/marioparaschiv/unbound/commit/f98730620b99a31a40eab071db547477c1dbbd0b))
* **deps:** merge tsdown 0.23.2 and block scoping 8 ([463b6c4](https://github.com/marioparaschiv/unbound/commit/463b6c478ea512a73b685275d03582758f362a6c))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))
* **loader:** run Kotlin tests; check the AVD dev setup ([2e318a9](https://github.com/marioparaschiv/unbound/commit/2e318a98d8df9b8a5192ae1523ec508cfd7a7c0a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.9.0
  * devDependencies
    * @unbound-app/api bumped to 0.11.0
    * @unbound-app/contracts bumped to 0.11.0
    * @unbound-app/types bumped to 0.10.0
    * @unbound-app/utils bumped to 0.9.1
    * @unbound-app/web bumped to 0.11.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.9.0...cli-v0.10.0) (2026-10-25)


### Features

* **cli:** add plugin analysis commands ([50745ea](https://github.com/marioparaschiv/unbound/commit/50745eacb196a66ab7780beba0fa0f4e8e6a1dac))
* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **cli:** publish the pushed commit instead of uploading a build ([dcc3341](https://github.com/marioparaschiv/unbound/commit/dcc3341a1dd1399bde41ddeac4391b2a7c4426be))
* **contracts:** add shared workspace discovery rules ([33531c2](https://github.com/marioparaschiv/unbound/commit/33531c2634092e1cf3dc3a48badce1ce4fc27301))
* move the native loaders into the monorepo and reach Android plugin parity ([98347e6](https://github.com/marioparaschiv/unbound/commit/98347e6c109a74ace67bb9b951ac32c2a7a7650f))
* **native:** compose the fabric bridge on Android ([d09c309](https://github.com/marioparaschiv/unbound/commit/d09c309a6d4e4032df936656772add5fc81a2422))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))


### Bug Fixes

* **cli:** borrow a bridge that holds every capability a probe uses ([ff266ae](https://github.com/marioparaschiv/unbound/commit/ff266ae7681d349bd365f0e2cebc65b6f4c43d4c))


### Code Refactoring

* **cli:** discover addons through the contracts workspace rules ([a861045](https://github.com/marioparaschiv/unbound/commit/a86104585b9f3863aea6bef583336c4a85bc329b))
* **plugins:** rewrite sample plugins into a shared layout ([#206](https://github.com/marioparaschiv/unbound/issues/206)) ([a50a473](https://github.com/marioparaschiv/unbound/commit/a50a473a2eff3ab812d8bfd7c249b27b8298c405))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.8.1
  * devDependencies
    * @unbound-app/api bumped to 0.10.0
    * @unbound-app/contracts bumped to 0.10.0
    * @unbound-app/types bumped to 0.9.0
    * @unbound-app/utils bumped to 0.9.0
    * @unbound-app/web bumped to 0.10.0
