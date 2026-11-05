import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags inline styles and theme tokens outside style files', async () => {
	const findings = await lintFixture('no-inline-styles', {
		'src/object.tsx': 'export const a = <View style={{ flex: 1 }} />;',
		'src/content-style.tsx':
			'export const a = <ScrollView contentContainerStyle={{ padding: 16 }} />;',
		'src/array.tsx': 'export const a = <View style={[styles.row, { gap: 8 }]} />;',
		'src/mixed.tsx':
			"export const a = <View style={[styles.row, { position: 'absolute', top }]} />;",
		'src/conditional.tsx': 'export const a = <View style={off ? { opacity: 0.5 } : null} />;',
		'src/dynamic.tsx': 'export const a = <View style={[styles.row, { width }]} />;',
		'src/dynamic-object.tsx': 'export const a = <View style={{ width: size, height }} />;',
		'src/key.tsx': 'export const a = <View style={[styles.row, off ? styles.off : null]} />;',
		'src/theme-colors.tsx':
			'export const a = <Text style={[styles.text, { color: Theme.colors.TEXT_MUTED }]} />;',
		'src/theme-radii.tsx': 'export const radius = Theme.radii.lg;',
		'src/use-token.tsx':
			'export const tint = Discord.useToken(Theme.unsafe_rawColors.RED_400);',
		'src/bare-use-token.tsx': 'export const tint = useToken(token);',
		'src/use-state.tsx': 'export const value = useState(0);',
		'src/row.style.ts':
			'export default Discord.createStyles({ text: { color: Theme.colors.TEXT_MUTED } });',
		'src/token.style.ts': 'export const tint = Discord.useToken(Theme.colors.TEXT_MUTED);',
		'tests/row.test.tsx':
			'export const a = <View style={{ flex: 1, color: Theme.colors.TEXT_MUTED }} />;',
	});

	expect(flaggedFiles(findings)).toEqual([
		'src/array.tsx',
		'src/bare-use-token.tsx',
		'src/conditional.tsx',
		'src/content-style.tsx',
		'src/mixed.tsx',
		'src/object.tsx',
		'src/theme-colors.tsx',
		'src/use-token.tsx',
	]);
	expect(findings.every(({ message }) => message.endsWith('(AGENTS.md)'))).toBe(true);
});
