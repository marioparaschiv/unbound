#!/usr/bin/env bun
import {
	appPid,
	DISCORD,
	HubError,
	readDeviceFile,
	retryAx,
	type Vphone,
	VphoneError,
	writeDeviceFile,
	type ToolArgs,
} from './vphone.ts';
// Any vphone tool action from a shell.
import { isObject, parseJson, type Json } from './json.ts';
import { connectVphone } from './session.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `Any vphone tool action from a shell.
  vphone <action> [key=value ...] [--json '<args>'] [--out <file.png>] [--timeout <s>]
  vphone help                           the tool's live list of actions and arguments
  vphone shot <file.png> [--wait <text>] wait for on-screen text (AX retries included), then screenshot
  vphone pid [bundle_id]                an app's pid (the device has no ps or pgrep)
  vphone get <device path> <file>       copy a device file here (\`pull\`/\`push\` use the Mac's paths)
  vphone put <file> <device path>       copy a file from here to the device, as root
Values decode as JSON when they can (\`timeout=3\`, \`root=true\`), else stay strings. Common misspellings
(\`bundleId\`, \`cmd\`, \`duration\`) map to the tool's names. Exit 1: the tool answered an error. 2: unreachable.`;

/** Argument names agents guess, mapped to the tool's, per action (`*` for every action). */
const ALIASES: Record<string, Record<string, string>> = {
	'*': { bundleId: 'bundle_id', bundle: 'bundle_id', cmd: 'command' },
	logs: { duration: 'seconds', timeout: 'seconds' },
	swipe: { duration: 'ms' },
};

function normalise(action: string, args: ToolArgs): ToolArgs {
	const names = { ...ALIASES['*'], ...ALIASES[action] };

	return Object.fromEntries(
		Object.entries(args).map(([key, value]) => [names[key] ?? key, value]),
	);
}

function parseValue(raw: string): Json {
	try {
		return parseJson(raw, 'an argument');
	} catch {
		return raw;
	}
}

async function shot(vphone: Vphone, out: string, wait: string | undefined): Promise<number> {
	if (wait) {
		const found = await retryAx(() => vphone.text('wait', { text: wait, timeout: 15 })).catch(
			(error: Error) => error.message,
		);

		if (!found.includes('"found": true')) {
			console.error(`"${wait}" did not appear: ${found.trim()}`);
		}
	}

	const image = (await vphone.call('screenshot')).content.find((part) => part.type === 'image');

	if (!image?.data) {
		throw new VphoneError('screenshot returned no image');
	}

	await Bun.write(out, Buffer.from(image.data, 'base64'));
	console.log(`wrote ${out}`);

	return 0;
}

async function copy(vphone: Vphone, action: string, from: string, to: string): Promise<number> {
	if (action === 'get') {
		await Bun.write(to, await readDeviceFile(vphone, from));
	} else {
		await writeDeviceFile(vphone, to, new Uint8Array(await Bun.file(from).arrayBuffer()));
	}

	console.log(`copied ${from} -> ${to}`);

	return 0;
}

async function callAction(vphone: Vphone, action: string, rest: string[]): Promise<number> {
	let args: ToolArgs = {};
	let out: string | undefined;
	let timeoutMs: number | undefined;

	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];

		if (arg === '--json') {
			const extra = parseJson(rest[++i], '--json');

			args = { ...args, ...(isObject(extra) ? extra : {}) };
		} else if (arg === '--out') {
			out = rest[++i];
		} else if (arg === '--timeout') {
			timeoutMs = Number(rest[++i]) * 1000;
		} else if (arg.includes('=')) {
			args[arg.slice(0, arg.indexOf('='))] = parseValue(arg.slice(arg.indexOf('=') + 1));
		} else {
			throw new Error(`Unexpected argument ${arg}\n\n${USAGE}`);
		}
	}

	const result = await vphone.call(action, normalise(action, args), timeoutMs);

	for (const part of result.content) {
		if (part.type === 'image' && part.data && out) {
			await Bun.write(out, Buffer.from(part.data, 'base64'));
			console.log(`wrote ${out}`);
		} else if (part.type === 'image') {
			console.log(`[image ${part.mimeType ?? ''} omitted: pass --out <file>]`);
		} else if (part.text) {
			console.log(part.text);
		}
	}

	return result.isError ? 1 : 0;
}

async function run(vphone: Vphone, action: string, rest: string[]): Promise<number> {
	if (action === 'help') {
		console.log(await vphone.describe());

		return 0;
	}

	if (action === 'pid') {
		console.log((await appPid(vphone, rest[0] ?? DISCORD)) ?? 'not running');

		return 0;
	}

	if (action === 'shot') {
		if (!rest[0]) {
			throw new Error('usage: vphone shot <file.png> [--wait <text>]');
		}

		return shot(vphone, rest[0], rest[1] === '--wait' ? rest[2] : undefined);
	}

	if (action === 'get' || action === 'put') {
		if (!rest[0] || !rest[1]) {
			throw new Error(`usage: vphone ${action} <from> <to>`);
		}

		return copy(vphone, action, rest[0], rest[1]);
	}

	return callAction(vphone, action, rest);
}

async function main(argv: string[]): Promise<number> {
	const [action, ...rest] = argv;

	if (!action || action === '-h' || action === '--help') {
		console.log(USAGE);

		return 0;
	}

	const vphone = connectVphone();

	try {
		return await run(vphone, action, rest);
	} finally {
		vphone.close();
	}
}

main(process.argv.slice(2)).then(
	(code) => process.exit(code),
	(error: Error) => {
		console.error(error.message);
		process.exit(error instanceof HubError ? 2 : 1);
	},
);
