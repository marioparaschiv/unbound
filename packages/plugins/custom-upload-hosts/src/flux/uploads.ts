import { settings } from '@unbound-app/settings';
import { flux, metro, toasts } from '@unbound-app/api';

import { hostFor, readLink, type Host, type HostSettings } from '~/lib/hosts';
import { mimeTypeOf } from '~/lib/mime-types';

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

async function uploadAll(host: Host, action: AddFilesAction) {
	const files = action.files ?? [];
	const progress = toasts.info('UPLOADING', { count: files.length }, { duration: 0 });

	try {
		const links: string[] = [];

		for (const file of files) links.push(await upload(host, file));

		insertLinks(action.channelId!, links);
		toasts.success('UPLOADED', { count: links.length });
	} catch (error) {
		logger.error(`Failed to upload ${files.length} files to ${host.url}:`, error);
		toasts.warning('UPLOAD_FAILED');
		void flux.dispatch({ ...action, customUploadHostsHandled: true });
	} finally {
		progress.close();
	}
}

/**
 * @description Sends the files you attach to the chosen upload host instead of Discord, and puts their links in the
 * chat input. If an upload fails the files are attached to Discord as usual.
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

		void uploadAll(host, action);

		return true;
	});
}

export default { interceptUploads };
