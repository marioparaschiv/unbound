# Changelog

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
