import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';
import { LOG_LEVELS } from '~/lib/log-levels';

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
	follow: Type.Optional(
		Type.Boolean({
			description:
				'Keep printing new lines. On by default without --since; --since alone prints the history and exits.',
		}),
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
		'through its unified log. Runs until interrupted, or with --since prints the history and exits.',
	summary: "Tail Discord's log, or pull the loader's log files.",
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./logs-handler')),
};

export default logsCommand;
