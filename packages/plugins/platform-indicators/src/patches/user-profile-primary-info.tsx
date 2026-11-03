import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';
import { cloneElement, type ReactElement } from 'react';

import PlatformIndicators from '~/components/platform-indicators';
import { USER_PROFILE_PRIMARY_INFO_PATH } from '~/constants';
import { skip } from '~/skip';

type PrimaryInfoProps = {
	user?: { id?: string; bot?: boolean };
};

function patchLoadedPrimaryInfo(module: AnyProps) {
	const target = findRenderTarget(module);

	if (!target) {
		skip('profiles, UserProfilePrimaryInfo is not a component');

		return;
	}

	return patcher.after(target.holder, target.key, ({ args: [props], result }) => {
		const user = (props as PrimaryInfoProps | undefined)?.user;

		if (!result || !user?.id || user.bot) return;

		const indicators = (
			<PlatformIndicators
				key='platform-indicators'
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

/**
 * @description Shows platform indicators under the name, tag and badges on user profiles, once the profile's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchUserProfilePrimaryInfo(): () => void {
	return whenLoaded(USER_PROFILE_PRIMARY_INFO_PATH, patchLoadedPrimaryInfo);
}

export default patchUserProfilePrimaryInfo;
