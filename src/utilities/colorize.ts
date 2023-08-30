export const Colors = {
	red: '\u001b[31m',
	reset: '\u001b[0m',
	green: '\u001b[32m',
	gray: '\u001b[90m',
	blue: '\u001b[34m',
	yellow: '\u001b[33m'
};

type Color = keyof typeof Colors;

function colorize(input: string, color: Color = 'reset') {
	return Colors[color.toLowerCase()] + input + Colors.reset;
};

export default colorize;