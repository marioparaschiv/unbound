type ProseProps = {
	text: string;
	className?: string;
};

/**
 * @description A description from the OpenAPI document, with backtick spans shown as inline code.
 * @param props The text and the paragraph's classes.
 * @returns The paragraph.
 */
function Prose({ text, className = 'text-foreground/80 leading-7' }: ProseProps) {
	return (
		<p className={className}>
			{text.split('`').map((part, index) =>
				index % 2 ? (
					<code
						key={index}
						className='bg-muted px-1.5 py-0.5 rounded-md font-mono text-[0.875em] text-foreground break-words'
					>
						{part}
					</code>
				) : (
					part
				),
			)}
		</p>
	);
}

export default Prose;
