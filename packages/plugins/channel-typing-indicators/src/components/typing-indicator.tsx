import { Pressable, View } from 'react-native';
import { useRef, useState, type RefObject } from 'react';

import type { TooltipAnchor } from '~/tooltip-placement';
import { GuildMemberStore, settings, Tooltips, UserStore } from '~/modules';
import { formatDiscordMessage } from '~/i18n';
import type { Channel, User } from '~/types';
import { IndicatorMode } from '~/constants';
import { typingLabel } from '~/typing-label';

import useStyles from './typing-indicator.style';
import TypingTooltip from './typing-tooltip';
import TypingAvatars from './typing-avatars';
import useTypingIds from './use-typing-ids';
import TypingDots from './typing-dots';

type TypingIndicatorProps = {
	channel: Channel;
	muted: boolean;
};

function displayName(user: User, guildId: string | undefined): string {
	return (
		(guildId ? GuildMemberStore.getNick?.(guildId, user.id) : undefined) ??
		user.globalName ??
		user.username ??
		user.id
	);
}

function TypingIndicator({ channel, muted }: TypingIndicatorProps) {
	const styles = useStyles();
	const avatarsRef = useRef<View>(null);
	const dotsRef = useRef<View>(null);
	const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);
	const mode = settings
		.useSettingsStore()
		.get('indicatorMode', IndicatorMode.Dots | IndicatorMode.Avatars);
	const typingIds = useTypingIds(channel, muted);

	if (!typingIds.length) return null;

	const users: (User | null)[] = typingIds.map((id) => UserStore.getUser(id) ?? null);
	const names = users.map((user) => (user ? displayName(user, channel.guild_id) : 'Someone'));
	const label = typingLabel(names, formatDiscordMessage);

	function showTooltip(target: RefObject<View | null>) {
		target.current?.measureInWindow((x, y, width, height) => {
			if (![x, y, width, height].every(Number.isFinite)) return;

			setAnchor({ x, y, width, height });
		});
	}

	return (
		<>
			<View style={styles.row}>
				{mode & IndicatorMode.Avatars ? (
					<TypingAvatars
						users={users}
						guildId={channel.guild_id}
						channelId={channel.id}
						containerRef={avatarsRef}
						onShowTooltip={() => showTooltip(avatarsRef)}
					/>
				) : null}
				{mode & IndicatorMode.Dots ? (
					<Pressable
						ref={dotsRef}
						accessibilityLabel={label}
						onPress={(event) => {
							event.stopPropagation();
							showTooltip(dotsRef);
						}}
					>
						<TypingDots />
					</Pressable>
				) : null}
			</View>
			{anchor && Tooltips.Tooltip ? (
				<TypingTooltip anchor={anchor} label={label} onClose={() => setAnchor(null)} />
			) : null}
		</>
	);
}

export default TypingIndicator;
