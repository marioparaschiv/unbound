// Each function here runs on the device through `toDeviceCode`, so none may reach outside its own body.
import type { DevicePrelude } from '~/lib/device-prelude';

/** How a local message looks while it sends: Discord's `state` for it. */
export type LocalMessageState = 'sent' | 'sending' | 'failed';

/** A local message to add: where, from whom, what it says and how far it got. */
export type LocalMessageInput = {
	channelId: string | null;
	author: string;
	content: string;
	attachment: string | null;
	state: LocalMessageState;
};

/** What `ubd debug message` reports about the messages it added or removed. */
export type LocalMessageResult = { channelId: string; ids: string[] };

/**
 * @description Shows a message only on the device, as if it arrived or were being sent, without telling Discord's
 * servers. The ids it adds are kept on the device so `removeLocalMessages` can take them away again.
 * @param device The device prelude.
 * @param input The channel (the open one when `null`), the author (`me`, `clyde` or a user id), the text, an
 * attachment URL and the sending state.
 * @returns The channel and the new message's id.
 */
export function addLocalMessage(
	{ unbound }: DevicePrelude,
	{ channelId, author, content, attachment, state }: LocalMessageInput,
): LocalMessageResult {
	const STATES = { sent: 'SENT', sending: 'SENDING', failed: 'SEND_FAILED' };
	const PREVIEW_SIZE = 256;
	const TYPES: Record<string, string> = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		mp4: 'video/mp4',
		mov: 'video/quicktime',
		m4a: 'audio/mp4',
		mp3: 'audio/mpeg',
	};
	const Messages = unbound.metro.findByProps('createBotMessage', 'userRecordToServer');
	const Users = unbound.flux.getStore('User');
	const Selected = unbound.flux.getStore('SelectedChannel');
	const id = channelId ?? Selected?.getChannelId?.();

	if (!Messages || !Users) {
		throw new Error("Discord's message or user module is missing.");
	}

	if (!id) {
		throw new Error('No channel is open on the device; pass --channel.');
	}

	const message = Messages.createBotMessage({ channelId: id, content });
	const user = author === 'me' ? Users.getCurrentUser() : Users.getUser(author);

	if (author !== 'clyde') {
		if (!user) {
			throw new Error(
				`No user ${author} on the device; pass me, clyde or a user id it knows.`,
			);
		}

		message.author = Messages.userRecordToServer(user);
	}

	if (attachment) {
		const filename = attachment.split(/[?#]/)[0]?.split('/').pop() || 'attachment';
		const extension = filename.split('.').pop()?.toLowerCase() ?? '';

		message.attachments = [
			{
				id: `${message.id}1`,
				filename,
				size: 0,
				url: attachment,
				proxy_url: attachment,
				content_type: TYPES[extension] ?? 'application/octet-stream',
				...(/^(image|video)\//.test(TYPES[extension] ?? '')
					? { width: PREVIEW_SIZE, height: PREVIEW_SIZE }
					: {}),
			},
		];
	}

	message.flags = 0;
	message.state = STATES[state];
	message.nonce = message.id;
	unbound.flux.dispatch({
		type: 'MESSAGE_CREATE',
		channelId: id,
		message,
		optimistic: state !== 'sent',
		isPushNotification: false,
	});

	const owned: Record<string, string[]> = Reflect.get(globalThis, '__ubdLocalMessages') ?? {};

	owned[id] = [...(owned[id] ?? []), message.id];
	Reflect.set(globalThis, '__ubdLocalMessages', owned);

	return { channelId: id, ids: [message.id] };
}

/**
 * @description Removes local messages from the device: the given ids, or every message `addLocalMessage` added to
 * the channel when none are given.
 * @param device The device prelude.
 * @param channelId The channel (the open one when `null`).
 * @param ids The messages to remove; all of this tool's messages in the channel when empty.
 * @returns The channel and the ids removed.
 */
export function removeLocalMessages(
	{ unbound }: DevicePrelude,
	channelId: string | null,
	ids: string[],
): LocalMessageResult {
	const Selected = unbound.flux.getStore('SelectedChannel');
	const id = channelId ?? Selected?.getChannelId?.();

	if (!id) {
		throw new Error('No channel is open on the device; pass --channel.');
	}

	const owned: Record<string, string[]> = Reflect.get(globalThis, '__ubdLocalMessages') ?? {};
	const removing = ids.length ? ids : (owned[id] ?? []);

	for (const message of removing) {
		unbound.flux.dispatch({ type: 'MESSAGE_DELETE', channelId: id, id: message });
	}

	owned[id] = (owned[id] ?? []).filter((message) => !removing.includes(message));
	Reflect.set(globalThis, '__ubdLocalMessages', owned);

	return { channelId: id, ids: removing };
}

export default { addLocalMessage, removeLocalMessages };
