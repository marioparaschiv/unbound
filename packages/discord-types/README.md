# @unbound-app/discord-types

TypeScript types for the React Native components in Discord's mobile app, generated from a decompiled build.

Generated from Discord build `discord-350`.

The `DiscordBuild` type carries the same build name.

## Install

```sh
npm install --save-dev @unbound-app/discord-types @types/react react-native typescript
```

`@types/react`, `react-native` and `typescript` are peer dependencies. The types reference `React.ComponentType` and React Native's host components (`View`, `Text`, ...), so your project must resolve both.

## Use

Import a component's props:

```ts
import type { TableRowProps } from '@unbound-app/discord-types';

const row: TableRowProps = { label: 'Notifications' };
```

Look up a component by its source path and export name:

```ts
import type { DiscordComponentsByPath } from '@unbound-app/discord-types';

type TableSwitchRow =
	DiscordComponentsByPath['design/components/TableRow/native/TableSwitchRow.native.tsx']['TableSwitchRow'];
```

Type the components of Discord's design module (`design/native.tsx`). This entry point is self-contained, so it compiles much less than the full package:

```ts
import type { DesignBarrelComponents } from '@unbound-app/discord-types/design';
import type { ComponentProps } from 'react';

type TextProps = ComponentProps<DesignBarrelComponents['Text']>;
```

`DiscordComponentsByName` maps each export name that is unique in the build to its component type.

`@unbound-app/discord-types/metro` is the module index Unbound's Metro lookups are typed from. `DiscordExportName` and `DiscordModulePath` list the export names and source paths suggested for a lookup: those of modules with two or more distinctive export names (each in at most three modules). `DiscordModules` holds the shapes of only the modules with a typed export, the design-barrel components, keyed by source path, or by `~` and a hash of the export names for a module without one, never by Metro's numeric id, which changes every build. `DiscordModuleProps` maps their export names to the keys exposing them, and `DiscordModulesByName` maps default-exported components by name.

### Asset names

`@unbound-app/discord-types/assets` lists the name of every asset the build registers, by file type (`png`, `svg`, `lottie`, `jpg`, `webm`). Unbound's `assets.getIdByName`, `assets.getByName` and `assets.icons` take these names, so an editor completes them and a name the build lacks is a type error:

```ts
import type { DiscordAssetName } from '@unbound-app/discord-types/assets';

const icon: DiscordAssetName<'png'> = 'WrenchIcon';
```

`DiscordAssetNames` maps each file type to its names, and `DiscordAssetName<T>` is the names of the types `T`, all of them by default. Every icon component Discord exports, such as `WrenchIcon`, draws the PNG asset of the same name. Compiled translation catalogs (`jsona`) are left out: their names carry a content hash that changes every build.

## Best effort

The types are inferred from how each component uses its props in the decompiled JavaScript, not from Discord's source. A prop whose type the generator could not infer is `unknown`. A component that may read props the generator could not see also accepts any extra key. Discord changes components between builds, so check the build line above against the app version you target.

## Regenerate

In the [Unbound repository](https://github.com/marioparaschiv/unbound), decompile a Discord build, then run:

```sh
bun run generate-discord-types -- ~/.cache/unbound/discord-<build>
```

This rewrites `src/*.gen.d.ts`, `src/assets.gen.d.ts` included, and the build line of this README. Then run `bun run generate-sdk`, so the plugin SDK's asset lookups take the new names. Fix a wrong type in the generator (`apps/discord-typegen`), never by hand.
