export const PLUGIN_NAME = 'Shiki Codeblocks';

export const PLUGIN_ID = 'unbound.shiki-codeblocks';

export const DEFAULT_THEME = 'dark-plus';

/** Settings that change how mounted cards look, so the renderer repaints or rebuilds them. */
export const CARD_SETTINGS = [
	'theme',
	'customTheme',
	'bgOpacity',
	'lineOverflow',
	'tryHljs',
	'useDevIcon',
];

export const SHIKI_LANGS_VERSION = '4.5.0';

export const SHIKI_ASSET_COMMIT = 'bc5436518111d87ea58eb56d97b3f9bec30e6b83';

export const LANGUAGE_CATALOG_URL =
	'https://cdn.jsdelivr.net/gh/Vencord/ShikiPluginAssets@75d69df9fdf596a31eef8b7f6f891231a6feab44/grammars.json';

export const Limits = {
	codeLength: 6000,
	tokenCacheEntries: 96,
	surfaces: 96,
	rowRetries: 4,
};

// Colors for the card before its Shiki theme loads, and for Highlight.js, which has no theme.
export const Palette = {
	light: {
		background: '#ffffff',
		foreground: '#333333',
		header: '#f3f3f3',
		lineNumber: '#8a8a8a',
		hljsForeground: '#24292e',
	},
	dark: {
		background: '#1e1e1e',
		foreground: '#d4d4d4',
		header: '#181818',
		lineNumber: '#858585',
		hljsForeground: '#c9d1d9',
	},
};

// Highlight.js scope colors as [light, dark], from GitHub's themes.
export const HLJS_SCOPE_COLORS: Record<string, readonly [string, string]> = {
	addition: ['#22863a', '#aff5b4'],
	attr: ['#005cc5', '#79c0ff'],
	attribute: ['#005cc5', '#79c0ff'],
	bullet: ['#735c0f', '#f2cc60'],
	built_in: ['#e36209', '#ffa657'],
	code: ['#6a737d', '#8b949e'],
	comment: ['#6a737d', '#8b949e'],
	deletion: ['#b31d28', '#ffdcd7'],
	doctag: ['#d73a49', '#ff7b72'],
	formula: ['#6a737d', '#8b949e'],
	keyword: ['#d73a49', '#ff7b72'],
	literal: ['#005cc5', '#79c0ff'],
	meta: ['#005cc5', '#79c0ff'],
	name: ['#22863a', '#7ee787'],
	number: ['#005cc5', '#79c0ff'],
	operator: ['#005cc5', '#79c0ff'],
	quote: ['#22863a', '#7ee787'],
	regexp: ['#032f62', '#a5d6ff'],
	section: ['#005cc5', '#1f6feb'],
	selector: ['#22863a', '#7ee787'],
	string: ['#032f62', '#a5d6ff'],
	subst: ['#24292e', '#c9d1d9'],
	symbol: ['#e36209', '#ffa657'],
	template: ['#d73a49', '#ff7b72'],
	title: ['#6f42c1', '#d2a8ff'],
	type: ['#d73a49', '#ff7b72'],
	variable: ['#005cc5', '#79c0ff'],
};

export const HTML_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

export const LANGUAGE_ALIASES: Record<string, string> = {
	bash: 'bash',
	c: 'c',
	cc: 'cpp',
	cpp: 'cpp',
	css: 'css',
	cxx: 'cpp',
	go: 'go',
	golang: 'go',
	h: 'c',
	html: 'html',
	java: 'java',
	js: 'javascript',
	json: 'json',
	jsonc: 'jsonc',
	jsx: 'javascript',
	kt: 'kotlin',
	kts: 'kotlin',
	kotlin: 'kotlin',
	md: 'markdown',
	markdown: 'markdown',
	py: 'python',
	python: 'python',
	rs: 'rust',
	rust: 'rust',
	sh: 'bash',
	shell: 'bash',
	sql: 'sql',
	swift: 'swift',
	ts: 'typescript',
	tsx: 'tsx',
	typescript: 'typescript',
	yml: 'yaml',
	yaml: 'yaml',
};

export const LANGUAGE_LABELS: Record<string, string> = {
	bash: 'Bash',
	c: 'C',
	cpp: 'C++',
	css: 'CSS',
	go: 'Go',
	html: 'HTML',
	java: 'Java',
	javascript: 'JavaScript',
	json: 'JSON',
	jsonc: 'JSONC',
	kotlin: 'Kotlin',
	markdown: 'Markdown',
	plain: 'Text',
	python: 'Python',
	rust: 'Rust',
	sql: 'SQL',
	swift: 'Swift',
	tsx: 'TSX',
	typescript: 'TypeScript',
	yaml: 'YAML',
};

export const ICON_MODES = ['disabled', 'greyscale', 'colored'];

export const HLJS_PREFERENCES = [
	{ label: 'Never', value: 'never' },
	{ label: 'Prefer Shiki', value: 'secondary' },
	{ label: 'Prefer Highlight.js', value: 'primary' },
	{ label: 'Always use Highlight.js', value: 'always' },
];

export const THEME_IDS = [
	'dark-plus',
	'andromeeda',
	'aurora-x',
	'ayu-dark',
	'catppuccin-latte',
	'catppuccin-frappe',
	'catppuccin-macchiato',
	'catppuccin-mocha',
	'dracula-soft',
	'dracula',
	'everforest-dark',
	'everforest-light',
	'github-dark-default',
	'github-dark-dimmed',
	'github-dark-high-contrast',
	'github-dark',
	'github-light-default',
	'github-light-high-contrast',
	'github-light',
	'gruvbox-dark-hard',
	'gruvbox-dark-medium',
	'gruvbox-dark-soft',
	'gruvbox-light-hard',
	'gruvbox-light-medium',
	'gruvbox-light-soft',
	'houston',
	'kanagawa-dragon',
	'kanagawa-lotus',
	'kanagawa-wave',
	'laserwave',
	'light-plus',
	'material-theme-darker',
	'material-theme',
	'material-theme-lighter',
	'material-theme-ocean',
	'material-theme-palenight',
	'material-candy',
	'min-dark',
	'min-light',
	'monokai',
	'night-owl',
	'nord',
	'one-dark-pro',
	'one-light',
	'plastic',
	'poimandres',
	'red',
	'rose-pine-dawn',
	'rose-pine-moon',
	'rose-pine',
	'slack-dark',
	'slack-ochin',
	'snazzy-light',
	'solarized-dark',
	'solarized-light',
	'synthwave-84',
	'tokyo-night',
	'vesper',
	'vitesse-black',
	'vitesse-dark',
	'vitesse-light',
];
