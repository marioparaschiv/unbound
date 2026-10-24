import type { NativeMessageInfo } from '@unbound-plugins/shared/native/message-info';
import type { NativeObjectHandle } from '@unbound-app/api/native';

import { createSurface, teardownSurface, updateSurface } from '~/native/surfaces';
import { findRenderedLinkRange, linkedTargets, targetKey } from '~/link-targets';
import { buildEmbeddedContent } from '~/embedded-content';
import { reactionSnapshot } from '~/reaction-state';
import type { Session } from '~/native/session';
import { linkedChannelName } from '~/channels';
import { readLabelText } from '~/native/objc';
import { MessageStore } from '~/modules';

/**
 * `embedded` attached a new embed, `retry` looks again shortly, and `waiting` looks again once the
 * linked message is fetched.
 */
export type CellStatus = 'embedded' | 'done' | 'retry' | 'waiting';

export type CellLookup = {
	key: string;
	cell: NativeObjectHandle;
	info: NativeMessageInfo | undefined;
	channelId: string | undefined;
	labels: NativeObjectHandle[];
};

/**
 * @description Embeds the first message a cell's message links to, or brings its existing embed up to date.
 * @param session The running session.
 * @param lookup The cell, its message, and its text labels.
 * @param isCurrent Tells whether the cell still shows the message this lookup started for.
 * @returns What the cell needs next.
 */
export async function embedCell(
	session: Session,
	{ key, cell, info, channelId, labels }: CellLookup,
	isCurrent: () => boolean,
): Promise<CellStatus> {
	if (!info || !channelId) return 'retry';

	const source = MessageStore.getMessage(channelId, info.messageId);
	const [target] = source ? linkedTargets(source) : [];
	const existing = session.surfaces.get(key);

	if (!source || !target) {
		if (existing && existing.messageId !== info.messageId) {
			teardownSurface(session, existing, true);
		}

		return source ? 'done' : 'retry';
	}

	const linked = session.linked.get(target);

	if (!linked) {
		session.cells.get(key)!.waitingFor = targetKey(target);
		session.linked.fetch(target);

		return 'waiting';
	}

	const channelName = linkedChannelName(target, linked);

	if (!channelName) return 'retry';

	if (existing?.messageId === info.messageId && existing.target.messageId === target.messageId) {
		const label = await readLabelText(session.objc, existing.label);

		if (!isCurrent()) return 'done';
		if (!label) return 'retry';
		if (label.text === existing.renderedText) return 'done';

		const range = findRenderedLinkRange(label.text, channelName);

		if (!range) return 'retry';

		updateSurface(session, existing, label.attributedText, range);

		return 'done';
	}

	if (existing) teardownSurface(session, existing, false);

	for (const label of labels) {
		const text = await readLabelText(session.objc, label);

		if (!isCurrent()) return 'done';
		if (!text) continue;

		const range = findRenderedLinkRange(text.text, channelName);

		if (!range) continue;

		const content = buildEmbeddedContent(session.renderers, linked, target.channelId);

		if (!content) return 'retry';

		const surface = await createSurface(
			session,
			{
				cell,
				cellKey: key,
				messageId: info.messageId,
				target,
				channelName,
				label,
				attributedText: text.attributedText,
				range,
				reactionSnapshot: reactionSnapshot(source.reactions),
				content,
			},
			isCurrent,
		);

		return surface ? 'embedded' : 'retry';
	}

	return 'retry';
}
