import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import cn from '~/lib/cn';

type SourceFile = {
	name: string;
	lines: string[];
};

type Token = {
	text: string;
	className?: string;
};

// The real entry point and manifest of the first-party Hide Gift Button plugin, in packages/plugins.
const FILES: SourceFile[] = [
	{
		name: 'index.ts',
		lines: [
			"import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';",
			'',
			"import { patchGiftOrThreadButton } from '~/patches/chat-input-action-button-gift-or-thread';",
			"import { patchChatInputRightActions } from '~/patches/chat-input-right-actions';",
			'',
			'let dispose = () => {};',
			'',
			'function start() {',
			"\tdispose = applyFeatures('Hide Gift Button', [",
			'\t\tpatchGiftOrThreadButton,',
			'\t\tpatchChatInputRightActions,',
			'\t]);',
			'}',
			'',
			'function stop() {',
			'\tdispose();',
			'\tdispose = () => {};',
			'}',
			'',
			'export default { start, stop };',
		],
	},
	{
		name: 'manifest.json',
		lines: [
			'{',
			'\t"id": "unbound.hide-gift-button",',
			'\t"name": "Hide Gift Button",',
			'\t"description": "Hide the gift button from the chat composer.",',
			'\t"version": "1.0.0",',
			'\t"icon": "GiftIcon",',
			'\t"main": "index.ts"',
			'}',
		],
	},
];

const TOKEN_PATTERN =
	/('[^']*'|"[^"]*"|\b(?:import|from|let|function|export|default|return)\b|\b(?:start|stop|dispose|applyFeatures)\b)/;

const KEYWORDS = new Set(['import', 'from', 'let', 'function', 'export', 'default', 'return']);

function tokenize(line: string): Token[] {
	return line
		.split(TOKEN_PATTERN)
		.filter(Boolean)
		.map((text) => {
			if (text.startsWith("'") || text.startsWith('"')) {
				return { text, className: 'text-emerald-300' };
			}

			if (KEYWORDS.has(text)) {
				return { text, className: 'text-fuchsia-300' };
			}

			if (TOKEN_PATTERN.test(text)) {
				return { text, className: 'text-sky-300' };
			}

			return { text };
		});
}

/**
 * @description A two-tab editor window that shows a real first-party plugin's source.
 * @returns The code window.
 */
function CodeWindow() {
	const [active, setActive] = useState(0);
	const reduceMotion = useReducedMotion();
	const file = FILES[active];

	if (!file) return null;

	return (
		<div className='bg-[#0d0d10] shadow-float border border-white/10 rounded-surface w-full min-w-0 overflow-hidden font-mono text-[13px] leading-6'>
			<div className='flex items-center gap-2 px-4 border-white/10 border-b h-11'>
				<span className='bg-white/15 rounded-full size-2.5' />
				<span className='bg-white/15 rounded-full size-2.5' />
				<span className='bg-white/15 rounded-full size-2.5' />
				<span className='ml-3 text-muted-foreground text-xs truncate'>
					plugins/hide-gift-button/
				</span>
			</div>
			<div role='tablist' className='flex border-white/10 border-b text-xs'>
				{FILES.map(({ name }, index) => (
					<button
						key={name}
						type='button'
						role='tab'
						aria-selected={index === active}
						onClick={() => setActive(index)}
						className={cn(
							'px-4 py-2 border-white/10 border-r text-muted-foreground transition-colors',
							index === active && 'bg-white/5 text-foreground',
						)}
					>
						{name}
					</button>
				))}
			</div>
			<pre className='py-4 overflow-x-auto'>
				<code className='font-mono'>
					{file.lines.map((line, index) => (
						<motion.div
							key={`${file.name}-${index}`}
							initial={reduceMotion ? false : { opacity: 0, x: -6 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.2, delay: 0.025 * index }}
							className='flex pr-4'
						>
							<span className='inline-block pr-4 w-12 text-white/25 text-right select-none shrink-0'>
								{index + 1}
							</span>
							<span className='whitespace-pre'>
								{tokenize(line.replaceAll('\t', '  ')).map((token, position) => (
									<span key={position} className={token.className}>
										{token.text}
									</span>
								))}
							</span>
						</motion.div>
					))}
				</code>
			</pre>
		</div>
	);
}

export default CodeWindow;
