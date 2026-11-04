import { format, messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import {
	getAssetUrl,
	getStickerFile,
	type Emoji,
	type Expression,
	type Sticker,
} from '~/expression-actions/expression';
import { Auth, EmojiActions, UserStore } from '~/expression-actions/modules';
import { getErrorMessage } from '~/expression-actions/errors';
import type { Guild } from '~/expression-actions/guilds';
import { notify } from '~/expression-actions/notify';

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
		throw new Error(format('COULD_NOT_FETCH', { name: emoji.name }));
	}

	const blob = await response.blob();
	const reader = new FileReader();

	return new Promise((resolve, reject) => {
		reader.onerror = () => reject(reader.error ?? new Error(messages.COULD_NOT_READ_FILE));
		// `readAsDataURL` always produces a string result.
		reader.onload = () => resolve(reader.result as string);
		reader.readAsDataURL(blob);
	});
}

async function uploadEmoji(emoji: Emoji, guild: Guild, name: string): Promise<void> {
	if (!EmojiActions.uploadEmoji) {
		throw new Error(messages.EMOJI_UPLOADS_UNAVAILABLE);
	}

	await EmojiActions.uploadEmoji({ guildId: guild.id, image: await readDataUrl(emoji), name });
}

function postSticker(guild: Guild, form: FormData, token: string): Promise<StickerResponse> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();

		request.open('POST', `https://discord.com/api/v10/guilds/${guild.id}/stickers`);
		request.setRequestHeader('Authorization', token);
		request.onerror = () => reject(new Error(messages.STICKER_UPLOAD_FAILED));
		request.onload = () => {
			let body: StickerResponse;

			try {
				body = JSON.parse(request.responseText);
			} catch {
				reject(new Error(messages.STICKER_UPLOAD_INVALID_RESPONSE));

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
		throw new Error(messages.STICKER_UPLOADS_UNAVAILABLE);
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

	void flux.dispatch({
		type: 'GUILD_STICKERS_CREATE_SUCCESS',
		guildId: guild.id,
		sticker: { ...body, user: UserStore.getCurrentUser() },
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

	notify(format('CLONED', { name: expression.name, guild: guild.name }));
}

export default cloneExpression;
