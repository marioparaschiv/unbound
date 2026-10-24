import {
	getAssetUrl,
	getStickerFile,
	type Emoji,
	type Expression,
	type Sticker,
} from '~/expression';
import { Auth, Dispatcher, EmojiActions, Users } from '~/modules';
import { getErrorMessage } from '~/errors';
import type { Guild } from '~/guilds';
import { notify } from '~/notify';

type StickerResponse = {
	message?: string;
};

type FilePart = {
	name: string;
	type: string;
	uri: string;
};

async function readDataUrl(emoji: Emoji): Promise<string> {
	const response = await fetch(getAssetUrl(emoji));

	if (!response.ok) {
		throw new Error(`Could not fetch ${emoji.name}.`);
	}

	const blob = await response.blob();
	const reader = new FileReader();

	return new Promise((resolve, reject) => {
		reader.onerror = () =>
			reject(reader.error ?? new Error('Could not read the expression file.'));
		// `readAsDataURL` always produces a string result.
		reader.onload = () => resolve(reader.result as string);
		reader.readAsDataURL(blob);
	});
}

async function uploadEmoji(emoji: Emoji, guild: Guild, name: string): Promise<void> {
	if (!EmojiActions.uploadEmoji) {
		throw new Error('Emoji uploads are unavailable on this client build.');
	}

	await EmojiActions.uploadEmoji({ guildId: guild.id, image: await readDataUrl(emoji), name });
}

function postSticker(guild: Guild, form: FormData, token: string): Promise<StickerResponse> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();

		request.open('POST', `https://discord.com/api/v10/guilds/${guild.id}/stickers`);
		request.setRequestHeader('Authorization', token);
		request.onerror = () => reject(new Error('Sticker upload failed.'));
		request.onload = () => {
			let body: StickerResponse;

			try {
				body = JSON.parse(request.responseText);
			} catch {
				reject(new Error('Sticker upload returned an invalid response.'));

				return;
			}

			if (request.status >= 200 && request.status < 300) {
				resolve(body);
			} else {
				reject(new Error(getErrorMessage({ body })));
			}
		};

		request.send(form);
	});
}

async function uploadSticker(sticker: Sticker, guild: Guild, name: string): Promise<void> {
	const token = Auth.getToken?.();

	if (!token) {
		throw new Error('Sticker uploads are unavailable on this client build.');
	}

	const { extension, mimeType } = getStickerFile(sticker.formatType);
	const form = new FormData();

	form.append('name', name);
	form.append('tags', sticker.tags || name);
	form.append('description', sticker.description);

	const file: FilePart = {
		name: `${name}.${extension}`,
		type: mimeType,
		uri: `https://cdn.discordapp.com/stickers/${sticker.id}.${extension}`,
	};

	// React Native uploads a `{ uri, name, type }` part by downloading `uri`; the DOM typings only know `Blob`.
	form.append('file', file as never);

	const body = await postSticker(guild, form, token);

	Dispatcher.dispatch({
		type: 'GUILD_STICKERS_CREATE_SUCCESS',
		guildId: guild.id,
		sticker: { ...body, user: Users.getCurrentUser() },
	});
}

/**
 * @description Uploads a copy of an emoji or sticker to a server the user owns, then confirms with a toast.
 * @param expression The emoji or sticker to copy.
 * @param guild The server to upload it to.
 * @param name The name to give the copy.
 * @returns A promise that rejects with Discord's error when the upload fails.
 */
export async function cloneExpression(
	expression: Expression,
	guild: Guild,
	name: string,
): Promise<void> {
	if (expression.kind === 'emoji') {
		await uploadEmoji(expression, guild, name);
	} else {
		await uploadSticker(expression, guild, name);
	}

	notify(`Cloned ${expression.name} to ${guild.name}.`);
}

export default cloneExpression;
