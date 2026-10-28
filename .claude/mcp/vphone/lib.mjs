import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// .claude/mcp/vphone/lib.mjs -> repo root is three levels up.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Absolute paths to the shell scripts the tools delegate to (single source of truth for device quirks). */
export const SCRIPTS = {
	vphone: resolve(ROOT, '.claude/skills/vphone-ssh/scripts/vphone.sh'),
	logs: resolve(ROOT, '.claude/skills/vphone-ssh/scripts/vphone-logs.sh'),
};

/**
 * Run an executable and resolve with its trimmed stdout.
 * @param {string} bin Absolute path to the executable.
 * @param {string[]} args Arguments to pass.
 * @param {{ timeoutMs?: number }} [opts] Optional kill timeout in milliseconds.
 * @returns {Promise<string>} Trimmed stdout; rejects with stderr (or the spawn error) on non-zero exit.
 */
export const exec = (bin, args, { timeoutMs } = {}) =>
	new Promise((res, rej) =>
		execFile(
			bin,
			args,
			{ env: process.env, maxBuffer: 32 << 20, timeout: timeoutMs },
			(err, out, errOut) =>
				err ? rej(new Error(errOut?.trim() || err.message)) : res(out.trim()),
		),
	);

/**
 * Run the `vphone.sh` wrapper with the given subcommand args.
 * @param {string[]} args
 * @returns {Promise<string>}
 */
export const vphone = (args) => exec(SCRIPTS.vphone, args);

/**
 * Wrap text as a successful MCP tool result.
 * @param {string} text
 * @returns {object}
 */
export const ok = (text) => ({ content: [{ type: 'text', text: text || '(no output)' }] });

/**
 * Wrap an error as a failed MCP tool result.
 * @param {Error} err
 * @returns {object}
 */
export const fail = (err) => ({
	content: [{ type: 'text', text: `Error: ${err.message}` }],
	isError: true,
});

/**
 * Register a tool whose handler resolves to a string, folding the try/ok/fail boilerplate into one place.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} name Tool name.
 * @param {string} description Human/LLM-facing description.
 * @param {Record<string, import('zod').ZodTypeAny>} schema Zod input schema (use {} for no args).
 * @param {(args: object) => Promise<string>} handler Returns the text payload; thrown errors become tool errors.
 * @returns {ReturnType<import('@modelcontextprotocol/sdk/server/mcp.js').McpServer['tool']>}
 */
export const define = (server, name, description, schema, handler) =>
	server.tool(name, description, schema, async (args) => {
		try {
			return ok(await handler(args));
		} catch (err) {
			return fail(err);
		}
	});
