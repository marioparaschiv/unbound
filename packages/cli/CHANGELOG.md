# Changelog

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
