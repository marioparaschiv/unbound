import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { createLogPrinter, LOG_LEVELS, parseLogLevel, type LogEvent } from '~/lib/log-lines';
import { loadFrameRewriter } from '~/lib/log-symbolicator';
import { tailAndroid, tailIOS } from '~/lib/log-tail';

const schema = z.object({
	serial: z
		.string()
		.optional()
		.describe('The adb serial of the Android device, when several are attached.'),
	ios: z
		.boolean()
		.default(false)
		.describe('Tail a jailbroken iPhone over USB instead of an Android device over adb.'),
	udid: z
		.string()
		.optional()
		.describe('The UDID of the iPhone, when several are connected. Implies --ios.'),
	level: z
		.string()
		.default('verbose')
		.describe(`The lowest level to print: ${LOG_LEVELS.join(', ')}, or their first letter.`),
	grep: z.string().optional().describe('Print only lines matching this regular expression.'),
	since: z
		.string()
		.optional()
		.describe(
			'Start from history: a duration such as 5m, a clock time such as 14:30, or a date. iOS history holds notices, errors and faults only.',
		),
	follow: z
		.boolean()
		.default(true)
		.describe('Keep printing new lines; pass --follow=false to print the history and exit.'),
	symbolicate: z
		.boolean()
		.default(false)
		.describe(
			"Rewrite Hermes frames of the client bundle to source positions using packages/client/dist's maps.",
		),
	bundle: z
		.string()
		.optional()
		.describe(
			'The Hermes bundle to symbolicate against; defaults to the bytecode version the loader reports, else the newest built.',
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
	async handler({ serial, ios, udid, level, grep, since, follow, symbolicate, bundle }) {
		const onIOS = ios || udid !== void 0;

		if (onIOS && serial !== void 0) {
			return {
				ok: false,
				text: 'Pass either --serial for an Android device or --ios/--udid for an iPhone, not both.',
			};
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

		return onIOS
			? tailIOS({ udid, since, follow, emit })
			: tailAndroid({ serial, since, follow, emit });
	},
};

export default logsCommand;
