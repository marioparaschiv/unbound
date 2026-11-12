import { createLogger } from '@unbound-app/logger';

import { Messages as MessageActions } from '~/metro/api';
import { findByProps, findStore } from '~/metro/lookups';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';
import fs from '~/native/fs';

import formatDebugInfo, { type DebugInfo } from './format-debug-info';
import { readDebugInfo, readEntitlements } from './read-debug-info';
import { debugAltText, layoutDebugCard } from './debug-card';
import { renderDebugCard } from './render-debug-card';

type CloudUpload = {
	status: string;
	description?: string;
	upload(): Promise<void>;
};

type UploadFile = {
	path: string;
	mimeType: string;
	filename: string;
	width?: number;
	height?: number;
};

type SendResult = { ok?: boolean; status?: number } | undefined;

const ENTITLEMENTS_PATH = 'Unbound/cache/debug/Entitlements.xml';
const CARD_PATH = 'Unbound/cache/debug/unbound-debug.png';
const UPLOAD_ORIGIN_FILE = 1;
const UPLOAD_PLATFORM_REACT_NATIVE = 0;

const CloudUploader = findByProps('CloudUpload');
const SelectedChannelStore = findStore('SelectedChannel');
const Logger = createLogger('Diagnostics', 'DebugReport');

function selectedChannelId(): string | undefined {
	try {
		return SelectedChannelStore.getChannelId() ?? undefined;
	} catch {
		// The store is missing before Discord's flux stores load; the caller then has no channel.
		return undefined;
	}
}

function warnTextOnly() {
	show({
		title: messages.UNBOUND_DEBUG_INFO,
		content: messages.UNBOUND_DEBUG_ENTITLEMENTS_FAILED,
		icon: 'WarningIcon',
	});
}

async function uploadFile(channelId: string, file: UploadFile): Promise<CloudUpload | undefined> {
	if (!CloudUploader?.CloudUpload) {
		return undefined;
	}

	const uri = `file://${fs.documentsPath}/${file.path}`;
	const upload: CloudUpload = new CloudUploader.CloudUpload(
		{
			id: `unbound-debug-${file.filename}-${Date.now()}`,
			origin: UPLOAD_ORIGIN_FILE,
			uri,
			originalUri: uri,
			mimeType: file.mimeType,
			filename: file.filename,
			platform: UPLOAD_PLATFORM_REACT_NATIVE,
			createdUsingInAppCamera: false,
			progress: 0,
			...(file.width && file.height ? { width: file.width, height: file.height } : {}),
		},
		channelId,
		0,
		true,
	);

	await upload.upload();

	return upload.status === 'COMPLETED' ? upload : undefined;
}

async function uploadEntitlements(channelId: string): Promise<CloudUpload | undefined> {
	const plist = readEntitlements();

	if (!plist) {
		return undefined;
	}

	await fs.writeFile(ENTITLEMENTS_PATH, plist);

	return uploadFile(channelId, {
		path: ENTITLEMENTS_PATH,
		mimeType: 'application/xml',
		filename: 'Entitlements.xml',
	});
}

async function uploadCard(channelId: string, info: DebugInfo): Promise<CloudUpload | undefined> {
	const card = layoutDebugCard(info);

	await fs.writeFile(CARD_PATH, '');

	if (!renderDebugCard(card, `${fs.documentsPath}/${CARD_PATH}`)) {
		return undefined;
	}

	const upload = await uploadFile(channelId, {
		path: CARD_PATH,
		mimeType: 'image/png',
		filename: 'unbound-debug.png',
		width: card.width * card.scale,
		height: card.height * card.scale,
	});

	if (upload) {
		upload.description = debugAltText(info);
	}

	return upload;
}

function uploadQuietly(what: string, run: () => Promise<CloudUpload | undefined>) {
	return run().catch((cause: unknown) => {
		Logger.error(`Failed to attach the debug ${what}:`, cause);

		return undefined;
	});
}

/**
 * @description Sends the debug report as a rendered card whose alt text carries it as JSON, with the user's note and the app's entitlements on iOS; falls back to the text report when the card cannot be drawn.
 * @param channelId The channel the command ran in, or the open channel when it is not known.
 * @param note Text the user added to the command, sent as the message.
 * @returns The text for Discord to send when nothing could be attached, otherwise nothing once it is sent.
 */
export async function sendDebugReport(
	channelId?: string,
	note?: string,
): Promise<string | undefined> {
	const info = readDebugInfo();
	const message = note?.trim() ?? '';
	const target: string | undefined = channelId ?? selectedChannelId();
	const textReport = [message, formatDebugInfo(info)].filter(Boolean).join('\n\n');

	if (!target) {
		return textReport;
	}

	const card = await uploadQuietly('card', () => uploadCard(target, info));
	const entitlements = await uploadQuietly('entitlements', () => uploadEntitlements(target));
	const attachments = [card, entitlements].filter((upload): upload is CloudUpload =>
		Boolean(upload),
	);

	if (!attachments.length) {
		if (readEntitlements()) {
			warnTextOnly();
		}

		return textReport;
	}

	const result: SendResult = await MessageActions._sendMessage(
		target,
		{
			content: card ? message : textReport,
			tts: false,
			invalidEmojis: [],
			validNonShortcutEmojis: [],
		},
		{ attachmentsToUpload: attachments },
	);

	if (result?.ok === false) {
		warnTextOnly();

		return textReport;
	}

	return undefined;
}
