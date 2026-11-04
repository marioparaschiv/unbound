import { settings } from '@unbound-app/settings';
import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import PlatformIndicators from '~/indicators/components/platform-indicators';
import { appendToLabel, type TreeNode } from '~/indicators/label-tree';
import { UserRow } from '~/indicators/modules';

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
