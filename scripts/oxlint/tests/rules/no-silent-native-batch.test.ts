import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '~/lint-fixture';

test('flags an objc.batch whose failure is discarded', async () => {
	const findings = await lintFixture('no-silent-native-batch', {
		'src/arrow.ts': 'void objc.batch([]).catch(() => undefined);',
		'src/block.ts': 'void objc.batch([]).catch(() => {});',
		'src/then.ts': 'void objc.batch([]).then(() => 1).catch(() => null);',
		'src/noop.ts': 'void objc.batch([]).catch(noop);',
		'src/logged.ts':
			"void objc.batch([]).catch((error) => logger.warn('Failed to batch:', error));",
		'src/explained.ts': 'void objc.batch([]).catch(() => {\n\t// The view was released.\n});',
		'src/other.ts': "void objc.invokeAsync(view, 'setNeedsLayout', []).catch(() => undefined);",
	});

	expect(flaggedFiles(findings)).toEqual([
		'src/arrow.ts',
		'src/block.ts',
		'src/noop.ts',
		'src/then.ts',
	]);
});
