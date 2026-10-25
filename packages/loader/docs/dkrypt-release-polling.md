# GitHub-driven Discord release polling

## Ownership

GitHub Actions should own the timer, source comparison, duplicate-release check, and release orchestration. dkrypt should expose authenticated version lookup and exact-version decryption APIs, but it should not dispatch loader builds or own a loader-specific schedule. The loader workflow should poll, request the selected artifacts, validate them, and publish them.

This does not imply removing dkrypt's generic scheduler. Remove only the Discord loader watch and its dispatch configuration unless the dkrypt owner confirms the scheduler has no other consumers.

## Current API surface

The current dkrypt API already supports the required operations:

- `GET /v1/testflight/{appId}/trains` lists TestFlight trains.
- `GET /v1/testflight/{appId}/builds?trainVersion={trainVersion}` lists builds for a train.
- `POST /v1/decrypts` accepts an exact `bundleId` and `version`; a `major.minor_build` selector resolves to the corresponding TestFlight build, while a version without a build suffix resolves to App Store history.
- `GET /v1/jobs/{id}` and artifact routes expose asynchronous decrypt status and results.

The TestFlight catalog routes already require an API key with TestFlight access. They are not currently included in dkrypt's public OpenAPI operation allowlist, so the dkrypt API owner should add those two GET operations to the generated public API document and its allowlist tests. No new release-dispatch endpoint or combined candidate endpoint is required.

## Loader update feed

After a stable combined release is created, CI publishes one iOS and one Android loader record through `POST /api/v1/loader/releases`. The endpoint uses the `x-api-key` header and the `loader: ['publish']` permission introduced by client PR #180. Configure the restricted CI account's API key as the GitHub Actions secret `UNBOUND_API_KEY` and the endpoint as the `UNBOUND_API_URL` repository variable; do not use an administrator key. The published version comes from the packaged tweak's Debian version, shared with the Android module, while each record links directly to its platform asset in the matching GitHub release. CI attaches categorized loader change notes and publishes records only when the packaged loader SemVer is newer than the existing platform records.

TestFlight Discord builds are not published as loader updates because they currently share the stable loader package version. Publishing them would replace the stable URL for that same platform/version. Publish loader prereleases only after the packaged loader version itself is given a SemVer prerelease identifier.

Loader changelogs are generated from conventional commits since the previous change to the Debian Version field. They do not use Discord-generated release notes or include the Discord app version. The Discord-tagged release URL is used only to locate the matching combined release assets.

## Polling behavior

The scheduled workflow should run the following checks independently so an unavailable TestFlight bridge does not block a stable release:

1. Query Apple's iTunes Lookup API for `com.hammerandchisel.discord` and retain the current App Store version and track ID.
2. Query the Android stable package source and map its version code to Discord's marketing version.
3. Select the newest Android version that is not newer than the current App Store version. Confirm the exact Android base package is downloadable, then ask dkrypt to decrypt that exact iOS marketing version. The build's existing IPA and APK version checks remain the final guard; any absent historical iOS version or source mismatch fails closed without creating a release.
4. Use the iTunes track ID to list TestFlight trains and builds through dkrypt. Choose the newest non-expired build for the Discord bundle ID, represented as `major.minor_build`.
5. Check whether the matching GitHub release tag already exists before dispatching either build. Stable tags use `v{version}`; TestFlight prerelease tags use `v{version}_{build}`.
6. Call the existing reusable build workflow with the exact candidate. Stable builds include matching iOS and Android artifacts. TestFlight builds produce an iOS prerelease only.
7. Resolve Discord's Google Play beta and alpha builds through sniff and the Android version tracker, taking the newest version code any eligible track serves. Tag them `loader-v{version}-android-beta` and `loader-v{version}-android-alpha`, and build them as Android-only prereleases from the exact version code. These do not need dkrypt.

The workflow should be concurrency-protected per channel, tolerate an unchanged catalog as a no-op, retry transient network errors, and never fall back to a different app version. The API key belongs only in GitHub Actions secrets. Stable decrypt requests need the `com.hammerandchisel.discord` bundle scope; TestFlight polling additionally needs dkrypt's TestFlight API scope.

## Request for the dkrypt API owner

Please expose the existing TestFlight trains and builds GET routes in the public OpenAPI allowlist, with their existing API-key and TestFlight-scope requirements unchanged. Confirm that the GitHub API key is allowed to list Discord TestFlight builds and submit exact-version decrypts. The loader will do the iTunes lookup, Android version mapping, release-tag deduplication, and scheduling itself, so dkrypt no longer needs to send `ipa-update` repository dispatches for loader releases.

After the scheduled workflow has been deployed and observed completing stable and TestFlight runs, remove the Discord-specific dkrypt scheduler watch and dispatch target. Preserve unrelated dkrypt scheduler functionality.
