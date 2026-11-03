import { TYPE_TONE_CLASSES, tokenizeType } from '~/lib/type-tone';

type TypeTextProps = {
	/** A type or a value written as text, such as `string | { uri: string }` or `true`. */
	text: string;
};

/**
 * @description Colours a type or value written as text, token by token, in the same tones as the API reference.
 * @param props The text.
 * @returns The coloured tokens.
 */
function TypeText({ text }: TypeTextProps) {
	return tokenizeType(text).map((token, index) => (
		<span key={index} className={TYPE_TONE_CLASSES[token.tone]}>
			{token.text}
		</span>
	));
}

export default TypeText;
