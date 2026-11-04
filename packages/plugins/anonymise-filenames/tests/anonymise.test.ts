import { metro } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import { createUploadChoices } from '~/anonymise/uploads';
import { patchCloudUpload } from '~/anonymise/cloud-upload';
import { patchSend } from '~/anonymise/send';

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

function sendMessage(
	_channelId: string,
	_message: object,
	options: { attachmentsToUpload: Upload[] },
) {
	return options.attachmentsToUpload.map((upload) => upload.filename);
}

describe('anonymising uploads', () => {
	test('Discord starts an upload under an anonymous name that keeps the extension', () => {
		metro.register({ CloudUpload });
		settings.method = 'consistent';
		patchCloudUpload(createUploadChoices(() => settings));

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('image.png');
	});

	test('keeps the original name while anonymising by default is off', () => {
		metro.register({ CloudUpload });
		settings.anonymiseByDefault = false;
		patchCloudUpload(createUploadChoices(() => settings));

		expect(new CloudUpload('1', 'passport scan.png').upload()).toBe('passport scan.png');
	});

	test('a file switched on in its preview sheet is anonymised even with the default off', () => {
		const choices = createUploadChoices(() => settings);

		metro.register({ CloudUpload });
		settings.anonymiseByDefault = false;
		patchCloudUpload(choices);

		const upload = new CloudUpload('1', 'holiday.tar.gz');

		choices.setAnonymised(upload, true);
		settings.method = 'consistent';

		expect(upload.upload()).toBe('image.tar.gz');
	});

	test('names attachments anonymously as the message is sent', () => {
		const Messages = {
			sendMessage: () => {},
			receiveMessage: () => {},
			_sendMessage: sendMessage,
		};

		metro.register(Messages);
		settings.method = 'consistent';
		settings.consistent = 'photo';
		patchSend(createUploadChoices(() => settings));

		expect(
			Messages._sendMessage(
				'1',
				{},
				{ attachmentsToUpload: [{ id: '1', filename: 'IMG_1.jpg' }] },
			),
		).toEqual(['photo.jpg']);
	});

	test('names a file once across the upload and the send', () => {
		const Messages = {
			sendMessage: () => {},
			receiveMessage: () => {},
			_sendMessage: sendMessage,
		};
		const choices = createUploadChoices(() => settings, { random: () => 0, now: () => 1 });

		metro.register({ CloudUpload });
		metro.register(Messages);
		settings.method = 'timestamp';
		patchCloudUpload(choices);
		patchSend(choices);

		const upload = new CloudUpload('1', 'IMG_1.jpg');

		upload.upload();

		expect(Messages._sendMessage('1', {}, { attachmentsToUpload: [upload] })).toEqual([
			upload.filename,
		]);
		expect(upload.filename).toMatch(/^\d+\.jpg$/);
	});
});
