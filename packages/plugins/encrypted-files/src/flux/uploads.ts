import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { flux, toasts } from '@unbound-app/api';

import { contactIds, contactKey, encryptsIn, ownKeys } from '~/lib/keys';
import { seal } from '~/lib/envelope';
import { toBase64 } from '~/lib/key-text';

const MAX_BYTES = 25 * 1024 * 1024;
const EXTENSION = '.ufx';

type UploadFile = { uri: string; filename?: string };

type AddFilesAction = {
	channelId?: string;
	files?: UploadFile[];
};

type RecipientChannel = { recipients?: string[] };

function recipientsOf(channelId: string) {
	const channel = flux.getStore('Channel').getChannel(channelId) as RecipientChannel | undefined;
	const ids = channel?.recipients ?? contactIds();
	const keys = ids.flatMap((id) => {
		const key = contactKey(id);

		return key ? [{ id, key }] : [];
	});

	return { keys: keys.map(({ key }) => key), missing: ids.filter((id) => !contactKey(id)) };
}

async function encrypt(
	channelId: string,
	file: UploadFile,
	recipients: Uint8Array[],
	folder: string,
) {
	const response = await fetch(file.uri);
	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the file is over 25 MB');

	const name = file.filename ?? file.uri.split('/').pop() ?? 'file';
	const sealed = seal(bytes, name, ownKeys(), recipients);

	return attachFile(channelId, toBase64(sealed), {
		folder,
		filename: `${name}${EXTENSION}`,
		mimeType: 'application/octet-stream',
		encoding: 'base64',
	});
}

async function encryptAll(
	channelId: string,
	files: UploadFile[],
	recipients: Uint8Array[],
	folder: string,
) {
	let count = 0;

	for (const file of files) {
		try {
			if (await encrypt(channelId, file, recipients, folder)) count++;
		} catch (error) {
			logger.error(`Failed to encrypt ${file.filename ?? file.uri}:`, error);
			toasts.error('ENCRYPT_FAILED', { name: file.filename ?? 'file' }, error);
		}
	}

	if (count) toasts.success('ENCRYPTED', { count });
}

function isSealed(file: UploadFile): boolean {
	return (file.filename ?? '').toLowerCase().endsWith(EXTENSION);
}

/**
 * @description Encrypts files added in channels where encryption is on, for every recipient whose key is saved (every saved key in a server channel), and
 * attaches the encrypted copies instead. Files in other channels, and channels where no recipient has a key, go as usual.
 * @param folder The plugin's temporary folder, relative to the documents directory.
 * @returns A function that stops encrypting.
 */
export function encryptUploads(folder: string): () => void {
	return flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (raw) => {
		const action = raw as AddFilesAction;

		if (!action.channelId || !action.files?.length || action.files.every(isSealed))
			return false;
		if (!encryptsIn(action.channelId)) return false;

		const { keys, missing } = recipientsOf(action.channelId);

		if (!keys.length) {
			toasts.warning('NO_KEYS');

			return true;
		}

		if (missing.length) toasts.warning('SOME_WITHOUT_KEYS', { count: missing.length });

		void encryptAll(action.channelId, action.files, keys, folder);

		return true;
	});
}
