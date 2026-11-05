// The vphone's MCP tool, called from a shell through the tailnet hub's stdio agent (`tailnet-connector agent`).
// vphone-cli.ts is the command line over it; the other scripts import this file.
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
	isObject,
	listAt,
	numberAt,
	parseJson,
	stringAt,
	type Json,
	type JsonObject,
} from './json.ts';

/** One content part of a tool result. */
export type Content = { type: string; text?: string; data?: string; mimeType?: string };

/** A tool result. */
export type CallResult = { content: Content[]; isError: boolean };

/** The arguments a vphone action takes. */
export type ToolArgs = { [key: string]: Json };

type Pending = { resolve: (value: Json) => void; reject: (error: Error) => void };

const TOOL_SUFFIX = '__vphone__vphone';
const CHUNK = 96_000;

/** Discord's bundle id on iOS. */
export const DISCORD = 'com.hammerandchisel.discord';

/** The tool answered with an error: the same call would fail the same way. */
export class VphoneError extends Error {}

/** The hub, connector or tool could not be reached. */
export class HubError extends Error {}

function readContent(part: Json): Content {
	return {
		type: stringAt(part, 'type') ?? '',
		text: stringAt(part, 'text'),
		data: stringAt(part, 'data'),
		mimeType: stringAt(part, 'mimeType'),
	};
}

/** One stdio MCP session with the hub agent. */
export class Vphone {
	private readonly child;
	private readonly pending = new Map<number, Pending>();
	private nextId = 1;
	private tool: JsonObject | undefined;

	constructor(hubUrl = process.env.TAILNET_URL) {
		if (!hubUrl) {
			throw new HubError(
				'TAILNET_URL is unset: the tailnet MCP hub, such as http://<hub>:8790 (set it in .env).',
			);
		}

		const connector =
			process.env.TAILNET_CONNECTOR ??
			Bun.which('tailnet-connector') ??
			join(homedir(), '.cargo/bin/tailnet-connector');

		this.child = spawn(connector, ['agent'], {
			env: { ...process.env, TAILNET_URL: hubUrl },
			stdio: ['pipe', 'pipe', 'ignore'],
		});
		this.child.on('error', (error) =>
			this.failAll(new HubError(`Failed to start ${connector}: ${error.message}`)),
		);
		this.child.on('exit', (code) =>
			this.failAll(new HubError(`tailnet-connector agent exited (${code})`)),
		);
		createInterface({ input: this.child.stdout }).on('line', (line) => this.receive(line));
	}

	private failAll(error: Error) {
		for (const { reject } of this.pending.values()) {
			reject(error);
		}

		this.pending.clear();
	}

	private receive(line: string) {
		let message: Json;

		try {
			message = parseJson(line, 'a hub message');
		} catch {
			// The agent only writes JSON-RPC; anything else is noise.
			return;
		}

		const id = numberAt(message, 'id');
		const waiter = id === undefined ? undefined : this.pending.get(id);

		if (id === undefined || !waiter) {
			return;
		}

		this.pending.delete(id);

		const error = isObject(message) ? message.error : undefined;

		if (isObject(error)) {
			waiter.reject(new HubError(stringAt(error, 'message') ?? 'hub error'));
		} else {
			waiter.resolve(isObject(message) ? (message.result ?? null) : null);
		}
	}

