# Changelog

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/web-v0.10.0...web-v0.11.0) (2026-10-29)


### Features

* **client:** attach scrubbed log lines to crash reports ([0f0868f](https://github.com/marioparaschiv/unbound/commit/0f0868f0657432a977a23454ba8e6225c8ccf955))
* **client:** attach scrubbed log lines to crash reports ([0733cbf](https://github.com/marioparaschiv/unbound/commit/0733cbfcd59321d8faf417367c973ecef1ff0ae2))
* **client:** send opt-in crash reports to the API ([311f957](https://github.com/marioparaschiv/unbound/commit/311f957b1172343e1474813ddc73cacbd6f6de50))
* **client:** send opt-in crash reports to the API ([9f10514](https://github.com/marioparaschiv/unbound/commit/9f10514fe9248fef7ed735b344537e02ed1f0afe))
* **discord-bot:** react to unbound.rip through Postgres triggers, delete the bot feed ([5309aa4](https://github.com/marioparaschiv/unbound/commit/5309aa431de558b29a89387c610dfe51894bf421))
* **discord-bot:** read the web's tables, woken by triggers on them ([7966354](https://github.com/marioparaschiv/unbound/commit/7966354cce30d3a58866cb8346186921a3a2e6ab))
* **discord-bot:** turn on the audit log, compact embeds, export to OpenTelemetry ([#250](https://github.com/marioparaschiv/unbound/issues/250)) ([ba42953](https://github.com/marioparaschiv/unbound/commit/ba42953697e2baef38a973ae8aa644047e828c97))
* hand off addon installs from the website through unbound:// ([#332](https://github.com/marioparaschiv/unbound/issues/332)) ([2c1e4d3](https://github.com/marioparaschiv/unbound/commit/2c1e4d384cac3e061d05e5c61756b8dacd408733))
* **plugins:** republish rebuilt plugins with bytecode ([fbd653e](https://github.com/marioparaschiv/unbound/commit/fbd653e311392eb6b691bbbf4878b0c41da7ee2f))
* **plugins:** republish rebuilt plugins with bytecode ([2574b6b](https://github.com/marioparaschiv/unbound/commit/2574b6b5b028b413a6d249fa20ab257ff1729cd3))
* **web:** copy production data from SQLite into Postgres ([705f61a](https://github.com/marioparaschiv/unbound/commit/705f61a5a7a6fb6b23db110e191790e073bb11fb))
* **web:** drop the bot feed objects, its key and its locks ([b1e96e9](https://github.com/marioparaschiv/unbound/commit/b1e96e91f5ea1caa4764df8bfdb035fefd59ff2c))
* **web:** export the bot read model, delete the bot feed API ([20e4972](https://github.com/marioparaschiv/unbound/commit/20e49724b092c50db60b80f113100034dd9bd3ab))
* **web:** filter /plugins and /themes by tag, author and update date ([#414](https://github.com/marioparaschiv/unbound/issues/414)) ([f5b4703](https://github.com/marioparaschiv/unbound/commit/f5b4703c2da2843387a716b8f50cbd55e2e1d0a9))
* **web:** grant site admin to Development Team and Management ([#324](https://github.com/marioparaschiv/unbound/issues/324)) ([82b948c](https://github.com/marioparaschiv/unbound/commit/82b948c93f8ad92c307e76405d516a209442f80e))
* **web:** link every identified author to their developer page ([#303](https://github.com/marioparaschiv/unbound/issues/303)) ([4c7af2b](https://github.com/marioparaschiv/unbound/commit/4c7af2b36a32aa043976a0e80e6141edf0ae3e53))
* **web:** order staff by admin before moderator, then a manual position ([#329](https://github.com/marioparaschiv/unbound/issues/329)) ([3f870bf](https://github.com/marioparaschiv/unbound/commit/3f870bfbaf5c670a0c3cb0dbf16b40862a6b01a8))
* **web:** plump design system, Unbound red accent and Nucleo icons ([#335](https://github.com/marioparaschiv/unbound/issues/335)) ([92ed8f7](https://github.com/marioparaschiv/unbound/commit/92ed8f70f03897bc144f41165fda8dd83101d21e))
* **web:** read the newest moderation event id for the bot ([cf0b731](https://github.com/marioparaschiv/unbound/commit/cf0b7315cc54c64cdb9dfad88928a048b210ec99))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))
* **web:** show addon authors in a Discord-style avatar pile ([#299](https://github.com/marioparaschiv/unbound/issues/299)) ([5f1717b](https://github.com/marioparaschiv/unbound/commit/5f1717bd90488e2e2d05f85d742784024f1faff1))
* **web:** stagger detail page entrances and move team pages to /team and /profiles ([#435](https://github.com/marioparaschiv/unbound/issues/435)) ([768204c](https://github.com/marioparaschiv/unbound/commit/768204c23252b0a30026dc7d7cb6fd5418551171))
* **web:** sync the Addon Developer Discord role into the team ([#326](https://github.com/marioparaschiv/unbound/issues/326)) ([84abe6e](https://github.com/marioparaschiv/unbound/commit/84abe6edee5169c196928bedfc96b82dfa22cf86))
* **web:** sync the team by looking up known members, grant roles only ([#325](https://github.com/marioparaschiv/unbound/issues/325)) ([e124403](https://github.com/marioparaschiv/unbound/commit/e124403d2a9fc9cdfb4c55799261b53a6c4be2e6))
* **web:** Team page with Discord role sync and motion polish ([#322](https://github.com/marioparaschiv/unbound/issues/322)) ([9cb311c](https://github.com/marioparaschiv/unbound/commit/9cb311c1583a4314da8e02ef586e338c447fed9b))


### Bug Fixes

* **unbound-dev:** drop the catalog stub's database on SIGHUP, fully ([b1393cc](https://github.com/marioparaschiv/unbound/commit/b1393cc661040690097d3d2d45a2a074f2f1c900))
* **web:** break every ordering tie on the primary key ([6062129](https://github.com/marioparaschiv/unbound/commit/6062129442d9e29a3d96e5ac4c20484d4e8589cd))
* **web:** bring back the hero phones' slide-up entrance ([#338](https://github.com/marioparaschiv/unbound/issues/338)) ([35f7b83](https://github.com/marioparaschiv/unbound/commit/35f7b8341b9d37abb4b065400192c23f8310b3d2))
* **web:** cap cursor times at the end of year 9999 ([b5096e0](https://github.com/marioparaschiv/unbound/commit/b5096e04b32babe264bc1ff2d0ec8e514a61f803))
* **web:** copy double precision columns from SQLite ([d8515a4](https://github.com/marioparaschiv/unbound/commit/d8515a46c9495a49072c8ae1e3b7ec116cde06a9))
* **web:** copy double precision columns from SQLite ([6dd2385](https://github.com/marioparaschiv/unbound/commit/6dd2385dec4876ada534dedd855d4a6830ec5113))
* **web:** copy tables newer than the SQLite source as empty ([66bf94e](https://github.com/marioparaschiv/unbound/commit/66bf94e625a3b2db464e7b136fc75a91ee74362a))
* **web:** cover the mobile hero with dots, phones edge to edge ([#393](https://github.com/marioparaschiv/unbound/issues/393)) ([85523b1](https://github.com/marioparaschiv/unbound/commit/85523b1171fcb58ffd77fc7d2a1cf62e14e6cc04))
* **web:** decode cursor timestamps in the cursor schemas ([69b5816](https://github.com/marioparaschiv/unbound/commit/69b581637da9fbad3fcb3565b6eea86bd995271d))
* **web:** drop route view transitions so the header pill slides again ([#436](https://github.com/marioparaschiv/unbound/issues/436)) ([1d073ca](https://github.com/marioparaschiv/unbound/commit/1d073ca594c94e758f90b25def80c3dc54f1edee))
* **web:** drop the "by" from addon card bylines ([#313](https://github.com/marioparaschiv/unbound/issues/313)) ([f7d20a9](https://github.com/marioparaschiv/unbound/commit/f7d20a9aa47aaed40092fe0db515d1012a2812a5))
* **web:** ellipsize author names that overflow the byline ([#301](https://github.com/marioparaschiv/unbound/issues/301)) ([154e348](https://github.com/marioparaschiv/unbound/commit/154e34814537eaa76a52d48752e078e31eda77ee))
* **web:** generate the crash report log migration with drizzle-kit ([3b76757](https://github.com/marioparaschiv/unbound/commit/3b76757a87b4f2bba228e67048aee7a40d8dbd13))
* **web:** glide a hovered menu row into view instead of jumping ([#417](https://github.com/marioparaschiv/unbound/issues/417)) ([ad814dc](https://github.com/marioparaschiv/unbound/commit/ad814dc809941f9c704ea6074a4c1f69a7f74121))
* **web:** locate Postgres refusals and stop --replace cascading ([b42f27a](https://github.com/marioparaschiv/unbound/commit/b42f27ac6ab9fb7772294792fdeceb2a8f710f5e))
* **web:** lock account before a user delete draws an ordered id ([ef57b67](https://github.com/marioparaschiv/unbound/commit/ef57b67ba162dd413f83c169256a261beba8dd05))
* **web:** mark the developer search navigations as fire-and-forget ([ce4e499](https://github.com/marioparaschiv/unbound/commit/ce4e499c6d5710d2ba40f691f7508e70ef0d4fe7))
* **web:** pad the mobile hero phones and preload the image ([#394](https://github.com/marioparaschiv/unbound/issues/394)) ([2c386a9](https://github.com/marioparaschiv/unbound/commit/2c386a9773d599b9d1a04e8149b682f6f2cc6e59))
* **web:** refuse a foreign SQLite source and unreadable text ([28f320b](https://github.com/marioparaschiv/unbound/commit/28f320bd0b20e8feb970ce1aaad7a126e31da7b9))
* **web:** refuse NUL in copied text and json, naming the row by its key ([4f1c6f5](https://github.com/marioparaschiv/unbound/commit/4f1c6f52f846a08674099a79c30ce7589ce062b4))
* **web:** refuse NUL in text bound for Postgres ([d2156fa](https://github.com/marioparaschiv/unbound/commit/d2156fa0adf71a58f12d40327981deb3945f4844))
* **web:** refuse text Postgres cannot store in Better Auth requests ([e13033a](https://github.com/marioparaschiv/unbound/commit/e13033a98d9e49c9ba860a6338ff3990207acbf8))
* **web:** search transfer targets case-insensitively ([16fd17f](https://github.com/marioparaschiv/unbound/commit/16fd17f2efb600c4db0e3dc1cbf040b1421c24bf))
* **web:** skip empty relational filters for drizzle-orm rc.5 ([c7657ce](https://github.com/marioparaschiv/unbound/commit/c7657ce30454beeba43c76ca05b15356cf488301))
* **web:** skip the retired bot feed table when copying SQLite ([e254626](https://github.com/marioparaschiv/unbound/commit/e25462656c5996d0d40e052429c3db4b364dc72a))
* **web:** stamp a bot feed change after the ordering lock ([7184022](https://github.com/marioparaschiv/unbound/commit/718402224a8751c84335a36354f113eb1e6e4369))
* **web:** upgrade migration snapshots so drizzle-kit generates again ([efd9426](https://github.com/marioparaschiv/unbound/commit/efd9426ec306e40a7108853a1d55fb1346d53a5c))
* **web:** upgrade migration snapshots so drizzle-kit generates again ([a6b4bb5](https://github.com/marioparaschiv/unbound/commit/a6b4bb5de625fa042925a45a5f1ae9d88a0452cb))


### Code Refactoring

* **web:** default the bot reads' grace and read one addon by key ([a50f1d3](https://github.com/marioparaschiv/unbound/commit/a50f1d390731f457e455c0fd4d6b0975a811481c))
* **web:** load page data through TanStack Query ([#434](https://github.com/marioparaschiv/unbound/issues/434)) ([199ca67](https://github.com/marioparaschiv/unbound/commit/199ca673af2b6790ad116e21572199fe2f9c5d44))
* **web:** match admin search on the listed table itself ([7e49ac1](https://github.com/marioparaschiv/unbound/commit/7e49ac1caf116e0b94e16124185e0a1a3e647800))
* **web:** move hand-written SQL into custom migrations ([4d7f592](https://github.com/marioparaschiv/unbound/commit/4d7f592c52ce466d87389d6d9950761e67a05d84))
* **web:** move LIVE_VERSIONS and the grace default to leaf modules ([32deb0f](https://github.com/marioparaschiv/unbound/commit/32deb0f597729b874320a2f421a027099fbde8cb))
* **web:** move the SQLite copy out of src into scripts ([ded3674](https://github.com/marioparaschiv/unbound/commit/ded3674f0c4b0a7ce0958b987a14059a2a1ad5e4))
* **web:** refuse text Postgres cannot store once per boundary ([5915ffa](https://github.com/marioparaschiv/unbound/commit/5915ffae5be5b7d499c50c6baef72e8d71906dab))
* **web:** take only a sponsorship transaction in the upsert ([c834514](https://github.com/marioparaschiv/unbound/commit/c834514fcd46297c8d66d03642953d5f5211178d))
* **web:** tidy isRetryable, a test title and one source insert ([3a1c94c](https://github.com/marioparaschiv/unbound/commit/3a1c94c89605a5ea2817869382377cac93968521))


### Build System

* **deps:** bump drizzle-kit from 1.0.0-rc.4 to 1.0.0-rc.5 ([56aed55](https://github.com/marioparaschiv/unbound/commit/56aed556f95b84cb3fc3de4ce4f6311d0fc2f004))
* **deps:** bump drizzle-orm from 1.0.0-rc.4 to 1.0.0-rc.5 ([dbbc5d1](https://github.com/marioparaschiv/unbound/commit/dbbc5d166fe58fe7d106188769b484a2c503856d))
* **deps:** eslint-plugin-jsdoc 65 with the JSDoc it requires ([e4b303a](https://github.com/marioparaschiv/unbound/commit/e4b303a9d547a703e992955e1447c821922efb24))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))


### Documentation

* add the JSDoc eslint-plugin-jsdoc 65 requires ([d5632e8](https://github.com/marioparaschiv/unbound/commit/d5632e824e43cad5a88d15a5083b7cfc0097346c))


### Styles

* sort imports and fix the lint findings from the bot switch ([95d4dd1](https://github.com/marioparaschiv/unbound/commit/95d4dd1afde5aac343b7b04d3b0110b5f2a7b096))
* sort imports from the audit floor round ([07867f9](https://github.com/marioparaschiv/unbound/commit/07867f9a484f440fc299b32794d6b8fac5992a6f))
* sort imports from the fix round ([9c2c4ca](https://github.com/marioparaschiv/unbound/commit/9c2c4ca53c84bdbeef899cd66e312bb85c384110))
* **web:** keep readAddonSource's doc above it ([e281bf2](https://github.com/marioparaschiv/unbound/commit/e281bf2064df70fbd13eb38ab5008084573ad1e6))
* **web:** let more avatar colour through the team card backdrop ([#323](https://github.com/marioparaschiv/unbound/issues/323)) ([ff3a968](https://github.com/marioparaschiv/unbound/commit/ff3a968302468833f4ba148e52950812dd49ce63))
* **web:** sort imports and satisfy oxlint in the fix round ([b3b7a6d](https://github.com/marioparaschiv/unbound/commit/b3b7a6d21ddaea6fde0dfb46e8450fc201908a88))
* **web:** sort imports and shorten a comment from the fix round ([a45c158](https://github.com/marioparaschiv/unbound/commit/a45c15866016414c1b4c4594f4ff50fe86d149f7))
* **web:** sort the SQLite copy imports ([426fd60](https://github.com/marioparaschiv/unbound/commit/426fd60adb7f24b1dea88684afcfae44be2ae168))
* **web:** sort the SQLite copy test imports ([cfb6ccf](https://github.com/marioparaschiv/unbound/commit/cfb6ccf7950bdf4a7e91f360e87ecbac5c216e04))


### Tests

* **web:** assert the seek predicate of each planned index scan ([67947f1](https://github.com/marioparaschiv/unbound/commit/67947f1e1d8060add1802a32d33225e175634236))
* **web:** check only the failed context's own database is dropped ([0ed9b36](https://github.com/marioparaschiv/unbound/commit/0ed9b365270d789adf228c51cad83dcea5cce61b))
* **web:** count only this database's ordering-lock waiters ([7645884](https://github.com/marioparaschiv/unbound/commit/76458843955617fa41405a303cee4212e492ae29))
* **web:** drop the test database when a context fails to start ([ffe41a7](https://github.com/marioparaschiv/unbound/commit/ffe41a7ad107202baf29fcfc1055afb4bfeb1a13))
* **web:** expect no source rows for tables newer than SQLite ([150392b](https://github.com/marioparaschiv/unbound/commit/150392b9b878f22a434368af217f9669b3f3f3b1))
* **web:** expect the live digest in the first-party list ([3fa1c6e](https://github.com/marioparaschiv/unbound/commit/3fa1c6e61489a673b2ef3ff871ac778e141b639b))
* **web:** keep the SQLite fixture frozen at the pre-Postgres schema ([c9c1563](https://github.com/marioparaschiv/unbound/commit/c9c1563de5ea31b30045b50b8fe2201ea939a897))
* **web:** keep the SQLite fixture frozen at the pre-Postgres schema ([46c663a](https://github.com/marioparaschiv/unbound/commit/46c663a57b1546cbe335aefe55153f223b6b8950))
* **web:** plan the addon search seek without a cursor only ([294bb11](https://github.com/marioparaschiv/unbound/commit/294bb11bd468753c37e925b9a44ddcc2fe8a7abe))
* **web:** restore the time zone by name instead of deleting it ([6b49a8a](https://github.com/marioparaschiv/unbound/commit/6b49a8a5ea1612bd60374fdec200f71d4b38641b))
* **web:** seed crash reports and team members in the SQLite fixture ([1e00df7](https://github.com/marioparaschiv/unbound/commit/1e00df70fcd59785ea05b73582809603050f3681))
* **web:** wait out a slow drop of a failed test context ([2fd98e4](https://github.com/marioparaschiv/unbound/commit/2fd98e43d079a8f47cddd867d1e801f11d10841c))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.11.0
    * @unbound-app/logger bumped to 0.7.1
    * @unbound-app/utils bumped to 0.9.1

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/web-v0.9.0...web-v0.10.0) (2026-10-25)


### Features

* **contracts:** add source pin and repository details schemas ([8249648](https://github.com/marioparaschiv/unbound/commit/82496486be8642d240ef7630b536cefe98ec9add))
* **web:** add admin addon and user pages ([d7db1b5](https://github.com/marioparaschiv/unbound/commit/d7db1b591a23e3ac07ca9b413af188d3beb18d54))
* **web:** add admin addon and user pages with review history ([642b31b](https://github.com/marioparaschiv/unbound/commit/642b31bbbcd24c58676f3c96a7e7734222ebc2c0))
* **web:** add base ui primitives and redesign admin addon pages ([#205](https://github.com/marioparaschiv/unbound/issues/205)) ([86a219b](https://github.com/marioparaschiv/unbound/commit/86a219be5d57cb36d44f7723ec4ce9781b74e0b0))
* **web:** add GitHub listing endpoints and submission preview ([33e3992](https://github.com/marioparaschiv/unbound/commit/33e3992455f44375db8f9a4cae75bd0d0b6cb351))
* **web:** add GitHub Sponsors with a custom badge perk ([#190](https://github.com/marioparaschiv/unbound/issues/190)) ([85ad012](https://github.com/marioparaschiv/unbound/commit/85ad012ce92f128c025c0d7be0ae13c64e7bd2c3))
* **web:** add staff notes on users and addons ([6888d66](https://github.com/marioparaschiv/unbound/commit/6888d66e5da005bb589678a62c9c1f195802841c))
* **web:** add the ADDON.md URL policy and markdown dependencies ([b581f2b](https://github.com/marioparaschiv/unbound/commit/b581f2b930f10045538354d904f89bdad8e2c68c))
* **web:** add the moderation event log ([9350597](https://github.com/marioparaschiv/unbound/commit/9350597082194348aa948aec97847121f300c2d7))
* **web:** add the staff addon edit form ([2b788c8](https://github.com/marioparaschiv/unbound/commit/2b788c8884284c27a3ebc7ea36ee709a22be7f71))
* **web:** add the staff_note table and note permissions ([0664d5c](https://github.com/marioparaschiv/unbound/commit/0664d5cbc383148cb4fc0679319465303b1549d7))
* **web:** add the submission_source table ([b38de9c](https://github.com/marioparaschiv/unbound/commit/b38de9c60b517cddc64fb900f6edff35a28c7f17))
* **web:** carry the ADDON.md diff on review entries ([a944266](https://github.com/marioparaschiv/unbound/commit/a94426644da86c43e5fdc50dc808147d44c10688))
* **web:** create submissions from GitHub, staging bundles server-side ([aeff80f](https://github.com/marioparaschiv/unbound/commit/aeff80fe173452d22f1a49ea3f8156772ca5c471))
* **web:** diff a submission's ADDON.md against the approved copy ([caa9514](https://github.com/marioparaschiv/unbound/commit/caa9514b47eabf6d23ed58a0f875fcff3a60d3e5))
* **web:** edit addons as staff with pinned summary fields ([d4555fb](https://github.com/marioparaschiv/unbound/commit/d4555fbf506ae697763036b3d48bc8434d40fb6a))
* **web:** edit addons as staff with TanStack Form ([44f3f6b](https://github.com/marioparaschiv/unbound/commit/44f3f6bb311802478ca370618a794d30922c203f))
* **web:** filter admin addons by type, status, maintainer and date ([e708728](https://github.com/marioparaschiv/unbound/commit/e708728db8ca0d04963317b8c9a5472742107b61))
* **web:** filter admin addons by type, status, maintainer and date ([7ba0fe5](https://github.com/marioparaschiv/unbound/commit/7ba0fe5aa30e8d1afdad5dd592944dfa207890df))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** keyset-page and search the admin users and addons lists ([4309629](https://github.com/marioparaschiv/unbound/commit/4309629c55e6883fcdd1483ea147f27aa0ffbaf4))
* **web:** keyset-page and search the admin users and addons lists ([1e6b7db](https://github.com/marioparaschiv/unbound/commit/1e6b7dbb4720019115be1d9e16fddbbb5df42206))
* **web:** load the admin addon and user views ([13d32d3](https://github.com/marioparaschiv/unbound/commit/13d32d34df5af2db6113d30dc791d4a03dfa4bbd))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))
* **web:** read a lost staged bundle again from its pin at approval ([00f3547](https://github.com/marioparaschiv/unbound/commit/00f35478fe0f017ada5d325d54a07c473ac97dc7))
* **web:** read addons from GitHub at a pinned commit ([b1525a3](https://github.com/marioparaschiv/unbound/commit/b1525a3e33b8781681f1cb7ecfdca38d6f9926c7))
* **web:** read addons from GitHub at a pinned commit and preview submissions ([6e59bab](https://github.com/marioparaschiv/unbound/commit/6e59babb0a9252cf0e5b63c2bcff7bf630d6f436))
* **web:** read and write staff notes through server functions ([7b2c219](https://github.com/marioparaschiv/unbound/commit/7b2c2196ebba222fda9a4bec999202b64ccea9f1))
* **web:** read version changelogs and pins from submission_source ([e372ae4](https://github.com/marioparaschiv/unbound/commit/e372ae4f94deb01008024a22cb18ad633ed789db))
* **web:** record delist, relist and maintainer changes ([b6ef805](https://github.com/marioparaschiv/unbound/commit/b6ef805a7b29021c678d0d668105944b4d2a3400))
* **web:** record moderation events for addon actions and reviews ([a3c861c](https://github.com/marioparaschiv/unbound/commit/a3c861c44068e2c8a25d59f2a068663ce48b2d46))
* **web:** record review decisions as moderation events ([08244eb](https://github.com/marioparaschiv/unbound/commit/08244eb4d3a20b8bf12f63ca625f019eb72bd6ec))
* **web:** redesign the developer dashboard around addon rows and a review timeline ([#189](https://github.com/marioparaschiv/unbound/issues/189)) ([0d2c619](https://github.com/marioparaschiv/unbound/commit/0d2c61978b33ec92cea3fede19c4740e9b0a3098))
* **web:** render ADDON.md in the submission preview ([633b4d4](https://github.com/marioparaschiv/unbound/commit/633b4d43aab6e15aa88d795f54b8776934bf3ffc))
* **web:** render ADDON.md on the addon page and diff it in review ([f01b1cd](https://github.com/marioparaschiv/unbound/commit/f01b1cdd10ae17f95445b7615544a477e4cb4f0c))
* **web:** render ADDON.md with a safe markdown component ([cf19d55](https://github.com/marioparaschiv/unbound/commit/cf19d55abe20a7d48735b58f11f113709f0c5cfc))
* **web:** retire awaiting_upload with a cutover migration ([bb1049c](https://github.com/marioparaschiv/unbound/commit/bb1049cda36d7abc05c89f07846dea019a935657))
* **web:** roll an addon back to any approved version ([799bbf9](https://github.com/marioparaschiv/unbound/commit/799bbf93dbdddb1f45dba47fdd7bf3dca8869389))
* **web:** roll an addon back to any approved version ([cc7906e](https://github.com/marioparaschiv/unbound/commit/cc7906e159daa38165da5b4e453275cf7dd30172))
* **web:** serve a version from the admin addon page ([b67b9ad](https://github.com/marioparaschiv/unbound/commit/b67b9ad0e103d19bf303372acd2b6d53f5770690))
* **web:** serve only versions no rollback withdrew ([aedc7ff](https://github.com/marioparaschiv/unbound/commit/aedc7ff3820b09c195a294114ee2eb7af527216f))
* **web:** show ADDON.md rendered and as a diff in review ([0d03b1e](https://github.com/marioparaschiv/unbound/commit/0d03b1e04b9ae0cd8b5487458b7317180f505693))
* **web:** show ADDON.md, source and typed changelogs on the addon page ([c14b3e2](https://github.com/marioparaschiv/unbound/commit/c14b3e23ab6a01d7fd164f3f546d3bd762bc36f5))
* **web:** show staff notes on the admin addon and user pages ([3e5993c](https://github.com/marioparaschiv/unbound/commit/3e5993c8ef273d52c27ebfadf4376a5b802343d4))
* **web:** store version sources and serve typed changelogs ([d460e09](https://github.com/marioparaschiv/unbound/commit/d460e0935f638d47f69e49e8d0b14bea0a618058))
* **web:** submit from a GitHub repository on /submit ([6577e20](https://github.com/marioparaschiv/unbound/commit/6577e20c280073bdd9b7b3d3c18f7b7323072aae))


### Bug Fixes

* **web:** align diff signs and line numbers in wrapped rows ([591c312](https://github.com/marioparaschiv/unbound/commit/591c312be23d15528846ae2fb1be80f6efc370e9))
* **web:** keep catalogs stored before the listing name still parseable ([93cb8b2](https://github.com/marioparaschiv/unbound/commit/93cb8b2f5ad497bb0bf281ace914ba142f7b3c2a))
* **web:** keep catalogs stored before the listing name still parseable ([1db2a60](https://github.com/marioparaschiv/unbound/commit/1db2a60b23bf76c0f29700a761f9ce2149b8f388))
* **web:** keep sessions and the GitHub link usable ([8376b2c](https://github.com/marioparaschiv/unbound/commit/8376b2c272985df37e96c14b66189d2d30a76143))
* **web:** keep sessions and the GitHub link usable ([c5058b6](https://github.com/marioparaschiv/unbound/commit/c5058b683b88936bad9745d5261c83d4ef55bb88))
* **web:** refetch a lost bundle without the author's token if it lapsed ([abab19d](https://github.com/marioparaschiv/unbound/commit/abab19d824852d457c586cbcc47d471634dca34d))
* **web:** wrap long diff lines at word boundaries ([36c2ff2](https://github.com/marioparaschiv/unbound/commit/36c2ff29fe0816200dfd8f1560d1aafe7ed819a9))


### Code Refactoring

* **web:** delete the browser upload path ([ca23b2c](https://github.com/marioparaschiv/unbound/commit/ca23b2c44cc145d77ff28c5b3a92c861332353f5))
* **web:** encode the claim and discovery rules in types ([b3d736f](https://github.com/marioparaschiv/unbound/commit/b3d736f2aed0b8ea8db4ac255d0f6966c8dcffc0))
* **web:** move maintainer functions to lib/maintainers ([f643d3e](https://github.com/marioparaschiv/unbound/commit/f643d3e22d82cd90097b92624dd41bd82c4eaeed))
* **web:** name the ADDON.md line-ending normalizer ([b06f7b8](https://github.com/marioparaschiv/unbound/commit/b06f7b8b6b4cda025657bd48aa8a74e0642005c9))
* **web:** name the numbered diff line type ([706dd64](https://github.com/marioparaschiv/unbound/commit/706dd6482bc253f83636f5973786f6f72e91bf65))
* **web:** rename submit form props to say what they do ([a359c33](https://github.com/marioparaschiv/unbound/commit/a359c338e6d1dacaa0fcb781c36e9198b3e66479))
* **web:** share the marked changelog sections with the public page ([3f9ff86](https://github.com/marioparaschiv/unbound/commit/3f9ff865e590d36cbb8e49e39145c3269b69dd2d))
* **web:** trim admin comments and share the search length limits ([46db19b](https://github.com/marioparaschiv/unbound/commit/46db19bdd0f220e6bef5783294e0086e6146d060))
* **web:** trim rollback, edit and notes comments ([ae8ef66](https://github.com/marioparaschiv/unbound/commit/ae8ef669b7c4c272bb2c791589fc5a111ad1a44b))
* **web:** type submissions the API returns as sourced ([e36193b](https://github.com/marioparaschiv/unbound/commit/e36193b7f68d764ee7e9c5c69791d844c66b498e))


### Styles

* sort imports and shorten script header comments ([d159f61](https://github.com/marioparaschiv/unbound/commit/d159f613a19f0c1eec0095f2283824e758c7a15b))
* **web:** brace the control-character guard ([f1236fb](https://github.com/marioparaschiv/unbound/commit/f1236fbec833c66063e847910cf368a0e7b511e9))
* **web:** drop a type-only sibling import from the review tests ([fda02ce](https://github.com/marioparaschiv/unbound/commit/fda02cec62e6cb1fb2c3785b304a7329bff87e64))
* **web:** sort imports ([9cdc8e1](https://github.com/marioparaschiv/unbound/commit/9cdc8e1836a89f51614fbc9322a43c5736ba3823))
* **web:** sort imports ([7a933e2](https://github.com/marioparaschiv/unbound/commit/7a933e26b00a895ea9fcd1551066e913fba34c88))
* **web:** sort imports and exports ([3d297f5](https://github.com/marioparaschiv/unbound/commit/3d297f511aba79a490328a7033d00d6d25cdac6c))
* **web:** sort review imports ([d5087a9](https://github.com/marioparaschiv/unbound/commit/d5087a90fdeda308bafc83c3b9d9ef1cbae3b0e8))
* **web:** sort test imports ([b0d8839](https://github.com/marioparaschiv/unbound/commit/b0d883951bfa2fc7f206820db44368e924c1c113))


### Tests

* **web:** add a git-backed fake GitHub and cover the reader ([d32e580](https://github.com/marioparaschiv/unbound/commit/d32e580bc44f821322b4b9bad3b83fd2ea86ae42))
* **web:** reproduce stale-session unlink and expired GitHub tokens ([d79e18e](https://github.com/marioparaschiv/unbound/commit/d79e18e5d7bac08d18ba26a0d23ba4fa6bcb3811))
* **web:** share the in-memory S3 server between tests ([b6e779f](https://github.com/marioparaschiv/unbound/commit/b6e779fa84637b2cf840f7ca3c3151c633728eee))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.10.0
    * @unbound-app/utils bumped to 0.9.0
