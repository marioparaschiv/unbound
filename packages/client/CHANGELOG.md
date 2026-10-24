# Changelog

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/client-v0.9.0...client-v0.10.0) (2026-10-24)


### Features

* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))


### Bug Fixes

* **client:** declare the global `global` outside the downlevel wrapper ([#183](https://github.com/marioparaschiv/unbound/issues/183)) ([7ee029d](https://github.com/marioparaschiv/unbound/commit/7ee029d708c8d60d3a04a241e4b7abc18a2fec55))
* **client:** wrap lowered hot patches so swc helpers stay scoped ([#185](https://github.com/marioparaschiv/unbound/issues/185)) ([3285172](https://github.com/marioparaschiv/unbound/commit/3285172ee9074aac408d67d81c8915fc409ab9f6))


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
    * @unbound-app/utils bumped to 0.8.5
    * @unbound-app/web bumped to 0.10.0
