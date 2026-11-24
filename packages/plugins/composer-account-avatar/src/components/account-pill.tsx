import { useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { useDraft } from '@unbound-plugins/shared/composer/composer-state';
import { Discord } from '@unbound-app/api/metro/components';
import { flux, metro } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { Image, Pressable, type ImageSourcePropType } from 'react-native';

import useStyles, { PILL_HEIGHT } from '~/components/account-pill.style';

type CurrentUser = {
	username?: string;
	globalName?: string | null;
	getAvatarSource?: (
		guildId: string | undefined,
		animated?: boolean,
		size?: number,
	) => ImageSourcePropType | undefined;
	getAvatarURL?: (
		guildId: string | undefined,
		size: number,
		animated?: boolean,
	) => string | undefined;
};

type UserStore = { getCurrentUser(): CurrentUser | undefined };

type ManageAccounts = { openManageAccountsModal?: () => void; default?: () => void };

const ChannelStore = flux.getStore('Channel');

// `getAvatarSource` covers default avatars, whose URL is not one an `Image` can load.
function avatarOf(user: CurrentUser): ImageSourcePropType | undefined {
	const source = user.getAvatarSource?.(undefined, false, 64);

	if (source) return source;

	const uri = user.getAvatarURL?.(undefined, 64, false);

	return uri ? { uri } : undefined;
}

function openAccounts() {
	const module = metro.findByFilePath(
		'modules/multi_account/native/openManageAccountsModal.tsx',
	) as ManageAccounts | undefined;
	const open = module?.openManageAccountsModal ?? module?.default;

	if (typeof open === 'function') open();
	else logger.warn('Account switching skipped: Discord moved openManageAccountsModal.');
}

/**
 * @description The account you're signed in as, avatar and name, above the left of a channel's message box while you
 * write; tapping it opens Discord's account switcher.
 * @param props The channel whose message box it sits on.
 * @returns The pill, or nothing while the message box is empty.
 */
export function AccountPill({ channelId }: { channelId: string }) {
	const styles = useStyles();
	const draft = useDraft(channelId);
	const user = flux.useStore(flux.getStore('User'), (store) =>
		(store as unknown as UserStore).getCurrentUser(),
	);
	const shown = draft.trim().length > 0 && Boolean(user);
	const top = useComposerRow({
		channel: ChannelStore.getChannel(channelId),
		channelId,
		id: 'composer-account-avatar',
		order: 2,
		height: PILL_HEIGHT,
		shown,
	});

	if (!shown || !user) return null;

	const name = user.globalName || user.username || '';
	const avatar = avatarOf(user);

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={format('SENDING_AS', { name })}
			onPress={openAccounts}
			hitSlop={6}
			style={[styles.pill, { top }]}
		>
			{avatar ? <Image source={avatar} style={styles.avatar} /> : null}
			<Discord.Text variant='text-xs/semibold' color='text-default' numberOfLines={1}>
				{name}
			</Discord.Text>
		</Pressable>
	);
}
