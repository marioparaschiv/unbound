import type { CommandHandler } from '~/lib/lazy-handler';
import { withNativeBridge } from '~/lib/native-eval';
import { runOnDevice } from '~/lib/device';

import type crashCommand from './crash';

const SIGSEGV = 11;
const HANG_GRACE_MS = 15_000;

function crashCode(kind: string, seconds: number): string {
	switch (kind) {
		case 'js':
			return "setTimeout(() => { throw new Error('ubd debug crash js'); }); 'thrown'";
		case 'abort':
			return "native.ffi.call(native.ffi.symbol('abort'), { returnType: 'void', args: [] }); 'aborted'";
		case 'segv':
			return `native.ffi.call(native.ffi.symbol('raise'), { returnType: 'i32', args: ['i32'] }, ${SIGSEGV}); 'raised'`;
		case 'objc-exception':
			return [
				"const exception = native.objc.invoke(native.objc.getClass('NSException'), 'exceptionWithName:reason:userInfo:', 'UbdDebugCrash', 'ubd debug crash objc-exception', null);",
				"native.ffi.call(native.ffi.symbol('objc_exception_throw'), { returnType: 'void', args: ['object'] }, exception);",
				"'thrown'",
			].join('\n');
		default:
			return [
				"if (native.platform === 'ios') {",
				`\tawait native.objc.invokeAsync(native.objc.getClass('NSThread'), 'sleepForTimeInterval:', ${seconds});`,
				'} else {',
				"\tconst thread = native.java.getClass('java.lang.Thread');",
				`\tawait native.java.batchAsync([{ op: 'invoke', handle: thread, name: 'sleep', args: [{ type: 'long', value: ${seconds * 1000} }] }]);`,
				'}',
				`'blocked ${seconds} s'`,
			].join('\n');
	}
}

const handler: CommandHandler<typeof crashCommand.schema> = ({ kind, seconds }, { client }) =>
	runOnDevice(
		client,
		withNativeBridge(crashCode(kind, seconds)),
		kind === 'hang' ? seconds * 1000 + HANG_GRACE_MS : undefined,
	);

export default handler;
