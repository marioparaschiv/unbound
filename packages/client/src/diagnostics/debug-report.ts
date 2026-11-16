import { createLogger } from '@unbound-app/logger';

import { Messages as MessageActions } from '~/metro/api';
import { findByProps, findStore } from '~/metro/lookups';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';
import fs from '~/native/fs';

import { rejectedField, withoutRejectedField } from './rejected-field';
import formatDebugInfo, { type DebugInfo } from './format-debug-info';
import { readDebugReport, readEntitlements } from './read-debug-info';
import { buildDiagnosticsZip } from './diagnostics-zip';

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

/** What `/debug` attaches beyond the card. */
export type DebugReportOptions = { diagnostics?: boolean };

type SendResult = { ok?: boolean; status?: number } | undefined;

const DIAGNOSTICS_PATH = 'Unbound/cache/debug/unbound-diagnostics.zip';
const CARD_DIRECTORY = 'Unbound/cache/debug';
const UPLOAD_ORIGIN_FILE = 1;
const UPLOAD_PLATFORM_REACT_NATIVE = 0;
const MAX_CARD_ATTEMPTS = 8;

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
		content: messages.UNBOUND_DEBUG_ATTACH_FAILED,
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

async function uploadDiagnostics(
	channelId: string,
	info: DebugInfo,
): Promise<CloudUpload | undefined> {
	const zip = await buildDiagnosticsZip({
		report: info,
		entitlements: readEntitlements() || undefined,
	});

	await fs.writeFile(DIAGNOSTICS_PATH, zip, 'base64');

	try {
		return await uploadFile(channelId, {
			path: DIAGNOSTICS_PATH,
			mimeType: 'application/zip',
			filename: `unbound-diagnostics-${Date.now()}.zip`,
		});
	} finally {
		await fs.removeFile(DIAGNOSTICS_PATH).catch(() => false);
	}
}

function requiredOnly(info: DebugInfo): DebugInfo {
	const {
		client,
		commit,
		loader,
		loaderOrigin,
		framework,
		discord,
		discordChannel,
		discordBuild,
	} = info;
	const { appSource, react, reactNative, hermes, bytecode, platform, os, device, flags } = info;

	return {
		client,
		commit,
		loader,
		loaderOrigin,
		framework,
		discord,
		discordChannel,
		discordBuild,
		appSource,
		react,
		reactNative,
		hermes,
		bytecode,
		platform,
		os,
		device,
		flags,
	};
}

async function drawCard(info: DebugInfo) {
	const { createUnboundClient } = await import('~/account/client');
	// The plist goes to the server alone, which reduces it to JSON in the alt text.
	const entitlements = readEntitlements() || undefined;
	const request = createUnboundClient();
	const required = new Set(Object.keys(requiredOnly(info)));
	let body: DebugInfo & { entitlements?: string } = { ...info, entitlements };

	for (let attempt = 0; attempt < MAX_CARD_ATTEMPTS; attempt++) {
		try {
			return await request('POST /api/v1/debug-cards', { body });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const next = withoutRejectedField(body, message, required);

			Logger.warn(
				`Failed to draw the debug card with ${rejectedField(message) ?? 'every field'}:`,
				error,
			);

			if (!next) {
				break;
			}

			body = next;
		}
	}

	return request('POST /api/v1/debug-cards', { body: requiredOnly(info) });
}

async function uploadCard(
	channelId: string,
	info: DebugInfo,
	path: string,
): Promise<CloudUpload | undefined> {
	const card = await drawCard(info);

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
 * @description Sends the debug report as a rendered card whose alt text carries it as JSON, with the user's note; falls back to the text report when the card cannot be drawn.
 * @param channelId The channel the command ran in, or the open channel when it is not known.
 * @param note Text the user added to the command, sent as the message.
 * @param options `diagnostics` attaches a zip of the loader's logs, scrubbed of secrets, its crash and addon state and the report, with the app's Entitlements.xml on iOS.
 * @returns The text for Discord to send when nothing could be attached, otherwise nothing once it is sent.
 */
export async function sendDebugReport(
	channelId?: string,
	note?: string,
	options: DebugReportOptions = {},
): Promise<string | undefined> {
	const info = await readDebugReport();
	const message = note?.trim() ?? '';
	const target: string | undefined = channelId ?? selectedChannelId();
	const textReport = [message, formatDebugInfo(info)].filter(Boolean).join('\n\n');

	if (!target) {
		return textReport;
	}

	const cardPath = `${CARD_DIRECTORY}/unbound-debug-${Date.now()}.png`;

	try {
		return await sendWithCard(target, info, cardPath, message, textReport, options);
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
	{ diagnostics = false }: DebugReportOptions,
): Promise<string | undefined> {
	const card = await uploadQuietly('card', () => uploadCard(target, info, cardPath));
	const diagnosticsZip = diagnostics
		? await uploadQuietly('diagnostics', () => uploadDiagnostics(target, info))
		: undefined;
	const attachments = [card, diagnosticsZip].filter((upload): upload is CloudUpload =>
		Boolean(upload),
	);

	if (!attachments.length) {
		if (diagnostics) {
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
