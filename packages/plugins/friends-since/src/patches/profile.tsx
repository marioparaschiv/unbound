import { patchAboutCard } from '@unbound-plugins/shared/profile/patch-about-card';
import { AboutSection } from '@unbound-plugins/shared/profile/about-section';
import { messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { friendsSinceDate } from '~/lib/since';

type RelationshipStore = {
	isFriend(id: string): boolean;
	getSince(id: string): string | undefined;
};

const DISCORD_SECTION = 'FriendsSinceDate';

/**
 * @description Adds a Friends Since section to a friend's About card, from `RelationshipStore.getSince`, unless Discord already draws its own.
 */
export function patchProfile(): void {
	const Relationships = flux.getStore('Relationship') as unknown as RelationshipStore;
	const found = patchAboutCard({
		key: 'friends-since',
		render({ userId, sections }) {
			if (sections.includes(DISCORD_SECTION) || !Relationships.isFriend(userId)) return;

			const date = friendsSinceDate(Relationships.getSince(userId));

			return date ? (
				<AboutSection title={messages.FRIENDS_SINCE_TITLE} icon='FriendsIcon'>
					{date}
				</AboutSection>
			) : undefined;
		},
	});

	if (!found) logger.warn('Friends since skipped: Discord moved UserProfileAboutMeCard.');
}

export default { patchProfile };
