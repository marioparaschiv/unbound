import { Type, type Static, type StaticDecode, type TObject } from 'typebox';

import type { ControllerClient } from './controller';
import type { RequestFailureCode } from './index';

/**
 * One command definition feeds both surfaces: the CLI builds flags and positionals from its schema,
 * and the MCP server uses the schema as the tool's input schema.
 */

/** The shared runtime a command handler runs against: the bridge controller it evaluates through. */
export type CommandContext = { client: ControllerClient };

/** Why a command failed, so a front end branches on `code` instead of the text. */
export const CommandErrorCodeSchema = Type.Union([
	/** A flag, positional or piped argument the command's schema rejects. */
	Type.Literal('invalid-input'),
	// The {@link RequestFailureCode}s, carried over from the eval or push that failed.
	Type.Literal('no-device'),
	Type.Literal('device-disconnected'),
	Type.Literal('timeout'),
	Type.Literal('bridge-unreachable'),
	Type.Literal('shut-down'),
	/** The device answered with a failure: code threw, or it sent what the CLI cannot read. */
	Type.Literal('device-error'),
	/** A named addon, snapshot or file does not exist. */
	Type.Literal('not-found'),
	/** A program the command runs, such as adb or jb-p1lot, failed. */
	Type.Literal('tool-failed'),
	/** The device or its loader lacks what the command needs. */
	Type.Literal('unsupported'),
	/** Any other failure; the text says why. */
	Type.Literal('command-failed'),
]);

export type CommandErrorCode = Static<typeof CommandErrorCodeSchema>;

// Fails to compile when the protocol gains a request failure code this union lacks.
const requestFailureCodes: RequestFailureCode extends CommandErrorCode ? true : never = true;

void requestFailureCodes;

/** A failed command's reason, as `--json` prints it and the MCP tool result carries it. */
export const CommandErrorSchema = Type.Object({
	code: CommandErrorCodeSchema,
	message: Type.String(),
	/** What to do about it. */
	hint: Type.Optional(Type.String()),
	/** The schema property the failure is about, for a form to highlight. */
	field: Type.Optional(Type.String()),
	stack: Type.Optional(Type.String()),
});

export type CommandError = Static<typeof CommandErrorSchema>;

/** What a command handler returns: a success flag, human-readable text, optional structured data, and why it failed. */
export type CommandOutput =
	| { ok: true; text: string; data?: unknown }
	| { ok: false; text: string; data?: unknown; error?: CommandError };

/** A command usable from both the CLI and (when opted in) the MCP server. */
export type CommandDefinition<S extends TObject = TObject> = {
	/** The word that runs it, under its group when it has one: `eval` in `ubd debug eval`. */
	name: string;
	description: string;
	/** The one line the CLI's menus show for it. */
	summary: string;
	/** Whether `ubd mcp` serves it as a tool. */
	mcp: boolean;
	/** Used directly as the MCP tool's input schema; the CLI adapter derives flags from its properties. */
	schema: S;
	/** Which schema properties the CLI presents as positionals; the rest become flags. */
	cli?: { positionals?: (keyof StaticDecode<S>)[] };
	handler(input: StaticDecode<S>, context: CommandContext): Promise<CommandOutput>;
};
