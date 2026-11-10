import { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import type { EvalResult } from '@unbound-app/debugger-protocol';

/** One eval a command sent: the code and the timeout it asked for. */
export type SentEval = { code: string; timeout: number | undefined };

/**
 * @description A controller with a device attached that never dials a bridge: it records each eval and answers with `answer`.
 */
export class RecordingController extends ControllerClient {
	readonly sent: SentEval[] = [];
	readonly #answer: (code: string) => string;

	constructor(answer: (code: string) => string = () => '') {
		super('ws://127.0.0.1:0');
		this.#answer = answer;
	}

	override get isDeviceConnected(): boolean {
		return true;
	}

	override evaluate(code: string, timeout?: number): Promise<EvalResult> {
		this.sent.push({ code, timeout });

		return Promise.resolve({
			type: 'eval-result',
			id: '1',
			ok: true,
			value: this.#answer(code),
		});
	}
}
