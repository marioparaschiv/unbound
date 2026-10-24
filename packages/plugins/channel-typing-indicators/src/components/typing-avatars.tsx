import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import type { RefObject } from 'react';

import {
	ActionSheets,
	Icons,
	UserProfileActionSheet,
	UserSummaryItem,
	UserSummaryItemByName,
} from '~/modules';
import { MAX_AVATARS } from '~/constants';
import type { User } from '~/types';

import useStyles from './typing-avatars.style';

type TypingAvatarsProps = {
	users: (User | null)[];
	guildId: string | undefined;
	channelId: string;
	containerRef: RefObject<View | null>;
	onShowTooltip: () => void;
};

function openProfile(userId: string, channelId: string) {
	if (!UserProfileActionSheet.default) return;

	ActionSheets.openLazy(
		Promise.resolve({ default: UserProfileActionSheet.default }),
		`UserProfile${userId}`,
		{ userId, channelId, sourceAnalyticsLocations: ['avatar'], openedAt: Date.now() },
	);
}

function TypingAvatars({
	users,
	guildId,
	channelId,
	containerRef,
	onShowTooltip,
}: TypingAvatarsProps) {
	const styles = useStyles();
	const Summary = UserSummaryItem.default ?? UserSummaryItemByName.default;
	const visible = users.slice(0, MAX_AVATARS);
	const overflow = users.length - visible.length;

	if (!Summary) return null;

	// Presses stop here so the channel row underneath does not navigate.
	function showTooltip(event: GestureResponderEvent) {
		event.stopPropagation();
		onShowTooltip();
	}

	return (
		<View ref={containerRef} style={styles.container}>
			{visible.map((user, index) => (
				<View
					key={user?.id ?? `unknown-${index}`}
					style={{ marginLeft: index ? -6 : 0, zIndex: visible.length - index }}
				>
					{user ? (
						<Pressable
							onPress={(event) => {
								event.stopPropagation();
								openProfile(user.id, channelId);
							}}
							onLongPress={showTooltip}
						>
							<Summary
								users={[user]}
								guildId={guildId}
								renderIcon={false}
								max={1}
								size={16}
								showDefaultAvatarsForNullUsers
								showUserPopout
							/>
						</Pressable>
					) : (
						<Pressable onPress={showTooltip} onLongPress={showTooltip}>
							<View style={styles.unknownAvatar}>
								{Icons.UserIcon ? (
									<Icons.UserIcon
										color={styles.unknownIcon.color}
										style={{ transform: [{ scale: 0.5 }] }}
									/>
								) : null}
							</View>
						</Pressable>
					)}
				</View>
			))}
			{overflow > 0 ? (
				<Pressable onPress={showTooltip} onLongPress={showTooltip} style={styles.overflow}>
					<View style={styles.overflowBadge}>
						<Text style={styles.overflowText}>{`+${overflow}`}</Text>
					</View>
				</Pressable>
			) : null}
		</View>
	);
}

export default TypingAvatars;
