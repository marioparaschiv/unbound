import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

import { isHiddenRow } from '~/lib/hidden';

type RelationshipStore = {
	isBlocked?(userId: string): boolean;
	isIgnored?(userId: string): boolean;
};

type ChatManagerInstance = { createRow(row: unknown): unknown };

type ChatManagerClass = { prototype?: ChatManagerInstance };

/**
 * @description Hides the rows of blocked, ignored and hand-picked users and replies to them. Patches `createRow` on Discord's
 * `ChatManager`, which builds every row of the open chat again each time the chat changes, so hiding or showing someone
 * applies at the chat's next update.
 */
export function patchChatRows(): void {
	if (!metro.findByName('ChatManager')) {
		logger.warn('Client side block skipped: Discord moved ChatManager.');

		return;
	}

	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		const { prototype } = ChatManager;

		if (typeof prototype?.createRow !== 'function') {
			logger.warn('Client side block skipped: Discord moved ChatManager.createRow.');

			return;
		}

		const Relationships = flux.getStore('Relationship') as unknown as RelationshipStore;
		const rules = {
			isHidden: (userId: string) =>
				parseIdList(settings.users).includes(userId) ||
				Boolean(settings.ignored && Relationships.isIgnored?.(userId)) ||
				Boolean(Relationships.isBlocked?.(userId)),
			get replies() {
				return settings.replies;
			},
		};

		patcher.instead(prototype, 'createRow', ({ args, original }) => {
			if (isHiddenRow(args[0] as Parameters<typeof isHiddenRow>[0], rules)) return;

			return original(...args);
		});
	});
}
