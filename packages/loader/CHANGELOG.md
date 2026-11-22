# Changelog

## [1.12.3](https://github.com/marioparaschiv/unbound/compare/loader-v1.12.2...loader-v1.12.3) (2026-11-22)


### Bug Fixes

* **loader:** keep stopped plugin surfaces alive until layout settles ([#2229](https://github.com/marioparaschiv/unbound/issues/2229)) ([ab74190](https://github.com/marioparaschiv/unbound/commit/ab741908e57bccac062243531f92a05b2cf909bb))

## [1.12.2](https://github.com/marioparaschiv/unbound/compare/loader-v1.12.1...loader-v1.12.2) (2026-11-22)


### Bug Fixes

* **loader:** retire the JS runtime when React Native invalidates it ([#2186](https://github.com/marioparaschiv/unbound/issues/2186)) ([295e2d3](https://github.com/marioparaschiv/unbound/commit/295e2d3320baa819960569bf38200da658b8a9cf))

## [1.12.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.12.0...loader-v1.12.1) (2026-11-22)


### Bug Fixes

* **loader:** ignore MetricKit crashes from other apps in the same host ([#2171](https://github.com/marioparaschiv/unbound/issues/2171)) ([30ad351](https://github.com/marioparaschiv/unbound/commit/30ad351a052fb893f83a6ab3a398386f8e613f68)), closes [#2153](https://github.com/marioparaschiv/unbound/issues/2153)
* **loader:** read loader release responses past 16 KB ([#2160](https://github.com/marioparaschiv/unbound/issues/2160)) ([0d747ac](https://github.com/marioparaschiv/unbound/commit/0d747acd3310aedd96afabe6c6b6e82cbb4bf66d))

## [1.12.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.11.0...loader-v1.12.0) (2026-11-21)


### Features

* **loader:** batch iOS main-thread calls into one dispatch ([#1922](https://github.com/marioparaschiv/unbound/issues/1922)) ([fc952fe](https://github.com/marioparaschiv/unbound/commit/fc952fe2709faa0031ea702a9b1ccbd216242b60))
* **loader:** collapse repeated JavaScript errors in the log ([#1956](https://github.com/marioparaschiv/unbound/issues/1956)) ([50a7509](https://github.com/marioparaschiv/unbound/commit/50a75098b5ad848ca084860ecc7a9d1a624fbdd4))
* **loader:** decode the exception syndrome in native crash descriptions ([#2076](https://github.com/marioparaschiv/unbound/issues/2076)) ([867d5a1](https://github.com/marioparaschiv/unbound/commit/867d5a1e8119bf102014d0f2073dc7d474d303ea))
* **loader:** explain scheduled refresh, add job options, run on charge ([#2071](https://github.com/marioparaschiv/unbound/issues/2071)) ([59c3ee5](https://github.com/marioparaschiv/unbound/commit/59c3ee5a663bdd997fa187f44de0dfbf8aee18a3))
* **loader:** finish iOS update downloads in the background ([#1931](https://github.com/marioparaschiv/unbound/issues/1931)) ([4f529cf](https://github.com/marioparaschiv/unbound/commit/4f529cf2922ff122f329c42315c4fe2a3c880b2f))
* **loader:** flag legacy Xposed and merged split APKs ([#1907](https://github.com/marioparaschiv/unbound/issues/1907)) ([8e16b61](https://github.com/marioparaschiv/unbound/commit/8e16b61237ac44b657d336982acd0cdf187fb23f))
* **loader:** hash plugins into their digest caches in the background ([#2058](https://github.com/marioparaschiv/unbound/issues/2058)) ([7511089](https://github.com/marioparaschiv/unbound/commit/7511089720d2f7374247f4a95248368bed37911f))
* **loader:** keep build IDs in Android tombstone frames ([#1952](https://github.com/marioparaschiv/unbound/issues/1952)) ([0bbeb50](https://github.com/marioparaschiv/unbound/commit/0bbeb50a4c86b6319717ac8594c1ff3e99d81b46))
* **loader:** keep older logs compressed ([#1919](https://github.com/marioparaschiv/unbound/issues/1919)) ([a886a10](https://github.com/marioparaschiv/unbound/commit/a886a103c292de16da1fb9e315d97c68f0f67bc8))
* **loader:** keep Unbound's caches out of iCloud backups ([#1930](https://github.com/marioparaschiv/unbound/issues/1930)) ([a3b1495](https://github.com/marioparaschiv/unbound/commit/a3b14954932b8ecc947cf5a0fdc303919783078c))
* **loader:** list plugins' recent bridge calls in crashes ([#1913](https://github.com/marioparaschiv/unbound/issues/1913)) ([51bcf38](https://github.com/marioparaschiv/unbound/commit/51bcf38eb904ccb0bccc7179856b341ed5cc33d2))
* **loader:** log UI worklets that block the UI thread ([#2115](https://github.com/marioparaschiv/unbound/issues/2115)) ([0dfe51f](https://github.com/marioparaschiv/unbound/commit/0dfe51f1c110929210de27db68ef61419a37f78b))
* **loader:** mark IPv6-only networks and leftover mod data ([#1908](https://github.com/marioparaschiv/unbound/issues/1908)) ([728b70c](https://github.com/marioparaschiv/unbound/commit/728b70c0d4b1a1b80c1ebf94dd0e495487634332))
* **loader:** name likely pointer authentication failures ([#1973](https://github.com/marioparaschiv/unbound/issues/1973)) ([557fafe](https://github.com/marioparaschiv/unbound/commit/557fafe809dd49cd980a700f0d7a66c46f9ab5c7))
* **loader:** name plugins piling up main-thread calls ([#1898](https://github.com/marioparaschiv/unbound/issues/1898)) ([c94bd21](https://github.com/marioparaschiv/unbound/commit/c94bd21700f9c854cf2f30c2f263bf2290c79972))
* **loader:** name the likely plugin behind a MetricKit hang ([#1950](https://github.com/marioparaschiv/unbound/issues/1950)) ([5f5606b](https://github.com/marioparaschiv/unbound/commit/5f5606b2e7ec6c5a12488ac4a32b0234aafd8210))
* **loader:** name the team behind an enterprise certificate ([#2029](https://github.com/marioparaschiv/unbound/issues/2029)) ([8126cc6](https://github.com/marioparaschiv/unbound/commit/8126cc618b88a33ac14b9c4e6120fb6eb0a92c70))
* **loader:** name the tweak package behind each injected library ([#2028](https://github.com/marioparaschiv/unbound/issues/2028)) ([8b46028](https://github.com/marioparaschiv/unbound/commit/8b460282fcd143a1a6e9e00c74707727aec75d1e))
* **loader:** recognise PlayCover installs ([#1957](https://github.com/marioparaschiv/unbound/issues/1957)) ([a718087](https://github.com/marioparaschiv/unbound/commit/a718087a0ef55bbfc9b44581752350102d30c382))
* **loader:** recognise Serotonin by its bootstrap ([#2051](https://github.com/marioparaschiv/unbound/issues/2051)) ([2a48773](https://github.com/marioparaschiv/unbound/commit/2a48773e49f8e8571b262902b15f9c8cda768599))
* **loader:** record Hermes fatal errors in crash reports ([#1912](https://github.com/marioparaschiv/unbound/issues/1912)) ([ee7c0fa](https://github.com/marioparaschiv/unbound/commit/ee7c0fa6739a0c7ee6d83c093e46143f071cc8a0))
* **loader:** record MetricKit disk-write reports ([#1951](https://github.com/marioparaschiv/unbound/issues/1951)) ([b2cc806](https://github.com/marioparaschiv/unbound/commit/b2cc8062459375c48949a27e2081f47602ef111f))
* **loader:** refresh the bundle in the background when sideloaded ([#2052](https://github.com/marioparaschiv/unbound/issues/2052)) ([8df50dd](https://github.com/marioparaschiv/unbound/commit/8df50dd65ddbf1e344fbdc5d8fc1bffe2bd00b30))
* **loader:** report the versions of injected Android modules ([#2046](https://github.com/marioparaschiv/unbound/issues/2046)) ([ed64736](https://github.com/marioparaschiv/unbound/commit/ed647362d33180010988f4d625d571d4f2f52ba5))
* **loader:** run addon updates and client jobs in the background ([#2056](https://github.com/marioparaschiv/unbound/issues/2056)) ([5a9b86b](https://github.com/marioparaschiv/unbound/commit/5a9b86b79ad1d0dc51cc3383eadd8975227a01f6))
* **loader:** run iOS hooks on one method in plugin order ([#1918](https://github.com/marioparaschiv/unbound/issues/1918)) ([d7e0e3e](https://github.com/marioparaschiv/unbound/commit/d7e0e3ef20f07f6c3ee732a0d2059eb19ebb7255))
* **loader:** say when a failed update check hit a captive portal ([#1958](https://github.com/marioparaschiv/unbound/issues/1958)) ([ce20a9c](https://github.com/marioparaschiv/unbound/commit/ce20a9c7b243c33175cbe77d3443b41e01660947))
* **loader:** space background refreshes out while nothing changes ([#2073](https://github.com/marioparaschiv/unbound/issues/2073)) ([2a56ecb](https://github.com/marioparaschiv/unbound/commit/2a56ecbfc8937d07e1853cf2278abb1a51589b43))
* **loader:** stage addon installs and clean up leftover folders ([#2072](https://github.com/marioparaschiv/unbound/issues/2072)) ([1503fa0](https://github.com/marioparaschiv/unbound/commit/1503fa0f6c2b41eda922e599c37a63c572827de8))
* **loader:** support CGVector, UIOffset and NSDirectionalEdgeInsets ([#2044](https://github.com/marioparaschiv/unbound/issues/2044)) ([dd50340](https://github.com/marioparaschiv/unbound/commit/dd5034078b7936005c358e4d36ac55f1e6d1b254))
* **loader:** survive rejected list updates on iOS ([#1954](https://github.com/marioparaschiv/unbound/issues/1954)) ([800b3bf](https://github.com/marioparaschiv/unbound/commit/800b3bf485db06567d26e14eeeaba24e3901c70f))
* **loader:** wait out the server's max-age before the next update check ([#2075](https://github.com/marioparaschiv/unbound/issues/2075)) ([0033995](https://github.com/marioparaschiv/unbound/commit/0033995bc7e4dc745a1d704167a7551f642e0bff))
* **loader:** warn once when storage is full ([#1947](https://github.com/marioparaschiv/unbound/issues/1947)) ([af66a97](https://github.com/marioparaschiv/unbound/commit/af66a97b71c6ba5a909cc36de4b3b53ddade4a7b))


### Bug Fixes

* **loader:** blame a freeze only on the plugin that held it ([#2156](https://github.com/marioparaschiv/unbound/issues/2156)) ([de84753](https://github.com/marioparaschiv/unbound/commit/de84753680715d318e215153db9e191dc1edafdb))
* **loader:** detect a jailbreak from injected tweaks ([#1997](https://github.com/marioparaschiv/unbound/issues/1997)) ([b195c63](https://github.com/marioparaschiv/unbound/commit/b195c63c43db9eddbf88f4b6c50f3d7057ae0443))
* **loader:** find the jailbreak root in core, roothide included ([#2001](https://github.com/marioparaschiv/unbound/issues/2001)) ([a55fac2](https://github.com/marioparaschiv/unbound/commit/a55fac257a9f59d3a55c3589fdb5d1554fadb1d4))
* **loader:** format Kotlin with the pinned JDK ([#1944](https://github.com/marioparaschiv/unbound/issues/1944)) ([b4f7bbf](https://github.com/marioparaschiv/unbound/commit/b4f7bbf017f92dbb68f67bfdeb0f07ce8301425e))
* **loader:** give camera devices without a name an empty one ([#2004](https://github.com/marioparaschiv/unbound/issues/2004)) ([3f101b0](https://github.com/marioparaschiv/unbound/commit/3f101b01f778f8587d1591b5f5808e6ffb9c32ab))
* **loader:** hide the animated icon where it cannot animate ([#1996](https://github.com/marioparaschiv/unbound/issues/1996)) ([8388a2a](https://github.com/marioparaschiv/unbound/commit/8388a2a122fe771048431c185d16f01833a3ebe9))
* **loader:** ignore time spent suspended in freeze reports ([#2134](https://github.com/marioparaschiv/unbound/issues/2134)) ([601b067](https://github.com/marioparaschiv/unbound/commit/601b067dbae55787e6e771b9138eb07b54b6a5d4))
* **loader:** keep a new bundle when Discord's own code crashed ([#2003](https://github.com/marioparaschiv/unbound/issues/2003)) ([835b325](https://github.com/marioparaschiv/unbound/commit/835b325cd7b8347285ff37dbd75d8d1de23fb039))
* **loader:** keep a replaced runtime executor alive ([#2152](https://github.com/marioparaschiv/unbound/issues/2152)) ([ec22972](https://github.com/marioparaschiv/unbound/commit/ec22972fc35bb257af8598c9c6769935af4eedce))
* **loader:** keep iOS symbols for every shipped build ([#2157](https://github.com/marioparaschiv/unbound/issues/2157)) ([3a566fa](https://github.com/marioparaschiv/unbound/commit/3a566fa7b711259d8d8fcd5c1a4d06c04e6b8aba))
* **loader:** keep noting uncaught exceptions after Discord's handlers ([#2154](https://github.com/marioparaschiv/unbound/issues/2154)) ([c750156](https://github.com/marioparaschiv/unbound/commit/c750156015f92280fe7769d392dae62c187105bc))
* **loader:** keep objects hooks return alive past their pool ([#1906](https://github.com/marioparaschiv/unbound/issues/1906)) ([06fe21b](https://github.com/marioparaschiv/unbound/commit/06fe21b4a19600085a99c03db13d6b915875e30a))
* **loader:** keep the download banner up during the first download ([#2005](https://github.com/marioparaschiv/unbound/issues/2005)) ([3346c45](https://github.com/marioparaschiv/unbound/commit/3346c455e06ffa053c8313ebfecfbf2e798b4d4d))
* **loader:** keep the loader alive while JS can still reach it ([#2111](https://github.com/marioparaschiv/unbound/issues/2111)) ([d82d773](https://github.com/marioparaschiv/unbound/commit/d82d7735cce0ad4f408d457979019cc3ecea852d))
* **loader:** load the dev client when the debugger is on ([#2000](https://github.com/marioparaschiv/unbound/issues/2000)) ([95a205b](https://github.com/marioparaschiv/unbound/commit/95a205ba6479f5160cef00fa10a4f600e6969990))
* **loader:** name only hooks still running when Discord crashes ([#2108](https://github.com/marioparaschiv/unbound/issues/2108)) ([e7ed2ff](https://github.com/marioparaschiv/unbound/commit/e7ed2ff62536f101cdd701b3378b93e1842e2012))
* **loader:** name Swift traps and Mach exceptions in crash headlines ([#2061](https://github.com/marioparaschiv/unbound/issues/2061)) ([c941d79](https://github.com/marioparaschiv/unbound/commit/c941d7982c03c08085adb7f9a4aa976f8b3c9876))
* **loader:** name the plugin when a native callback throws ([#1911](https://github.com/marioparaschiv/unbound/issues/1911)) ([6263e69](https://github.com/marioparaschiv/unbound/commit/6263e69da35915f7e57449b04d62846c53287f8a))
* **loader:** never free a block's JS function after its runtime is gone ([#2118](https://github.com/marioparaschiv/unbound/issues/2118)) ([e30299f](https://github.com/marioparaschiv/unbound/commit/e30299fbfeab94c53f299e05eb15bef65650014a))
* **loader:** overwrite an existing IPA in non-interactive builds ([#2057](https://github.com/marioparaschiv/unbound/issues/2057)) ([998df76](https://github.com/marioparaschiv/unbound/commit/998df76659e7f933a26750152bd8e0336e286d9c))
* **loader:** pass and read Yoga's YGValue across the native bridge ([#2019](https://github.com/marioparaschiv/unbound/issues/2019)) ([cda81e3](https://github.com/marioparaschiv/unbound/commit/cda81e39d2566f53b22547ed1698ee712bc25856))
* **loader:** queue icon picks and say why one failed ([#1999](https://github.com/marioparaschiv/unbound/issues/1999)) ([c697717](https://github.com/marioparaschiv/unbound/commit/c697717219739f53f1b03798ee1483dc49fc3d0a))
* **loader:** restore the Logos directives in the list update guard ([#1955](https://github.com/marioparaschiv/unbound/issues/1955)) ([1be66cd](https://github.com/marioparaschiv/unbound/commit/1be66cd8be5182e035d7cd6a952a875dc8ec65fa))
* **loader:** run a dev server's new bundle on the first reload ([#1967](https://github.com/marioparaschiv/unbound/issues/1967)) ([c1a7e0f](https://github.com/marioparaschiv/unbound/commit/c1a7e0f2e4ffe1c9b4ea63d049c2623ae5ca0dfd))
* **loader:** say why an add-on file can't be read, and move it aside ([#1929](https://github.com/marioparaschiv/unbound/issues/1929)) ([2f2d644](https://github.com/marioparaschiv/unbound/commit/2f2d644d120cf1f97eed789ac111cd44563b75d5))
* **loader:** say why Android raised an ANR and which threads were busy ([#2121](https://github.com/marioparaschiv/unbound/issues/2121)) ([fe9141e](https://github.com/marioparaschiv/unbound/commit/fe9141e88cdae3a05fca34e7cc72bdfc5f6d58bb))
* **loader:** show native structs' name and value in JSON and logs ([#2017](https://github.com/marioparaschiv/unbound/issues/2017)) ([dd2974a](https://github.com/marioparaschiv/unbound/commit/dd2974a25ea91f6172a2aca97533ef80351c93f5))
* **loader:** stop animating the app icon where iOS confirms changes ([#1995](https://github.com/marioparaschiv/unbound/issues/1995)) ([f79a39a](https://github.com/marioparaschiv/unbound/commit/f79a39ac31b3e618bb0afefa340b5a0fd9909239))
* **loader:** symbolicate the crash issues the server opens ([#2132](https://github.com/marioparaschiv/unbound/issues/2132)) ([3a09c7e](https://github.com/marioparaschiv/unbound/commit/3a09c7e6f815cf021c8fa446b6492fb1dd13278b))

## [1.11.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.10.0...loader-v1.11.0) (2026-11-19)


### Features

* **loader:** add device, display and locale markers ([#1857](https://github.com/marioparaschiv/unbound/issues/1857)) ([fd94429](https://github.com/marioparaschiv/unbound/commit/fd94429aefd59197312bb8063f8bbeb4d340789d))
* **loader:** cap native handles per plugin ([#1884](https://github.com/marioparaschiv/unbound/issues/1884)) ([65c7595](https://github.com/marioparaschiv/unbound/commit/65c75951cd85965986ecbd887cba791a47c33e03))
* **loader:** flag plugin disk access on the Android main thread ([#1856](https://github.com/marioparaschiv/unbound/issues/1856)) ([9afe6bb](https://github.com/marioparaschiv/unbound/commit/9afe6bb98c3eda3945adf39a55ba7d5d1c652468))
* **loader:** list recent hook calls in native crash reports ([#1888](https://github.com/marioparaschiv/unbound/issues/1888)) ([615f690](https://github.com/marioparaschiv/unbound/commit/615f690c34fd9930079c2e5371813f26d77556b4))
* **loader:** name more Android stores and form factors ([#1880](https://github.com/marioparaschiv/unbound/issues/1880)) ([a22638e](https://github.com/marioparaschiv/unbound/commit/a22638e6060507fb07d4baaa2cfbf20669af1a72))
* **loader:** name tweaks that replace a plugin's hooked method ([#1855](https://github.com/marioparaschiv/unbound/issues/1855)) ([1141213](https://github.com/marioparaschiv/unbound/commit/114121305c93c5d31b649eaf6603c274be819da3))
* **loader:** prebuilt hook trampolines for mixed double and i64 ([#1851](https://github.com/marioparaschiv/unbound/issues/1851)) ([5d8696c](https://github.com/marioparaschiv/unbound/commit/5d8696cb4da623c6778fd66775eb6941907f31fd))
* **loader:** rate-limit JS log lines per scope ([#1853](https://github.com/marioparaschiv/unbound/issues/1853)) ([090358f](https://github.com/marioparaschiv/unbound/commit/090358f4d0f4519ad2c1d8b5b9222128a9d772fd))
* **loader:** record C++ exceptions and abort messages in crashes ([#1848](https://github.com/marioparaschiv/unbound/issues/1848)) ([e0f7c11](https://github.com/marioparaschiv/unbound/commit/e0f7c11f80814ea13cd43d2ed3935613ef2e9eed))
* **loader:** report MetricKit hangs with their main-thread stack ([#1849](https://github.com/marioparaschiv/unbound/issues/1849)) ([cb45fa4](https://github.com/marioparaschiv/unbound/commit/cb45fa4cdab6e2f7b9a1c2975d9572743354a0f4))
* **loader:** run only one copy of Unbound per process ([#1882](https://github.com/marioparaschiv/unbound/issues/1882)) ([3ac5b3e](https://github.com/marioparaschiv/unbound/commit/3ac5b3ee2886ce888c9bfd46f1313929cd71f00b))
* **loader:** skip queued hook calls past 1000 a second ([#1886](https://github.com/marioparaschiv/unbound/issues/1886)) ([55b4ef9](https://github.com/marioparaschiv/unbound/commit/55b4ef90a5ffbb43a9d40238b5703cbee38402c3))
* **loader:** stop plugin hooks recursing into their own method ([#1854](https://github.com/marioparaschiv/unbound/issues/1854)) ([fe2e524](https://github.com/marioparaschiv/unbound/commit/fe2e5248f9d3914276d0b1f6e42419337a725912))


### Bug Fixes

* **loader:** keep alternate icons working on sideloaded iOS 27.3 ([#1838](https://github.com/marioparaschiv/unbound/issues/1838)) ([ebf0d08](https://github.com/marioparaschiv/unbound/commit/ebf0d08e028876cf89244e7b8f6c647f88d2db82))
* **loader:** keep Objective-C exceptions out of JS hook frames ([#1887](https://github.com/marioparaschiv/unbound/issues/1887)) ([63ee40f](https://github.com/marioparaschiv/unbound/commit/63ee40f30de0c9bde9bbebb39045b38cb5c03ea5))
* **loader:** read class-method hooks in the compat scan ([#1835](https://github.com/marioparaschiv/unbound/issues/1835)) ([95ceef7](https://github.com/marioparaschiv/unbound/commit/95ceef787d0d877839c7e850a6cd34718d9e48ac))
* **loader:** tell the compat scan Huawei's BuildEx is a system class ([#1862](https://github.com/marioparaschiv/unbound/issues/1862)) ([b8f2250](https://github.com/marioparaschiv/unbound/commit/b8f2250c76794dae14b6a1d63c49a22f5dbec98e))

## [1.10.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.9.0...loader-v1.10.0) (2026-11-18)


### Features

* **loader:** add the JS stack to Android main thread stalls ([#1781](https://github.com/marioparaschiv/unbound/issues/1781)) ([b503b49](https://github.com/marioparaschiv/unbound/commit/b503b49913e9c434ab020d7bec9501f1824d248c))
* **loader:** flag JIT, attached debuggers, TrollFools and AppSync ([#1812](https://github.com/marioparaschiv/unbound/issues/1812)) ([3eb94f1](https://github.com/marioparaschiv/unbound/commit/3eb94f19fe4dbbeeb373b7415452716d31cb207b))
* **loader:** keep crash attribution in front of later handlers ([#1780](https://github.com/marioparaschiv/unbound/issues/1780)) ([576db95](https://github.com/marioparaschiv/unbound/commit/576db954ed7c0c0460b640dc3a116e39d2661400))
* **loader:** let Java hooks fire from inlined callers ([#1784](https://github.com/marioparaschiv/unbound/issues/1784)) ([ba642f0](https://github.com/marioparaschiv/unbound/commit/ba642f0ead47deef5914904364d1a40f86ec04fe))
* **loader:** name AltStore, SideStore and stolen certificates ([#1769](https://github.com/marioparaschiv/unbound/issues/1769)) ([8efa291](https://github.com/marioparaschiv/unbound/commit/8efa291c609ee8117804a1180666b4cd26689a6f))
* **loader:** name NPatch, PC hosts and background limits ([#1773](https://github.com/marioparaschiv/unbound/issues/1773)) ([16f89bd](https://github.com/marioparaschiv/unbound/commit/16f89bd3b1d25175213117a4c13fdc29fa3093fb))
* **loader:** name the plugin whose hook a Java crash went through ([#1782](https://github.com/marioparaschiv/unbound/issues/1782)) ([95aaccb](https://github.com/marioparaschiv/unbound/commit/95aaccbad55ab829ddbd6436241c27482bdb0451))
* **loader:** name virtual app hosts, more emulators and ROMs ([#1811](https://github.com/marioparaschiv/unbound/issues/1811)) ([4504b1d](https://github.com/marioparaschiv/unbound/commit/4504b1d5278c5595310df519f23843b62ad69ac7))
* **loader:** record the plugin's native call a crash happened in ([#1814](https://github.com/marioparaschiv/unbound/issues/1814)) ([2da91d2](https://github.com/marioparaschiv/unbound/commit/2da91d290fda2a058ed18fea357c9ee4efaa816c))
* **loader:** report methods two plugins rewrite ([#1778](https://github.com/marioparaschiv/unbound/issues/1778)) ([e480eb7](https://github.com/marioparaschiv/unbound/commit/e480eb75fe76f550641c69a485d9596205f4b542))


### Bug Fixes

* **loader:** bind hooks.deoptimize to the Java hooks capability ([#1785](https://github.com/marioparaschiv/unbound/issues/1785)) ([51837b1](https://github.com/marioparaschiv/unbound/commit/51837b1bf36a0f1d9256ae1a1b2b4ad3bac96032))
* **loader:** stop the compat scan flagging names that aren't classes ([#1786](https://github.com/marioparaschiv/unbound/issues/1786)) ([ec4b09d](https://github.com/marioparaschiv/unbound/commit/ec4b09d7bff94952657dbafe870c702c34cff3a2))

## [1.9.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.8.1...loader-v1.9.0) (2026-11-17)


### Features

* file crash reports as GitHub issues and catch exceptions ([#1715](https://github.com/marioparaschiv/unbound/issues/1715)) ([0852994](https://github.com/marioparaschiv/unbound/commit/08529945ebc4c5dec222b7fa80dc7c8e7adf086a))
* **loader:** name the app behind Android installs ([#1743](https://github.com/marioparaschiv/unbound/issues/1743)) ([ccade1e](https://github.com/marioparaschiv/unbound/commit/ccade1ee832d222cc502f1bfa9482dc224808d57))
* **loader:** record registers and every thread in iOS crashes ([#1736](https://github.com/marioparaschiv/unbound/issues/1736)) ([dc98580](https://github.com/marioparaschiv/unbound/commit/dc985802e1a85242967de154a0b7d97496f53ca2))


### Bug Fixes

* **loader:** accept block arguments in iOS hooks and calls ([#1733](https://github.com/marioparaschiv/unbound/issues/1733)) ([8dac3c3](https://github.com/marioparaschiv/unbound/commit/8dac3c38e9479ffb805af27f3c386010bb9ab2e2))
* **loader:** only wrap Objective-C objects a handle can own ([#1711](https://github.com/marioparaschiv/unbound/issues/1711)) ([26d3f68](https://github.com/marioparaschiv/unbound/commit/26d3f68dc8490d88c8192e44665f6adcbc3b3dae))
* **loader:** run view calls on main; quiet stopped plugin worklets ([#1713](https://github.com/marioparaschiv/unbound/issues/1713)) ([23fd749](https://github.com/marioparaschiv/unbound/commit/23fd7493622a24e3e9cbdb16047b604ca8da6684))
* **loader:** scope plain module paths and the ObjC factory to iOS ([#1716](https://github.com/marioparaschiv/unbound/issues/1716)) ([bf8d9ca](https://github.com/marioparaschiv/unbound/commit/bf8d9cabbd6975d8f05f0bd511b441a8414491d8))
* **loader:** search Java classes off the main thread ([#1732](https://github.com/marioparaschiv/unbound/issues/1732)) ([89f65e5](https://github.com/marioparaschiv/unbound/commit/89f65e59abf7e511150cf8b828512ce83b7f08d1))
* **web:** link GitHub to the unbound monorepo ([#1765](https://github.com/marioparaschiv/unbound/issues/1765)) ([b914ef2](https://github.com/marioparaschiv/unbound/commit/b914ef207773766700d32d889eef3b72040a8c67))

## [1.8.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.8.0...loader-v1.8.1) (2026-11-17)


### Bug Fixes

* **loader:** release Objective-C handles on the main thread ([#1707](https://github.com/marioparaschiv/unbound/issues/1707)) ([1892a6d](https://github.com/marioparaschiv/unbound/commit/1892a6de225cc9254d9aab5e5175a00fea77bc1e))

## [1.8.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.7.1...loader-v1.8.0) (2026-11-16)


### Features

* block additional tracking on iOS and Android ([#1692](https://github.com/marioparaschiv/unbound/issues/1692)) ([b27ce30](https://github.com/marioparaschiv/unbound/commit/b27ce30aefc2e065f32b526c53b13a42311adbe5))
* **loader:** add prebuilt hook trampolines for common UIKit signatures ([#1576](https://github.com/marioparaschiv/unbound/issues/1576)) ([0a2b0dd](https://github.com/marioparaschiv/unbound/commit/0a2b0ddbc3403af131b7b9d5b061c64856ab3089))
* **loader:** cache Android theme resource ids per Discord build ([#1577](https://github.com/marioparaschiv/unbound/issues/1577)) ([99b82ff](https://github.com/marioparaschiv/unbound/commit/99b82ffb06440724ef7847b1579bc6eca95a4ee4))
* **loader:** give every new iOS thread a spare signal stack ([#1660](https://github.com/marioparaschiv/unbound/issues/1660)) ([ec30440](https://github.com/marioparaschiv/unbound/commit/ec3044034af08d9d74a688102e895b7eed81aebb))
* **loader:** keep iOS crash stacks MetricKit reports on the next launch ([#1590](https://github.com/marioparaschiv/unbound/issues/1590)) ([11cf018](https://github.com/marioparaschiv/unbound/commit/11cf0188b73dc3bf7283ca0fccdd2d997f297de7))
* **loader:** let plugins show Live Activities on iOS ([#1602](https://github.com/marioparaschiv/unbound/issues/1602)) ([931052e](https://github.com/marioparaschiv/unbound/commit/931052e16f0daffd9419a376a145fd63c335b105))
* **loader:** mirror JS log lines to logcat and os_log ([#1680](https://github.com/marioparaschiv/unbound/issues/1680)) ([e933896](https://github.com/marioparaschiv/unbound/commit/e933896337f231c00da7af98fb30a623971b1027))
* **loader:** name the plugin that blocked the main thread in ANRs ([#1621](https://github.com/marioparaschiv/unbound/issues/1621)) ([c27d262](https://github.com/marioparaschiv/unbound/commit/c27d2620f348fcde1139f873c4c4354ff052c271))
* **loader:** pass bytes across the native bridge ([#1674](https://github.com/marioparaschiv/unbound/issues/1674)) ([4b12f44](https://github.com/marioparaschiv/unbound/commit/4b12f4421bd000b7bf1945a14792394f196ba8b1))
* **loader:** probe libffi closures at launch and show it on /debug ([#1574](https://github.com/marioparaschiv/unbound/issues/1574)) ([e0aa7e1](https://github.com/marioparaschiv/unbound/commit/e0aa7e19762bcbb1a9801a25817fe08d05bc40e8))
* **loader:** report Android main thread stalls with the blocking plugin ([#1588](https://github.com/marioparaschiv/unbound/issues/1588)) ([bf86ab9](https://github.com/marioparaschiv/unbound/commit/bf86ab9d678b32699f05abc00c8fc573c1089f5f))
* **loader:** scalar ObjC args, Java results, variadic FFI, overloads ([#1620](https://github.com/marioparaschiv/unbound/issues/1620)) ([dd49b45](https://github.com/marioparaschiv/unbound/commit/dd49b4570e799d8f895b43aea8359143d11ac56e))
* **loader:** translate native screens from the client's locale files ([#1624](https://github.com/marioparaschiv/unbound/issues/1624)) ([ab1269d](https://github.com/marioparaschiv/unbound/commit/ab1269d27da584ea6128990246ab47c5ef502cdd))


### Bug Fixes

* **loader:** count the loader's own Swift classes in the compat scan ([#1606](https://github.com/marioparaschiv/unbound/issues/1606)) ([652b729](https://github.com/marioparaschiv/unbound/commit/652b7299b3162e2dfbced15c91bf3f8306e60523))
* **loader:** drop the Developer Mode marker from /debug ([#1595](https://github.com/marioparaschiv/unbound/issues/1595)) ([3ec1570](https://github.com/marioparaschiv/unbound/commit/3ec1570902deb246c5c64cb3578efd47804eb896))
* **loader:** keep deallocating objects away from iOS plugin hooks ([#1659](https://github.com/marioparaschiv/unbound/issues/1659)) ([2006d84](https://github.com/marioparaschiv/unbound/commit/2006d843538026f4ac2c7aea2fce5b3e2a062d48))
* **loader:** keep each crash's stack in the crash history ([#1636](https://github.com/marioparaschiv/unbound/issues/1636)) ([80a2f37](https://github.com/marioparaschiv/unbound/commit/80a2f37f1951959bc4f5571e3fc1953482fe1a99))
* **loader:** keep native-crash.txt and write it on stack overflows ([#1638](https://github.com/marioparaschiv/unbound/issues/1638)) ([5721f85](https://github.com/marioparaschiv/unbound/commit/5721f85af9bbce1e7b434af9482ba770243da2d2))
* **loader:** post off-main UI hook callbacks safely ([#1679](https://github.com/marioparaschiv/unbound/issues/1679)) ([903d246](https://github.com/marioparaschiv/unbound/commit/903d246bc78fc86969f4859850c1d9e2b95b14cb))
* **loader:** read MetricKit report times as local time ([#1640](https://github.com/marioparaschiv/unbound/issues/1640)) ([e8f56df](https://github.com/marioparaschiv/unbound/commit/e8f56df7ef00645113278afbe974bb9929e3f36a))
* **loader:** return init's object from objc.create ([#1675](https://github.com/marioparaschiv/unbound/issues/1675)) ([4042a5b](https://github.com/marioparaschiv/unbound/commit/4042a5b18f7bae9b866a45300c503ca79ae76d26))
* **loader:** run loader:validate's Gradle steps on a pinned JDK on macOS ([#1644](https://github.com/marioparaschiv/unbound/issues/1644)) ([a6ece90](https://github.com/marioparaschiv/unbound/commit/a6ece90c541571825a4eba4fc6fdea6ec53680f4))
* **loader:** show only unusual Android device markers on /debug ([#1591](https://github.com/marioparaschiv/unbound/issues/1591)) ([fe47105](https://github.com/marioparaschiv/unbound/commit/fe47105ffdad27c91b214ff6729848ec773bad51))
* **loader:** stop the compat scan flagging runtime classes and strings ([#1580](https://github.com/marioparaschiv/unbound/issues/1580)) ([80dea85](https://github.com/marioparaschiv/unbound/commit/80dea85e5f3c38f4dc6fd622025e67d404f2b439))

## [1.7.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.7.0...loader-v1.7.1) (2026-11-15)


### Bug Fixes

* **loader:** keep unsaved settings when iOS reloads settings.json ([02816ee](https://github.com/marioparaschiv/unbound/commit/02816ee30537f4a0d0a998461d68703c552b7b79))

## [1.7.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.6.1...loader-v1.7.0) (2026-11-15)


### Features

* **loader:** declare speech recognition in sideloaded builds ([#1544](https://github.com/marioparaschiv/unbound/issues/1544)) ([06bd7ef](https://github.com/marioparaschiv/unbound/commit/06bd7efaf4acba239d02f3685f45a438dbbe4d8b))
* **loader:** hook Objective-C class methods ([#1543](https://github.com/marioparaschiv/unbound/issues/1543)) ([7daa824](https://github.com/marioparaschiv/unbound/commit/7daa824b09e3000d4eb7064912b61f1d5900decd))


### Bug Fixes

* **loader:** drop the on-device claim from the speech prompt ([#1546](https://github.com/marioparaschiv/unbound/issues/1546)) ([d8f6743](https://github.com/marioparaschiv/unbound/commit/d8f674359e17cb6614a9cf792815c29c28967d24))
* **loader:** name what to install when the loader is too old ([#1552](https://github.com/marioparaschiv/unbound/issues/1552)) ([b6bf35e](https://github.com/marioparaschiv/unbound/commit/b6bf35e87d8c247171451ff83713cafc887588a7))
* **loader:** skip antislop locally when it is not installed ([#1528](https://github.com/marioparaschiv/unbound/issues/1528)) ([c9a853a](https://github.com/marioparaschiv/unbound/commit/c9a853ad4b4f0ed125780952e4100486e8bd532b))
* **privacy-screen:** unblock screenshots when stopped while paused ([#1525](https://github.com/marioparaschiv/unbound/issues/1525)) ([c212e7d](https://github.com/marioparaschiv/unbound/commit/c212e7ddf794b36a1846fb6c017be08a78209a29))

## [1.6.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.6.0...loader-v1.6.1) (2026-11-15)


### Bug Fixes

* **loader:** keep the running bundle, overlap first download ([#1513](https://github.com/marioparaschiv/unbound/issues/1513)) ([2457330](https://github.com/marioparaschiv/unbound/commit/2457330abb67f4e0ab1739d6ceb57fcc1f1707d4))

## [1.6.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.5.0...loader-v1.6.0) (2026-11-14)


### Features

* **loader:** name the loader in the sideloaded IPA's version ([#1492](https://github.com/marioparaschiv/unbound/issues/1492)) ([f36ae6e](https://github.com/marioparaschiv/unbound/commit/f36ae6e8bde132aec63c37b8cd81fcd9098e7392))
* **loader:** name the plugins that froze Discord in the debug card ([#1480](https://github.com/marioparaschiv/unbound/issues/1480)) ([05d135e](https://github.com/marioparaschiv/unbound/commit/05d135eb6e7e05e1cf0e15fbe49319033073b3a1))
* **loader:** report Discord's data and cache size in the debug card ([#1482](https://github.com/marioparaschiv/unbound/issues/1482)) ([b1d5f62](https://github.com/marioparaschiv/unbound/commit/b1d5f62c46840b764709b81ea07a46d7f71ebc28))
* **loader:** report Focus and Scheduled Summary in the debug card ([#1486](https://github.com/marioparaschiv/unbound/issues/1486)) ([c2160a8](https://github.com/marioparaschiv/unbound/commit/c2160a8794a03c075b511ae73420ad72f4282d2d))


### Bug Fixes

* **loader:** name in-app Android splits by content ([#1500](https://github.com/marioparaschiv/unbound/issues/1500)) ([94e3c39](https://github.com/marioparaschiv/unbound/commit/94e3c39f826880238f52126f05c39fcb52ac3086))

## [1.5.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.4.0...loader-v1.5.0) (2026-11-14)


### Features

* **client:** name extensions without the app group in /debug ([#1414](https://github.com/marioparaschiv/unbound/issues/1414)) ([250a704](https://github.com/marioparaschiv/unbound/commit/250a7042326d496f5452d3dfa733fe376fba7697))
* **client:** report power, clock, DNS and notifications in /debug ([#1393](https://github.com/marioparaschiv/unbound/issues/1393)) ([1a9227f](https://github.com/marioparaschiv/unbound/commit/1a9227fa96802e73efd2293ec850db477f2355a4))
* **client:** send native crashes with opt-in crash reports ([#1403](https://github.com/marioparaschiv/unbound/issues/1403)) ([c3b7f91](https://github.com/marioparaschiv/unbound/commit/c3b7f916ce070ffa1d64e0860ab5dae2f5660396))
* **client:** share text and links to Discord ([#1353](https://github.com/marioparaschiv/unbound/issues/1353)) ([1e23d41](https://github.com/marioparaschiv/unbound/commit/1e23d41f3de3f162037a9e990c0fd3bea9ae32d6))
* **client:** update the client from the updates page ([#1434](https://github.com/marioparaschiv/unbound/issues/1434)) ([820958e](https://github.com/marioparaschiv/unbound/commit/820958e906360f243b46f0c627d18e652ec20fc5))
* **devtools:** find the bridge over Bonjour and add MCP to agents ([#1309](https://github.com/marioparaschiv/unbound/issues/1309)) ([03f4c20](https://github.com/marioparaschiv/unbound/commit/03f4c2016c7064fabb25c853ea766f0f1f9c962d))
* **devtools:** stream device logs into DevTools ([#1431](https://github.com/marioparaschiv/unbound/issues/1431)) ([4225450](https://github.com/marioparaschiv/unbound/commit/42254507717a6e18052f7d1b2d125cc6c4831f31))
* **loader:** add an animated Unbound app icon on iOS and Android ([#1193](https://github.com/marioparaschiv/unbound/issues/1193)) ([a0429a5](https://github.com/marioparaschiv/unbound/commit/a0429a50181fd4c282648e0e13ae9bcb1cffb773))
* **loader:** add FFI memory, C callbacks and import rebinding ([#1266](https://github.com/marioparaschiv/unbound/issues/1266)) ([5965be8](https://github.com/marioparaschiv/unbound/commit/5965be8306b61099675305e629e79d2fd160b203))
* **loader:** find classes by shape and hook subclasses or late classes ([#1267](https://github.com/marioparaschiv/unbound/issues/1267)) ([c0347ac](https://github.com/marioparaschiv/unbound/commit/c0347ace0a3a57e226b32f88ef3eb25fe3070f8b))
* **loader:** finish bundle downloads in the background ([#1270](https://github.com/marioparaschiv/unbound/issues/1270)) ([c003e0e](https://github.com/marioparaschiv/unbound/commit/c003e0e8d414c6e0fe41f0955496230d3c0c233a))
* **loader:** let plugins make Objective-C blocks and classes ([#1265](https://github.com/marioparaschiv/unbound/issues/1265)) ([f23f69b](https://github.com/marioparaschiv/unbound/commit/f23f69b7aa52db68878fd0d06a14b7400a3ba0a4))
* **loader:** open Safari extension settings from the disabled alert ([#1332](https://github.com/marioparaschiv/unbound/issues/1332)) ([0a19732](https://github.com/marioparaschiv/unbound/commit/0a19732609d5889085717c320439ffdacaf348be))
* **loader:** patch the bundle instead of downloading it whole ([#1401](https://github.com/marioparaschiv/unbound/issues/1401)) ([b041041](https://github.com/marioparaschiv/unbound/commit/b04104115928d635cdec4722b86b42227a7a553a))
* **loader:** report MetricKit hangs and system kills in /debug ([#1271](https://github.com/marioparaschiv/unbound/issues/1271)) ([8a8137a](https://github.com/marioparaschiv/unbound/commit/8a8137ab67e52076ef105555308a6b79bb342f23))
* **loader:** report signer, binary, re-sign, device and HTTPS facts ([#1274](https://github.com/marioparaschiv/unbound/issues/1274)) ([4bb2629](https://github.com/marioparaschiv/unbound/commit/4bb2629210d6cfb5fcd9defdbb89c52fc3178cf7))
* **loader:** show the module's status when opened from LSPosed ([#1438](https://github.com/marioparaschiv/unbound/issues/1438)) ([3e4e4dc](https://github.com/marioparaschiv/unbound/commit/3e4e4dce5effae889bd34d2fb8dfb8836abc3eba))
* **loader:** trust every listed bundle signing key ([#1399](https://github.com/marioparaschiv/unbound/issues/1399)) ([7dbb25a](https://github.com/marioparaschiv/unbound/commit/7dbb25aef9ec29f3dda2a3a70674e257e0fd0dc5))
* **loader:** use Discord's own share extension ([#1367](https://github.com/marioparaschiv/unbound/issues/1367)) ([7f33394](https://github.com/marioparaschiv/unbound/commit/7f33394f23d09da4a5d841e98fc7df0ed5c777ba))


### Bug Fixes

* **loader:** apply custom app icons on more Android launchers ([#1439](https://github.com/marioparaschiv/unbound/issues/1439)) ([61c8bca](https://github.com/marioparaschiv/unbound/commit/61c8bcad988907004f06847d21b67b41454ff8dc))
* **loader:** build the iOS tweak with the sampler off ([#1365](https://github.com/marioparaschiv/unbound/issues/1365)) ([7493d11](https://github.com/marioparaschiv/unbound/commit/7493d118a0cc16013ccdd87ba1b597a8ec3f2482))
* **loader:** decode binary plists without plutil ([#1437](https://github.com/marioparaschiv/unbound/issues/1437)) ([5080cce](https://github.com/marioparaschiv/unbound/commit/5080cce20a6f4b091e4611d394e9ea710225e96d))
* **loader:** hand shared files to Discord through the app group ([#1331](https://github.com/marioparaschiv/unbound/issues/1331)) ([d3d740d](https://github.com/marioparaschiv/unbound/commit/d3d740d752109056728af4bfe5d99e7c22dc6dcd))
* **loader:** keep outside settings edits made while changes are pending ([#1370](https://github.com/marioparaschiv/unbound/issues/1370)) ([73468c8](https://github.com/marioparaschiv/unbound/commit/73468c8d10c10249558c939215ff21bee7bf3405))
* **loader:** keep the Hermes sampler off on iOS ([#1357](https://github.com/marioparaschiv/unbound/issues/1357)) ([625684e](https://github.com/marioparaschiv/unbound/commit/625684eb689f54fdfe35ce3473b693f3057134ab))
* **loader:** leave background and locked launches out of the guard ([#1261](https://github.com/marioparaschiv/unbound/issues/1261)) ([566aa86](https://github.com/marioparaschiv/unbound/commit/566aa860622f98ef8b6a2a464d6ec32cc3edaae0))
* **loader:** list app permissions and builds in the AltStore source ([#1433](https://github.com/marioparaschiv/unbound/issues/1433)) ([4826fc6](https://github.com/marioparaschiv/unbound/commit/4826fc646eb3ed8cf64abf1c21e067c279c7df23))
* **loader:** name Android artifacts per channel ([#1421](https://github.com/marioparaschiv/unbound/issues/1421)) ([2837b5b](https://github.com/marioparaschiv/unbound/commit/2837b5bbb5dd669cb2965d493aae306e3efbcc7f))
* **loader:** read private iOS methods from the shared cache in compat ([#1436](https://github.com/marioparaschiv/unbound/issues/1436)) ([15083ad](https://github.com/marioparaschiv/unbound/commit/15083adf5a1625cb4cd77dd3c793ce38db365693))
* **loader:** rebuild every Android channel on a loader release ([#1410](https://github.com/marioparaschiv/unbound/issues/1410)) ([b1a7ca0](https://github.com/marioparaschiv/unbound/commit/b1a7ca02286682d8355758ce11995042c0429780))
* **loader:** save staged settings when Discord backgrounds ([#1356](https://github.com/marioparaschiv/unbound/issues/1356)) ([6727ded](https://github.com/marioparaschiv/unbound/commit/6727ded4e235c89655afac58d4357ff746a7d9a4))
* **loader:** share the app group with extensions when sideloaded ([#1366](https://github.com/marioparaschiv/unbound/issues/1366)) ([911134e](https://github.com/marioparaschiv/unbound/commit/911134e74dace20f10013b9a2648f062a8b3c2e5))
* **loader:** sign the share extension with codesign ([#1354](https://github.com/marioparaschiv/unbound/issues/1354)) ([664fe0e](https://github.com/marioparaschiv/unbound/commit/664fe0e5a96a6f5c2b005c4cb223d4c3d708b8ba))
* **loader:** treat UIKit's private CoreSVG image selector as external ([#1426](https://github.com/marioparaschiv/unbound/issues/1426)) ([d631d89](https://github.com/marioparaschiv/unbound/commit/d631d892232a250682ec685f9ccb45d079259f3c))
* **loader:** unblock the 1.5.0 release ([#1445](https://github.com/marioparaschiv/unbound/issues/1445)) ([3a64dda](https://github.com/marioparaschiv/unbound/commit/3a64ddaac0f30e0041b6b53bdcd30aa2c3065442))
* **web:** wrap /debug rows and tighten the environment rows ([#1275](https://github.com/marioparaschiv/unbound/issues/1275)) ([5dbf2db](https://github.com/marioparaschiv/unbound/commit/5dbf2db8edb1b6766a165fa4c5521340a6d6e868))

## [1.4.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.3.0...loader-v1.4.0) (2026-11-13)


### Features

* **client:** add errors, log, storage and patches to /debug ([#1163](https://github.com/marioparaschiv/unbound/issues/1163)) ([1cc9625](https://github.com/marioparaschiv/unbound/commit/1cc9625ccecde514a8923d57e66e2e17fd19a339))
* **client:** add network context to /debug ([#1204](https://github.com/marioparaschiv/unbound/issues/1204)) ([6fc2287](https://github.com/marioparaschiv/unbound/commit/6fc22878df442f8c0e7b0e8712cad1da3c6b1280))
* **client:** list other tweaks loaded into Discord in /debug ([#1250](https://github.com/marioparaschiv/unbound/issues/1250)) ([dd8c109](https://github.com/marioparaschiv/unbound/commit/dd8c1091d6d94c7776b1d2b2477df47694f91493))
* **devtools:** add an object explorer and structured ubd errors ([#1206](https://github.com/marioparaschiv/unbound/issues/1206)) ([cf37e2b](https://github.com/marioparaschiv/unbound/commit/cf37e2beccf364eb3d4a22842d5c1538c8a5c683))
* **loader:** check for a bundle each time Discord backgrounds ([#1201](https://github.com/marioparaschiv/unbound/issues/1201)) ([67bb22d](https://github.com/marioparaschiv/unbound/commit/67bb22d7c8ae04a2bbf288cbb7f78e63e71a7644))
* **loader:** heal a damaged saved bundle at launch ([#1200](https://github.com/marioparaschiv/unbound/issues/1200)) ([a9056c0](https://github.com/marioparaschiv/unbound/commit/a9056c0e5444d739a73be9b24dc8e9f90c67ddc2))
* **loader:** leave auto Recovery Mode after a fix, check space ([#1173](https://github.com/marioparaschiv/unbound/issues/1173)) ([f5d43df](https://github.com/marioparaschiv/unbound/commit/f5d43df25c00ab89805a9e15dc704fe4e8b732b4))
* **loader:** name the Android root manager and bridge failures ([#1150](https://github.com/marioparaschiv/unbound/issues/1150)) ([aa68889](https://github.com/marioparaschiv/unbound/commit/aa68889f9085501378b1d5e4b09728fe6ef12edc))
* **loader:** name the crashing addon in Android tombstones ([#1165](https://github.com/marioparaschiv/unbound/issues/1165)) ([55a6c98](https://github.com/marioparaschiv/unbound/commit/55a6c983a520c81579b350652d33267a7e8880bd))
* **loader:** offer the previous client bundle in the Toolbox ([#1249](https://github.com/marioparaschiv/unbound/issues/1249)) ([7699805](https://github.com/marioparaschiv/unbound/commit/76998054425a6cc1a6b4524bf36491a3c1ad0fe7))
* **loader:** offer the Toolbox when Discord never renders ([#1202](https://github.com/marioparaschiv/unbound/issues/1202)) ([1918924](https://github.com/marioparaschiv/unbound/commit/19189247b40c3e36f752e6e48066d3e770d3f16d))
* **loader:** record Android ANRs with the main thread's stack ([#1203](https://github.com/marioparaschiv/unbound/issues/1203)) ([33917dd](https://github.com/marioparaschiv/unbound/commit/33917dd413427f8398859b4a2319572c8c6a16f9))
* **loader:** report bundle state, launches and native crashes ([#1148](https://github.com/marioparaschiv/unbound/issues/1148)) ([f0a0e86](https://github.com/marioparaschiv/unbound/commit/f0a0e8625bfce64c1bbb6133ff154bb5eabee047))
* **loader:** report update checks, bundle source and settings ([#1162](https://github.com/marioparaschiv/unbound/issues/1162)) ([fdbe58d](https://github.com/marioparaschiv/unbound/commit/fdbe58da281df988197c52f0f560bc428d8478fd))
* **loader:** resume interrupted bundle downloads ([#1166](https://github.com/marioparaschiv/unbound/issues/1166)) ([85af3ea](https://github.com/marioparaschiv/unbound/commit/85af3ea154cc275d187ab0731f1c599df760ec99))
* **loader:** skip failed builds, report crashes and pressure ([#1158](https://github.com/marioparaschiv/unbound/issues/1158)) ([dd7f6dd](https://github.com/marioparaschiv/unbound/commit/dd7f6ddc44ede8e26c5cbeeb8d07faac8c4c7d3f))
* **loader:** stamp crash stacks with the image's build ID ([#1179](https://github.com/marioparaschiv/unbound/issues/1179)) ([fbcd97b](https://github.com/marioparaschiv/unbound/commit/fbcd97b80e66d1fed2e4dec1cf4af54595804885))
* **loader:** tell how the previous iOS launch ended ([#1149](https://github.com/marioparaschiv/unbound/issues/1149)) ([c8d17e8](https://github.com/marioparaschiv/unbound/commit/c8d17e823875b04b9c8973d67d85b81ef5979b44))


### Bug Fixes

* **loader:** find Magisk where Discord can see it ([#1153](https://github.com/marioparaschiv/unbound/issues/1153)) ([122c4ea](https://github.com/marioparaschiv/unbound/commit/122c4eaa14dde1d701aef928c8251f5ecd4ff79f))
* **loader:** load the Android library on 16 KB page devices ([#1246](https://github.com/marioparaschiv/unbound/issues/1246)) ([4fcab52](https://github.com/marioparaschiv/unbound/commit/4fcab521d4dd4f4e38be62bfd13a750ace67f197))
* **loader:** read hidden Android and private iOS APIs in the compat scan ([#1238](https://github.com/marioparaschiv/unbound/issues/1238)) ([99d0e4c](https://github.com/marioparaschiv/unbound/commit/99d0e4cf543ad1197cd04eedd8e2d57a998dc936))
* **loader:** skip Kotlin formatting locally when Java won't start ([#1247](https://github.com/marioparaschiv/unbound/issues/1247)) ([b8131ff](https://github.com/marioparaschiv/unbound/commit/b8131ffbb9c7958ecdcff16b34cbe6eff15d11b6))
* **loader:** treat UIKit's private effectWithBlurRadius: as external ([#1155](https://github.com/marioparaschiv/unbound/issues/1155)) ([90805d8](https://github.com/marioparaschiv/unbound/commit/90805d8991be3b8774934478a85e7fe18b4441d5))
* **loader:** write the profile expiry as exp ([#1224](https://github.com/marioparaschiv/unbound/issues/1224)) ([f659a0f](https://github.com/marioparaschiv/unbound/commit/f659a0f6e5fb1da4f7b45c1adaa7b9a8011ba163))

## [1.3.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.2.0...loader-v1.3.0) (2026-11-12)


### Features

* **client:** add support, issues and context to /debug ([#1147](https://github.com/marioparaschiv/unbound/issues/1147)) ([05b2839](https://github.com/marioparaschiv/unbound/commit/05b2839cb43f575aaad7bd2b96cbe9580c374815))
* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **loader:** let UI scopes implement Java interfaces ([f8ca349](https://github.com/marioparaschiv/unbound/commit/f8ca3499ea8627dfc5f57560928676278b65dea9))


### Bug Fixes

* **loader:** return from off-main Android hook dispatch ([#1139](https://github.com/marioparaschiv/unbound/issues/1139)) ([050f74f](https://github.com/marioparaschiv/unbound/commit/050f74f10ac66a468e1657226bd592d8f3f7b3ab))
* tidy the install and state debug lines ([#1143](https://github.com/marioparaschiv/unbound/issues/1143)) ([f1a2a2f](https://github.com/marioparaschiv/unbound/commit/f1a2a2f3999db8da506373b0248eef644b11bcef))

## [1.2.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.1...loader-v1.2.0) (2026-11-12)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).
* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))
* **loader:** catch frozen starts and show how installs were signed ([#1113](https://github.com/marioparaschiv/unbound/issues/1113)) ([562aa90](https://github.com/marioparaschiv/unbound/commit/562aa9051c36e82d4e3577697d73a64e3397d4db))
* **loader:** health-gated updates and crash recovery ([#1063](https://github.com/marioparaschiv/unbound/issues/1063)) ([0cd3772](https://github.com/marioparaschiv/unbound/commit/0cd37726daa68a2a8c4a2cae49c01e881649ce2e))
* **loader:** judge launches by render and exit, retry updates ([#1086](https://github.com/marioparaschiv/unbound/issues/1086)) ([cd39991](https://github.com/marioparaschiv/unbound/commit/cd399911d22a11fe8fbf4db09d6ad3184302eb3b))
* **loader:** let UI-scope Java hooks rewrite their arguments ([#1130](https://github.com/marioparaschiv/unbound/issues/1130)) ([20893e2](https://github.com/marioparaschiv/unbound/commit/20893e2e907eec6a81f2279ac714eb01aab100e9))
* **loader:** show the iOS toolbox as a sheet with a microbold wrench ([#1131](https://github.com/marioparaschiv/unbound/issues/1131)) ([8aa3174](https://github.com/marioparaschiv/unbound/commit/8aa3174e233d3008f26065bd18fbce4c854d7514))


### Bug Fixes

* **client:** download the IPA for sideloaded loader updates ([#1048](https://github.com/marioparaschiv/unbound/issues/1048)) ([880fa81](https://github.com/marioparaschiv/unbound/commit/880fa812b96d85b4ec6f1f436b6d47e0ccb5f552))
* **loader:** keep addon start markers across iOS static init ([#1110](https://github.com/marioparaschiv/unbound/issues/1110)) ([a238e8a](https://github.com/marioparaschiv/unbound/commit/a238e8aa6eef4e026efabc019cf47f9f78a7cbc8))
* **loader:** keep bootstrap scripts across iOS static init ([#1107](https://github.com/marioparaschiv/unbound/issues/1107)) ([c23d042](https://github.com/marioparaschiv/unbound/commit/c23d0424ec9e0bdf3be909c90c5579cdb0502541))
* **loader:** keep the release changelog under the API limit ([#1115](https://github.com/marioparaschiv/unbound/issues/1115)) ([638b698](https://github.com/marioparaschiv/unbound/commit/638b698a71d864b252b37b36f78bf8c4f2e8e0d1))
* **loader:** let the compat gate pass LiveContainer LCAppInfo ([#1129](https://github.com/marioparaschiv/unbound/issues/1129)) ([46e85a0](https://github.com/marioparaschiv/unbound/commit/46e85a061ce4ef2785531b956bd39c3ffadd3122))
* **loader:** read entitlements from the kernel inside LiveContainer ([#1112](https://github.com/marioparaschiv/unbound/issues/1112)) ([50d53d0](https://github.com/marioparaschiv/unbound/commit/50d53d0ee823876b9faea50ca28e34fe347d1dbf))
* **loader:** republish the sideloaded IPA on loader updates ([#1050](https://github.com/marioparaschiv/unbound/issues/1050)) ([5664844](https://github.com/marioparaschiv/unbound/commit/5664844740e43449ce55dc1caa4dc05e2bec9d2f))
* **loader:** warn when the loader lacks native bridge API 1.3.0 ([#1136](https://github.com/marioparaschiv/unbound/issues/1136)) ([7e15ee3](https://github.com/marioparaschiv/unbound/commit/7e15ee37dcb9c48e7d07d765e11d63c60bccd855))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))
* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.0...loader-v1.1.1) (2026-11-10)


### Bug Fixes

* **loader:** cross-check iTunes with dkrypt in the stable poll ([#1045](https://github.com/marioparaschiv/unbound/issues/1045)) ([dc77dc9](https://github.com/marioparaschiv/unbound/commit/dc77dc9ecb9f5fcd09cd4316b4dfcb98e65f73ea))
* **loader:** let the compat gate pass the private UIPlaceholderColor ([#1043](https://github.com/marioparaschiv/unbound/issues/1043)) ([7663da1](https://github.com/marioparaschiv/unbound/commit/7663da12f80f842517f4df8eba5df2b028fbc0cf))
* **loader:** point release-please at the loader's version.json ([#1039](https://github.com/marioparaschiv/unbound/issues/1039)) ([e401981](https://github.com/marioparaschiv/unbound/commit/e401981b28802d446f1d43a8525e2cb7e557b1a1))
* **loader:** stop patching the App Store Discord bundle on jailbreak ([#1047](https://github.com/marioparaschiv/unbound/issues/1047)) ([f24c091](https://github.com/marioparaschiv/unbound/commit/f24c0919c5f8950eada54df6d2814a7ddf385c09))

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.0.971...loader-v1.1.0) (2026-11-10)


### Features

* **app-icons:** custom app icons on every platform ([#987](https://github.com/marioparaschiv/unbound/issues/987)) ([9dbbcf8](https://github.com/marioparaschiv/unbound/commit/9dbbcf8bba4b7abcef6a27d99bb004d3c2a837ef))
* **client:** redesign the updater screen ([#1022](https://github.com/marioparaschiv/unbound/issues/1022)) ([f0677df](https://github.com/marioparaschiv/unbound/commit/f0677df1860f88f609d6beca7016cd9db0ae9b36))
* **loader:** draw the new Unbound icon in the Dynamic Island and notch ([#978](https://github.com/marioparaschiv/unbound/issues/978)) ([e23123d](https://github.com/marioparaschiv/unbound/commit/e23123d064070aada10aa20516127db23f140050))
* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Bug Fixes

* **ci:** finish npm publish, skip unnamed TestFlight releases ([#1026](https://github.com/marioparaschiv/unbound/issues/1026)) ([db758dc](https://github.com/marioparaschiv/unbound/commit/db758dcbbeb3429a1bf84484fe843d62e5956087))
* **ci:** unblock loader publishes after the billing pause ([#1018](https://github.com/marioparaschiv/unbound/issues/1018)) ([a8b0ad4](https://github.com/marioparaschiv/unbound/commit/a8b0ad4970bec504eb9ee63d5e2b6b975dd37762))
* **client:** run UI worklets on Reanimated 4's worklets runtime ([#1028](https://github.com/marioparaschiv/unbound/issues/1028)) ([269995c](https://github.com/marioparaschiv/unbound/commit/269995c755d6b186af09fa5807cecb29b9411a4b))
* **loader:** use semantic release versions ([#990](https://github.com/marioparaschiv/unbound/issues/990)) ([f4b0acd](https://github.com/marioparaschiv/unbound/commit/f4b0acd6cf9c577e767fc10a6561cf2b67f10a72))


### Performance Improvements

* **ci:** cut pull request CI wall time ([#1021](https://github.com/marioparaschiv/unbound/issues/1021)) ([0e5e0a7](https://github.com/marioparaschiv/unbound/commit/0e5e0a7ec4f6c107e78f6afca3409eca3b953be0))
* **loader:** lazy settings cache, metro cache file, plugin bytecode installs ([#1032](https://github.com/marioparaschiv/unbound/issues/1032)) ([87179aa](https://github.com/marioparaschiv/unbound/commit/87179aad6016c4e019546bb9ae0ba9d19147f614))
