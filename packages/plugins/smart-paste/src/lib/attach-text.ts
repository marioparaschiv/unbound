import { fs, metro } from '@unbound-app/api';

type UploadActions = {
	addFile(upload: { channelId: string; draftType: number; file: UploadFile }): void;
};

type UploadFile = {
	uri: string;
	originalUri: string;
	filename: string;
	mimeType: string;
	platform: number;
	id: string;
};

type UploadModule = { UploadPlatform?: { REACT_NATIVE?: number } };

type DraftModule = { DraftType?: { ChannelMessage?: number } };

/**
 * @description Writes text to a file in the plugin's temporary folder and adds it to the channel's attachments, as if
 * picked from the attachment menu.
 * @param channelId The channel whose chat input gets the file.
 * @param text The file's contents.
 * @param options Where to write it and the name it is sent under.
 * @returns Whether Discord's upload actions were found and the file was added.
 */
export async function attachText(
	channelId: string,
	text: string,
	{ folder, filename }: { folder: string; filename: string },
): Promise<boolean> {
	const uploads = metro.findByProps('addFile', 'popFirstFile') as UploadActions | undefined;

	if (!uploads) return false;

	const path = `${folder}/${Date.now()}-${filename}`;
	const uri = `file://${fs.documentsPath}/${path}`;
	const platform = (metro.findByProps('UploadPlatform') as UploadModule | undefined)
		?.UploadPlatform;
	const drafts = (metro.findByProps('DraftType') as DraftModule | undefined)?.DraftType;

	await fs.writeFile(path, text);
	uploads.addFile({
		channelId,
		draftType: drafts?.ChannelMessage ?? 0,
		file: {
			uri,
			originalUri: uri,
			filename,
			mimeType: 'text/plain',
			platform: platform?.REACT_NATIVE ?? 0,
			id: path,
		},
	});

	return true;
}

export default { attachText };
