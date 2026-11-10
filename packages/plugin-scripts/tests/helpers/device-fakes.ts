import type { Device } from '~/device';

type Received = { channel: string; message: Record<string, unknown> };

/** What the fake device answers a script with: its result, or a thrown error. */
export type FakeAnswer = string | (() => string);

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
				author: { id: 'clyde', bot: true },
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
		},
		flux: { getStore: (name: string) => stores[name] },
	};

	return { unbound, received, transitions, sent, dispatched };
}

/**
 * @description Builds a fake matrix device that answers each script it knows by its exact text, with host commands that fail, no screenshots and instant sleeps.
 * @param answers The result of each script, by the script's text; an answer function may throw, as a dropped device does.
 * @returns The device and what the run asked of it.
 */
export function fakeMatrixDevice(answers: Map<string, FakeAnswer>) {
	const evaluated: string[] = [];
	const commands: string[][] = [];
	const device: Device = {
		name: 'Fake Phone',
		target: { kind: 'android', serial: 'emulator-5554' },
		async evaluate(code) {
			const answer = answers.get(code);

			if (answer === undefined) throw new Error(`The fake device has no answer for ${code}`);

			evaluated.push(code);

			return typeof answer === 'function' ? answer() : answer;
		},
		waitForDevice: async () => true,
		async run(command) {
			commands.push(command);

			return { ok: false, stdout: '', stderr: 'not a real device' };
		},
		screenshot: async () => false,
		sleep: async () => {},
		close: () => {},
	};

	return { device, evaluated, commands };
}
