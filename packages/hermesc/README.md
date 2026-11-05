# @unbound-app/hermesc

Hermes compiler (`hermesc`) binaries for Linux, macOS and Windows, built from [facebook/hermes](https://github.com/facebook/hermes) by `.github/workflows/hermesc.yml`.

Each npm major is the bytecode version its `hermesc` emits: `98.0.0` compiles bytecode 98. This directory holds only the package manifest; the workflow builds the binaries into it and publishes. It is not a workspace.

`@unbound-app/rollup-plugin-hermes` reads the published versions from npm and downloads the binaries for the bytecode versions a build ships.

## Publishing

The workflow runs weekly and on manual dispatch. It reads `BYTECODE_VERSION` from upstream Hermes and builds only when `<bytecode>.0.0` is not on npm yet (`scripts/hermesc-version.ts`). A scheduled run publishes; a manual run publishes only with `release` set. A new release dispatches `hermesc-published`, which runs the bytecode sync and the beta bundle build.
