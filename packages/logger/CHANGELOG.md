# Changelog

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/logger-v0.7.3...logger-v1.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Code Refactoring

* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [0.7.3](https://github.com/marioparaschiv/unbound/compare/logger-v0.7.2...logger-v0.7.3) (2026-11-05)


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))

## [0.7.2](https://github.com/marioparaschiv/unbound/compare/logger-v0.7.1...logger-v0.7.2) (2026-10-31)


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))

## [0.7.1](https://github.com/marioparaschiv/unbound/compare/logger-v0.7.0...logger-v0.7.1) (2026-10-29)


### Bug Fixes

* **logger:** log errors with their code, message and stack ([0dfbedc](https://github.com/marioparaschiv/unbound/commit/0dfbedc802f2361f36b66e46dd1b28c2cefd06ab))
* show the real cause of native bridge errors ([72dc133](https://github.com/marioparaschiv/unbound/commit/72dc133b14b46fd8818229b883f15f08d97cfbea))
