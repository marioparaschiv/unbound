# Changelog

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
