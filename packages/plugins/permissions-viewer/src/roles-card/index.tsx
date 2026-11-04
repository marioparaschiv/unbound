import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import RolesCardButton from '~/roles-card/components/roles-card-button';
import { asId } from '~/action-sheets/targets';
import { ROLES_CARD_PATH } from '~/constants';

type RolesCardProps = {
	guildId?: unknown;
	userId?: unknown;
};

/**
 * @description Adds a View Permissions button under the roles card of a profile opened from a server, the mobile counterpart of Vencord's button in the user popout's roles section.
 * Patches the render of `modules/user_profile/native/UserProfileRolesCard.tsx` when it loads, appending the button after the card when its props carry `guildId` and `userId`. A profile open while the setting turns off keeps the button until it is reopened.
 * @returns A function that removes the button, or stops waiting for `UserProfileRolesCard`.
 */
export function patchUserProfileRolesCard(): () => void {
	return whenLoaded<AnyProps>(ROLES_CARD_PATH, (module) => {
		const target = findRenderTarget(module);

		if (!target) return;

		return patcher.after(target.holder, target.key, ({ args: [props], result }) => {
			const { guildId, userId } = (props ?? {}) as RolesCardProps;
			const guild = asId(guildId);
			const user = asId(userId);

			if (!result || !guild || !user) return result;

			return (
				<>
					{result}
					<RolesCardButton guildId={guild} userId={user} />
				</>
			);
		});
	});
}
