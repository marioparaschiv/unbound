import type { NativeFabricFrame as Frame } from '@unbound-app/api/native';

import { Icon } from '~/constants';

export type Placed<T> = {
	view: T;
	frame: Frame;
};

/** Pins a view's leading edge after another view's edge and centers it vertically in a container. */
export type Placement<T> = {
	view: T;
	leading: readonly [anchor: T, edge: 'leading' | 'trailing', offset: number];
	centerY: readonly [container: T, offset: number];
	width: number;
	height: number;
};

export type Header<T> = {
	row: Placed<T>;
	group: Placed<T>;
	username: Placed<T>;
	trailing: Placed<T>[];
	timestamp: Placed<T>;
	icon: T;
};

export type HeaderLayout<T> = {
	row: Placement<T>[];
	group: Placement<T>[];
};

function centerOffset(frame: Frame, container: Frame): number {
	return frame.y + frame.height / 2 - container.height / 2;
}

/**
 * @description Lays the indicator in front of the username by widening the name group, keeping every other view where it was.
 * @template T The native view handle type.
 * @param header The message header's views and their current frames.
 * @returns The placements to constrain inside the row and inside the name group.
 */
export function headerLayout<T>({
	row,
	group,
	username,
	trailing,
	timestamp,
	icon,
}: Header<T>): HeaderLayout<T> {
	const groupEnd = group.frame.x + group.frame.width;
	const inGroup: Placement<T>[] = [
		{
			view: icon,
			leading: [group.view, 'leading', username.frame.x],
			centerY: [group.view, 0],
			width: Icon.controlWidth,
			height: Icon.controlHeight,
		},
		{
			view: username.view,
			leading: [icon, 'trailing', 0],
			centerY: [group.view, centerOffset(username.frame, group.frame)],
			width: username.frame.width,
			height: username.frame.height,
		},
	];
	let previous = username;

	for (const next of trailing) {
		inGroup.push({
			view: next.view,
			leading: [
				previous.view,
				'trailing',
				next.frame.x - previous.frame.x - previous.frame.width,
			],
			centerY: [group.view, centerOffset(next.frame, group.frame)],
			width: next.frame.width,
			height: next.frame.height,
		});
		previous = next;
	}

	return {
		row: [
			{
				view: group.view,
				leading: [row.view, 'leading', group.frame.x],
				centerY: [row.view, 0],
				width: group.frame.width + Icon.controlWidth,
				height: group.frame.height,
			},
			{
				view: timestamp.view,
				leading: [group.view, 'trailing', timestamp.frame.x - groupEnd],
				centerY: [row.view, centerOffset(timestamp.frame, row.frame)],
				width: timestamp.frame.width,
				height: timestamp.frame.height,
			},
		],
		group: inGroup,
	};
}

export default { headerLayout };
