# Changelog

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/sdk-generator-v0.10.0...sdk-generator-v0.11.0) (2026-11-01)


### Features

* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** add metro.onModuleLoad and hide internal members ([#695](https://github.com/marioparaschiv/unbound/issues/695)) ([ad49b36](https://github.com/marioparaschiv/unbound/commit/ad49b36ed1988770143efc97c2009459cab784ac))
* **sdk:** add the @unbound-app/api/testing kit ([#738](https://github.com/marioparaschiv/unbound/issues/738)) ([2ebe700](https://github.com/marioparaschiv/unbound/commit/2ebe70055d7801dfdaeb1b2c26bcfa822734a510))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))


### Performance Improvements

* **sdk-generator:** bundle SDK modules in worker threads ([368f812](https://github.com/marioparaschiv/unbound/commit/368f812b4e4c8a73f910179b3d310217ac83fdb4))


### Code Refactoring

* **client:** move client modules into domain folders ([#707](https://github.com/marioparaschiv/unbound/issues/707)) ([6aa56a9](https://github.com/marioparaschiv/unbound/commit/6aa56a930028d426a3d5b3e46be5a0c2a47ccff7))
* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))


### Tests

* run the root suite in parallel workers ([692ed21](https://github.com/marioparaschiv/unbound/commit/692ed2111f61d8b83fd8336ff661d9b0e139945d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.13.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/sdk-generator-v0.9.0...sdk-generator-v0.10.0) (2026-10-31)


### Features

* **sdk-generator:** drop module default objects ([#678](https://github.com/marioparaschiv/unbound/issues/678)) ([a5b000d](https://github.com/marioparaschiv/unbound/commit/a5b000dbe706c62debd54397f59eeba8476358f7))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))


### Tests

* remove tautological tests and stop pinning brittle details ([#437](https://github.com/marioparaschiv/unbound/issues/437)) ([b69ca6c](https://github.com/marioparaschiv/unbound/commit/b69ca6c97c6470ac6cb1b0fa515c6e2f79639ba7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/logger bumped to 0.7.2

## [0.9.0](https://github.com/marioparaschiv/unbound/compare/sdk-generator-v0.8.4...sdk-generator-v0.9.0) (2026-10-29)


### Features

* **client:** add a Dialogs API ([#381](https://github.com/marioparaschiv/unbound/issues/381)) ([525bbfb](https://github.com/marioparaschiv/unbound/commit/525bbfb0bf035673a298ca96868a417314a3eee0)), closes [#33](https://github.com/marioparaschiv/unbound/issues/33)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/logger bumped to 0.7.1
