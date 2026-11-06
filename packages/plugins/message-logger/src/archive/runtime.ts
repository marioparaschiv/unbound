import { fs, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { capture, emptyArchive, prune, search, type Archive, type Entry } from './core';
import { Disk } from './disk';
import { ChannelStore, UserStore } from '~/log/modules';

let archive: Archive = emptyArchive();
let disk: Disk | undefined;
let running = false;
let epoch = 0;
let sweepTimer: ReturnType<typeof setInterval> | undefined;
let removeSettings: (() => void) | undefined;
let status = 'Archive is loading';
let failure = false;
let saving = 0;
const listeners = new Set<() => void>();
export function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
function notify(): void {
	for (const listener of listeners) listener();
}
export function currentAccount(): string {
	return UserStore.getCurrentUser()?.id ?? '';
}
export function archiveState() {
	return { status, ready: running, entries: archive.entries.length };
}
export function findSaved(query = '', channelId = ''): Entry[] {
	return search(archive, currentAccount(), query, channelId);
}
export function savedDeletionsForChannel(channelId: string): Entry[] {
	// Recheck age on a history load after suspension, even if its timer has not run yet.
	const previousCount = archive.entries.length;
	applyOptions();
	if (previousCount !== archive.entries.length) void save();
	const allowed = archive.options.channels.split(/[\s,]+/).filter(Boolean);
	if (allowed.length && !allowed.includes(channelId)) return [];
	return search(archive, currentAccount(), '', channelId).filter((e) => e.kind === 'deleted');
}
function applyOptions(): void {
	archive.options = {
		enabled: settings.archive.persistCapture && !failure,
		days: settings.archive.retentionDays,
		limit: settings.archive.maxSavedEvents,
		ignoreBots: settings.ignoreBots,
		ignoreSelf: settings.ignoreSelf,
		channels: settings.archive.captureChannels,
		ignoredUsers: settings.ignoreUsers,
		ignoredGuilds: settings.ignoreGuilds,
	};
	prune(archive);
}
async function save(): Promise<void> {
	if (!disk) return;
	const request = ++saving;
	status = 'Saving locally';
	notify();
	try {
		await disk.save(archive);
		if (request === saving && !failure) status = 'Saved locally';
	} catch {
		failure = true;
		archive.options.enabled = false;
		settings.archive.persistCapture = false;
		status = 'Save failed. Persistence is paused; check device storage and restart.';
		// Never log captured content or a native error that might contain serialized data.
	}
	notify();
}
export async function startArchive(): Promise<boolean> {
	const token = ++epoch;
	disk = new Disk(fs);
	const loaded = await disk.load();
	if (token !== epoch) return false;
	archive = loaded.archive;
	failure = false;
	if (loaded.recovered) settings.archive.persistCapture = false;
	applyOptions();
	await save();
	if (token !== epoch) return false;
	running = true;
	if (loaded.recovered)
		status = 'Recovered a backup. Persistence is paused; review saved history.';
	removeSettings = storage.onChange(
		(p) => p.store === addon.id,
		() => {
			if (!running || failure) return;
			applyOptions();
			void save();
		},
	);
	sweepTimer = setInterval(() => {
		const previousCount = archive.entries.length;
		applyOptions();
		if (archive.entries.length !== previousCount) void save();
	}, 60000);
	notify();
	return true;
}
export async function stopArchive(): Promise<void> {
	epoch++;
	running = false;
	removeSettings?.();
	removeSettings = undefined;
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = undefined;
	await disk?.flush().catch(() => {});
	notify();
}
export function recordDeletion(previous: any, channelId: string): void {
	record('deleted', previous, undefined, channelId);
}
export function recordEdit(previous: any, next: any, channelId: string): void {
	record('edited', previous, next, channelId);
}
function record(kind: Entry['kind'], previous: any, next: any, channelId: string): void {
	if (!running || failure || !settings.archive.persistCapture) return;
	applyOptions();
	const changed = capture(
		archive,
		currentAccount(),
		kind,
		{
			id: previous.id,
			channel_id: channelId,
			content: previous.content ?? '',
			author: previous.author,
			attachments: previous.attachments,
			flags: previous.flags,
		},
		next,
		ChannelStore.getChannel(channelId),
	);
	if (changed) void save();
}
export async function forgetSaved(channelId: string, messageId?: string): Promise<void> {
	if (!running) return;
	const user = currentAccount();
	archive.entries = archive.entries.filter(
		(e) =>
			e.accountId !== user ||
			e.channelId !== channelId ||
			(messageId !== undefined && e.messageId !== messageId),
	);
	await save();
}
export async function clearSaved(allAccounts = false): Promise<void> {
	if (!running) return;
	const user = currentAccount();
	archive.entries = allAccounts ? [] : archive.entries.filter((e) => e.accountId !== user);
	await save();
}
