# Changelog

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/contracts-v0.9.0...contracts-v0.10.0) (2026-10-24)


### Features

* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **contracts:** add repository listing and preview schemas ([85f169b](https://github.com/marioparaschiv/unbound/commit/85f169bb715a5d71356627b916b68794aecaafa5))
* **contracts:** add shared workspace discovery rules ([33531c2](https://github.com/marioparaschiv/unbound/commit/33531c2634092e1cf3dc3a48badce1ce4fc27301))
* **contracts:** add source pin and repository details schemas ([8249648](https://github.com/marioparaschiv/unbound/commit/82496486be8642d240ef7630b536cefe98ec9add))
* **contracts:** add the CHANGELOG.md parser and changelog schemas ([672df3d](https://github.com/marioparaschiv/unbound/commit/672df3d3649e0639e175a64dfb87a95d279d0f68))
* **contracts:** create submissions from a pinned GitHub source ([2882363](https://github.com/marioparaschiv/unbound/commit/288236321cbdcf1b7bf0399511306e8c0260b64d))
* **web:** add admin addon and user pages with review history ([642b31b](https://github.com/marioparaschiv/unbound/commit/642b31bbbcd24c58676f3c96a7e7734222ebc2c0))
* **web:** add GitHub Sponsors with a custom badge perk ([#190](https://github.com/marioparaschiv/unbound/issues/190)) ([85ad012](https://github.com/marioparaschiv/unbound/commit/85ad012ce92f128c025c0d7be0ae13c64e7bd2c3))
* **web:** add staff notes on users and addons ([6888d66](https://github.com/marioparaschiv/unbound/commit/6888d66e5da005bb589678a62c9c1f195802841c))
* **web:** add the moderation event log ([9350597](https://github.com/marioparaschiv/unbound/commit/9350597082194348aa948aec97847121f300c2d7))
* **web:** edit addons as staff with pinned summary fields ([d4555fb](https://github.com/marioparaschiv/unbound/commit/d4555fbf506ae697763036b3d48bc8434d40fb6a))
* **web:** edit addons as staff with TanStack Form ([44f3f6b](https://github.com/marioparaschiv/unbound/commit/44f3f6bb311802478ca370618a794d30922c203f))
* **web:** filter admin addons by type, status, maintainer and date ([e708728](https://github.com/marioparaschiv/unbound/commit/e708728db8ca0d04963317b8c9a5472742107b61))
* **web:** filter admin addons by type, status, maintainer and date ([7ba0fe5](https://github.com/marioparaschiv/unbound/commit/7ba0fe5aa30e8d1afdad5dd592944dfa207890df))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** keyset-page and search the admin users and addons lists ([4309629](https://github.com/marioparaschiv/unbound/commit/4309629c55e6883fcdd1483ea147f27aa0ffbaf4))
* **web:** keyset-page and search the admin users and addons lists ([1e6b7db](https://github.com/marioparaschiv/unbound/commit/1e6b7dbb4720019115be1d9e16fddbbb5df42206))
* **web:** load the admin addon and user views ([13d32d3](https://github.com/marioparaschiv/unbound/commit/13d32d34df5af2db6113d30dc791d4a03dfa4bbd))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read and write staff notes through server functions ([7b2c219](https://github.com/marioparaschiv/unbound/commit/7b2c2196ebba222fda9a4bec999202b64ccea9f1))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** record moderation events for addon actions and reviews ([a3c861c](https://github.com/marioparaschiv/unbound/commit/a3c861c44068e2c8a25d59f2a068663ce48b2d46))
* **web:** roll an addon back to any approved version ([799bbf9](https://github.com/marioparaschiv/unbound/commit/799bbf93dbdddb1f45dba47fdd7bf3dca8869389))
* **web:** roll an addon back to any approved version ([cc7906e](https://github.com/marioparaschiv/unbound/commit/cc7906e159daa38165da5b4e453275cf7dd30172))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))


### Bug Fixes

* **contracts:** import repositorySchema from source in admin ([465e77e](https://github.com/marioparaschiv/unbound/commit/465e77e41484a86b90943d7e2ee5ac555cd1ed4a))
* **web:** keep catalogs stored before the listing name still parseable ([93cb8b2](https://github.com/marioparaschiv/unbound/commit/93cb8b2f5ad497bb0bf281ace914ba142f7b3c2a))
* **web:** keep catalogs stored before the listing name still parseable ([1db2a60](https://github.com/marioparaschiv/unbound/commit/1db2a60b23bf76c0f29700a761f9ce2149b8f388))


### Code Refactoring

* **contracts:** give loader updates their own changelog entry ([2542bcc](https://github.com/marioparaschiv/unbound/commit/2542bcc67abacf2b331048d67371929425e7d649))
* **contracts:** name the parser's invalid states and the root check ([f795b5a](https://github.com/marioparaschiv/unbound/commit/f795b5a36eff7675713ab2a9d55af24c62a91e54))
* **web:** trim admin comments and share the search length limits ([46db19b](https://github.com/marioparaschiv/unbound/commit/46db19bdd0f220e6bef5783294e0086e6146d060))


### Styles

* **contracts:** sort admin imports ([cc8efcb](https://github.com/marioparaschiv/unbound/commit/cc8efcb0b8862ae29704e55ea97d72b824961225))
* sort imports and shorten script header comments ([d159f61](https://github.com/marioparaschiv/unbound/commit/d159f613a19f0c1eec0095f2283824e758c7a15b))
* **web:** sort imports ([7a933e2](https://github.com/marioparaschiv/unbound/commit/7a933e26b00a895ea9fcd1551066e913fba34c88))
* **web:** sort imports and exports ([3d297f5](https://github.com/marioparaschiv/unbound/commit/3d297f511aba79a490328a7033d00d6d25cdac6c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/types bumped to 0.9.0
