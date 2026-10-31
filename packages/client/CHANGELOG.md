# Changelog

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
