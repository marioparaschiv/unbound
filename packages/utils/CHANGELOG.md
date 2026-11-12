# Changelog

## [1.0.1](https://github.com/marioparaschiv/unbound/compare/utils-v1.0.0...utils-v1.0.1) (2026-11-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.1.0

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/utils-v0.10.4...utils-v1.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Code Refactoring

* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 1.0.0

## [0.10.4](https://github.com/marioparaschiv/unbound/compare/utils-v0.10.3...utils-v0.10.4) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.15.0

## [0.10.3](https://github.com/marioparaschiv/unbound/compare/utils-v0.10.2...utils-v0.10.3) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.14.0

## [0.10.2](https://github.com/marioparaschiv/unbound/compare/utils-v0.10.1...utils-v0.10.2) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.13.1

## [0.10.1](https://github.com/marioparaschiv/unbound/compare/utils-v0.10.0...utils-v0.10.1) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.13.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/utils-v0.9.2...utils-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.12.0

## [0.9.2](https://github.com/marioparaschiv/unbound/compare/utils-v0.9.1...utils-v0.9.2) (2026-10-31)


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.11.0

## [0.9.1](https://github.com/marioparaschiv/unbound/compare/utils-v0.9.0...utils-v0.9.1) (2026-10-29)


### Bug Fixes

* **client:** fall back to the Forms module Discord 353 still ships ([6f25cae](https://github.com/marioparaschiv/unbound/commit/6f25cae07c15d3579927b5e3d3d97ab7bad05456))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.10.0

## [0.9.0](https://github.com/marioparaschiv/unbound/compare/utils-v0.8.4...utils-v0.9.0) (2026-10-25)


### Features

* move the native loaders into the monorepo and reach Android plugin parity ([98347e6](https://github.com/marioparaschiv/unbound/commit/98347e6c109a74ace67bb9b951ac32c2a7a7650f))


### Bug Fixes

* **utils:** let patches through lazy objects reach the real module ([2b18c5b](https://github.com/marioparaschiv/unbound/commit/2b18c5bd2e38b12f8679b5f3c97baa7d4d501343))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.9.0
