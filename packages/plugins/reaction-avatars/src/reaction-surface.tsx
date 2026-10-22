import {
	hydrateReactorsInOrder,
	REACTION_AVATAR_LIMIT,
	REACTION_AVATAR_SIZE,
	type Reactor,
	reactionAvatarPresentation,
	reactionAvatarReservedSlotCount,
	reactionAvatarStackPositions,
	reactionAvatarStackWidth,
	reactionAvatarSummaryProps,
	shouldMeasureReactionAvatarWidth,
} from '@reaction-avatars/reaction-state';
import { metro } from '@unbound-app/api';
import type { ReactNode } from 'react';

type AnyRecord = Record<string, unknown>;
type UserStore = {
	getUser?: (id: string) => Reactor | null;
};
export type ReactionAvatarSurfaceState = {
	guildId?: string;
	height: number;
	measured: boolean;
	onWidth: (width: number) => void;
	totalCount: number;
	users: Reactor[];
	width: number;
};
type SurfaceProps = {
	revision: number;
	surfaceId: string;
};
type NativeLayoutEvent = {
	nativeEvent?: {
		layout?: {
			width?: number;
		};
	};
};
type PropagationEvent = {
	stopPropagation?: () => void;
};
type ReactRuntime = {
	createElement: (type: unknown, props?: AnyRecord | null, ...children: ReactNode[]) => ReactNode;
};
type ReactNativeRuntime = {
	Text: unknown;
	View: unknown;
};

const surfaceStates = new Map<string, ReactionAvatarSurfaceState>();

let userSummaryItem: unknown = null;
let userStore: UserStore | null = null;

function stopEventPropagation(event: PropagationEvent): void {
	event.stopPropagation?.();
}

export function configureReactionAvatarSurface(component: unknown, store: UserStore | null): void {
	userSummaryItem = component;
	userStore = store;
}

export function setReactionAvatarSurfaceState(id: string, state: ReactionAvatarSurfaceState): void {
	surfaceStates.set(id, state);
}

export function clearReactionAvatarSurfaceState(id: string): void {
	surfaceStates.delete(id);
}

export function clearReactionAvatarSurfaceStates(): void {
	surfaceStates.clear();
	userSummaryItem = null;
	userStore = null;
}

export function ReactionAvatarSurface({ surfaceId }: SurfaceProps): ReactNode {
	const { React, ReactNative } = metro.common as {
		React: ReactRuntime;
		ReactNative: ReactNativeRuntime;
	};
	const state = surfaceStates.get(surfaceId);
	if (!state || !userSummaryItem || !userStore) return null;
	const users = hydrateReactorsInOrder(
		state.users,
		(id) => userStore?.getUser?.(id) ?? undefined,
	);
	const presentation = reactionAvatarPresentation(users, state.totalCount);
	const visibleUsers = presentation.users.slice(
		0,
		Math.min(REACTION_AVATAR_LIMIT, Math.max(0, state.totalCount)),
	);
	const overflowCount = presentation.overflowCount;
	const positions = reactionAvatarStackPositions(
		reactionAvatarReservedSlotCount(state.totalCount),
	);
	const stackWidth = reactionAvatarStackWidth(positions.length);
	const onLayout = (event: NativeLayoutEvent) => {
		const width = Number(event.nativeEvent?.layout?.width);
		if (!Number.isFinite(width) || width <= 0) return;
		if (shouldMeasureReactionAvatarWidth(state.measured, state.width, width))
			state.onWidth(width);
	};
	const stackChildren: ReactNode[] = visibleUsers.map((user, index) =>
		React.createElement(
			ReactNative.View,
			{
				key: `avatar-${user.id}`,
				pointerEvents: 'box-none',
				style: {
					height: REACTION_AVATAR_SIZE,
					left: positions[index] ?? 0,
					position: 'absolute',
					top: 0,
					width: REACTION_AVATAR_SIZE,
					zIndex: index + 1,
				},
			},
			React.createElement(
				userSummaryItem,
				reactionAvatarSummaryProps([user], state.guildId, 1),
			),
		),
	);
	if (overflowCount > 0) {
		stackChildren.push(
			React.createElement(
				ReactNative.View,
				{
					key: 'overflow',
					style: {
						alignItems: 'center',
						backgroundColor: '#000',
						borderRadius: REACTION_AVATAR_SIZE / 2,
						height: REACTION_AVATAR_SIZE,
						justifyContent: 'center',
						left: positions[visibleUsers.length] ?? 0,
						position: 'absolute',
						top: 0,
						zIndex: REACTION_AVATAR_LIMIT + 1,
						width: REACTION_AVATAR_SIZE,
					},
				},
				React.createElement(
					ReactNative.Text,
					{
						style: {
							color: '#fff',
							fontSize: 8,
							fontWeight: '600',
							height: REACTION_AVATAR_SIZE,
							lineHeight: REACTION_AVATAR_SIZE,
							textAlign: 'center',
							width: REACTION_AVATAR_SIZE,
						},
						adjustsFontSizeToFit: true,
						includeFontPadding: false,
						minimumFontScale: 0.5,
						numberOfLines: 1,
					},
					`+${overflowCount}`,
				),
			),
		);
	}
	const stack = React.createElement(
		ReactNative.View,
		{
			onLayout,
			pointerEvents: 'box-none',
			style: {
				height: REACTION_AVATAR_SIZE,
				position: 'relative',
				justifyContent: 'center',
				width: stackWidth,
			},
		},
		...stackChildren,
	);

	return React.createElement(
		ReactNative.View,
		{
			onClick: stopEventPropagation,
			onKeyDown: stopEventPropagation,
			pointerEvents: 'box-none',
			style: {
				alignItems: 'flex-start',
				height: state.height,
				justifyContent: 'center',
				marginLeft: 0,
				transform: [{ scale: 0.9 }],
			},
		},
		stack,
	);
}
