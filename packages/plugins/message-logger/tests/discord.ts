import { flux, metro, startPlugin } from '@unbound-app/api/testing';

// UNKNOWN: a test sends Discord's action payloads, which FluxAction does not type.
export type Action = { type: string } & Record<string, unknown>;

export function dispatch(action: Action) {
	return flux.dispatch(action);
}

export const ME = '1';

export const message = {
	id: 'm1',
	channel_id: 'c1',
	content: 'hello',
	author: { id: '2' } as { id: string; bot?: boolean },
	attachments: [
		{ id: 'a1', filename: 'cat.png' },
		{ id: 'a2', filename: 'dog.png' },
	],
	state: 'SENT',
};

type RowInput = { message: Record<string, unknown> };

type Row = {
	message: {
		id: string;
		channelId: string;
		content: { type: string; content: string }[];
		attachments: { id: string; filename: string }[];
		textColor?: number;
		ephemeralIndication?: unknown;
	};
};

export class RowManager {
	generate(input: RowInput): Row {
		const { id, channel_id, content, attachments } = input.message as typeof message;

		return {
			message: {
				id,
				channelId: channel_id,
				content: [{ type: 'text', content }],
				attachments: attachments.map((attachment) => ({ ...attachment })),
			},
		};
	}
}

export class ChatManager {
	determineChangeType(_input: unknown): number {
		return 0;
	}
}

function immutable(fields: Record<string, unknown>): Record<string, unknown> {
	return {
		...fields,
		set: (key: string, value: unknown) => immutable({ ...fields, [key]: value }),
	};
}

/** Draws the row Discord's `RowManager` generates for a message, as the chat does. */
export function generateRow(fields: Partial<typeof message> = {}) {
	return new RowManager().generate({ message: immutable({ ...message, ...fields }) }).message;
}

/** Registers the Discord modules the plugin needs, seeds the stores it reads and starts the plugin. */
export async function startLogger() {
	metro.register(RowManager);
	metro.register(ChatManager);
	metro.register({ openLazy: () => {}, hideActionSheet: () => {} });
	flux.seed({
		Message: {
			getMessage: (_channel: string, id: string) => (id === message.id ? message : undefined),
			getMessages: () => ({ toArray: () => [message] }),
		},
		Channel: { getChannel: () => ({ guild_id: 'g1' }) },
		User: { getCurrentUser: () => ({ id: ME }) },
	});

	await startPlugin();
}
