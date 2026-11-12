import { resolve } from 'node:path';

import {
	defaultLogFolder,
	pullAndroidLogs,
	pullIOSLogs,
	symbolicatePulledLogs,
} from '~/lib/log-pull';
import { createLogPrinter, LOG_LEVELS, parseLogLevel, type LogEvent } from '~/lib/log-lines';
import { loadFrameRewriter } from '~/lib/log-symbolicator';
import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { tailAndroid, tailIOS } from '~/lib/log-tail';
import { failure } from '~/lib/command-error';

import type logsCommand from './logs';

const handler: CommandHandler<typeof logsCommand.schema> = async ({
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
}) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
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
		return failure('invalid-input', `--level takes one of ${LOG_LEVELS.join(', ')}.`, {
			field: 'level',
		});
	}

	let pattern: RegExp | undefined;

	try {
		pattern = grep === void 0 ? void 0 : new RegExp(grep);
	} catch (error) {
		return failure(
			'invalid-input',
			`--grep is not a valid regular expression: ${String(error)}`,
			{ field: 'grep' },
		);
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
};

export default handler;
