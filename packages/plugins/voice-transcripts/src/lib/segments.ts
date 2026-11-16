export type TimedWord = { text: string; start: number; duration: number };

export type TranscriptSegment = { start: number; text: string };

const MAX_WORDS = 10;
const PAUSE_SECONDS = 0.8;
const SENTENCE_END = /[.!?…]["')\]]*$/;

/**
 * @description Groups a transcript's timed words into short passages to seek to: a passage ends at the end of a
 * sentence, at a pause, or after 10 words.
 * @param words The recognised words with their start and length in seconds.
 * @returns The passages with the time each starts at.
 */
export function groupWords(words: TimedWord[]): TranscriptSegment[] {
	const segments: TranscriptSegment[] = [];
	let current: TimedWord[] = [];

	function close() {
		if (current.length) {
			segments.push({
				start: current[0]!.start,
				text: current.map((word) => word.text).join(' '),
			});
		}

		current = [];
	}

	for (const word of words) {
		const previous = current.at(-1);

		if (previous && word.start - (previous.start + previous.duration) > PAUSE_SECONDS) close();

		current.push(word);

		if (SENTENCE_END.test(word.text) || current.length >= MAX_WORDS) close();
	}

	close();

	return segments;
}

/**
 * @description Writes a playback time as minutes and seconds.
 * @param seconds The time in seconds.
 * @returns The time, such as `0:07`.
 */
export function formatTime(seconds: number): string {
	const whole = Math.max(0, Math.floor(seconds));

	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export default { groupWords, formatTime };
