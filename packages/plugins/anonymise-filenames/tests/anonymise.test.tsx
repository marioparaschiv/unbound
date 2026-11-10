import { logs, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { View } from 'react-native';

import { selfTest } from '~/index';
import { UPLOAD_PREVIEW_SHEET } from '~/constants';

type Upload = { id: string; filename: string };

class CloudUpload {
	constructor(
		public id: string,
		public filename: string,
	) {}

	upload() {
		return this.filename;
	}
}

const Messages = {
	sendMessage: () => {},
	receiveMessage: () => {},
	_sendMessage(_channelId: string, _message: object, options: { attachmentsToUpload: Upload[] }) {
		return options.attachmentsToUpload.map((upload) => upload.filename);
	},
};

function Row(_props: { label: string; onPress: () => void }) {
	return <View />;
}

function UploadPreviewActionSheet({ upload }: { upload: Upload }) {
	return <View>{[<Row key='remove' label={upload.filename} onPress={() => undefined} />]}</View>;
}

const sheet = { default: UploadPreviewActionSheet };

// The preset forgets registered modules before each test, so each test registers them again.
function registerModules(sheetModule: object) {
	metro.register({ CloudUpload });
	metro.register(Messages);
	metro.register(sheetModule, UPLOAD_PREVIEW_SHEET);
}

describe('anonymising uploads', () => {
	beforeEach(async () => {
		registerModules(sheet);
		await startPlugin();
	});

	test('Discord starts an upload under an anonymous name that keeps the extension', () => {
		settings.method = 'consistent';

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('image.png');
	});

	test('keeps the original name while anonymising by default is off', () => {
		settings.anonymiseByDefault = false;

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('passport scan.png');
	});

	test('names attachments anonymously as the message is sent', () => {
		settings.method = 'consistent';
		settings.consistent = 'photo';

		expect(
			Messages._sendMessage(
				'1',
				{},
				{ attachmentsToUpload: [{ id: '1', filename: 'IMG_1.jpg' }] },
			),
		).toEqual(['photo.jpg']);
	});

	test('names a file once across the upload and the send', () => {
		settings.method = 'timestamp';

		const upload = new CloudUpload('1', 'IMG_1.jpg');

		upload.upload();
		const named = upload.filename;

		expect(Messages._sendMessage('1', {}, { attachmentsToUpload: [upload] })).toEqual([named]);
		expect(named).toMatch(/^\d+\.jpg$/);
	});

	test('stops renaming once the plugin stops', async () => {
		await stopPlugin();
		settings.method = 'consistent';

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('passport scan.png');
	});
});

describe('the upload preview sheet', () => {
	beforeEach(async () => {
		registerModules(sheet);
		await startPlugin();
	});

	function renderSheet(upload: Upload) {
		const Sheet = sheet.default;

		return render(<Sheet upload={upload} />);
	}

	test('shows an anonymise switch that is on by default', () => {
		const row = renderSheet({ id: '1', filename: 'passport scan.png' }).find(
			'ActionSheetSwitchRow',
		);

		expect(row.props.label).toBe('Anonymise File Name');
		expect(row.props.subLabel).toBe('Using an anonymous file name');
		expect(row.props.value).toBe(true);
	});

	test('starts off when anonymising by default is off', () => {
		settings.anonymiseByDefault = false;

		const row = renderSheet({ id: '1', filename: 'a.png' }).find('ActionSheetSwitchRow');

		expect(row.props.value).toBe(false);
		expect(row.props.subLabel).toBe('Using the original file name');
	});

	test('switching a file off keeps its original name when it uploads', () => {
		const view = renderSheet({ id: '1', filename: 'holiday.png' });

		view.act(() => view.find('ActionSheetSwitchRow').props.onValueChange?.(false));

		expect(view.find('ActionSheetSwitchRow').props.value).toBe(false);
		expect(new CloudUpload('1', 'holiday.png').upload()).toBe('holiday.png');
		expect(new CloudUpload('2', 'holiday.png').upload()).not.toBe('holiday.png');
	});
});

describe('the plugin as a whole', () => {
	test('reports every patch applied to the self test', async () => {
		registerModules(sheet);
		await startPlugin();

		expect((await selfTest()).ok).toBe(true);
	});

	test('keeps anonymising uploads when the preview sheet has an unexpected shape', async () => {
		registerModules({ default: 'not a component' });
		await startPlugin();

		expect(new CloudUpload('1', 'passport scan.png').upload()).not.toBe('passport scan.png');
		expect((await selfTest()).detail).toContain('start failed');
	});

	test("logs a failed patch through the plugin's logger", async () => {
		registerModules({ default: 'not a component' });
		await startPlugin();

		expect(logs.entries.map(({ args }) => args[0])).toContain('Failed to start a feature:');
	});

	test('sends files under their original names again once the plugin stops', async () => {
		registerModules(sheet);
		await startPlugin();
		await stopPlugin();

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('passport scan.png');
	});
});
