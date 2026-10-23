---
name: dkrypt
description: Download decrypted iOS IPAs from the dkrypt API at ipa.dylib.dev. Use when you need a Discord (or other) IPA for the vphone or for decompiling, or need a build dkrypt has not decrypted yet.
---

# dkrypt (ipa.dylib.dev)

Auth is `Authorization: Bearer $DKRYPT_API_KEY`. The script reads the key from the environment, else from the repo's gitignored `.env`. Keep the key out of output and commits.

## Get an IPA

```bash
python3 .agents/skills/dkrypt/scripts/fetch-ipa.py --list com.hammerandchisel.discord    # cached builds, newest first
python3 .agents/skills/dkrypt/scripts/fetch-ipa.py com.hammerandchisel.discord appstore  # newest appstore build
```

Done when it prints `ok <path>`. Files land in `$IPA_DIR` (default `~/ipas`) as `<bundleId>-<version>-<build>.ipa`, checked against the listed SHA-256. Prefer `appstore` builds for the vphone. `testflight` builds are newer but less tested.

## A build that is not cached

`POST /v1/decrypts` with `{bundleId, version?}` starts a decrypt job. Poll `GET /v1/jobs/{id}` until it finishes, then fetch it with the script. Avoid `GET /v1/decrypt?bundleId=&version=`: it holds the connection for minutes without answering.
