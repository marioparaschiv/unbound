import { settings } from '@unbound-app/settings';
import { cloneElement, type ReactElement } from 'react';
import { metro, patcher } from '@unbound-app/api';

import PlatformIndicators from '~/components/platform-indicators';
import { Theme } from '~/lib/modules';

type PrimaryInfoProps = {
	user?: { id?: string; bot?: boolean };
};

/**
 * @description Shows platform indicators under the name, tag and badges on user profiles.
 */
export function patchUserProfilePrimaryInfo(): void {
	const UserProfilePrimaryInfo = metro.findByFilePath(
		'modules/user_profile/native/UserProfilePrimaryInfo.tsx',
	);

	if (!UserProfilePrimaryInfo || !Theme) {
		logger.warn('Profiles skipped: Discord moved UserProfilePrimaryInfo or Theme.');

		return;
	}

	patcher.react.after(UserProfilePrimaryInfo, 'default', ({ props, result }) => {
		const user = (props as PrimaryInfoProps | undefined)?.user;

		if (!settings.profiles || !result || !user?.id || user.bot) return;

		const indicators = (
			<PlatformIndicators
				key='platform-indicators'
				setting='profiles'
				userId={user.id}
				small={false}
				pressable
				style={{ marginTop: 8 }}
			/>
		);
		const element = result as ReactElement<{ children?: unknown }>;
		const children = element.props?.children;

		if (children === undefined) {
			return (
				<>
					{result}
					{indicators}
				</>
			);
		}

		return cloneElement(element, { children: [...[children].flat(), indicators] });
	});
}
