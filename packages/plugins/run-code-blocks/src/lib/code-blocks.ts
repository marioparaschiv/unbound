/** A fenced code block in a message, by the Compiler Explorer language it is written in. */
export type CodeBlock = { language: string; code: string };

const FENCE = /```([\w+#-]+)[^\S\n]*\n([\s\S]*?)```/g;

const LANGUAGES: Record<string, string> = {
	py: 'python',
	python: 'python',
	python3: 'python',
	js: 'javascript',
	javascript: 'javascript',
	ts: 'typescript',
	typescript: 'typescript',
	rs: 'rust',
	rust: 'rust',
	go: 'go',
	golang: 'go',
	c: 'c',
	h: 'c',
	cpp: 'c++',
	'c++': 'c++',
	cc: 'c++',
	cxx: 'c++',
	hpp: 'c++',
	cs: 'csharp',
	csharp: 'csharp',
	'c#': 'csharp',
	java: 'java',
	kt: 'kotlin',
	kotlin: 'kotlin',
	swift: 'swift',
	rb: 'ruby',
	ruby: 'ruby',
	lua: 'lua',
	hs: 'haskell',
	haskell: 'haskell',
	zig: 'zig',
};

/**
 * @description Finds the code blocks in a message that name a language Compiler Explorer can run.
 * @param content The message text.
 * @returns The runnable blocks, in order.
 */
export function runnableBlocks(content: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];

	FENCE.lastIndex = 0;

	for (let match = FENCE.exec(content); match; match = FENCE.exec(content)) {
		const language = LANGUAGES[match[1]!.toLowerCase()];

		if (language && match[2]!.trim()) blocks.push({ language, code: match[2]! });
	}

	return blocks;
}
