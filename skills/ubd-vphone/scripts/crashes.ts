#!/usr/bin/env bun
// Explains Discord's newest crash; the verdict and suspect rules follow Xrash's XrashKit.
import {
	isObject,
	listAt,
	numberAt,
	objectAt,
	parseJson,
	stringAt,
	type Json,
	type JsonObject,
} from './json.ts';
import { readWindow, summariseLog, toIso } from './unbound-log.ts';
import { appPaths, DISCORD, Vphone } from './vphone.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `Explains Discord's newest crash on the vphone, keeping only what decides the cause: a one-line verdict, the
termination reason, the non-Apple images to suspect, the top frames, and the run's unbound.log. The verdict and
suspect rules follow Xrash's XrashKit (github.com/owngoal-dev/Xrash).
  crashes [--since <device epoch s>] [--limit <n>] [--bundle <id>] [--no-log] [--path <report>]
Without --since it explains the newest report. \`--path\` prints one report's raw JSON. Silent when none match.`;

/** One crash report file on the device. */
export type Report = { path: string; name: string; mtime: number };

type Suspect = { name: string; score: number; why: string[] };

const TOP_FRAMES = 8;
const APPLE = ['/System/', '/usr/lib/', '/usr/libexec/', '/private/preboot/Cryptexes/'];
const TWEAK_DIRS = ['/MobileSubstrate/DynamicLibraries/', '/TweakInject/'];
/** Injected into every process by the bootstrap, so present in every crash: blamed only when on the stack. */
const BOOTSTRAP =
	/(^|\/)(systemhook|libsystemhook|libellekit|libsubstrate|libinjector|libroothide|roothideinit)\.dylib$/;

/**
 * @description Lists crash reports newer than `since`, newest first.
 * @param vphone The session.
 * @param since Device epoch seconds.
 * @param bundleId The app.
 * @returns The reports.
 */
export async function listCrashes(
	vphone: Vphone,
	since = 0,
	bundleId = DISCORD,
): Promise<Report[]> {
	const list = parseJson(await vphone.text('crashes', { bundle_id: bundleId }), 'the crash list');
	const reports = listAt(list, 'crashes').map((entry) => ({
		path: stringAt(entry, 'path') ?? '',
		name: stringAt(entry, 'name') ?? '',
		mtime: numberAt(entry, 'mtime') ?? 0,
	}));

	return reports.filter((report) => report.mtime > since).sort((a, b) => b.mtime - a.mtime);
}

function reasonsOf(body: JsonObject): string[] {
	const asi = objectAt(body, 'asi');
	const strings = (lines: Json[]) => lines.filter((line) => typeof line === 'string');
	const termination = strings(listAt(objectAt(body, 'termination'), 'reasons'));
	const application = Object.entries(asi).flatMap(([lib, lines]) =>
		strings(Array.isArray(lines) ? lines : []).map((line) => `${lib}: ${line}`),
	);

	return [...termination, ...application];
}

/** One sentence on what killed the process; Xrash's ExceptionExplainer, first match wins. */
function verdict(body: JsonObject): string {
	const exception = objectAt(body, 'exception');
	const type = stringAt(exception, 'type') ?? '';
	const signal = stringAt(exception, 'signal') ?? '';
	const subtype = stringAt(exception, 'subtype') ?? '';
	const namespace = stringAt(objectAt(body, 'termination'), 'namespace') ?? '';
	const code = numberAt(objectAt(body, 'termination'), 'code') ?? 0;
	const reasons = reasonsOf(body).join('\n');
	const text = `${subtype}\n${reasons}`.toLowerCase();
	const address = /at (0x[0-9a-f]+)/i.exec(subtype)?.[1];
	const thrown =
		text.includes('uncaught exception') || listAt(body, 'lastExceptionBacktrace').length > 0;
	const badAccess =
		type.startsWith('EXC_BAD_ACCESS') || signal === 'SIGSEGV' || signal === 'SIGBUS';
	const rules: [boolean, string][] = [
		[
			namespace === 'SPRINGBOARD' || code === 0x8badf00d,
			'Watchdog kill: the main thread blocked launch, resume or quit too long.',
		],
		[namespace === 'CODESIGNING', 'Code signature rejected or changed on disk.'],
		[namespace === 'DYLD', `A library failed to load: ${reasons.split('\n')[0]}.`],
		[
			namespace === 'JETSAM',
			text.includes('per-process-limit')
				? 'Killed for exceeding its memory limit.'
				: 'Killed to reclaim memory.',
		],
		[
			namespace === 'RUNNINGBOARD' || code === 0xdead10cc,
			'Killed for holding a file lock or database while suspended.',
		],
		[
			namespace === 'FRONTBOARD' || code === 0xbaddcafe,
			'Did not finish launching in the allowed time.',
		],
		[type === 'EXC_RESOURCE', `Went over a system resource limit (${subtype}).`],
		[
			type === 'EXC_GUARD',
			'Misused a guarded resource, such as closing a file descriptor it does not own.',
		],
		[
			badAccess && (text.includes('pointer authentication') || text.includes('ptrauth')),
			'Called through a pointer with an invalid PAC: a corrupted function pointer or stack.',
		],
		[
			badAccess && address !== undefined && Number(address) < 0x4000,
			`Null pointer access (${address}): an object was released or never created.`,
		],
		[badAccess, `Bad memory access ${address ? `at ${address}` : ''}: usually a freed object.`],
		[
			(type === 'EXC_CRASH' || signal === 'SIGABRT') && thrown,
			'An exception was thrown and never caught, so the app aborted.',
		],
		[
			type === 'EXC_CRASH' || signal === 'SIGABRT',
			'abort() was called, usually after a failed assertion.',
		],
		[
			type === 'EXC_BREAKPOINT' || signal === 'SIGTRAP',
			'A runtime trap: fatalError, failed precondition, nil unwrap or index out of range.',
		],
		[signal === 'SIGKILL', `Killed outright by the system ${namespace}.`],
	];

	return (
		rules.find(([matches]) => matches)?.[1] ??
		`Ended with ${type || 'no recognised exception'} ${signal}.`
	);
}

