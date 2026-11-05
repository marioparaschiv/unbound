import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import RolesCardButton from '~/viewer/roles-card/components/roles-card-button';
import { asId } from '~/viewer/action-sheets/targets';
import { RolesCard } from '~/viewer/modules';

type RolesCardProps = {
	guildId?: unknown;
	userId?: unknown;
};

/**
 * @description Adds a View Permissions button under the roles card of a profile opened from a server, the mobile counterpart of Vencord's button in the user popout's roles section.
 * Patches the render of `modules/user_profile/native/UserProfileRolesCard.tsx`, appending the button after the card when its props carry `guildId` and `userId` and `rolesCardButton` is on.
 */
export function patchUserProfileRolesCard(): void {
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
