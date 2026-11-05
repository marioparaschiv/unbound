import { flux, metro } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { currentAccount, savedDeletionsForChannel, subscribe } from '~/archive/runtime';
import { UserStore, ChannelStore } from '~/log/modules';
import { shouldIgnore } from '~/log/filters';
import type { MessageLog } from '~/log';
import { archivedMessage, mergeHistory, type HistoryAction } from './merge';
import { LOCAL_CLEANUP_FLAG } from './local-cleanup';

/** Restores only retained snapshots for the signed-in account into actual channel-history loads. */
export function startRestoration(log: MessageLog): () => void {
	const injected = new Map<string, { channelId: string; accountId: string }>();
	let owner = currentAccount();
	let active = true;
	let converter: any;
	function canRestore(e: ReturnType<typeof savedDeletionsForChannel>[number]): boolean {
		const channel = ChannelStore.getChannel(e.channelId);
		if (!channel || (e.guildId && channel.guild_id !== e.guildId)) return false;
		return !shouldIgnore(
			archivedMessage(e),
			settings,
			{ currentUserId: currentAccount(), channel },
			false,
		);
	}
	function prepare(raw: any, sample: any): any {
		if (!sample || typeof sample.set !== 'function') return raw;
		converter ??= metro.findByProps('createMessageRecord');
		if (typeof converter?.createMessageRecord !== 'function')
			throw new Error('Message record converter is unavailable');
		const record = converter.createMessageRecord(raw);
		if (typeof record?.set !== 'function') throw new Error('Unsupported message record');
		return record;
	}
	function reconcile(): void {
		const user = currentAccount();
		if (owner !== user) {
			// Discord already resets its stores on logout; also purge our local cache/markers.
			const oldDeleted = log.deletedMessages();
			log.clear();
			injected.clear();
			owner = user;
			for (const target of oldDeleted)
				setTimeout(() => {
					if (active && currentAccount() === user)
						void flux.dispatch({
							type: 'MESSAGE_DELETE',
							channelId: target.channelId,
							id: target.messageId,
							[LOCAL_CLEANUP_FLAG]: true,
						});
				}, 0);
			return;
		}
		for (const [messageId, target] of injected) {
			const retained =
				settings.archive.restoreInChannel &&
				user &&
				target.accountId === user &&
				savedDeletionsForChannel(target.channelId).some(
					(e) => e.messageId === messageId && canRestore(e),
				);
			if (retained) continue;
			injected.delete(messageId);
			log.forget(messageId);
			setTimeout(() => {
				if (!active) return;
				void flux.dispatch({
					type: 'MESSAGE_DELETE',
					channelId: target.channelId,
					id: messageId,
					[LOCAL_CLEANUP_FLAG]: true,
				});
			}, 0);
		}
	}
	const removeHistory = flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		if (!active) return false;
		reconcile();
		if (!owner || !settings.archive.restoreInChannel || !settings.logDeletes) return false;
		const load = action as HistoryAction;
		if (!load.channelId) return false;
		const entries = savedDeletionsForChannel(load.channelId).filter(canRestore);
		if (!entries.length) return false;
		const merged = mergeHistory(load, entries, prepare);
		if (!merged.supported || !merged.restored.length) return false;
		for (const e of merged.restored) {
			log.markDeleted(e.channelId, e.messageId);
			injected.set(e.messageId, { channelId: e.channelId, accountId: owner });
		}
		load.messages = merged.messages;
		return false;
	});
	const removeAccount = flux.onStoreChange(UserStore, reconcile);
	const removeArchive = subscribe(reconcile);
	return () => {
		active = false;
		removeHistory();
		removeAccount();
		removeArchive();
		injected.clear();
	};
}
