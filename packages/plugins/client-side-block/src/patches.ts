import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

import { isHiddenMessage, isHiddenRow, type GatewayMessage, type HideRules } from '~/lib/hidden';
import { keywordMatcher } from '~/lib/keywords';

type RelationshipStore = {
	isBlocked?(userId: string): boolean;
	isIgnored?(userId: string): boolean;
};

type ChatManagerInstance = { createRow(row: unknown): unknown };

type ChatManagerClass = { prototype?: ChatManagerInstance };

function createRules(): HideRules {
	const Relationships = flux.getStore('Relationship') as unknown as RelationshipStore;
	let keywords = { text: '', matches: keywordMatcher('') };

	return {
		isHidden: (userId: string) =>
			parseIdList(settings.users).includes(userId) ||
			Boolean(settings.ignored && Relationships.isIgnored?.(userId)) ||
			Boolean(Relationships.isBlocked?.(userId)),
		hidesContent: (content: string) => {
			if (keywords.text !== settings.keywords) {
				keywords = {
					text: settings.keywords,
					matches: keywordMatcher(settings.keywords),
				};
			}

			return keywords.matches(content);
		},
		get replies() {
			return settings.replies;
		},
	};
}

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

		const rules = createRules();

		patcher.instead(prototype, 'createRow', ({ args, original }) => {
			if (isHiddenRow(args[0] as Parameters<typeof isHiddenRow>[0], rules)) return;

			return original(...args);
		});
	});
}

/**
 * @description Drops new messages from hidden authors, with hidden keywords or replying to hidden authors before Discord
 * handles them, so they neither mark the channel unread nor leave an empty row at the bottom of the chat.
 * @returns A function that lets them through again.
 */
export function dropHiddenMessages(): () => void {
	const rules = createRules();
	const Users = flux.getStore('User');

	return flux.interceptAction('MESSAGE_CREATE', (action) =>
		isHiddenMessage(
			(action as { message?: GatewayMessage }).message,
			rules,
			Users.getCurrentUser?.()?.id,
		),
	);
}
