import { afterEach, describe, expect, mock, test } from 'bun:test';

type UploadItem = { uri?: string };

let loaded: ((mdl: MetroExport) => void) | null = null;

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ warn: () => undefined }),
}));

mock.module('~/metro/filters', () => ({ byProps: () => () => true }));
mock.module('~/metro/wait', () => ({
	onModuleLoaded: (_filter: () => boolean, callback: (mdl: MetroExport) => void) => {
		loaded = callback;

		return () => void (loaded = null);
	},
}));

const { start, stop } = await import('~/builtins/upload-path-guard');

const APP_FILE = 'file:///private/var/mobile/Containers/Data/Application/A/tmp/x-Inbox/';

function loadAttachmentFile() {
	const AttachmentFile = { canUploadNatively: (item: UploadItem) => Boolean(item.uri) };

	start();
	loaded?.(AttachmentFile);

	return AttachmentFile;
}

afterEach(() => {
	stop();
	loaded = null;
});

describe('upload path guard', () => {
	test('sends a percent-escaped file URI through the JS uploader', () => {
		const AttachmentFile = loadAttachmentFile();

		expect(AttachmentFile.canUploadNatively({ uri: `${APP_FILE}NETT%20-%20IM.mp3` })).toBe(
			false,
		);
	});

	test('keeps native uploads for plain file URIs', () => {
		const AttachmentFile = loadAttachmentFile();

		expect(AttachmentFile.canUploadNatively({ uri: `${APP_FILE}nett.mp3` })).toBe(true);
		expect(AttachmentFile.canUploadNatively({})).toBe(false);
	});

	test('restores Discord’s check when stopped', () => {
		const AttachmentFile = loadAttachmentFile();

		stop();

		expect(AttachmentFile.canUploadNatively({ uri: `${APP_FILE}a%20b.mp3` })).toBe(true);
	});
});
