import type { UnboundAsset } from '@unbound-app/types/assets';

// Every registered asset by id; `assets/api.ts` records Discord's, `plugin-assets.ts` adds and removes plugins'.
export const recordedAssets = new Map<number, UnboundAsset>();
