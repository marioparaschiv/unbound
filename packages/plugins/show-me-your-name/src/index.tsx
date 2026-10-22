import { metro, patcher, storage } from '@unbound-app/api';

import {
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
} from '@shared/settings-ui';

const ADDON_ID = 'unbound.show-me-your-name';
const STORE = storage.getStore(ADDON_ID);

let unpatch: (() => void) | null = null;
let users: { getUser?: (id: string) => Author | undefined } | null = null;
let relationships: {
	getNickname?: (userId: string) => string | null;
} | null = null;

type Mode = 'user-nick' | 'nick-user' | 'user';

interface Author {
	id?: string;
	username?: string;
	globalName?: string;
}

function isAutomodMessage(message: any): boolean {
	const type = message?.type;
	return (
		(typeof type === 'number' ? type : Number(type)) === 24 ||
		type === 'AUTOMOD_ACTION' ||
		type === 'AUTO_MODERATION_ACTION' ||
		message?.isAutomod === true ||
		message?.isAutoModAction === true
	);
}

const MODES: { key: Mode; label: string; subLabel: string }[] = [
	{ key: 'nick-user', label: 'Display name then username', subLabel: 'Display Name (@username)' },
	{ key: 'user-nick', label: 'Username then display name', subLabel: '@username (Display Name)' },
	{ key: 'user', label: 'Username only', subLabel: '@username' },
];

function buildLabel(author: Author | undefined, displayed: string | undefined): string | null {
	if (!author || typeof displayed !== 'string') return null;

	const mode = STORE.get<Mode>('mode', 'nick-user');
	const useDisplayNames = STORE.get('displayNames', false);

	let username = author.username ?? '';
	if (useDisplayNames && author.globalName) username = author.globalName;
	if (!username) return null;

	const prefix = displayed.startsWith('@') ? '@' : '';
	const friendNickname =
		STORE.get('friendNicknames', true) && author.id
			? relationships?.getNickname?.(author.id)
			: null;
	const nick = friendNickname ?? (prefix ? displayed.slice(1) : displayed);
	const tag = `@${username}`;

	if (username === nick) return displayed;
	if (mode === 'user') return tag;
	if (mode === 'user-nick') return `${tag} (${nick})`;
	return `${prefix}${nick} (${tag})`;
}

function rewriteUsername(rowMessage: any, author?: Author): void {
	if (!rowMessage) return;

	const resolved =
		author ?? (rowMessage.authorId ? users?.getUser?.(rowMessage.authorId) : undefined);
	const label = buildLabel(resolved, rowMessage.username);
	if (label != null) rowMessage.username = label;
}

function ReactNativeSettingsScreen() {
	const state = STORE.useSettingsStore();
	const mode = state.get<Mode>('mode', 'nick-user');

	return (
		<SettingsScrollView>
			<SettingsSection title='Display Mode'>
				{MODES.map(({ key, label, subLabel }) => (
					<SettingsRow
						key={key}
						label={label}
						description={subLabel}
						trailing={mode === key ? '✓' : null}
						onPress={() => state.set('mode', key)}
					/>
				))}
			</SettingsSection>

			<SettingsSection title='Preferences'>
				<SettingsSwitchRow
					label='Show Friend Nicknames'
					description="Prefer a friend's nickname wherever it applies"
					value={state.get('friendNicknames', true)}
					onValueChange={(value: boolean) => state.set('friendNicknames', value)}
				/>
				<SettingsSwitchRow
					label='Use Global Names'
					description="Show the account's global name instead of its username"
					value={state.get('displayNames', false)}
					onValueChange={(value: boolean) => state.set('displayNames', value)}
				/>
				<SettingsSwitchRow
					label='Apply To Replies'
					description='Also apply to reply previews'
					value={state.get('inReplies', false)}
					onValueChange={(value: boolean) => state.set('inReplies', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start() {
		const target = metro.findByProps('generateMessageRowData');
		if (typeof target?.generateMessageRowData !== 'function') return;

		users = metro.findByProps('getCurrentUser', 'getUser');
		relationships = metro.findStore('RelationshipStore', { short: false });

		unpatch = patcher.after(target, 'generateMessageRowData', (ctx) => {
			try {
				const row = ctx.result?.message;
				if (!row) return;
				const message = (ctx.args[0] as any)?.message;
				if (isAutomodMessage(message)) return;

				rewriteUsername(row, message?.author);

				const referencedMessage =
					message?.referencedMessage?.message ?? message?.referenced_message;
				if (STORE.get('inReplies', false) && !isAutomodMessage(referencedMessage)) {
					rewriteUsername(row.referencedMessage?.message, referencedMessage?.author);
				}
			} catch {}
		});
	},

	stop() {
		unpatch?.();
		unpatch = null;
		users = null;
		relationships = null;
	},
	getSettingsPanel: () => <ReactNativeSettingsScreen />,
};
