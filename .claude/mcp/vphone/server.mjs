#!/usr/bin/env node

/**
 * vphone MCP server — exposes the virtual iPhone (vphone) tooling as MCP tools.
 *
 * Every tool delegates to the shell scripts under `.claude/skills/vphone-ssh/scripts/`,
 * keeping a single source of truth for the device's quirks (scp -O, password sudo,
 * jq settings merges, the logarchive→ndjson log pipeline). The connection is
 * configured via env on the wrapper: VPHONE_HOST, VPHONE_PORT, VPHONE_USER, VPHONE_PASS.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { SCRIPTS, define, exec, vphone } from './lib.mjs';

const DISCORD = 'com.hammerandchisel.discord';
const server = new McpServer({ name: 'vphone', version: '1.0.0' });

define(server, 'vphone_ping', 'Check whether the virtual iPhone is reachable over SSH.', {}, () =>
	vphone(['ping']),
);

define(
	server,
	'vphone_ssh',
	'Run a shell command on the vphone (non-root).',
	{
		command: z.string().describe('Command to run on the device, e.g. "ls /var/mobile".'),
	},
	({ command }) => vphone(['ssh', 'sh', '-c', command]),
);

define(
	server,
	'vphone_sudo',
	'Run a shell command on the vphone as root.',
	{
		command: z
			.string()
			.describe('Command to run as root, e.g. "cat /var/mobile/.../settings.json".'),
	},
	({ command }) => vphone(['sudo', command]),
);

define(
	server,
	'vphone_push',
	'Copy a file from the host to the vphone (uses scp -O).',
	{
		local: z.string().describe('Local source path.'),
		remote: z.string().describe('Remote destination path on the device.'),
	},
	({ local, remote }) =>
		vphone(['push', local, remote]).then(() => `pushed ${local} -> ${remote}`),
);

define(
	server,
	'vphone_pull',
	'Copy a file from the vphone to the host (uses scp -O).',
	{
		remote: z.string().describe('Remote source path on the device.'),
		local: z.string().describe('Local destination path.'),
	},
	({ remote, local }) =>
		vphone(['pull', remote, local]).then(() => `pulled ${remote} -> ${local}`),
);

define(
	server,
	'vphone_app_data',
	"Resolve an app's Data container path on the vphone.",
	{
		bundleId: z.string().optional().describe(`Bundle id (default ${DISCORD}).`),
	},
	({ bundleId }) => vphone(bundleId ? ['app-data', bundleId] : ['app-data']),
);

define(
	server,
	'vphone_unbound_dir',
	'Print the Unbound directory path on the vphone (holds settings.json, unbound.js, Plugins/Themes/Fonts/i18n).',
	{},
	() => vphone(['unbound-dir']),
);

define(
	server,
	'vphone_settings_get',
	'Read the Unbound settings.json. Optionally apply a jq filter.',
	{
		filter: z.string().optional().describe('jq filter, e.g. ".unbound.loader.update.hmr".'),
	},
	({ filter }) => vphone(filter ? ['settings-get', filter] : ['settings-get']),
);

define(
	server,
	'vphone_settings_set',
	'Set unbound.<key> in settings.json to a JSON value (backs up + pushes).',
	{
		key: z.string().describe('Dotted key under the unbound store, e.g. "loader.update.hmr".'),
		value: z.string().describe('Raw JSON value, e.g. true, false, 42, or \'"a string"\'.'),
	},
	({ key, value }) => vphone(['settings-set', key, value]),
);

define(server, 'vphone_restart', 'Kill and relaunch Discord on the vphone.', {}, () =>
	vphone(['restart']),
);

define(
	server,
	'vphone_logs_udid',
	'Print the resolved vphone UDID used for log capture (the virtual iPhone, never the real device).',
	{},
	() => exec(SCRIPTS.logs, ['udid']),
);

define(
	server,
	'vphone_logs',
	'Snapshot structured, timestamped Unbound logs from the vphone. Reads os_log via logarchive+ndjson (no syslog regex) and emits clean "HH:MM:SS.mmm L [category|JS] message" lines from BOTH native (subsystem app.unbound) and JS/React Native console (subsystem com.facebook.react.log), all levels incl. debug/info. To capture exactly one action (e.g. a restart): note the current UNIX time (`date +%s`) BEFORE the action, run the action (vphone_restart), then pass that value as `since` — windows to precisely that boot instead of dumping history. Otherwise pass `seconds` for a relative look-back.',
	{
		since: z
			.number()
			.int()
			.optional()
			.describe(
				'Absolute UNIX timestamp to start from (capture `date +%s` BEFORE the action). Takes precedence over seconds; gives an exact window.',
			),
		seconds: z
			.number()
			.int()
			.min(1)
			.max(600)
			.optional()
			.describe(
				'Relative look-back window in seconds (default 30). Ignored if `since` is set.',
			),
		filter: z
			.string()
			.optional()
			.describe(
				'Optional case-insensitive fixed-string filter the line must contain, e.g. "[JS]", "updater", " E [".',
			),
	},
	({ since, seconds, filter }) => {
		// `since` -> exact window from an absolute time; otherwise a relative look-back.
		const [mode, value] = since != null ? ['since', since] : ['show', seconds ?? 30];
		const args = [mode, String(value), ...(filter ? [filter] : [])];
		// Budget: cover the whole window plus archive-pull overhead.
		const windowSecs = since != null ? Math.floor(Date.now() / 1000) - since : value;
		return exec(SCRIPTS.logs, args, { timeoutMs: (Math.max(windowSecs, 30) + 30) * 1000 });
	},
);

await server.connect(new StdioServerTransport());
