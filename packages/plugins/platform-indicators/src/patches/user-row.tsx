import { settings } from '@unbound-app/settings';
import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import PlatformIndicators from '~/components/platform-indicators';
import { appendToLabel, type TreeNode } from '~/lib/label-tree';
import { Theme } from '~/lib/modules';

type UserRowProps = {
	user?: { id?: string; bot?: boolean };
};

function cloneNode(node: TreeNode, props: Record<string, unknown>) {
	return cloneElement(node as ReactElement, props);
}

/**
 * @description Shows platform indicators after each name in the member list and Discord's other user lists.
 */
export function patchUserRow(): void {
	const UserRow = metro.findByFilePath(
		'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx',
	);

	if (!UserRow || !Theme) {
		logger.warn('Member list skipped: Discord moved UserRow or Theme.');

		return;
	}

	patcher.react.after(UserRow, 'default', ({ props, result }) => {
		const user = (props as UserRowProps | undefined)?.user;

		if (!settings.memberList || !user?.id || user.bot) return;

		return appendToLabel(
			result,
			<PlatformIndicators
				key='platform-indicators'
				setting='memberList'
				userId={user.id}
				small
				pressable={false}
			/>,
			cloneNode,
		) as ReactNode;
	});
}
