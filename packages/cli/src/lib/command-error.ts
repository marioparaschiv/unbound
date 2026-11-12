import type {
	CommandError,
	CommandErrorCode,
	CommandOutput,
} from '@unbound-app/debugger-protocol/registry';
import type { EvalResult } from '@unbound-app/debugger-protocol';

/** The shape every failed result shares. */
type Failed = { ok: false };

/** A failed {@link EvalResult}. */
type FailedEval = Extract<EvalResult, Failed>;

/** A failed command's output. */
export type FailedOutput = Extract<CommandOutput, Failed>;

/** What a failure adds beyond its code and text. */
type FailureDetails = Omit<CommandError, 'code' | 'message'> & {
	/** The error's message when it should differ from the text the CLI prints. */
	message?: string;
	data?: unknown;
};

/** One issue of a schema error, at a `/`-separated path. */
type SchemaIssue = { path: string };

/** A schema error as `safeParse` reports it. */
type SchemaFailure = { message: string; issues: SchemaIssue[] };

/**
 * @description Builds a failed command output whose error carries a code.
 * @param code Why it failed.
 * @param text The text the CLI prints, also the error's message unless `details.message` is set.
 * @param details A hint, field, separate message, stack or data.
 * @returns The failed output.
 */
export function failure(
	code: CommandErrorCode,
	text: string,
	details: FailureDetails = {},
): FailedOutput {
	const { data, message = text, ...rest } = details;
	const output: FailedOutput = { ok: false, text, error: { code, message, ...rest } };

	if (data !== void 0) {
		output.data = data;
	}

	return output;
}

/**
 * @description Builds the `invalid-input` failure for input a schema rejected, naming the property
 * of its first issue as the field.
 * @param error The schema error, with issues at `/`-separated paths.
 * @returns The failed output.
 */
export function inputFailure(error: SchemaFailure): FailedOutput {
	const field = error.issues[0]?.path.split('/')[1];

	return failure('invalid-input', error.message, field ? { field } : {});
}

/**
 * @description Builds a failed output from a failed eval: the bridge's request failure code when it
 * set one, else `device-error`, since the code itself threw on the device.
 * @param result The failed eval.
 * @param text The text to print; the eval's error when omitted.
 * @param data Data to keep beside the error.
 * @returns The failed output.
 */
export function evalFailure(
	result: FailedEval,
	text: string = result.error,
	// UNKNOWN: a command's data is whatever it chose to return.
	data?: unknown,
): FailedOutput {
	return failure(result.code ?? 'device-error', text, { message: result.error, data });
}

/**
 * @description Reads a failed output's error, naming a generic `command-failed` when the command set none.
 * @param output The failed output.
 * @returns Its error.
 */
export function commandError(output: FailedOutput): CommandError {
	return output.error ?? { code: 'command-failed', message: output.text };
}

export default { failure, inputFailure, evalFailure, commandError };
