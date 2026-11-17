import { settings } from '@unbound-app/settings';
import { flux, metro, toasts } from '@unbound-app/api';

import { hostFor, readLink, type Host, type HostSettings } from '~/lib/hosts';
import { mimeTypeOf } from '~/lib/mime-types';
import { hostThreshold, splitBySize } from '~/lib/threshold';

type UploadFile = { uri: string; filename?: string; mimeType?: string };

type AddFilesAction = {
	type: string;
	channelId?: string;
	files?: UploadFile[];
	customUploadHostsHandled?: boolean;
};

type ChatInput = { insertText?: (text: string) => void };

type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};

type FileSizes = { getFileSize?: (uri: string) => Promise<number> };
type UploadLimits = { maxFileSize?: (guildId: string | null) => number };
type ThresholdSettings = { uploadWhen: string; minSizeMB: number };

const FileInfo: FileSizes | undefined = metro.findByProps('getFileSize', { lazy: true });
const Limits: UploadLimits | undefined = metro.findByProps('maxFileSize', 'sizeString', {
	lazy: true,
});

async function sizeOf(file: UploadFile): Promise<number | undefined> {
	try {
		const size = await FileInfo?.getFileSize?.(file.uri);

		return typeof size === 'number' && size >= 0 ? size : undefined;
	} catch (error) {
		logger.warn(`Failed to read the size of ${file.uri}:`, error);

		return undefined;
	}
}

function channelLimit(channelId: string): number | undefined {
	const channel = flux.getStore('Channel').getChannel(channelId) as
		| { guild_id?: string }
		| undefined;
	const limit = Limits?.maxFileSize?.(channel?.guild_id ?? null);

	return typeof limit === 'number' && limit > 0 ? limit : undefined;
}

async function upload(host: Host, file: UploadFile): Promise<string> {
	const form = new FormData();
	const name = file.filename ?? file.uri.split('/').pop() ?? 'file';

	for (const [key, value] of Object.entries(host.fields)) form.append(key, value);

	form.append(host.fileField, {
		uri: file.uri,
		name,
		type: file.mimeType ?? mimeTypeOf(name),
	} as never);

	const response = await fetch(host.url, {
		method: 'POST',
		headers: host.headers,
		body: form as never,
	});
	const body = await response.text();
	const link = response.ok ? readLink(body, host) : undefined;

	if (!link) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);

	return link;
}

function insertLinks(channelId: string, links: string[]) {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputRegistry
		| undefined;

	registry?.getBestActiveInputForChannelId?.(channelId)?.insertText?.(`${links.join('\n')} `);
}

async function uploadAll(host: Host, action: AddFilesAction, files: UploadFile[]) {
	const progress = toasts.info('UPLOADING', { count: files.length }, { duration: 0 });

	try {
		const links: string[] = [];

		for (const file of files) links.push(await upload(host, file));

		insertLinks(action.channelId!, links);
		toasts.success('UPLOADED', { count: links.length });
	} catch (error) {
		logger.error(`Failed to upload ${files.length} files to ${host.url}:`, error);
		toasts.warning('UPLOAD_FAILED');
		attachToDiscord(action, files);
	} finally {
		progress.close();
	}
}

function attachToDiscord(action: AddFilesAction, files: UploadFile[]) {
	if (files.length) void flux.dispatch({ ...action, files, customUploadHostsHandled: true });
}

async function route(host: Host, action: AddFilesAction, threshold: number) {
	const files = action.files ?? [];
	const sized = await Promise.all(
		files.map(async (file) => ({ file, size: await sizeOf(file) })),
	);
	const { hosted, attached } = splitBySize(sized, threshold);

	attachToDiscord(action, attached);

	if (hosted.length) await uploadAll(host, action, hosted);
}

/**
 * @description Sends the files you attach to the chosen upload host instead of Discord, all of them or only those over a
 * size or the channel's upload limit, and puts their links in the chat input. Smaller files, and any whose upload fails,
 * are attached to Discord as usual.
 */
export function interceptUploads(): void {
	flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (raw) => {
		const action = raw as AddFilesAction;
		const host = hostFor(settings as unknown as HostSettings);

		if (action.customUploadHostsHandled || !action.channelId || !action.files?.length)
			return false;

		if (!host) {
			toasts.warning('NO_HOST');

			return false;
		}

		const { uploadWhen, minSizeMB } = settings as unknown as ThresholdSettings;
		const threshold = hostThreshold(uploadWhen, minSizeMB, channelLimit(action.channelId));

		if (threshold === undefined) return false;

		if (threshold === 0) {
			void uploadAll(host, action, action.files);

			return true;
		}

		void route(host, action, threshold);

		return true;
	});
}

export default { interceptUploads };
