import type { LayoutChangeEvent } from 'react-native';
import { Text, View } from 'react-native';

import { findUserSummaryItem, UserStore } from '~/modules';
import { surfaceStates } from '~/surface-states';
import type { Reactor } from '~/avatars';
import { Avatar } from '~/constants';
import {
	reactionAvatarReservedSlotCount,
	reactionAvatarStackPositions,
	reactionAvatarStackWidth,
	reactionAvatarStack,
	shouldMeasureReactionAvatarWidth,
} from '~/avatars';

type SurfaceProps = {
	surfaceId: string;
};

export type UserSummaryItemProps = {
	guildId?: string;
	max: number;
	renderIcon: boolean;
	showDefaultAvatarsForNullUsers: boolean;
	showUserPopout: boolean;
	users: Reactor[];
};

type PropagationEvent = {
	stopPropagation?: () => void;
};

function stopPropagation(event: PropagationEvent) {
	event.stopPropagation?.();
}

function ReactionAvatarSurface({ surfaceId }: SurfaceProps) {
	const state = surfaceStates.get(surfaceId);
	const Summary = findUserSummaryItem();

	if (!state || !Summary) return null;

	const users = state.users.map((user) => UserStore.getUser(user.id) ?? user);
	const stack = reactionAvatarStack(users, state.totalCount);
	const positions = reactionAvatarStackPositions(
		reactionAvatarReservedSlotCount(state.totalCount),
	);
	const { measured, onWidth, width: reservedWidth } = state;
	// Taps on the faces open their profiles instead of toggling the reaction underneath. These
	// pointer events are missing from React Native's `View` typings.
	const pointerHandlers = { onClick: stopPropagation, onKeyDown: stopPropagation };

	function onLayout(event: LayoutChangeEvent) {
		const { width } = event.nativeEvent.layout;

		if (!Number.isFinite(width) || width <= 0) return;

		if (shouldMeasureReactionAvatarWidth(measured, reservedWidth, width)) onWidth(width);
	}

	return (
		<View
			{...pointerHandlers}
			pointerEvents='box-none'
			style={{
				alignItems: 'flex-start',
				height: state.height,
				justifyContent: 'center',
				marginLeft: 0,
				transform: [{ scale: 0.9 }],
			}}
		>
			<View
				onLayout={onLayout}
				pointerEvents='box-none'
				style={{
					height: Avatar.size,
					position: 'relative',
					justifyContent: 'center',
					width: reactionAvatarStackWidth(positions.length),
				}}
			>
				{stack.users.map((user, index) => (
					<View
						key={`avatar-${user.id}`}
						pointerEvents='box-none'
						style={{
							height: Avatar.size,
							left: positions[index] ?? 0,
							position: 'absolute',
							top: 0,
							width: Avatar.size,
							zIndex: index + 1,
						}}
					>
						<Summary
							guildId={state.guildId}
							max={1}
							renderIcon={false}
							showDefaultAvatarsForNullUsers
							showUserPopout
							users={[user]}
						/>
					</View>
				))}
				{stack.overflowCount > 0 ? (
					<View
						style={{
							alignItems: 'center',
							backgroundColor: '#000',
							borderRadius: Avatar.size / 2,
							height: Avatar.size,
							justifyContent: 'center',
							left: positions[stack.users.length] ?? 0,
							position: 'absolute',
							top: 0,
							zIndex: Avatar.limit + 1,
							width: Avatar.size,
						}}
					>
						<Text
							adjustsFontSizeToFit
							minimumFontScale={0.5}
							numberOfLines={1}
							style={{
								color: '#fff',
								fontSize: 8,
								fontWeight: '600',
								height: Avatar.size,
								includeFontPadding: false,
								lineHeight: Avatar.size,
								textAlign: 'center',
								width: Avatar.size,
							}}
						>
							{`+${stack.overflowCount}`}
						</Text>
					</View>
				) : null}
			</View>
		</View>
	);
}

export default ReactionAvatarSurface;