function imageIndexes(frames: Json[]): Set<number | undefined> {
	return new Set(frames.map((frame) => numberAt(frame, 'imageIndex')));
}

/** Non-Apple images ranked by how much the crash implicates them; Xrash's Suspects scoring. */
function suspects(body: JsonObject, crashed: Json[]): string[] {
	const processPath = stringAt(body, 'procPath') ?? '';
	const app = processPath.includes('.app/')
		? processPath.slice(0, processPath.indexOf('.app/') + 5)
		: '';
	const onStack = imageIndexes(crashed);
	const nearTop = imageIndexes(crashed.slice(0, TOP_FRAMES));
	const inException = imageIndexes(listAt(body, 'lastExceptionBacktrace'));
	const ranked: Suspect[] = [];

	for (const [index, image] of listAt(body, 'usedImages').entries()) {
		const path = stringAt(image, 'path') ?? '';
		const tweak = TWEAK_DIRS.some((dir) => path.includes(dir));
		const apple =
			stringAt(image, 'source') === 'S' || APPLE.some((prefix) => path.startsWith(prefix));
		const why: string[] = [];
		let score = 0;

		if (!path || (!tweak && (apple || (app && path.startsWith(app))))) {
			continue;
		}

		if (onStack.has(index)) {
			why.push('on the crashed stack');
			score += nearTop.has(index) ? 70 : 50;
		}

		if (inException.has(index)) {
			why.push('in the exception backtrace');
			score += 40;
		}

		// A bootstrap library or plain third party only counts when the crash itself points at it.
		if (!tweak && !why.length) {
			continue;
		}

		why.push(
			tweak ? 'injected tweak' : BOOTSTRAP.test(path) ? 'jailbreak bootstrap' : 'third party',
		);
		score += tweak ? 30 : 10;
		ranked.push({
			name: stringAt(image, 'name') ?? path.split('/').at(-1) ?? path,
			score,
			why,
		});
	}

	return ranked
		.sort((a, b) => b.score - a.score)
		.map(({ name, score, why }) => `${name} (${score}: ${why.join(', ')})`);
}

function frames(body: JsonObject, list: Json[]): string[] {
	const images = listAt(body, 'usedImages');

	return list.slice(0, TOP_FRAMES).map((frame) => {
		const image = stringAt(images[numberAt(frame, 'imageIndex') ?? -1], 'name') ?? '?';
		const symbol =
			stringAt(frame, 'symbol') ?? `+0x${(numberAt(frame, 'imageOffset') ?? 0).toString(16)}`;

		return `    ${image}  ${symbol}`;
	});
}

/** The loader's addon crash guard files, which name the addon that was starting or running when a launch died. */
const GUARD_FILES = [
	'addon-crashes.json',
	'addon-frozen.json',
	'addon-starting.json',
	'addon-running.json',
];

