const Colors = {
	red: '\u001b[31m',
	reset: '\u001b[0m',
	green: '\u001b[32m',
	gray: '\u001b[90m',
	blue: '\u001b[34m',
	yellow: '\u001b[33m',
	cyan: '\u001b[36m',
	bold: '\u001b[1m',
};

type Color = keyof typeof Colors;

/**
 * @description Wraps a string in the ANSI escape codes for the given color, resetting afterwards.
 * @param string The string to colorize.
 * @param color The color to apply, defaulting to `reset`.
 * @returns The ANSI-wrapped string.
 */
function colorize(string: string, color: Color = 'reset') {
	return Colors[color.toLowerCase() as keyof typeof Colors] + string + Colors.reset;
}

export default colorize;
