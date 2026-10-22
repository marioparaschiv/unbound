import { afterEach, describe, expect, mock, test } from 'bun:test';

let nativeHookClass: string | null = null;
let nativeHookSelector: string | null = null;
let nativeHookSelectors: string[] = [];
let nativeHookRemoveCount = 0;
let findByFilePathCount = 0;
let clipboardText: string | null = null;
let clipboardFailure = false;
let shownToasts: Array<{ title: string; content: string }> = [];
let selectedChannelId: string | null = null;

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			Clipboard: {
				setString(text: string) {
					if (clipboardFailure) return Promise.reject(new Error('Clipboard unavailable'));
					clipboardText = text;
					return Promise.resolve();
				},
			},
		},
		findByProps: (...properties: string[]) =>
			properties.includes('getLastSelectedChannelId')
				? { getLastSelectedChannelId: () => selectedChannelId }
				: null,
		findByFilePath: () => {
			findByFilePathCount++;
			return null;
		},
	},
	storage: {
		getStore: () => ({
			addListener: () => () => {},
			get: () => false,
			useSettingsStore: () => ({ get: () => false, set: () => {} }),
		}),
	},
}));
mock.module('@shared/settings-ui', () => ({
	getSettingsColors: () => ({}),
	SettingsCard: () => null,
	SettingsRow: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const {
	buildNativeCodeMarkup,
	codeBlockLayout,
	codeScrollHeight,
	codeSurfaceMatchesCell,
	copyCodeToClipboard,
	default: plugin,
	getCodeBlockTokens,
	getTokens,
	locateCodeBlocks,
	measureCodeRow,
	matchCodeBlock,
	parseFencedCodeBlocks,
	resolveMessageContent,
	resolveLanguage,
	shouldCorrectRow,
	shouldRebuildNativeSurface,
} = await import('@shiki-codeblocks/index');
const { highlightCodeToTokens, highlightLanguageLabel, shouldUseHighlightJs } =
	await import('@shiki-codeblocks/highlight-js');
const { loadThemeDefinition } = await import('@shiki-codeblocks/catalog');
const { default: manifest } = await import('../manifest.json');

afterEach(() => {
	plugin.stop();
	nativeHookClass = null;
	nativeHookSelector = null;
	nativeHookSelectors = [];
	nativeHookRemoveCount = 0;
	findByFilePathCount = 0;
	clipboardText = null;
	clipboardFailure = false;
	shownToasts = [];
	selectedChannelId = null;
});

describe('language aliases', () => {
	test('resolves supported aliases case-insensitively', () => {
		expect(resolveLanguage('TS')).toBe('typescript');
		expect(resolveLanguage('js')).toBe('javascript');
		expect(resolveLanguage(' yml ')).toBe('yaml');
	});

	test('does not resolve unsupported and unlabelled language names', () => {
		expect(resolveLanguage('brainfuck')).toBeNull();
		expect(resolveLanguage(undefined)).toBeNull();
	});
});

describe('remote themes', () => {
	test('defaults VS Code themes without a declared type to dark', async () => {
		const theme = await loadThemeDefinition('https://themes.example/theme.json', async () => ({
			ok: true,
			status: 200,
			text: async () => '{"colors":{"editor.background":"#161616"},"tokenColors":[]}',
		}));

		expect(theme.type).toBe('dark');
	});

	test('loads JSON with comments and inherits a relative base theme', async () => {
		const definitions = new Map([
			[
				'https://themes.example/material.json',
				'{\n// Theme metadata\n"include":"./dark_vs.json",\n"colors":{"editor.foreground":"#eeeeee"},\n"tokenColors":[{"scope":"keyword","settings":{"foreground":"#ff0000"}}],\n}',
			],
			[
				'https://themes.example/dark_vs.json',
				'{"type":"dark","colors":{"editor.background":"#101010","editor.foreground":"#aaaaaa"},"tokenColors":[{"scope":"string","settings":{"foreground":"#00ff00"}}]}',
			],
		]);
		const fetched: string[] = [];
		const theme = await loadThemeDefinition(
			'https://themes.example/material.json',
			async (url) => {
				fetched.push(url);
				return { ok: true, status: 200, text: async () => definitions.get(url) ?? '' };
			},
		);

		expect(fetched).toEqual([
			'https://themes.example/material.json',
			'https://themes.example/dark_vs.json',
		]);
		expect(theme.type).toBe('dark');
		expect(theme.colors).toEqual({
			'editor.background': '#101010',
			'editor.foreground': '#eeeeee',
		});
		expect(theme.tokenColors).toEqual([
			{ scope: 'string', settings: { foreground: '#00ff00' } },
			{ scope: 'keyword', settings: { foreground: '#ff0000' } },
		]);
	});
});

describe('native fenced code matching', () => {
	test('parses supported blocks and preserves indentation', () => {
		const blocks = parseFencedCodeBlocks(
			'Before\n```ts title=example.ts\nconst answer = 42;\n    return answer;\n```\nAfter',
		);

		expect(blocks).toEqual([
			{
				code: 'const answer = 42;\n    return answer;',
				language: 'typescript',
			},
		]);
	});

	test('copies blank lines inside a fence without changing native matching', async () => {
		const [block] = parseFencedCodeBlocks('```ts\n\nconst answer = 42;\n\n```');
		const rendered = '\nconst answer = 42;\n';

		expect(locateCodeBlocks([block], rendered)).toHaveLength(1);
		await copyCodeToClipboard(block.originalCode ?? block.code, (toast) =>
			shownToasts.push(toast),
		);
		expect(clipboardText).toBe('\nconst answer = 42;\n');
	});

	test('matches native text after newline normalization and retains unsupported blocks', () => {
		const blocks = parseFencedCodeBlocks(
			'```brainfuck\n++++\n```\n~~~js\r\nconsole.log(1);\r\n~~~',
		);

		expect(blocks).toEqual([
			{ code: '++++', language: 'plain' },
			{ code: 'console.log(1);', language: 'javascript' },
		]);
		expect(matchCodeBlock(blocks, '\nconsole.log(1);\n\n')).toEqual(blocks[1]);
		expect(matchCodeBlock(blocks, 'console.log(2);')).toBeUndefined();
	});

	test('renders an unlabelled fence as a plain code card', async () => {
		const blocks = parseFencedCodeBlocks('Before\n```\nplain value\n```\nAfter');
		const tokens = await getTokens('plain value', blocks[0].language, 'dark-plus');

		expect(blocks).toEqual([{ code: 'plain value', language: 'plain' }]);
		expect(tokens?.[0].map((token) => token.content).join('')).toBe('plain value');
	});

	test('preserves a Highlight.js-only language when Shiki has no grammar', () => {
		expect(parseFencedCodeBlocks('```php-template\n<?php echo 1; ?>\n```')).toEqual([
			{ code: '<?php echo 1; ?>', language: 'plain', sourceLanguage: 'php-template' },
		]);
	});

	test('rejects mismatched or too-short fences', () => {
		expect(
			parseFencedCodeBlocks('```ts\nconst value = 1;\n~~\n~~~ts\nconst value = 2;\n~~~'),
		).toEqual([]);
	});

	test('keeps shorter fence lines inside a longer fenced block', () => {
		const blocks = parseFencedCodeBlocks(
			'````ts\nconst text = "```";\n```\nconst after = true;\n````',
		);

		expect(blocks).toEqual([
			{
				code: 'const text = "```";\n```\nconst after = true;',
				language: 'typescript',
			},
		]);
	});

	test('leaves long fences alone when Discord splits their native rendering', () => {
		const blocks = parseFencedCodeBlocks(
			'Long fence parser test.\n\n````ts\nconst fence = "```";\n```\nconst kept = true;\n````\n\nThis sentence must stay below the one card.',
		);
		const rendered =
			'Long fence parser test.\n\n\n`ts\nconst fence = "\n\n";\n\nconst kept = true;\n\n`\n\nThis sentence must stay below the one card.';

		expect(locateCodeBlocks(blocks, rendered)).toEqual([]);
	});

	test('locates a fenced block between ordinary text without replacing the text', () => {
		const blocks = parseFencedCodeBlocks(
			'Before the code block.\n\n```ts\nconst answer = 42;\n```\n\nAfter the code block.',
		);
		const rendered =
			'Before the code block.\n\n\nconst answer = 42;\n\n\nAfter the code block.';
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toEqual([
			{
				block: blocks[0],
				start: 'Before the code block.'.length,
				end: rendered.indexOf('After the code block.'),
			},
		]);
		expect(rendered.slice(0, placements[0]?.start)).toBe('Before the code block.');
		expect(rendered.slice(placements[0]?.end)).toBe('After the code block.');
	});

	test('locates multiple blocks in order and leaves intervening text intact', () => {
		const blocks = parseFencedCodeBlocks(
			'Before\n```ts\nconst value = 1;\n```\nBetween\n```py\nprint(2)\n```\nAfter',
		);
		const rendered = 'Before\n\nconst value = 1;\n\nBetween\n\nprint(2)\n\nAfter';
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toHaveLength(2);
		expect(rendered.slice(placements[0].end, placements[1].start)).toBe('Between');
		expect(rendered.slice(placements[1].end)).toBe('After');
	});

	test('preserves message-link attachment text around a code block', () => {
		const blocks = parseFencedCodeBlocks(
			'Before https://discord.com/channels/709061970078335027/709062739581992971/1555962053007769671\n```ts\nconst value = 1;\n```\nAfter',
		);
		const prefix = 'Before \uFFFC\u2068development\u2069\n';
		const suffix = '\nAfter';
		const rendered = `${prefix}const value = 1;${suffix}`;
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toHaveLength(1);
		expect(rendered.slice(0, placements[0].start)).toBe('Before \uFFFC\u2068development\u2069');
		expect(rendered.slice(placements[0].end)).toBe('After');
	});

	test('loads cross-channel embedded code from the linked message channel', () => {
		const store = {
			getMessage(channelId: string, messageId: string) {
				return channelId === 'linked-channel' && messageId === 'linked-message'
					? { content: '```ts\nconst linked = true;\n```' }
					: null;
			},
		};

		expect(
			resolveMessageContent(store, 'linked-message', 'linked-channel', 'open-channel'),
		).toBe('```ts\nconst linked = true;\n```');
	});

	test('falls back to the visible channel when a native message has no channel ID', () => {
		const store = {
			getMessage(channelId: string, messageId: string) {
				return channelId === 'open-channel' && messageId === 'open-message'
					? { content: '```ts\nconst open = true;\n```' }
					: null;
			},
		};

		expect(resolveMessageContent(store, 'open-message', undefined, 'open-channel')).toBe(
			'```ts\nconst open = true;\n```',
		);
	});

	test('locates repeated code in separate fences without merging their ranges', () => {
		const blocks = parseFencedCodeBlocks(
			'```ts\nconst same = true;\n```\nBetween\n```ts\nconst same = true;\n```',
		);
		const rendered = '\nconst same = true;\n\nBetween\n\nconst same = true;\n';
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toHaveLength(2);
		expect(placements[0].end).toBeLessThanOrEqual(placements[1].start);
		expect(rendered.slice(placements[0].end, placements[1].start)).toBe('Between');
	});

	test('does not target ambiguous code that also occurs outside a block', () => {
		const blocks = parseFencedCodeBlocks('```ts\nconst value = 1;\n```');
		expect(locateCodeBlocks(blocks, 'const value = 1;\nconst value = 1;')).toEqual([]);
		expect(locateCodeBlocks([...blocks, ...blocks], '\nconst value = 1;\n')).toEqual([]);
	});
});

describe('native syntax rendering', () => {
	test('measures a code row and its attachment in one asynchronous native pass', async () => {
		const selectors: string[] = [];
		const bridge = {
			batch(steps: Array<{ selector: string }>) {
				selectors.push(...steps.map((step) => step.selector));
				return Promise.resolve([
					true,
					null,
					null,
					{},
					{ value: { size: { height: 217.5 } } },
					{ value: { size: { height: 217.5 } } },
					{ value: { origin: { y: 0 }, size: { height: 217.5 } } },
					{ value: { origin: { y: 40 }, size: { height: 217.5 } } },
				]);
			},
		};

		const geometry = await measureCodeRow(bridge as never, {} as never, {} as never);

		expect(geometry).toEqual({ cellHeight: 217.5, contentHeight: 217.5, labelBottom: 257.5 });
		expect(selectors).toEqual([
			'isDescendantOfView:',
			'layoutIfNeeded',
			'layoutIfNeeded',
			'contentView',
			'frame',
			'frame',
			'bounds',
			'convertRect:toView:',
		]);
	});

	test('copies the exact code and confirms it with an Unbound toast', async () => {
		const code = 'const answer = 42;\nconsole.log(answer);';

		expect(await copyCodeToClipboard(code, (toast) => shownToasts.push(toast))).toBe(true);
		expect(clipboardText).toBe(code);
		expect(shownToasts).toEqual([
			{ title: 'Shiki Codeblocks', content: 'Code copied to clipboard.' },
		]);
	});

	test('does not claim the copy succeeded when clipboard access fails', async () => {
		clipboardFailure = true;

		expect(
			await copyCodeToClipboard('const answer = 42;', (toast) => shownToasts.push(toast)),
		).toBe(false);
		expect(clipboardText).toBeNull();
		expect(shownToasts).toEqual([
			{ title: 'Shiki Codeblocks', content: 'Could not copy code.' },
		]);
	});

	test('renders Highlight.js keywords in the numbered code card', () => {
		const tokens = highlightCodeToTokens(
			'const value = 42;\nreturn value;',
			'javascript',
			false,
		);
		const markup = buildNativeCodeMarkup(tokens, false);

		expect(markup.text).toBe(' 1 const value = 42;\n 2 return value;');
		expect(markup.spans.some((span) => span.color !== '#c9d1d9' && span.location >= 3)).toBe(
			true,
		);
	});

	test('preserves angle brackets and ampersands in unsupported Highlight.js code', () => {
		const tokens = highlightCodeToTokens('<Tag>& unknown', 'unknown-language', false);

		expect(tokens[0].map((token) => token.content).join('')).toBe('<Tag>& unknown');
	});

	test('labels a Highlight.js-only grammar by its language name', () => {
		expect(highlightLanguageLabel('php-template')).toBe('PHP template');
	});

	test('chooses the Vencord highlighter preference without dropping the code card', () => {
		expect(shouldUseHighlightJs('javascript', true, 'never')).toBe(false);
		expect(shouldUseHighlightJs('javascript', true, 'secondary')).toBe(false);
		expect(shouldUseHighlightJs('javascript', true, 'primary')).toBe(true);
		expect(shouldUseHighlightJs('javascript', false, 'secondary')).toBe(true);
		expect(shouldUseHighlightJs('unknown-language', false, 'primary')).toBe(false);
		expect(shouldUseHighlightJs('', false, 'primary')).toBe(true);
		expect(shouldUseHighlightJs('unknown-language', false, 'always')).toBe(true);
	});

	test('keeps the native card and line numbers when Highlight.js is preferred', async () => {
		const code = 'const value = 42;';
		const tokens = await getCodeBlockTokens(
			{ code, language: 'javascript' },
			'dark-plus',
			'primary',
		);
		const markup = buildNativeCodeMarkup(tokens ?? [], false);

		expect(markup.text).toBe(' 1 const value = 42;');
		expect(markup.spans.some((span) => span.color === '#ff7b72')).toBe(true);
	});

	test('reuses Highlight.js tokens for repeated rows without mixing light and dark colors', async () => {
		const block = { code: 'const value = 42;', language: 'javascript' };
		const dark = await getCodeBlockTokens(block, 'dark-plus', 'primary');
		const darkAgain = await getCodeBlockTokens(block, 'dark-plus', 'primary');
		const light = await getCodeBlockTokens(block, 'light-plus', 'primary');

		expect(darkAgain).toBe(dark);
		expect(light).not.toBe(dark);
		expect(light?.[0].some((token) => token.color === '#d73a49')).toBe(true);
	});

	test('does not reuse a code surface after its message cell is recycled', () => {
		const surface = { cellKey: 'cell-1', channelId: 'channel-1', messageId: 'message-1' };

		expect(codeSurfaceMatchesCell(surface, 'channel-1', 'message-1', 'cell-1')).toBe(true);
		expect(codeSurfaceMatchesCell(surface, 'channel-1', 'message-2', 'cell-1')).toBe(false);
		expect(codeSurfaceMatchesCell(surface, 'channel-2', 'message-1', 'cell-1')).toBe(false);
		expect(codeSurfaceMatchesCell(surface, 'channel-1', 'message-1', 'cell-2')).toBe(false);
	});

	test('corrects a cell when its label extends beyond the reported content height', () => {
		expect(shouldCorrectRow(217.5, 217.5, 257.5)).toBe(true);
		expect(shouldCorrectRow(257.5, 257.5, 257.5)).toBe(false);
	});

	test('does not rebuild embed geometry when only the highlighter changes', () => {
		expect(shouldRebuildNativeSurface('tryHljs')).toBe(false);
		expect(shouldRebuildNativeSurface('lineOverflow')).toBe(true);
		expect(shouldRebuildNativeSurface('useDevIcon')).toBe(true);
	});

	test('loads and tokenizes a bundled grammar on demand', async () => {
		const tokens = await getTokens('const answer = 42;', 'typescript', 'dark-plus');

		expect(tokens).not.toBeNull();
		expect(tokens?.[0].map((token) => token.content).join('')).toBe('const answer = 42;');
		expect(tokens?.[0].some((token) => token.color !== '#D4D4D4')).toBe(true);
	});

	test('keeps long lines on one row in horizontal-scroll mode', () => {
		const code = `const result = ${'item + '.repeat(20)}42;\nreturn result;`;
		const wrapped = codeBlockLayout(code, 240, 'wrap');
		const scrolled = codeBlockLayout(code, 240, 'scroll');

		expect(scrolled.height).toBeLessThan(wrapped.height);
		expect(scrolled.contentWidth).toBeGreaterThan(240);
		expect(scrolled.contentWidth).toBeGreaterThan((code.split('\n')[0].length + 3) * 8);
	});

	test('keeps oversized code content scrollable inside a capped card', () => {
		const code = Array.from({ length: 36 }, (_, index) => `print(${index + 1})`).join('\n');
		const layout = codeBlockLayout(code, 240, 'wrap');

		expect(layout.height).toBe(520);
		expect(layout.contentHeight).toBeGreaterThan(layout.height - 50);
		expect(codeScrollHeight(516, layout.height - 50)).toBe(518);
		expect(codeScrollHeight(28, 38)).toBe(38);
	});

	test('builds line-numbered text and coalesced token color spans for the dark theme', () => {
		const markup = buildNativeCodeMarkup(
			[
				[
					{ content: 'const ', offset: 0, color: '#c586c0', fontStyle: 0 },
					{ content: 'answer', offset: 6, color: '#9cdcfe', fontStyle: 0 },
				],
				[
					{ content: 'return ', offset: 0, color: '#c586c0', fontStyle: 0 },
					{ content: 'answer', offset: 7, color: '#9cdcfe', fontStyle: 0 },
				],
			],
			false,
		);

		expect(markup.text).toBe(' 1 const answer\n 2 return answer');
		expect(markup.spans).toEqual([
			{ color: '#858585', location: 0, length: 3 },
			{ color: '#c586c0', location: 3, length: 6 },
			{ color: '#9cdcfe', location: 9, length: 6 },
			{ color: '#858585', location: 16, length: 3 },
			{ color: '#c586c0', location: 19, length: 7 },
			{ color: '#9cdcfe', location: 26, length: 6 },
		]);
	});

	test('uses a light line-number color when the light theme is active', () => {
		const markup = buildNativeCodeMarkup(
			[[{ content: 'const value = 1;', offset: 0, color: '#0000ff', fontStyle: 0 }]],
			true,
		);

		expect(markup.spans[0]).toEqual({ color: '#8a8a8a', location: 0, length: 3 });
		expect(markup.spans[1]).toEqual({ color: '#0000ff', location: 3, length: 16 });
	});

	test('preserves Shiki italic, bold, and underline token styles', () => {
		const markup = buildNativeCodeMarkup(
			[
				[
					{ content: 'alpha', offset: 0, color: '#ffffff', fontStyle: 1 },
					{ content: 'beta', offset: 5, color: '#ffffff', fontStyle: 2 },
					{ content: 'gamma', offset: 9, color: '#ffffff', fontStyle: 4 },
				],
			],
			false,
		);

		expect(markup.spans.slice(1)).toEqual([
			{ color: '#ffffff', location: 3, length: 5, fontStyle: 1 },
			{ color: '#ffffff', location: 8, length: 4, fontStyle: 2 },
			{ color: '#ffffff', location: 12, length: 5, fontStyle: 4 },
		]);
	});
});

describe('plugin lifecycle', () => {
	test('identifies a recycled cell without waiting for the main thread', () => {
		let reused: ((context: { self: object }) => void) | undefined;
		const currentThreadCalls: string[] = [];
		const mainThreadCalls: string[] = [];
		const native = {
			objc: {
				hook(
					_className: string,
					selector: string,
					handlers: { after?: (context: { self: object }) => void },
				) {
					if (selector === 'prepareForReuse') reused = handlers.after;
					return { active: true, remove: () => undefined };
				},
				call(_handle: object, selector: string) {
					currentThreadCalls.push(selector);
					return 123;
				},
				invoke(_handle: object, selector: string) {
					mainThreadCalls.push(selector);
					return 123;
				},
			},
		};

		plugin.start({ native } as never);
		reused?.({ self: {} });

		expect(currentThreadCalls).toEqual(['hash']);
		expect(mainThreadCalls).toEqual([]);
	});

	test('declares the capabilities used by its asynchronous scan', () => {
		expect(manifest.capabilities).toContain('native.objc.batch');
		expect(manifest.capabilities).toContain('native.objc.snapshot');
	});

	test('scans visible labels through bounded asynchronous native calls', async () => {
		selectedChannelId = 'channel';
		const selectors: string[][] = [];
		const window = {};
		const label = {};
		const searches: unknown[] = [];
		const native = {
			objc: {
				getClass: () => ({}),
				hook: () => ({ active: true, remove: () => undefined }),
				batch(requests: Array<{ selector: string }>) {
					selectors.push(requests.map((request) => request.selector));
					return Promise.resolve(selectors.length === 1 ? [{}, [], window] : [null]);
				},
				findViews(_root: object, _className: string, options: unknown) {
					searches.push(options);
					return Promise.resolve([label]);
				},
				invoke() {
					throw new Error(
						'The startup scan must not synchronously cross to the main thread',
					);
				},
			},
		};

		plugin.start({ native } as never);
		await Bun.sleep(340);

		expect(selectors).toEqual([
			['sharedApplication', 'windows', 'keyWindow'],
			['attributedText'],
		]);
		expect(searches).toEqual([
			{
				maxDepth: 40,
				maxVisited: 2048,
				maxResults: 256,
				attachedOnly: true,
			},
		]);
	});

	test('discards a startup scan after the channel changes', async () => {
		selectedChannelId = 'original';
		let finishBatch: (values: unknown[]) => void = () => undefined;
		let searches = 0;
		const pending = new Promise<unknown[]>((resolve) => {
			finishBatch = resolve;
		});
		const native = {
			objc: {
				getClass: () => ({}),
				hook: () => ({ active: true, remove: () => undefined }),
				batch: () => pending,
				findViews: () => {
					searches++;
					return Promise.resolve([]);
				},
			},
		};

		plugin.start({ native } as never);
		await Bun.sleep(320);
		selectedChannelId = 'other';
		finishBatch([{}, [], {}]);
		await Bun.sleep(5);

		expect(searches).toBe(0);
	});

	test('checks moved labels through one asynchronous native batch', async () => {
		selectedChannelId = 'original';
		const steps: string[][] = [];
		let moved: ((context: { self: object }) => void) | undefined;
		const native = {
			objc: {
				hook(
					_className: string,
					selector: string,
					handlers: { after?: (context: { self: object }) => void },
				) {
					if (selector === 'didMoveToWindow') moved = handlers.after;
					return { active: true, remove: () => undefined };
				},
				batch(requests: Array<{ selector: string }>) {
					steps.push(requests.map((request) => request.selector));
					return Promise.resolve([true, null]);
				},
				invoke() {
					throw new Error('Moved labels must not synchronously cross to the main thread');
				},
			},
		};

		plugin.start({ native } as never);
		moved?.({ self: {} });
		await Bun.sleep(30);

		expect(steps).toEqual([['window', 'attributedText']]);
	});

	test('discards a moved label after the channel changes', async () => {
		selectedChannelId = 'original';
		let moved: ((context: { self: object }) => void) | undefined;
		let finishBatch: (values: unknown[]) => void = () => undefined;
		let synchronousCalls = 0;
		const pending = new Promise<unknown[]>((resolve) => {
			finishBatch = resolve;
		});
		const native = {
			objc: {
				hook(
					_className: string,
					selector: string,
					handlers: { after?: (context: { self: object }) => void },
				) {
					if (selector === 'didMoveToWindow') moved = handlers.after;
					return { active: true, remove: () => undefined };
				},
				batch: () => pending,
				invoke: () => {
					synchronousCalls++;
					return null;
				},
			},
		};

		plugin.start({ native } as never);
		moved?.({ self: {} });
		await Bun.sleep(30);
		selectedChannelId = 'other';
		finishBatch([true, {}]);
		await Bun.sleep(5);

		expect(synchronousCalls).toBe(0);
	});

	test('uses the native label hook without replacing the Markdown renderer', () => {
		const native = {
			objc: {
				hook(className: string, selector: string) {
					nativeHookClass = className;
					nativeHookSelector = selector;
					nativeHookSelectors.push(selector);
					return { remove: () => nativeHookRemoveCount++ };
				},
			},
		};

		plugin.start({ native } as never);
		plugin.start({ native } as never);

		expect(nativeHookClass).toBe('DCDMessageTableViewCell');
		expect(nativeHookSelector).toBe('prepareForReuse');
		expect(nativeHookSelectors).toEqual([
			'setAttributedText:',
			'didMoveToWindow',
			'prepareForReuse',
		]);
		expect(findByFilePathCount).toBe(0);
		plugin.stop();
		expect(nativeHookRemoveCount).toBe(3);
	});
});
