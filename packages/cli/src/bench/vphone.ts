import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

export const DISCORD_BUNDLE_ID = 'com.hammerandchisel.discord';

const TOOL_SUFFIX = '__vphone__vphone';

const contentSchema = z.object({
	content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
	isError: z.boolean().optional(),
});

const processesSchema = z.object({
	processes: z.array(
		z.object({
			bundle_id: z.string().nullish(),
			pid: z.number(),
			footprint_bytes: z.number().nullish(),
			resident_bytes: z.number().nullish(),
		}),
	),
});

const appInfoSchema = z.object({
	version: z.string(),
	build: z.string(),
	bundle_path: z.string(),
	documents_path: z.string(),
});

export type AppInfo = z.infer<typeof appInfoSchema>;

export type DiscordProcess = {
	pid: number;
	footprintBytes: number | null;
	residentBytes: number | null;
};

type Connection = { client: Client; tool: string };

/** A value the vphone tool takes as an action argument. */
export type VphoneArgument = string | number | boolean;

/**
 * The vphone, driven through the tailnet MCP hub's `vphone` tool, the same tool agents call. The hub's stdio
 * agent is respawned on demand, so a Ctrl-C that kills it still leaves a working connection for the restore.
 */
export class Vphone {
	private client: Client | undefined;
	private tool: string | undefined;

	constructor(
		private readonly connector: string,
		private readonly hubUrl: string,
	) {}

	private async connect(): Promise<Connection> {
		if (this.client && this.tool) {
			return { client: this.client, tool: this.tool };
		}

		const transport = new StdioClientTransport({
			command: this.connector,
			args: ['agent'],
			env: {
				...Object.fromEntries(
					Object.entries(process.env).filter(
						(entry): entry is [string, string] => entry[1] !== undefined,
					),
				),
				TAILNET_URL: this.hubUrl,
			},
			stderr: 'ignore',
		});
		const client = new Client({ name: 'unbound-bench', version: '1.0.0' });

		transport.onclose = () => {
			this.client = undefined;
		};
		await client.connect(transport);
		const { tools } = await client.listTools();
		const tool = tools.find((candidate) => candidate.name.endsWith(TOOL_SUFFIX))?.name;

		if (!tool) {
			await client.close();
			throw new Error(
				`Failed to find the vphone tool on the tailnet hub ${this.hubUrl}: is the Mac connector up?`,
			);
		}

		this.client = client;
		this.tool = tool;

		return { client, tool };
	}

	/**
	 * @description Runs one vphone action, reconnecting once if the hub agent went away.
	 * @param action The action, such as `shell` or `launch`.
	 * @param args Its arguments.
	 * @returns The text the tool answered with.
	 */
	async call(action: string, args: Record<string, VphoneArgument> = {}): Promise<string> {
		for (let attempt = 0; ; attempt++) {
			try {
				const { client, tool } = await this.connect();
				const result = contentSchema.parse(
					await client.callTool({ name: tool, arguments: { action, args } }),
				);
				const text = result.content.map((part) => part.text ?? '').join('');

				if (result.isError) {
					throw new VphoneError(`vphone ${action} failed: ${text.trim()}`);
				}

				return text;
			} catch (error) {
				if (error instanceof VphoneError || attempt > 0) {
					throw error;
				}

				this.client = undefined;
			}
		}
	}

	/**
	 * @description Runs a shell script on the vphone as root.
	 * @param command The script.
	 * @returns Its output; throws when it exits non-zero.
	 */
	shell(command: string): Promise<string> {
		return this.call('shell', { command, root: true });
	}

	/**
	 * @description Reads Discord's install: version, build and folders.
	 * @returns The app info.
	 */
	async appInfo(): Promise<AppInfo> {
		return appInfoSchema.parse(
			JSON.parse(await this.call('app_info', { bundle_id: DISCORD_BUNDLE_ID })),
		);
	}

	/**
	 * @description Reads Discord's process and its memory, as the kernel reports them.
	 * @returns The process, or `undefined` when Discord is not running.
	 */
	async discord(): Promise<DiscordProcess | undefined> {
		const { processes } = processesSchema.parse(
			JSON.parse(await this.call('rpc', { method: 'processes.list' })),
		);
		const found = processes.find((entry) => entry.bundle_id === DISCORD_BUNDLE_ID);

		return (
			found && {
				pid: found.pid,
				footprintBytes: found.footprint_bytes ?? null,
				residentBytes: found.resident_bytes ?? null,
			}
		);
	}

	/** @description Stops Discord, killing it when `terminate` leaves it running. */
	async stopDiscord(): Promise<void> {
		await this.call('terminate', { bundle_id: DISCORD_BUNDLE_ID }).catch(() => '');
		const left = await this.discord();

		if (left) {
			await this.shell(`kill -9 ${left.pid} 2>/dev/null; true`);
		}

		if (await this.discord()) {
			throw new Error('Failed to stop Discord: it is still running after kill -9.');
		}
	}

	/** @description Launches Discord. */
	async launchDiscord(): Promise<void> {
		await this.call('launch', { bundle_id: DISCORD_BUNDLE_ID });
	}

	/**
	 * @description Taps the "Okay" button of the alert the loader shows for a missing app extension, if it is up.
	 * The alert appears after Unbound starts, so it cannot affect startup numbers; left open it stacks up.
	 */
	async dismissAlert(): Promise<void> {
		for (let attempt = 0; attempt < 3; attempt++) {
			const found = await this.call('wait', {
				text: 'Okay',
				match: 'exact',
				timeout: 2,
			}).catch((error: Error) => error.message);

			// Right after a launch the accessibility tree can be unavailable for a moment.
			if (found.includes('-25215')) {
				continue;
			}

			if (found.includes('"found": true')) {
				await this.call('tap_text', { text: 'Okay', match: 'exact' }).catch(() => '');
			}

			return;
		}
	}

	async close(): Promise<void> {
		await this.client?.close();
		this.client = undefined;
	}
}

/** The vphone answered, but with an error: retrying the same call would fail the same way. */
export class VphoneError extends Error {}

export default { DISCORD_BUNDLE_ID, Vphone, VphoneError };