	private request(method: string, params: Json, timeoutMs = 120_000): Promise<Json> {
		const id = this.nextId++;

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new HubError(`${method} timed out after ${timeoutMs / 1000}s`));
			}, timeoutMs);

			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
			this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
		});
	}

	private async connect(): Promise<JsonObject> {
		if (this.tool) {
			return this.tool;
		}

		const clientInfo = { name: 'ubd-vphone', version: '1.0.0' };

		await this.request(
			'initialize',
			{ protocolVersion: '2025-06-18', capabilities: {}, clientInfo },
			30_000,
		);
		this.child.stdin.write(
			`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
		);

		const tools = listAt(await this.request('tools/list', {}, 30_000), 'tools');
		const tool = tools.find((entry) => stringAt(entry, 'name')?.endsWith(TOOL_SUFFIX));

		if (!isObject(tool)) {
			throw new HubError(
				'The hub lists no vphone tool: is the Mac connector up? (list_machines on the tailnet MCP)',
			);
		}

		this.tool = tool;

		return tool;
	}

	/**
	 * @description Lists the tool's actions and arguments, as the tool describes them.
	 * @returns The tool's description.
	 */
	async describe(): Promise<string> {
		return stringAt(await this.connect(), 'description') ?? '';
	}

	/**
	 * @description Runs one action.
	 * @param action The action, such as `shell` or `launch`.
	 * @param args Its arguments.
	 * @param timeoutMs How long to wait for the answer.
	 * @returns The tool's result.
	 */
	async call(action: string, args: ToolArgs = {}, timeoutMs?: number): Promise<CallResult> {
		const name = stringAt(await this.connect(), 'name') ?? '';
		const result = await this.request(
			'tools/call',
			{ name, arguments: { action, args } },
			timeoutMs,
		);

		return {
			content: listAt(result, 'content').map(readContent),
			isError: isObject(result) && result.isError === true,
		};
	}

	/**
	 * @description Runs one action and returns its text.
	 * @param action The action.
	 * @param args Its arguments.
	 * @param timeoutMs How long to wait for the answer.
	 * @returns The text the tool answered with; throws {@link VphoneError} when it reports an error.
	 */
	async text(action: string, args: ToolArgs = {}, timeoutMs?: number): Promise<string> {
		const result = await this.call(action, args, timeoutMs);
		const text = result.content.map((part) => part.text ?? '').join('');

		if (result.isError) {
			throw new VphoneError(`vphone ${action} failed: ${text.trim()}`);
		}

		return text;
	}

	close() {
		this.child.kill();
	}
}

/**
 * @description Retries an action that fails with the AX error iOS gives right after a launch.
 * @template T The action's result.
 * @param run The action.
 * @param tries How many times to try.
 * @returns The action's result.
 */
export async function retryAx<T>(run: () => Promise<T>, tries = 5): Promise<T> {
	for (let i = 1; ; i++) {
		try {
			return await run();
		} catch (error) {
			if (i >= tries || !String(error).includes('-25215')) {
				throw error;
			}

			await Bun.sleep(1000);
		}
	}
}

/** A running process, as `processes.list` reports it. */
export type DeviceProcess = {
	pid: number;
	bundleId: string | undefined;
	startTime: number | undefined;
};

/**
 * @description Lists the device's processes.
 * @param vphone The session.
 * @returns Every process with its pid, bundle id and start time.
 */
export async function processes(vphone: Vphone): Promise<DeviceProcess[]> {
	const list = parseJson(
		await vphone.text('rpc', { method: 'processes.list' }),
		'processes.list',
	);

	return listAt(list, 'processes').map((entry) => ({
		pid: numberAt(entry, 'pid') ?? 0,
		bundleId: stringAt(entry, 'bundle_id'),
		startTime: numberAt(entry, 'start_time'),
	}));
}

/**
 * @description Finds an app's pid.
 * @param vphone The session.
 * @param bundleId The app.
 * @returns Its pid, or `undefined` when it is not running.
 */
export async function appPid(vphone: Vphone, bundleId: string): Promise<number | undefined> {
	return (await processes(vphone)).find((entry) => entry.bundleId === bundleId)?.pid;
}

/** Where an app lives on the device, as real-root paths. */
export type AppPaths = { version: string; bundlePath: string; documentsPath: string };

/**
 * @description Reads an app's version and folders, which change on reinstall.
 * @param vphone The session.
 * @param bundleId The app.
 * @returns Its version, bundle and documents folders.
 */
export async function appPaths(vphone: Vphone, bundleId = DISCORD): Promise<AppPaths> {
	const info = parseJson(await vphone.text('app_info', { bundle_id: bundleId }), 'app_info');

	return {
		version: stringAt(info, 'version') ?? '',
		bundlePath: stringAt(info, 'bundle_path') ?? '',
		documentsPath: stringAt(info, 'documents_path') ?? '',
	};
}

const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

/**
 * @description Reads a device file through the shell, since `pull` writes to the Mac's disk, not this one.
 * @param vphone The session.
 * @param path A real-root device path.
 * @returns The file's bytes.
 */
export async function readDeviceFile(vphone: Vphone, path: string): Promise<Buffer> {
	const encoded = await vphone.text('shell', {
		command: `base64 < ${quote(`/rootfs${path}`)}`,
		root: true,
	});

	return Buffer.from(encoded.replaceAll(/\s+/g, ''), 'base64');
}

/**
 * @description Writes a device file through the shell, replacing it atomically once every chunk has landed.
 * @param vphone The session.
 * @param path A real-root device path.
 * @param bytes The content.
 */
export async function writeDeviceFile(
	vphone: Vphone,
	path: string,
	bytes: Uint8Array,
): Promise<void> {
	const target = quote(`/rootfs${path}`);
	const staged = quote(`/rootfs${path}.ubd-tmp`);
	const encoded = Buffer.from(bytes).toString('base64');

	await vphone.text('shell', { command: `: > ${staged}.b64`, root: true });

	for (let i = 0; i < encoded.length; i += CHUNK) {
		await vphone.text('shell', {
			command: `printf %s '${encoded.slice(i, i + CHUNK)}' >> ${staged}.b64`,
			root: true,
		});
	}

	await vphone.text('shell', {
		command: `base64 -d < ${staged}.b64 > ${staged} && rm ${staged}.b64 && mv ${staged} ${target}`,
		root: true,
	});
}
