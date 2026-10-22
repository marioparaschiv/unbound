import { metro, patcher, storage } from '@unbound-app/api';

import {
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
} from '@shared/settings-ui';

const ADDON_ID = 'unbound.pronoundb';
const STORE = storage.getStore(ADDON_ID);
const API_URL = 'https://pronoundb.org/api/v2/lookup';
const REQUEST_BATCH_SIZE = 50;
const REQUEST_INTERVAL_MS = 2000;

type Format = 'capitalized' | 'lowercase';
type Priority = 'discord' | 'pronoundb';

type Message = {
	author?: { bot?: boolean; id?: string; system?: boolean; username?: string };
	channel_id?: string;
	type?: number;
};

type ProfileStore = {
	getGuildMemberProfile?: (userId: string, guildId?: string) => { pronouns?: string } | undefined;
	getUserProfile?: (userId: string) => { pronouns?: string } | undefined;
};

type PronounDBResponse = Record<string, { sets?: Record<string, string[]> }>;

const pronounMapping: Record<string, string> = {
	any: 'Any pronouns',
	ask: 'Ask me my pronouns',
	avoid: 'Avoid pronouns, use my name',
	he: 'He/Him',
	it: 'It/Its',
	other: 'Other pronouns',
	she: 'She/Her',
	they: 'They/Them',
	unspecified: 'No pronouns specified.',
};

const cache = new Map<string, string | null>();
const queue = new Set<string>();
let unpatch: (() => void) | null = null;
let profiles: ProfileStore | null = null;
let users: { getCurrentUser?: () => { id?: string } | undefined } | null = null;
let channels: { getChannel?: (id: string) => { guild_id?: string } | undefined } | null = null;
let messageStore: { emitChange?: () => void } | null = null;
let processing = false;
let scheduled = false;
let runId = 0;

function formatPronouns(codes: string[] | undefined): string | null {
	if (!codes?.length) return null;
	if (codes.length > 1) {
		const pronouns = codes.map((code) => code[0]?.toUpperCase() + code.slice(1)).join('/');
		return STORE.get<Format>('format', 'lowercase') === 'lowercase'
			? pronouns.toLowerCase()
			: pronouns;
	}

	const code = codes[0];
	const value = pronounMapping[code] ?? code;
	if (
		STORE.get<Format>('format', 'lowercase') === 'capitalized' ||
		['any', 'ask', 'avoid', 'other', 'unspecified'].includes(code)
	) {
		return value;
	}
	return value.toLowerCase();
}

function discordPronouns(userId: string, channelId?: string): string | null {
	const global = profiles?.getUserProfile?.(userId)?.pronouns?.trim().replace(/\n+/g, '');
	const guildId = channelId ? channels?.getChannel?.(channelId)?.guild_id : undefined;
	return (
		profiles?.getGuildMemberProfile?.(userId, guildId)?.pronouns?.trim().replace(/\n+/g, '') ||
		global ||
		null
	);
}

function resolvePronouns(userId: string, channelId?: string): string | null {
	const discord = discordPronouns(userId, channelId);
	const pronounDB = cache.get(userId) ?? null;
	const priority = STORE.get<Priority>('priority', 'pronoundb');
	return priority === 'discord' ? discord || pronounDB : pronounDB || discord;
}

function refreshMessages(): void {
	messageStore?.emitChange?.();
}

async function requestPronouns(ids: string[], currentRunId: number): Promise<void> {
	const query = new URLSearchParams({ ids: ids.join(','), platform: 'discord' });
	try {
		const response = await fetch(`${API_URL}?${query}`, {
			headers: { Accept: 'application/json', 'X-PronounDB-Source': 'Unbound/1.0.0' },
		});
		if (!response.ok) throw new Error(`PronounDB returned ${response.status}`);
		const result = (await response.json()) as PronounDBResponse;
		if (runId !== currentRunId) return;
		for (const id of ids) cache.set(id, formatPronouns(result[id]?.sets?.en));
		refreshMessages();
	} catch {
		if (runId !== currentRunId) return;
		for (const id of ids) cache.set(id, null);
	}
}

async function processQueue(currentRunId: number): Promise<void> {
	if (processing) return;
	processing = true;
	while (queue.size > 0 && runId === currentRunId) {
		const ids = Array.from(queue).slice(0, REQUEST_BATCH_SIZE);
		for (const id of ids) queue.delete(id);
		await requestPronouns(ids, currentRunId);
		if (queue.size > 0 && runId === currentRunId) {
			await new Promise<void>((resolve) => setTimeout(() => resolve(), REQUEST_INTERVAL_MS));
		}
	}
	processing = false;
}

