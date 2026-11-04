import { flux, metro, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { StoreSeeds } from '@unbound-app/api/testing';

const file = { id: 'f', filename: 'cat.png', uri: 'file:///cat.png' };
const message = {
	id: 'm1',
	channel_id: 'c1',
	type: 0,
	author: { id: 'me' },
	attachments: [{ id: '9' }],
};

function stores(editing: unknown = message): StoreSeeds {
	return {
		EditMessage: { getEditingMessage: () => editing },
		Message: { getMessage: () => message },
		User: { getCurrentUser: () => ({ id: 'me' }) },
		Channel: { getChannel: () => ({ id: 'c1', isPrivate: () => true }) },
	};
}

async function dropFile(seeds: StoreSeeds) {
	flux.seed(seeds);
	await startPlugin();
	const action = { type: 'UPLOAD_ATTACHMENT_ADD_FILES', channelId: 'c1', files: [file] };

	await flux.dispatch(action);
	// The upload and the edit settle on later ticks.
	await new Promise((resolve) => setTimeout(resolve, 0));
}

const patched: unknown[] = [];

class CloudUpload {
	status = 'COMPLETED';
	uploadedFilename: string;
	filename: string;

	constructor(item: { filename: string }) {
		this.filename = item.filename;
		this.uploadedFilename = `cdn-${item.filename}`;
	}

	async upload() {}
}

beforeEach(() => {
	patched.length = 0;
	metro.register({ CloudUpload });
	metro.register({ launchImageLibraryAsync: async () => ({ assets: [] }) });
	metro.register({
		getAPIBaseURL: () => '',
		patch: async (request: unknown) => patched.push(request),
	});
});

describe('files added while editing a message', () => {
	test('join the edited message and keep its attachments', async () => {
		await dropFile(stores());

		expect(patched).toMatchObject([
			{
				url: '/channels/c1/messages/m1',
				body: {
					attachments: [
						{ id: '9' },
						{ id: '0', filename: 'cat.png', uploaded_filename: 'cdn-cat.png' },
					],
				},
			},
		]);
		expect(toasts.shown.map((toast) => toast.content)).toEqual([
			'Uploading, this can take a while...',
			'Attachment added successfully!',
		]);
	});

	test('are left for the next message when nothing is being edited', async () => {
		await dropFile(stores(null));

		expect(patched).toEqual([]);
		expect(toasts.shown).toEqual([]);
	});

	test('are refused when someone else wrote the message', async () => {
		await dropFile(stores({ ...message, author: { id: 'them' } }));

		expect(patched).toEqual([]);
	});
});
