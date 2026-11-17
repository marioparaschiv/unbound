import { useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { useDraft } from '@unbound-plugins/shared/composer/composer-state';
import { flux, metro } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { Image, Pressable, Text } from 'react-native';

type CurrentUser = {
	username?: string;
	globalName?: string | null;
	getAvatarURL?: (
		guildId: string | undefined,
		size: number,
		animated?: boolean,
	) => string | undefined;
};

type UserStore = { getCurrentUser(): CurrentUser | undefined };

type ManageAccounts = { openManageAccountsModal?: () => void; default?: () => void };

const ChannelStore = flux.getStore('Channel');
const PILL_HEIGHT = 24;
const AVATAR_SIZE = 18;

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
	const uri = user.getAvatarURL?.(undefined, 64, false);

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={format('SENDING_AS', { name })}
			onPress={openAccounts}
			hitSlop={6}
			style={{
				position: 'absolute',
				top,
				left: 12,
				zIndex: 10,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 5,
				height: PILL_HEIGHT,
				paddingLeft: 3,
				paddingRight: 8,
				borderRadius: 999,
				backgroundColor: 'rgba(0, 0, 0, 0.35)',
			}}
		>
			{uri ? (
				<Image
					source={{ uri }}
					style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 999 }}
				/>
			) : null}
			<Text
				style={{ color: '#f2f3f5', fontSize: 11, fontWeight: '600', lineHeight: 14 }}
				numberOfLines={1}
			>
				{name}
			</Text>
		</Pressable>
	);
}
