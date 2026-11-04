import { useRef, useState, type RefObject } from 'react';
import type { FluxUser } from '@unbound-app/api/flux';
import { Pressable, View } from 'react-native';
import { useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';

import { GuildMemberStore, Tooltips, UserStore } from '~/typing-indicator/modules';
import { formatDiscordMessage } from '~/typing-indicator/discord-messages';
import type { TooltipAnchor } from '~/typing-indicator/tooltip-placement';
import { typingLabel } from '~/typing-indicator/typing-label';
import { IndicatorMode } from '~/constants';
import type { Channel } from '~/types';

import useStyles from '~/typing-indicator/components/typing-indicator.style';
import TypingTooltip from '~/typing-indicator/components/typing-tooltip';
import TypingAvatars from '~/typing-indicator/components/typing-avatars';
import useTypingIds from '~/typing-indicator/components/use-typing-ids';
import TypingDots from '~/typing-indicator/components/typing-dots';

type TypingIndicatorProps = {
	channel: Channel;
	muted: boolean;
};

function displayName(user: FluxUser, guildId: string | undefined): string {
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
	const mode = useSetting('indicatorMode');
	const typingIds = useTypingIds(channel, muted);

	if (!typingIds.length) return null;

	const users: (FluxUser | null)[] = typingIds.map((id) => UserStore.getUser(id) ?? null);
	const names = users.map((user) =>
		user ? displayName(user, channel.guild_id) : messages.SOMEONE,
	);
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
