import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';
import { cloneElement, type ReactElement } from 'react';

import PlatformIndicators from '~/components/platform-indicators';
import { USER_ROW_PATH } from '~/constants';
import { skip } from '~/skip';
import { appendToLabel, type TreeNode } from '~/label-tree';

type UserRowProps = {
	user?: { id?: string; bot?: boolean };
};

function cloneNode(node: TreeNode, props: Record<string, unknown>) {
	return cloneElement(node as ReactElement, props);
}

function patchLoadedUserRow(module: AnyProps) {
	const target = findRenderTarget(module);

	if (!target) {
		skip('the member list, UserRow is not a component');

		return;
	}

	return patcher.after(target.holder, target.key, ({ args: [props], result }) => {
		const user = (props as UserRowProps | undefined)?.user;

		if (!user?.id || user.bot) return;

		return appendToLabel(
			result,
			<PlatformIndicators
				key='platform-indicators'
				userId={user.id}
				small
				pressable={false}
			/>,
			cloneNode,
		);
	});
}

/**
 * @description Shows platform indicators after each name in the member list and Discord's other user lists, once the row's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchUserRow(): () => void {
	return whenLoaded(USER_ROW_PATH, patchLoadedUserRow);
}

export default patchUserRow;
