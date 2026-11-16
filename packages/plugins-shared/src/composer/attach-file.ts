import { fs, metro } from '@unbound-app/api';

type UploadFile = {
	uri: string;
	originalUri: string;
	filename: string;
	mimeType: string;
	platform: number;
	id: string;
	width?: number;
	height?: number;
};

type UploadActions = {
	addFile(upload: { channelId: string; draftType: number; file: UploadFile }): void;
};

type UploadModule = { UploadPlatform?: { REACT_NATIVE?: number } };

type DraftModule = { DraftType?: { ChannelMessage?: number } };

export type AttachOptions = {
	folder: string;
	filename: string;
	mimeType: string;
	encoding?: 'utf8' | 'base64';
	size?: { width: number; height: number };
};

/**
 * @description Writes content to a file in a plugin's temporary folder and adds it to a channel's attachments, as if
 * picked from the attachment menu.
 * @param channelId The channel whose chat input gets the file.
 * @param content The file's contents: text, or base64 with `encoding: 'base64'`.
 * @param options Where to write it, its name, type and encoding, and an image's size.
 * @returns Whether Discord's upload actions were found and the file was added.
 */
export async function attachFile(
	channelId: string,
	content: string,
	{ folder, filename, mimeType, encoding = 'utf8', size }: AttachOptions,
): Promise<boolean> {
	const uploads = metro.findByProps('addFile', 'popFirstFile') as UploadActions | undefined;

	if (!uploads) return false;

	const path = `${folder}/${Date.now()}/${filename}`;
	const uri = `file://${fs.documentsPath}/${path}`;
	const platform = (metro.findByProps('UploadPlatform') as UploadModule | undefined)
		?.UploadPlatform;
	const drafts = (metro.findByProps('DraftType') as DraftModule | undefined)?.DraftType;

	await fs.writeFile(path, content, encoding);
	uploads.addFile({
		channelId,
		draftType: drafts?.ChannelMessage ?? 0,
		file: {
			uri,
			originalUri: uri,
			filename,
			mimeType,
			platform: platform?.REACT_NATIVE ?? 0,
			id: path,
			...size,
		},
	});

	return true;
}

export default { attachFile };
