:robot: I have created a release *beep* *boop*
---


<details><summary>devtools: 0.2.0</summary>

## [0.2.0](https://github.com/marioparaschiv/unbound/compare/devtools-v0.1.0...devtools-v0.2.0) (2026-11-05)


### Features

* **loader:** ship the React DevTools backend as signed bytecode ([#919](https://github.com/marioparaschiv/unbound/issues/919)) ([d940256](https://github.com/marioparaschiv/unbound/commit/d940256443edfc12fb0fd5bb6ae0eb013f4aadcb))


### Code Refactoring

* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
</details>

<details><summary>cli: 1.0.0</summary>

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.12.0...cli-v1.0.0) (2026-11-05)


###   BREAKING CHANGES

* **rollup-plugin-hermes:** the plugin is ESM-only, `manifestUrl` is now `registryUrl`, and the manifest helpers moved from dist/manifest.js to the `./manifest` export.

### Features

* **cli:** add an on-device startup and memory bench ([#805](https://github.com/marioparaschiv/unbound/issues/805)) ([aa199ca](https://github.com/marioparaschiv/unbound/commit/aa199ca3d10f3b16cae47e6eab49008a60f1f43f))
* **cli:** add the unbound rollup preset for plugins ([#683](https://github.com/marioparaschiv/unbound/issues/683)) ([1b7b007](https://github.com/marioparaschiv/unbound/commit/1b7b0070ea2b8aac74349053d6bdaf0c506cb19f))
* **cli:** add ubd profile for Hermes' sampling profiler ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** expose plugin start durations ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **client:** rebuild Plugins and Design settings on Discord primitives ([#964](https://github.com/marioparaschiv/unbound/issues/964)) ([cd4349f](https://github.com/marioparaschiv/unbound/commit/cd4349fdd5b74ede4f267d7716ad16380c51fc9c))
* **client:** splice hook changes in place during hot refresh ([#890](https://github.com/marioparaschiv/unbound/issues/890)) ([ab1355c](https://github.com/marioparaschiv/unbound/commit/ab1355c493239e287dcd9c2f6a6895aeae7fb39d))
* **cli:** generate platforms and Capabilities in ubd build ([#729](https://github.com/marioparaschiv/unbound/issues/729)) ([7deb4b2](https://github.com/marioparaschiv/unbound/commit/7deb4b23cb810fa7643557613ed4d763aded3b5f))
* **cli:** keep line info in plugin bytecode ([a187d1f](https://github.com/marioparaschiv/unbound/commit/a187d1f7bdd42cb4fb2fcdffed9885030b6cee2b))
* **cli:** measure ADDON.md media in ubd build ([#704](https://github.com/marioparaschiv/unbound/issues/704)) ([efe25d9](https://github.com/marioparaschiv/unbound/commit/efe25d92051183c8d39f4847ac71264e3702961e))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** run post-build checks in ubd build ([#685](https://github.com/marioparaschiv/unbound/issues/685)) ([88e2f4e](https://github.com/marioparaschiv/unbound/commit/88e2f4e8080a92d0bebdc39f4864d9d3885f7ca6))
* **cli:** scaffold the standard plugin tree with ubd create ([#733](https://github.com/marioparaschiv/unbound/issues/733)) ([63d3fc8](https://github.com/marioparaschiv/unbound/commit/63d3fc8b66b8f0a75359ac172a9b1e993b6ba6ef))
* **cli:** show plugin start times in ubd status ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **cli:** validate addon naming, Capabilities and layout ([#699](https://github.com/marioparaschiv/unbound/issues/699)) ([a8f2704](https://github.com/marioparaschiv/unbound/commit/a8f2704b743e08a306607bd18d5717756edf09b4))
* **native:** run plugin hooks on the UI thread ([4dde7a6](https://github.com/marioparaschiv/unbound/commit/4dde7a66bc26463ebc0e043c6c630727f3dba730))
* **rollup-plugin-hermes:** move hermes tooling into the repo ([#957](https://github.com/marioparaschiv/unbound/issues/957)) ([b91ec1e](https://github.com/marioparaschiv/unbound/commit/b91ec1e283e51ddf94a5296872181856e68655b8))
* **web,cli:** read the built manifest for publish and ubd dev ([#696](https://github.com/marioparaschiv/unbound/issues/696)) ([f417abc](https://github.com/marioparaschiv/unbound/commit/f417abc0d88f19f2144dc9a2dc5b7f8dde9b7cdd))
* **web:** read the measured ADDON.md page on submission ([#706](https://github.com/marioparaschiv/unbound/issues/706)) ([29627b6](https://github.com/marioparaschiv/unbound/commit/29627b6b13831e2ab949a4cfa6216f51b20ff096))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **cli:** compile worklets before swc ([b7a63da](https://github.com/marioparaschiv/unbound/commit/b7a63dacfad77df7e1b535153c13b8637e688096))
* **cli:** resolve symlinked paths in the capabilities check ([dd36438](https://github.com/marioparaschiv/unbound/commit/dd36438aa275b380bcc7a4baf0207ae72b1a0868))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **client:** load modules on demand, import Discord's libraries ([#789](https://github.com/marioparaschiv/unbound/issues/789)) ([d732248](https://github.com/marioparaschiv/unbound/commit/d7322488f7019307615246b4fc29d60fa5d85330))
* **loader:** harden the native runtime and add cheaper native paths ([#879](https://github.com/marioparaschiv/unbound/issues/879)) ([3686732](https://github.com/marioparaschiv/unbound/commit/36867326491240cc5ab27082a795537df282de27))
* **loader:** keep compiled plugin sources off the JS heap ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.13.0
    * @unbound-app/debugger-protocol bumped to 0.10.0
    * @unbound-app/rollup-plugin-hermes bumped to 2.0.0
  * devDependencies
    * @unbound-app/api bumped to 1.0.0
    * @unbound-app/types bumped to 0.12.0
    * @unbound-app/utils bumped to 0.10.0
    * @unbound-app/web bumped to 0.13.0
</details>

<details><summary>contracts: 0.13.0</summary>

## [0.13.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.12.0...contracts-v0.13.0) (2026-11-05)


### Features

* **client:** move fonts to a native font store with presets ([#969](https://github.com/marioparaschiv/unbound/issues/969)) ([40ff081](https://github.com/marioparaschiv/unbound/commit/40ff081f49917861523acf3e0a1ad0e8b6ec14f0))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **cli:** generate platforms and Capabilities in ubd build ([#729](https://github.com/marioparaschiv/unbound/issues/729)) ([7deb4b2](https://github.com/marioparaschiv/unbound/commit/7deb4b23cb810fa7643557613ed4d763aded3b5f))
* **cli:** measure ADDON.md media in ubd build ([#704](https://github.com/marioparaschiv/unbound/issues/704)) ([efe25d9](https://github.com/marioparaschiv/unbound/commit/efe25d92051183c8d39f4847ac71264e3702961e))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** validate addon naming, Capabilities and layout ([#699](https://github.com/marioparaschiv/unbound/issues/699)) ([a8f2704](https://github.com/marioparaschiv/unbound/commit/a8f2704b743e08a306607bd18d5717756edf09b4))
* **contracts:** add the ADDON.md page contract ([#687](https://github.com/marioparaschiv/unbound/issues/687)) ([16339c6](https://github.com/marioparaschiv/unbound/commit/16339c633867fb185a7fdf2e686824427af0b369))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **discord-bot:** v2 addon cards with gallery and author avatars ([#871](https://github.com/marioparaschiv/unbound/issues/871)) ([444fe85](https://github.com/marioparaschiv/unbound/commit/444fe854746bc7e5a0b654e0ad17ffaecb8f7bc5))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* require a minimum loader version per bundle ([#962](https://github.com/marioparaschiv/unbound/issues/962)) ([840bcfa](https://github.com/marioparaschiv/unbound/commit/840bcfa3912c370623fad8b7e810af46e5598d8f))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))
* **web,cli:** read the built manifest for publish and ubd dev ([#696](https://github.com/marioparaschiv/unbound/issues/696)) ([f417abc](https://github.com/marioparaschiv/unbound/commit/f417abc0d88f19f2144dc9a2dc5b7f8dde9b7cdd))
* **web:** allow animated GIF sponsor badges ([#912](https://github.com/marioparaschiv/unbound/issues/912)) ([77e53df](https://github.com/marioparaschiv/unbound/commit/77e53dfd28b6cc37ab7ae79996eeaef58f03ed48))
* **web:** catalog versions carry their store page URL ([#718](https://github.com/marioparaschiv/unbound/issues/718)) ([5f1f0f3](https://github.com/marioparaschiv/unbound/commit/5f1f0f31402ce2b4d9890f63a55b454f410f2d2e))
* **web:** draw :name: icon shortcodes on addon store pages ([#872](https://github.com/marioparaschiv/unbound/issues/872)) ([9d3e3f5](https://github.com/marioparaschiv/unbound/commit/9d3e3f54d096cbba4b47b9c0984e494465d7b179))
* **web:** read the measured ADDON.md page on submission ([#706](https://github.com/marioparaschiv/unbound/issues/706)) ([29627b6](https://github.com/marioparaschiv/unbound/commit/29627b6b13831e2ab949a4cfa6216f51b20ff096))
* **web:** redesign the GitHub submit flow ([#715](https://github.com/marioparaschiv/unbound/issues/715)) ([d582e06](https://github.com/marioparaschiv/unbound/commit/d582e067b9fb5839e6503e686e4e36b38744d7da))
* **web:** sponsor badges as PNGs, $5 tier and profile perks ([#809](https://github.com/marioparaschiv/unbound/issues/809)) ([c19e946](https://github.com/marioparaschiv/unbound/commit/c19e94652620ad34cb09a6c21aa91247914380a9))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **web:** limit emails to the dev team and block role escalation ([#765](https://github.com/marioparaschiv/unbound/issues/765)) ([137cc50](https://github.com/marioparaschiv/unbound/commit/137cc50253533181a22c9d1a5066b094288ec667))
* **web:** list a user's badges by their Discord id ([#913](https://github.com/marioparaschiv/unbound/issues/913)) ([28bb3a4](https://github.com/marioparaschiv/unbound/commit/28bb3a471d259e9c446beb9c54096aa1ae4551dc))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.12.0
</details>

<details><summary>debugger: 0.10.0</summary>

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/debugger-v0.9.1...debugger-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.10.0
</details>

<details><summary>debugger-protocol: 0.10.0</summary>

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.9.1...debugger-protocol-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.12.0
</details>

<details><summary>discord-types: 0.2.0</summary>

## [0.2.0](https://github.com/marioparaschiv/unbound/compare/discord-types-v0.1.0...discord-types-v0.2.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
</details>

<details><summary>logger: 0.7.3</summary>

## [0.7.3](https://github.com/marioparaschiv/unbound/compare/logger-v0.7.2...logger-v0.7.3) (2026-11-05)


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
</details>

<details><summary>rollup-plugin-hermes: 2.0.0</summary>

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v1.3.0...rollup-plugin-hermes-v2.0.0) (2026-11-05)


###   BREAKING CHANGES

* **rollup-plugin-hermes:** the plugin is ESM-only, `manifestUrl` is now `registryUrl`, and the manifest helpers moved from dist/manifest.js to the `./manifest` export.

### Features

* **rollup-plugin-hermes:** move hermes tooling into the repo ([#957](https://github.com/marioparaschiv/unbound/issues/957)) ([b91ec1e](https://github.com/marioparaschiv/unbound/commit/b91ec1e283e51ddf94a5296872181856e68655b8))
</details>

<details><summary>sdk-generator: 0.11.0</summary>

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/sdk-generator-v0.10.0...sdk-generator-v0.11.0) (2026-11-05)


### Features

* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** add metro.onModuleLoad and hide internal members ([#695](https://github.com/marioparaschiv/unbound/issues/695)) ([ad49b36](https://github.com/marioparaschiv/unbound/commit/ad49b36ed1988770143efc97c2009459cab784ac))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **sdk:** add the @unbound-app/api/testing kit ([#738](https://github.com/marioparaschiv/unbound/issues/738)) ([2ebe700](https://github.com/marioparaschiv/unbound/commit/2ebe70055d7801dfdaeb1b2c26bcfa822734a510))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
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
    * @unbound-app/logger bumped to 0.7.3
</details>

<details><summary>types: 0.12.0</summary>

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/types-v0.11.0...types-v0.12.0) (2026-11-05)


### Features

* **android:** notify hooks after the original runs ([c7f1e92](https://github.com/marioparaschiv/unbound/commit/c7f1e924f9607440ef7b4031ecb2bf913f7f32b2))
* **avatar-radius:** round avatars from UI-thread hooks ([4809639](https://github.com/marioparaschiv/unbound/commit/480963908b2f13cbafee1d4abce5c6618bf959fa))
* **cli:** add ubd profile for Hermes' sampling profiler ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **client:** add a typed native.objc.create ([#726](https://github.com/marioparaschiv/unbound/issues/726)) ([6dca897](https://github.com/marioparaschiv/unbound/commit/6dca89729b4efc0f5022147145e5515b522c52d4))
* **client:** add chat backgrounds that themes can recommend ([#966](https://github.com/marioparaschiv/unbound/issues/966)) ([4b72e6e](https://github.com/marioparaschiv/unbound/commit/4b72e6e9f7d29608901ec4320985685fd3cd1069))
* **client:** add commands.register and commands.unregister ([#708](https://github.com/marioparaschiv/unbound/issues/708)) ([2ea9a39](https://github.com/marioparaschiv/unbound/commit/2ea9a390863152c23586e3838e72e63cf013a543))
* **client:** add the flux namespace ([#722](https://github.com/marioparaschiv/unbound/issues/722)) ([f0213f2](https://github.com/marioparaschiv/unbound/commit/f0213f2d78a309964be60f3101803b8a750b9f8c))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** let worklets call back into JS ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** log unhandled promise rejections ([833b739](https://github.com/marioparaschiv/unbound/commit/833b739b4d58ec47c5b56ea33f5266edef35ebd3))
* **client:** move fonts to a native font store with presets ([#969](https://github.com/marioparaschiv/unbound/issues/969)) ([40ff081](https://github.com/marioparaschiv/unbound/commit/40ff081f49917861523acf3e0a1ad0e8b6ec14f0))
* **client:** read and write settings through the loader ([e2651a2](https://github.com/marioparaschiv/unbound/commit/e2651a29c0ac9f37459f20033d67aa184144988e))
* **client:** rebuild Plugins and Design settings on Discord primitives ([#964](https://github.com/marioparaschiv/unbound/issues/964)) ([cd4349f](https://github.com/marioparaschiv/unbound/commit/cd4349fdd5b74ede4f267d7716ad16380c51fc9c))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **client:** scope module listeners, buckets, flux and commands ([#731](https://github.com/marioparaschiv/unbound/issues/731)) ([e8e913c](https://github.com/marioparaschiv/unbound/commit/e8e913cb68d341bb0dd75614b390b35bec805555))
* **client:** show an addon's store page from the marketplace ([#725](https://github.com/marioparaschiv/unbound/issues/725)) ([6f87e74](https://github.com/marioparaschiv/unbound/commit/6f87e74b5b712d210d9e449c8ad33dee330badeb))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* **loader:** keep settings native and read them on demand ([e2651a2](https://github.com/marioparaschiv/unbound/commit/e2651a29c0ac9f37459f20033d67aa184144988e))
* **loader:** replace preload.js with the UnboundNative bridge ([#902](https://github.com/marioparaschiv/unbound/issues/902)) ([4d7a469](https://github.com/marioparaschiv/unbound/commit/4d7a469e0cad7791c731e0f2b156bde960722406))
* **loader:** report active iOS jailbreak in diagnostics ([#905](https://github.com/marioparaschiv/unbound/issues/905)) ([b00057b](https://github.com/marioparaschiv/unbound/commit/b00057bb2208c4b5b080a9a5251bf1aed5ce81c1))
* **native:** run plugin hooks on the UI thread ([4dde7a6](https://github.com/marioparaschiv/unbound/commit/4dde7a66bc26463ebc0e043c6c630727f3dba730))
* require a minimum loader version per bundle ([#962](https://github.com/marioparaschiv/unbound/issues/962)) ([840bcfa](https://github.com/marioparaschiv/unbound/commit/840bcfa3912c370623fad8b7e810af46e5598d8f))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))


### Bug Fixes

* **client:** render store page media and bold on Discord 349 ([#732](https://github.com/marioparaschiv/unbound/issues/732)) ([bc19683](https://github.com/marioparaschiv/unbound/commit/bc1968388911bc769286854a12d725ce5e21f9cf))
* **native:** follow Cocoa ownership in the iOS bridge and create ([#904](https://github.com/marioparaschiv/unbound/issues/904)) ([d17f03c](https://github.com/marioparaschiv/unbound/commit/d17f03c15fef7d0dfcb57ca37970e806371a35b8))


### Performance Improvements

* **chat-bubbles:** wake JS only for Android rows that need measuring ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** start late plugins after Discord's first frame ([94c7428](https://github.com/marioparaschiv/unbound/commit/94c7428c663d707ab72ba54cb7dc102726484072))
* **loader:** harden the native runtime and add cheaper native paths ([#879](https://github.com/marioparaschiv/unbound/issues/879)) ([3686732](https://github.com/marioparaschiv/unbound/commit/36867326491240cc5ab27082a795537df282de27))
* **loader:** hash bundles and download addon files natively ([#903](https://github.com/marioparaschiv/unbound/issues/903)) ([8e9d4e6](https://github.com/marioparaschiv/unbound/commit/8e9d4e6b84564f3944b5c325cff42717829ee741))
* **loader:** keep compiled plugin sources off the JS heap ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **loader:** second native round, Always Animate, bubble card layout ([#881](https://github.com/marioparaschiv/unbound/issues/881)) ([1aeea65](https://github.com/marioparaschiv/unbound/commit/1aeea656a7eb1d16e51b6fc14e6e86688b58c227))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **client:** add the Addon class and per-kind behaviour ([#705](https://github.com/marioparaschiv/unbound/issues/705)) ([3195a68](https://github.com/marioparaschiv/unbound/commit/3195a68bb18b726d8e7c6e2e1ef033d58fb387a6))
* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
* **client:** share the native method-to-Capability map ([#681](https://github.com/marioparaschiv/unbound/issues/681)) ([cbfa587](https://github.com/marioparaschiv/unbound/commit/cbfa5873fc4ee69f24d2719eccf672f40dd9ce13))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/discord-types bumped to 0.2.0
</details>

<details><summary>utils: 0.10.0</summary>

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/utils-v0.9.2...utils-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.12.0
</details>

<details><summary>web: 0.13.0</summary>

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
* **web:** track reading position in guide toc, debounce K ([#864](https://github.com/marioparaschiv/unbound/issues/864)) ([f9d4687](https://github.com/marioparaschiv/unbound/commit/f9d46872d934a4e6947ecc8bf96bcfeca5de356a))


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
</details>

<details><summary>api: 1.0.0</summary>

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/api-v0.12.0...api-v1.0.0) (2026-11-05)


### Features

* **android:** notify hooks after the original runs ([c7f1e92](https://github.com/marioparaschiv/unbound/commit/c7f1e924f9607440ef7b4031ecb2bf913f7f32b2))
* **avatar-radius:** round avatars from UI-thread hooks ([4809639](https://github.com/marioparaschiv/unbound/commit/480963908b2f13cbafee1d4abce5c6618bf959fa))
* **cli:** add ubd profile for Hermes' sampling profiler ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **client:** add a typed native.objc.create ([#726](https://github.com/marioparaschiv/unbound/issues/726)) ([6dca897](https://github.com/marioparaschiv/unbound/commit/6dca89729b4efc0f5022147145e5515b522c52d4))
* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** add chat backgrounds that themes can recommend ([#966](https://github.com/marioparaschiv/unbound/issues/966)) ([4b72e6e](https://github.com/marioparaschiv/unbound/commit/4b72e6e9f7d29608901ec4320985685fd3cd1069))
* **client:** add commands.register and commands.unregister ([#708](https://github.com/marioparaschiv/unbound/issues/708)) ([2ea9a39](https://github.com/marioparaschiv/unbound/commit/2ea9a390863152c23586e3838e72e63cf013a543))
* **client:** add metro.onModuleLoad and hide internal members ([#695](https://github.com/marioparaschiv/unbound/issues/695)) ([ad49b36](https://github.com/marioparaschiv/unbound/commit/ad49b36ed1988770143efc97c2009459cab784ac))
* **client:** add new names for fs, assets, toasts, i18n and settings ([#693](https://github.com/marioparaschiv/unbound/issues/693)) ([968a5d4](https://github.com/marioparaschiv/unbound/commit/968a5d4b7ffc26a1a0d0bde605da210b642b230c))
* **client:** add the Bucket API to storage ([#694](https://github.com/marioparaschiv/unbound/issues/694)) ([e0be2df](https://github.com/marioparaschiv/unbound/commit/e0be2dfe91c70bd3c431316dad008d20c44f6f44))
* **client:** add the flux namespace ([#722](https://github.com/marioparaschiv/unbound/issues/722)) ([f0213f2](https://github.com/marioparaschiv/unbound/commit/f0213f2d78a309964be60f3101803b8a750b9f8c))
* **client:** add the ui namespace for addon settings ([#728](https://github.com/marioparaschiv/unbound/issues/728)) ([26840c9](https://github.com/marioparaschiv/unbound/commit/26840c943c39a5412dda1a30376faf066fae0cd3))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** expose plugin start durations ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **client:** lazy patch targets and lazy addon lookups ([#714](https://github.com/marioparaschiv/unbound/issues/714)) ([e7c1cd9](https://github.com/marioparaschiv/unbound/commit/e7c1cd9a7c788bf1f6a3d58a63591a91df36cdf4))
* **client:** let worklets call back into JS ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** read manifest platforms, add definePlatform and has ([#723](https://github.com/marioparaschiv/unbound/issues/723)) ([9c31acf](https://github.com/marioparaschiv/unbound/commit/9c31acf0591982314e8c35457b91740d45f3d67a))
* **client:** redesign settings and add a shared Unbound account ([#810](https://github.com/marioparaschiv/unbound/issues/810)) ([859add1](https://github.com/marioparaschiv/unbound/commit/859add1230f6dce2ff67c2088f4590199a8ab667))
* **client:** scope module listeners, buckets, flux and commands ([#731](https://github.com/marioparaschiv/unbound/issues/731)) ([e8e913c](https://github.com/marioparaschiv/unbound/commit/e8e913cb68d341bb0dd75614b390b35bec805555))
* **client:** show an addon's store page from the marketplace ([#725](https://github.com/marioparaschiv/unbound/issues/725)) ([6f87e74](https://github.com/marioparaschiv/unbound/commit/6f87e74b5b712d210d9e449c8ad33dee330badeb))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** show plugin start times in ubd status ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **contracts:** add the manifest platforms field ([#691](https://github.com/marioparaschiv/unbound/issues/691)) ([edac1ed](https://github.com/marioparaschiv/unbound/commit/edac1ed2f287a26e869bf02057c2244684494aba))
* **loader:** add an in-app updater for patched Discord ([#956](https://github.com/marioparaschiv/unbound/issues/956)) ([747ef3b](https://github.com/marioparaschiv/unbound/commit/747ef3bde0f5b712e1548a4d3b4c3aad7394bcc6))
* **loader:** replace preload.js with the UnboundNative bridge ([#902](https://github.com/marioparaschiv/unbound/issues/902)) ([4d7a469](https://github.com/marioparaschiv/unbound/commit/4d7a469e0cad7791c731e0f2b156bde960722406))
* **loader:** report active iOS jailbreak in diagnostics ([#905](https://github.com/marioparaschiv/unbound/issues/905)) ([b00057b](https://github.com/marioparaschiv/unbound/commit/b00057bb2208c4b5b080a9a5251bf1aed5ce81c1))
* **sdk:** add the @unbound-app/api/testing kit ([#738](https://github.com/marioparaschiv/unbound/issues/738)) ([2ebe700](https://github.com/marioparaschiv/unbound/commit/2ebe70055d7801dfdaeb1b2c26bcfa822734a510))
* **sdk:** type the Addon scope globals in global.d.ts ([#737](https://github.com/marioparaschiv/unbound/issues/737)) ([5fde80b](https://github.com/marioparaschiv/unbound/commit/5fde80ba20afc9a06b6a0cc2f59cf58ca14bf057))
* type all of window.unbound and publish versioned API docs ([#784](https://github.com/marioparaschiv/unbound/issues/784)) ([3174a68](https://github.com/marioparaschiv/unbound/commit/3174a68aa9713d44631bf2527b0014a7d79f2a8c))


### Bug Fixes

* **api:** regenerate the SDK with the profiler type ([eb65292](https://github.com/marioparaschiv/unbound/commit/eb65292fad531795be4130f489c7a6e90456bc0b))
* **client:** apply icon packs on Discord 349 ([#730](https://github.com/marioparaschiv/unbound/issues/730)) ([b4f7310](https://github.com/marioparaschiv/unbound/commit/b4f73109ad4e430402851d5a7e3be884ebdb7eaa))
* **client:** render store page media and bold on Discord 349 ([#732](https://github.com/marioparaschiv/unbound/issues/732)) ([bc19683](https://github.com/marioparaschiv/unbound/commit/bc1968388911bc769286854a12d725ce5e21f9cf))
* **client:** trim isRenderable and the design audit from the SDK ([#867](https://github.com/marioparaschiv/unbound/issues/867)) ([e47bd64](https://github.com/marioparaschiv/unbound/commit/e47bd646d89fb4fd6461164c4a8c6c9acf8d7126))
* **native:** follow Cocoa ownership in the iOS bridge and create ([#904](https://github.com/marioparaschiv/unbound/issues/904)) ([d17f03c](https://github.com/marioparaschiv/unbound/commit/d17f03c15fef7d0dfcb57ca37970e806371a35b8))


### Performance Improvements

* **chat-bubbles:** wake JS only for Android rows that need measuring ([8a01f16](https://github.com/marioparaschiv/unbound/commit/8a01f1625f188431a9d88f5fbf8c5cb50762b6bd))
* **client:** add a cached byTypeName metro filter ([45ce33c](https://github.com/marioparaschiv/unbound/commit/45ce33c0a17bf1aa83955410bab0811019d0d49e))
* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **client:** load modules on demand, import Discord's libraries ([#789](https://github.com/marioparaschiv/unbound/issues/789)) ([d732248](https://github.com/marioparaschiv/unbound/commit/d7322488f7019307615246b4fc29d60fa5d85330))
* **client:** look up file-path searches and waits by path ([#806](https://github.com/marioparaschiv/unbound/issues/806)) ([8c17656](https://github.com/marioparaschiv/unbound/commit/8c17656d0990b9e88e68457458363e37dfe65c27))
* **loader:** harden the native runtime and add cheaper native paths ([#879](https://github.com/marioparaschiv/unbound/issues/879)) ([3686732](https://github.com/marioparaschiv/unbound/commit/36867326491240cc5ab27082a795537df282de27))
* **loader:** keep compiled plugin sources off the JS heap ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **loader:** second native round, Always Animate, bubble card layout ([#881](https://github.com/marioparaschiv/unbound/issues/881)) ([1aeea65](https://github.com/marioparaschiv/unbound/commit/1aeea656a7eb1d16e51b6fc14e6e86688b58c227))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** add AddonKind and Manager.for ([#684](https://github.com/marioparaschiv/unbound/issues/684)) ([82c0cd6](https://github.com/marioparaschiv/unbound/commit/82c0cd6e92471066f0d3511622e6a5666c2a87f0))
* **client:** add the Addon class and per-kind behaviour ([#705](https://github.com/marioparaschiv/unbound/issues/705)) ([3195a68](https://github.com/marioparaschiv/unbound/commit/3195a68bb18b726d8e7c6e2e1ef033d58fb387a6))
* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
* **client:** share the native method-to-Capability map ([#681](https://github.com/marioparaschiv/unbound/issues/681)) ([cbfa587](https://github.com/marioparaschiv/unbound/commit/cbfa5873fc4ee69f24d2719eccf672f40dd9ce13))
* **client:** type each patcher callback by its patch kind ([#682](https://github.com/marioparaschiv/unbound/issues/682)) ([a6e2744](https://github.com/marioparaschiv/unbound/commit/a6e2744af84e3f051731bd6f7df6d5f0b9c67e03))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/client bumped to 1.0.0
    * @unbound-app/sdk-generator bumped to 0.11.0
</details>

<details><summary>client: 1.0.0</summary>

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/client-v0.12.0...client-v1.0.0) (2026-11-05)


###   BREAKING CHANGES

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
</details>

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).