import type { CommandHandler } from '~/lib/lazy-handler';
import { isStdinPiped, readStdin } from '~/lib/stdin';
import { withNativeBridge } from '~/lib/native-eval';
import { failure } from '~/lib/command-error';
import { runOnDevice } from '~/lib/device';

import type evalCommand from './eval';

const STDIN_MARKER = '-';

async function readSource(code: string | undefined, file: string | undefined) {
	if (file !== undefined) {
		const script = Bun.file(file);

		return (await script.exists()) ? script.text() : undefined;
	}

	if (code === STDIN_MARKER || (code === undefined && isStdinPiped())) {
		return readStdin();
	}

	return code;
}

const handler: CommandHandler<typeof evalCommand.schema> = async (
	{ code, file, native, timeout },
	{ client },
) => {
	const source = await readSource(code, file);

	if (source === undefined) {
		return file === undefined
			? failure('invalid-input', 'Pass the code to evaluate, --file, or pipe it on stdin.', {
					field: 'code',
				})
			: failure('invalid-input', `No file at ${file}.`, { field: 'file' });
	}

	return runOnDevice(client, native ? withNativeBridge(source) : source, timeout);
};

export default handler;
