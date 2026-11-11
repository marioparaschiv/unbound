import { flux, metro } from '@unbound-app/api';

export const AssetUris = metro.findByProps('getAssetUriForEmbed');
export const GuildStore = flux.getStore('Guild');
