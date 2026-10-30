type Received = { channel: string; message: Record<string, unknown> };

/**
 * @description Runs a device script against a fake `unbound` global, with timers that fire at once.
 * @param script The script.
 * @param fake What the script sees as `unbound`.
 * @returns What the script returns.
 */
export function runOnFakeDevice(script: string, fake: object): Promise<unknown> {
	const instant = (run: () => void) => run();

	return Promise.resolve(
		new Function('unbound', 'setTimeout', `return ${script}`)(fake, instant),
	);
}

/**
 * @description Builds a fake Discord with the stores and actions the fixture scripts use, recording what they do.
 * @param options The selected channel and the messages already loaded in it.
 * @returns The fake `unbound` and what the scripts did to it.
 */
export function fakeDiscord(
	options: {
		selected?: string;
		loaded?: { id: string; content?: string; author?: object }[];
	} = {},
) {
	const received: Received[] = [];
	const transitions: string[][] = [];
	const sent: unknown[] = [];
	const dispatched: Record<string, unknown>[] = [];
	const modules: Record<string, object> = {
		transitionToGuild: { transitionToGuild: (...args: string[]) => transitions.push(args) },
		receiveMessage: {
			receiveMessage: (channel: string, message: Record<string, unknown>) =>
				received.push({ channel, message }),
			sendMessage: (...args: unknown[]) => sent.push(args),
		},
		subscribe: { dispatch: (action: Record<string, unknown>) => dispatched.push(action) },
		createBotMessage: {
			createBotMessage: (fields: { channelId: string; content: string }) => ({
				id: 'bot',
				...fields,
			}),
		},
	};
	const stores: Record<string, object> = {
		User: { getCurrentUser: () => ({ id: 'me', avatar: 'hash' }) },
		Message: { getMessages: () => ({ toArray: () => options.loaded ?? [] }) },
		SelectedChannel: { getChannelId: () => options.selected },
	};
	const unbound = {
		metro: {
			findByProps: (...names: string[]) => modules[names.at(-1)!] ?? modules[names[0]!],
			findStore: (name: string) => stores[name],
		},
	};

	return { unbound, received, transitions, sent, dispatched };
}
