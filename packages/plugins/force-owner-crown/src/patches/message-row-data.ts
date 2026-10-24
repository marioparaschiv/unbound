import { assets } from '@unbound-app/api';
import { Image } from 'react-native';

import { AssetUris, GuildStore, MessageRowData, Patcher } from '~/modules';

type RoleIcon = {
	source: string | number;
	name: string;
	size: number;
	alt: string;
};

type Row = {
	guildId?: string;
	authorId?: string;
	roleIcon?: RoleIcon;
};

function getCrownSource(): string | number | undefined {
	const id = assets.getIDByName('ic_crown_16px');

	if (id === undefined) return;

	// Discord's embed URI stays valid where the native asset's may not.
	return AssetUris.getAssetUriForEmbed?.(id) || Image.resolveAssetSource(id)?.uri || id;
}

/**
 * @description Shows the owner crown as the role icon on the server owner's messages that have none.
 * @returns A function that removes the patch.
 */
export function patchOwnerCrown(): () => void {
	// Resolved on the first owner row rather than at start, since the asset may register later.
	let source: string | number | undefined;

	return Patcher.after(MessageRowData, 'generateMessageRowData', ({ result }) => {
		const row: Row | undefined = result?.message;

		if (!row?.guildId || !row.authorId || row.roleIcon) return;

		if (GuildStore.getGuild(row.guildId)?.ownerId !== row.authorId) return;

		source ??= getCrownSource();

		if (source === undefined) return;

		row.roleIcon = { source, name: 'Server Owner', size: 18, alt: 'Server Owner' };
	});
}
