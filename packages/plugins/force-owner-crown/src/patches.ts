import {
	MessageRowData,
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { assets, flux, metro } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { Image } from 'react-native';

import { platformCrownSource } from '~/lib/crown-source';

type RoleIcon = {
	source: string | number;
	name: string;
	size: number;
	alt: string;
};

type Row = MessageRow & {
	roleIcon?: RoleIcon;
};

type AssetUris = { getAssetUriForEmbed?: (id: number) => string } | undefined;

function getCrownSource(uris: AssetUris): string | number | undefined {
	const id = assets.getIdByName('ic_crown_16px');

	if (id === undefined) return;

	// Discord's embed URI stays valid where the native asset's may not.
	return (
		platformCrownSource(assets.getById(id)) ??
		(uris?.getAssetUriForEmbed?.(id) || Image.resolveAssetSource(id)?.uri || id)
	);
}

/**
 * @description Shows the owner crown as the role icon on the server owner's messages that have none.
 * Patches `generateMessageRowData` on Discord's message row module, and reads the owner from
 * `GuildStore` and the crown's URI from the asset URI module.
 */
export function patchMessageRows(): void {
	if (!MessageRowData) {
		logger.warn('Crown skipped: Discord moved MessageRowData.');

		return;
	}

	const AssetUris = metro.findByProps('getAssetUriForEmbed');
	const GuildStore = flux.getStore('Guild');

	// Resolved on the first owner row rather than at start, since the asset may register later.
	let source: string | number | undefined;

	onMessageRow<RowMessage, Row>({
		after({ row }) {
			if (!row?.guildId || !row.authorId || row.roleIcon) return;

			if (GuildStore.getGuild(row.guildId)?.ownerId !== row.authorId) return;

			source ??= getCrownSource(AssetUris);

			if (source === undefined) return;

			row.roleIcon = {
				source,
				name: messages.SERVER_OWNER,
				size: 18,
				alt: messages.SERVER_OWNER,
			};
		},
	});
}
