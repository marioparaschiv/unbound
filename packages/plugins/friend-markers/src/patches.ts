import { flux, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { withFriendLabel, type TagLabels } from '~/lib/marker';

type TagInput = { message?: { author?: { id?: string } } };

type RelationshipStore = { isFriend(userId: string): boolean };

/**
 * @description Labels the header of each message a friend sent. Patches the default export of Discord's
 * `getTagProperties`, which builds the tags beside a name, and reads friendships from `RelationshipStore`.
 */
export function patchTagProperties(): void {
	const TagProperties = metro.findByName('getTagProperties', { interop: false });
	const Relationships = flux.getStore('Relationship') as unknown as RelationshipStore;

	if (!TagProperties || typeof Relationships?.isFriend !== 'function') {
		logger.warn('Friend markers skipped: Discord moved getTagProperties or RelationshipStore.');

		return;
	}

	patcher.after(TagProperties, 'default', ({ args, result }) => {
		const author = (args[0] as TagInput | undefined)?.message?.author?.id;

		if (!result || !author || !Relationships.isFriend(author)) return;

		return withFriendLabel(result as TagLabels, messages.FRIEND);
	});
}
