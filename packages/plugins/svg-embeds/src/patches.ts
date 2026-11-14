import type { NativeBridge } from '@unbound-app/api/native';
import { flux, fs, metro, patcher } from '@unbound-app/api';
import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { SVG_FOLDER } from '~/lib/folder';

import { entryFor, fileNameFor, setEntry } from '~/lib/cache';
import { rasterizeSvg } from '~/native/rasterize';
import { cleanSvg, isSvg, type Attachment } from '~/lib/svg';

const FILE_PREFIX = 'file://';
const CHANGE_TYPE_NONE = 0;
const CHANGE_TYPE_UPDATE = 2;

type AttachmentMessage = RowMessage & {
	id?: string;
	channel_id?: string;
	attachments?: Attachment[];
	set?: (key: 'attachments', value: Attachment[]) => AttachmentMessage;
};

type RowAttachment = { url?: string; isAnimated?: boolean; srcIsAnimated?: boolean };

type AttachmentRow = MessageRow & { attachments?: RowAttachment[] };

type MessageLookup = {
	getMessage?: (
		channelId: string,
		messageId: string,
	) => { content: string; author: unknown } | undefined;
};

type ChangeInput = { message?: { id?: string } };

const redraws = new Set<string>();
const waiting = new Map<string, Map<string, string>>();

function redraw(channelId: string, messageId: string): void {
	const store = flux.getStore('Message') as unknown as MessageLookup | undefined;
	const message = store?.getMessage?.(channelId, messageId);

	if (!message) return;

	redraws.add(messageId);
	void flux.dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: messageId,
			channel_id: channelId,
			content: message.content,
			author: message.author,
		},
	} as Parameters<typeof flux.dispatch>[0]);
}

function wait(url: string, channelId: string, messageId: string): void {
	const messages = waiting.get(url) ?? new Map<string, string>();

	messages.set(messageId, channelId);
	waiting.set(url, messages);
}

function redrawWaiting(url: string): void {
	for (const [messageId, channelId] of waiting.get(url) ?? []) redraw(channelId, messageId);

	waiting.delete(url);
}

async function draw(native: NativeBridge, url: string): Promise<void> {
	setEntry(url, { state: 'pending' });

	try {
		const response = await fetch(url);
		const markup = response.ok ? cleanSvg(await response.text()) : undefined;

		if (!markup) {
			setEntry(url, { state: 'failed' });
			waiting.delete(url);

			return;
		}

		const name = fileNameFor(url);

		await fs.writeFile(`${SVG_FOLDER}/${name}.svg`, markup);

		const png = `${fs.documentsPath}/${SVG_FOLDER}/${name}.png`;
		const raster = await rasterizeSvg(
			native,
			`${fs.documentsPath}/${SVG_FOLDER}/${name}.svg`,
			png,
		);

		setEntry(url, raster ? { state: 'ready', png, ...raster } : { state: 'failed' });

		if (raster) redrawWaiting(url);
		else waiting.delete(url);
	} catch (error) {
		logger.error(`Failed to draw the SVG ${url}:`, error);
		setEntry(url, { state: 'failed' });
		waiting.delete(url);
	}
}

function asImage(attachment: Attachment): Attachment {
	const entry = attachment.url ? entryFor(attachment.url) : undefined;

	if (entry?.state !== 'ready') return attachment;

	const url = `${FILE_PREFIX}${entry.png}`;

	return {
		...attachment,
		url,
		proxy_url: url,
		filename: (attachment.filename ?? 'image.svg').replace(/\.svg$/i, '.png'),
		content_type: 'image/png',
		width: entry.width,
		height: entry.height,
	};
}

/**
 * @description Shows SVG attachments as images: draws each one to a PNG once, then hands chat rows a copy of the message
 * whose attachment points at that PNG, so Discord's own media view draws it. Hooks `generateMessageRowData` before and
 * after it runs, and `determineChangeType` on Discord's `ChatManager` to redraw a row once its picture is ready.
 * @param native The plugin's native bridge.
 */
export function patchMessageRows(native: NativeBridge): void {
	onMessageRow<AttachmentMessage, AttachmentRow>({
		feature: 'SVG embeds',
		before({ input, message }) {
			const attachments = message?.attachments;

			if (!input || !attachments?.some(isSvg) || typeof message?.set !== 'function')
				return undefined;

			for (const attachment of attachments) {
				const { url } = attachment;

				if (!isSvg(attachment) || !url || !message.channel_id || !message.id) continue;

				const entry = entryFor(url);

				if (!entry || entry.state === 'pending') wait(url, message.channel_id, message.id);
				if (!entry) void draw(native, url);
			}

			const images = attachments.map((attachment) =>
				isSvg(attachment) ? asImage(attachment) : attachment,
			);

			return images.some((image, index) => image !== attachments[index])
				? { input: { ...input, message: message.set('attachments', images) } }
				: undefined;
		},
		after({ row }) {
			for (const attachment of row?.attachments ?? []) {
				if (
					attachment.url?.startsWith(`${FILE_PREFIX}${fs.documentsPath}/${SVG_FOLDER}/`)
				) {
					attachment.isAnimated = false;
					attachment.srcIsAnimated = false;
				}
			}
		},
	});

	const ChatManager = metro.findByName('ChatManager');

	if (typeof ChatManager?.prototype?.determineChangeType !== 'function') {
		logger.warn('SVG redraws skipped: Discord moved ChatManager.determineChangeType.');

		return;
	}

	patcher.after(ChatManager.prototype, 'determineChangeType', ({ args: [input], result }) => {
		const messageId = (input as ChangeInput | undefined)?.message?.id;

		if (result !== CHANGE_TYPE_NONE || !messageId || !redraws.delete(messageId)) return;

		return CHANGE_TYPE_UPDATE;
	});
}
