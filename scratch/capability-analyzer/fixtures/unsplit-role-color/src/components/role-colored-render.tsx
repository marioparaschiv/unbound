import type { RoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { paintRoleTextTree } from '~/role-text';

type RoleColoredRenderProps<T> = {
	render: (props: T) => ReactNode;
	props: T;
	appearances: Map<string, RoleColorAppearance>;
};

/**
 * @description Renders a Discord component in its place, then paints the names it shows with their role colors.
 * @param props The component to render, its props, and the colors for each name.
 * @returns The component's output with matching names painted.
 */
function RoleColoredRender<T>({ render, props, appearances }: RoleColoredRenderProps<T>) {
	return paintRoleTextTree(render(props), appearances, Text);
}

export default RoleColoredRender;