function enqueue(userId: string): void {
	if (cache.has(userId)) return;
	queue.add(userId);
	if (scheduled) return;
	scheduled = true;
	setTimeout(() => {
		scheduled = false;
		void processQueue(runId);
	}, 0);
}

function shouldShow(message: Message | undefined): message is Message {
	if (!message) return false;
	if (message.type !== 0 && message.type !== 19) return false;
	const author = message.author;
	if (!author?.id || author.bot || author.system) return false;
	if (!STORE.get('showSelf', true) && author.id === users?.getCurrentUser?.()?.id) return false;
	return true;
}

function displayPronouns(pronouns: string): string {
	const firstSegment = pronouns.split(/\s+[|•]\s+/)[0].trim();
	if (firstSegment.length <= 12) return firstSegment;
	return `${firstSegment.slice(0, 11).trimEnd()}…`;
}

function hasHeaderRoom(row: any, message: Message, pronouns: string): boolean {
	const width = metro.common?.ReactNative?.Dimensions?.get?.('window')?.width;
	if (typeof width !== 'number' || !Number.isFinite(width)) return false;
	const characterBudget = Math.floor((width - 55) / 8);
	const tag = row.tagText ?? row.opTagText ?? '';
	const username = String(row.username ?? '');
	const authorUsername = message.author?.username;
	const projectedUsername =
		authorUsername && !username.includes(`@${authorUsername}`)
			? `${username} (@${authorUsername})`
			: username;
	const length =
		projectedUsername.length +
		String(tag).length +
		row.timestamp.length +
		pronouns.length +
		4 +
		(row.roleIcon ? 3 : 0);
	return length <= characterBudget;
}

function addPronouns(row: any, message: Message | undefined): void {
	if (!shouldShow(message) || !message.author?.id) return;
	const pronouns = resolvePronouns(message.author.id, message.channel_id);
	if (!cache.has(message.author.id)) enqueue(message.author.id);
	if (!pronouns || typeof row?.timestamp !== 'string') return;
	if (typeof row.timestampAccessibilityLabel === 'string') {
		if (!row.timestampAccessibilityLabel.endsWith(` • ${pronouns}`)) {
			row.timestampAccessibilityLabel = `${row.timestampAccessibilityLabel} • ${pronouns}`;
		}
	}
	const displayed = displayPronouns(pronouns);
	if (
		!displayed ||
		!hasHeaderRoom(row, message, displayed) ||
		row.timestamp.endsWith(` • ${displayed}`)
	)
		return;
	row.timestamp = `${row.timestamp} • ${displayed}`;
}

function SettingsPanel() {
	const state = STORE.useSettingsStore();
	const format = state.get<Format>('format', 'lowercase');
	const priority = state.get<Priority>('priority', 'pronoundb');
	return (
		<SettingsScrollView>
			<SettingsSection title='Pronouns'>
				<SettingsRow
					label='Lowercase'
					trailing={format === 'lowercase' ? '✓' : null}
					onPress={() => state.set('format', 'lowercase')}
				/>
				<SettingsRow
					label='Capitalized'
					trailing={format === 'capitalized' ? '✓' : null}
					onPress={() => state.set('format', 'capitalized')}
				/>
			</SettingsSection>
			<SettingsSection title='Source'>
				<SettingsRow
					label='Prefer PronounDB'
					description='Fall back to Discord profile pronouns'
					trailing={priority === 'pronoundb' ? '✓' : null}
					onPress={() => state.set('priority', 'pronoundb')}
				/>
				<SettingsRow
					label='Prefer Discord'
					description='Fall back to PronounDB'
					trailing={priority === 'discord' ? '✓' : null}
					onPress={() => state.set('priority', 'discord')}
				/>
			</SettingsSection>
			<SettingsSection title='Visibility'>
				<SettingsSwitchRow
					label='Show for Yourself'
					value={state.get('showSelf', true)}
					onValueChange={(value: boolean) => state.set('showSelf', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start() {
		runId++;
		profiles = metro.findStore('UserProfile');
		users = metro.findByProps('getCurrentUser');
		channels = metro.findByProps('getChannel');
		messageStore = metro.findStore('Message');
		const target = metro.findByProps('generateMessageRowData');
		if (!profiles || !users?.getCurrentUser || !target?.generateMessageRowData) return;

		unpatch = patcher.after(target, 'generateMessageRowData', (ctx) => {
			addPronouns(ctx.result?.message, ctx.args[0]?.message);
		});
	},
	stop() {
		runId++;
		unpatch?.();
		unpatch = null;
		cache.clear();
		queue.clear();
		profiles = null;
		users = null;
		channels = null;
		messageStore = null;
		processing = false;
		scheduled = false;
	},
	getSettingsPanel: () => <SettingsPanel />,
};
