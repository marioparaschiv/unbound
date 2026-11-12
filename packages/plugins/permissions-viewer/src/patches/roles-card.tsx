import { asId } from '@unbound-plugins/shared/values/as-id';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import RolesCardButton from '~/components/roles-card-button';
import { ROLES_CARD_PATH } from '~/lib/constants';
import { Constants } from '~/lib/modules';

type RolesCardProps = {
	guildId?: unknown;
	userId?: unknown;
};

/**
 * @description Adds a View Permissions button under the roles card of a profile opened from a server, the mobile counterpart of Vencord's button in the user popout's roles section.
 * Patches the render of `modules/user_profile/native/UserProfileRolesCard.tsx`, appending the button after the card when its props carry `guildId` and `userId` and `rolesCardButton` is on.
 */
export function patchUserProfileRolesCard(): void {
	const RolesCard = metro.findByFilePath(ROLES_CARD_PATH);

	if (!RolesCard || !Constants) {
		logger.warn('Roles card button skipped: Discord moved UserProfileRolesCard or Constants.');

		return;
	}

	patcher.react.after(RolesCard, 'default', ({ props, result }) => {
		const { guildId, userId }: RolesCardProps = props;
		const guild = asId(guildId);
		const user = asId(userId);

		if (!settings.rolesCardButton || !result || !guild || !user) return result;

		return (
			<>
				{result}
				<RolesCardButton guildId={guild} userId={user} />
			</>
		);
	});
}