async function addonGuard(vphone: Vphone): Promise<string[]> {
	const folder = `/rootfs${(await appPaths(vphone)).documentsPath}/Unbound`;
	const command = GUARD_FILES.map(
		(name) =>
			`[ -s '${folder}/${name}' ] && echo "${name}: $(head -c 300 '${folder}/${name}' | tr -d '\\n')"`,
	).join('; ');
	const text = await vphone
		.text('shell', { command: `${command}; true`, root: true })
		.catch(() => '');

	return text
		.split('\n')
		.filter(Boolean)
		.map((line) => `  addon guard ${line}`);
}

/**
 * @description Reads one report and explains it, with the run's unbound.log unless `withLog` is false.
 * @param vphone The session.
 * @param report The report.
 * @param withLog Whether to add the loader's log for the crashed run.
 * @returns The explanation.
 */
export async function summarise(vphone: Vphone, report: Report, withLog = true): Promise<string> {
	const file = parseJson(await vphone.text('crashes', { path: report.path }), 'a crash report');
	const content = stringAt(file, 'content') ?? '';
	const parsed = parseJson(content.slice(content.indexOf('\n') + 1), report.name);
	const body = isObject(parsed) ? parsed : {};
	const exception = objectAt(body, 'exception');
	const termination = objectAt(body, 'termination');
	const thread = listAt(body, 'threads')[numberAt(body, 'faultingThread') ?? 0];
	const crashed = listAt(thread, 'frames');
	const launched = stringAt(body, 'procLaunch');
	const died = stringAt(body, 'captureTime');
	const uptime =
		launched && died
			? `${Math.round((Date.parse(toIso(died)) - Date.parse(toIso(launched))) / 1000)}s after launch`
			: '';
	const blamed = suspects(body, crashed);
	const backtrace = listAt(body, 'lastExceptionBacktrace');
	const lines = [
		`crash ${report.name}: died ${died ? toIso(died) : '?'} ${uptime}`,
		`  what happened: ${verdict(body)}`,
		`  exception: ${['type', 'signal', 'subtype']
			.map((key) => stringAt(exception, key) ?? '')
			.join(' ')
			.trim()}`,
	];

	if (stringAt(termination, 'namespace')) {
		lines.push(
			`  termination: ${stringAt(termination, 'namespace')} 0x${(numberAt(termination, 'code') ?? 0).toString(16)}`,
		);
	}

	lines.push(
		...reasonsOf(body)
			.slice(0, 5)
			.map((reason) => `  reason: ${reason.trim()}`),
	);
	lines.push(
		`  suspects: ${blamed.length ? blamed.slice(0, 4).join('; ') : 'none outside Apple and Discord'}`,
	);

	if (backtrace.length) {
		lines.push('  exception backtrace:', ...frames(body, backtrace));
	}

	lines.push(
		`  crashed thread (${stringAt(thread, 'queue') ?? stringAt(thread, 'name') ?? '?'}):`,
		...frames(body, crashed),
	);

	lines.push(...(await addonGuard(vphone)));

	if (withLog && launched && died) {
		const window = await readWindow(vphone, toIso(launched), toIso(died)).catch(() => ({
			entries: [],
			oldest: undefined,
		}));

		lines.push('unbound.log for that run:', summariseLog(window));
	}

	lines.push(`full report: scripts/crashes --path ${report.path}`);

	return lines.join('\n');
}

async function main(argv: string[]) {
	let since: number | undefined;
	let limit = 1;
	let bundle = DISCORD;
	let path: string | undefined;
	let withLog = true;

	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--since') {
			since = Number(argv[++i]);
		} else if (argv[i] === '--limit') {
			limit = Number(argv[++i]);
		} else if (argv[i] === '--bundle') {
			bundle = argv[++i];
		} else if (argv[i] === '--path') {
			path = argv[++i];
		} else if (argv[i] === '--no-log') {
			withLog = false;
		} else {
			throw new Error(`Unexpected argument ${argv[i]}\n\n${USAGE}`);
		}
	}

	const vphone = new Vphone();

	try {
		if (path) {
			console.log(
				stringAt(
					parseJson(await vphone.text('crashes', { path }), 'a crash report'),
					'content',
				),
			);

			return;
		}

		const reports = (await listCrashes(vphone, since ?? 0, bundle)).slice(
			0,
			since === undefined ? 1 : limit,
		);

		for (const report of reports) {
			console.log(await summarise(vphone, report, withLog && bundle === DISCORD));
		}
	} finally {
		vphone.close();
	}
}

if (import.meta.main) {
	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		console.log(USAGE);
		process.exit(0);
	}

	main(process.argv.slice(2)).catch((error: Error) => {
		console.error(error.message);
		process.exit(1);
	});
}
