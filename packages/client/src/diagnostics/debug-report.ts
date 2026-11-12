import { createLogger } from '@unbound-app/logger';

import { Messages as MessageActions } from '~/metro/api';
import { findByProps, findStore } from '~/metro/lookups';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';
import fs from '~/native/fs';

import { readAccessibility, readDebugInfo, readEntitlements } from './read-debug-info';
import formatDebugInfo, { type DebugInfo } from './format-debug-info';
import { crashLogExcerpt } from './crash-report';

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

/** What `/debug` attaches beyond the card and entitlements. */
export type DebugReportOptions = { log?: boolean };

type SendResult = { ok?: boolean; status?: number } | undefined;

const ENTITLEMENTS_PATH = 'Unbound/cache/debug/Entitlements.xml';
const LOG_PATH = 'Unbound/cache/debug/unbound.log';
const LOADER_LOG = 'Unbound/Logs/unbound.log';
const CARD_DIRECTORY = 'Unbound/cache/debug';
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

async function uploadLog(channelId: string): Promise<CloudUpload | undefined> {
	const log = (await fs.exists(LOADER_LOG)) ? await fs.readFile(LOADER_LOG) : '';
	const excerpt = crashLogExcerpt(log);

	if (!excerpt) {
		return undefined;
	}

	await fs.writeFile(LOG_PATH, excerpt);

	return uploadFile(channelId, {
		path: LOG_PATH,
		mimeType: 'text/plain',
		filename: 'unbound.log',
	});
}

async function uploadCard(
	channelId: string,
	info: DebugInfo,
	path: string,
): Promise<CloudUpload | undefined> {
	const { createUnboundClient } = await import('~/account/client');
	const card = await createUnboundClient()('POST /api/v1/debug-cards', { body: info });

	await fs.writeFile(path, card.image, 'base64');

	const upload = await uploadFile(channelId, {
		path,
		mimeType: 'image/png',
		filename: path.slice(path.lastIndexOf('/') + 1),
		width: card.width,
		height: card.height,
	});

	if (upload) {
		upload.description = card.altText;
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
 * @param options `log` attaches the newest loader log lines, scrubbed of secrets.
 * @returns The text for Discord to send when nothing could be attached, otherwise nothing once it is sent.
 */
export async function sendDebugReport(
	channelId?: string,
	note?: string,
	{ log = false }: DebugReportOptions = {},
): Promise<string | undefined> {
	const base = readDebugInfo();
	const info: DebugInfo = base.display
		? { ...base, display: { ...base.display, ...(await readAccessibility()) } }
		: base;
	const message = note?.trim() ?? '';
	const target: string | undefined = channelId ?? selectedChannelId();
	const textReport = [message, formatDebugInfo(info)].filter(Boolean).join('\n\n');

	if (!target) {
		return textReport;
	}

	const cardPath = `${CARD_DIRECTORY}/unbound-debug-${Date.now()}.png`;

	try {
		return await sendWithCard(target, info, cardPath, message, textReport, log);
	} finally {
		await fs.removeFile(cardPath).catch(() => false);
	}
}

async function sendWithCard(
	target: string,
	info: DebugInfo,
	cardPath: string,
	message: string,
	textReport: string,
	log: boolean,
): Promise<string | undefined> {
	const card = await uploadQuietly('card', () => uploadCard(target, info, cardPath));
	const entitlements = await uploadQuietly('entitlements', () => uploadEntitlements(target));
	const logFile = log ? await uploadQuietly('log', () => uploadLog(target)) : undefined;
	const attachments = [card, entitlements, logFile].filter((upload): upload is CloudUpload =>
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
