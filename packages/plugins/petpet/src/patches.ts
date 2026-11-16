import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { avatarUrl, imageUrl, type AvatarUser, type ImageAttachment } from '~/lib/sources';
import { makePetPet } from '~/lib/make-petpet';

type SheetProps = {
	message?: {
		channel_id?: string;
		attachments?: ImageAttachment[];
		author?: AvatarUser & { username?: string; globalName?: string | null };
	};
};

/**
 * @description Adds rows to the message long-press sheet that pat the author's avatar or the message's image.
 * @param native The plugin's native bridge, which decodes images.
 * @param folder The plugin's temporary folder.
 */
export function patchActionSheets(native: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('PetPet rows skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const message = props.message;
		const channelId = message?.channel_id;
		const author = message?.author;

		if (!key.endsWith('MessageLongPressActionSheet') || !channelId || !author?.id) return;

		const image = imageUrl(message.attachments);
		const pat = (url: string) => {
			ActionSheets.hideActionSheet(key);
			void makePetPet(native, folder, channelId, url);
		};

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-petpet-author',
					label: format('PET_AUTHOR', {
						name: author.globalName ?? author.username ?? '',
					}),
					icon: 'HeartIcon',
					onPress: () => pat(avatarUrl(author)),
				},
				...(image
					? [
							{
								key: 'unbound-petpet-image',
								label: messages.PET_IMAGE,
								icon: 'HeartIcon',
								onPress: () => pat(image),
							},
						]
					: []),
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
