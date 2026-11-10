import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { resolve } from 'node:path';

import {
	defaultLogFolder,
	pullAndroidLogs,
	pullIOSLogs,
	symbolicatePulledLogs,
} from '~/lib/log-pull';
import { createLogPrinter, LOG_LEVELS, parseLogLevel, type LogEvent } from '~/lib/log-lines';
import { loadFrameRewriter } from '~/lib/log-symbolicator';
import { openDeviceTarget } from '~/lib/device-target';
import { tailAndroid, tailIOS } from '~/lib/log-tail';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	serial: Type.Optional(
		Type.String({
			description: 'The adb serial of the Android device, when several are attached.',
		}),
	),
	ios: defaulted(
		Type.Boolean({
			description: 'Tail a jailbroken iPhone over USB instead of an Android device over adb.',
		}),
		false,
	),
	udid: Type.Optional(
		Type.String({
			description: 'The UDID of the iPhone, when several are connected. Implies --ios.',
		}),
	),
	level: defaulted(
		Type.String({
			description: `The lowest level to print: ${LOG_LEVELS.join(', ')}, or their first letter.`,
		}),
		'verbose',
	),
	grep: Type.Optional(
		Type.String({ description: 'Print only lines matching this regular expression.' }),
	),
	since: Type.Optional(
		Type.String({
			description:
				'Start from history: a duration such as 5m, a clock time such as 14:30, or a date. iOS history holds notices, errors and faults only.',
		}),
	),
	follow: defaulted(
		Type.Boolean({
			description:
				'Keep printing new lines; pass --follow=false to print the history and exit.',
		}),
		true,
	),
	symbolicate: defaulted(
		Type.Boolean({
			description:
				"Rewrite Hermes frames of the client bundle to source positions using packages/client/dist's maps.",
		}),
		false,
	),
	bundle: Type.Optional(
		Type.String({
			description:
				'The Hermes bundle to symbolicate against; defaults to the bytecode version the loader reports, else the newest built.',
		}),
	),
	pull: defaulted(
		Type.Boolean({
			description:
				"Copy the loader's own log files off the device instead of tailing; they survive restarts and hold the JavaScript console too.",
		}),
		false,
	),
	out: Type.Optional(
		Type.String({
			description:
				'The folder --pull writes the log files into; defaults to a timestamped folder here.',
		}),
	),
});

const logsCommand: CommandDefinition<typeof schema> = {
	name: 'logs',
	description:
		"Tail Discord's log, filtered to Unbound, the JavaScript console and crashes: on Android " +
		'through adb logcat for com.discord, following it across restarts, or on a jailbroken iPhone ' +
		'through its unified log. Runs until interrupted.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler({
		serial,
		ios,
		udid,
		level,
		grep,
		since,
		follow,
		symbolicate,
		bundle,
		pull,
		out,
	}) {
		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		if (pull) {
			const folder = out ?? defaultLogFolder();
			const pulled =
				target.platform === 'ios'
					? await pullIOSLogs(target, { out: folder })
					: await pullAndroidLogs(target, { out: folder });

			if (!pulled.ok || !symbolicate) {
				return pulled;
			}

			const rewriter = await loadFrameRewriter(bundle);

			if (typeof rewriter !== 'function') {
				return {
					ok: false,
					text: `${pulled.text} Symbolicating them failed: ${rewriter.error}`,
				};
			}

			const written = symbolicatePulledLogs(resolve(folder), rewriter);

			return { ok: true, text: `${pulled.text} Symbolicated copies: ${written.join(', ')}.` };
		}

		const minimum = parseLogLevel(level);

		if (!minimum) {
			return { ok: false, text: `--level takes one of ${LOG_LEVELS.join(', ')}.` };
		}

		let pattern: RegExp | undefined;

		try {
			pattern = grep === void 0 ? void 0 : new RegExp(grep);
		} catch (error) {
			return {
				ok: false,
				text: `--grep is not a valid regular expression: ${String(error)}`,
			};
		}

		const rewriter = symbolicate ? await loadFrameRewriter(bundle) : void 0;

		if (rewriter && typeof rewriter !== 'function') {
			return { ok: false, text: rewriter.error };
		}

		const print = createLogPrinter({ level: minimum, grep: pattern, symbolicate: rewriter });

		function emit(event: LogEvent) {
			const line = print(event);

			if (line !== void 0) {
				process.stdout.write(`${line}\n`);
			}
		}

		return target.platform === 'ios'
			? tailIOS(target, { since, follow, emit })
			: tailAndroid(target, { since, follow, emit });
	},
};

export default logsCommand;
