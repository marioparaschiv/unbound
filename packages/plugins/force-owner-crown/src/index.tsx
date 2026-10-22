import { assets, metro, patcher } from '@unbound-app/api';

import { resolveCrownSource } from '@force-owner-crown/crown';

const CROWN_ASSET = 'ic_crown_16px';
const CROWN_LABEL = 'Server Owner';

let unpatch: (() => void) | null = null;
let assetUriResolver: { getAssetUriForEmbed?: (id: number) => unknown } | null = null;

function getCrownSource(): string | number | null {
	const id = assets.getIDByName(CROWN_ASSET);
	if (id == null) return null;

	if (!assetUriResolver) assetUriResolver = metro.findByProps('getAssetUriForEmbed');
	return resolveCrownSource(
		id,
		(assetId) => metro.common.ReactNative.Image.resolveAssetSource(assetId),
		(assetId) => assetUriResolver?.getAssetUriForEmbed?.(assetId),
	);
}

function isGuildOwner(guildId: string | undefined, userId: string | undefined): boolean {
	if (!guildId || !userId) return false;

	const guilds = metro.findStore('Guild') as {
		getGuild?: (id: string) => { ownerId?: string } | null;
	};
	return guilds?.getGuild?.(guildId)?.ownerId === userId;
}

function applyCrown(rowMessage: any): void {
	if (!rowMessage || rowMessage.roleIcon) return;
	if (!isGuildOwner(rowMessage.guildId, rowMessage.authorId)) return;

	const crownSource = getCrownSource();
	if (crownSource == null) return;

	rowMessage.roleIcon = {
		source: crownSource,
		name: CROWN_LABEL,
		size: 18,
		alt: CROWN_LABEL,
	};
}

export default {
	start() {
		const target = metro.findByProps('generateMessageRowData');
		if (typeof target?.generateMessageRowData !== 'function') return;

		unpatch = patcher.after(target, 'generateMessageRowData', (ctx) => {
			try {
				applyCrown(ctx.result?.message);
			} catch {}
		});
	},

	stop() {
		unpatch?.();
		unpatch = null;
		assetUriResolver = null;
	},
};
