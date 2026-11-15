export const SPEECH_RATE = 16_000;

/**
 * @description Turns 16-bit PCM into mono at another rate: channels are averaged, and the samples are averaged over each
 * output sample's span when shrinking, or interpolated when growing.
 * @param input Interleaved 16-bit samples.
 * @param rate The input's sample rate.
 * @param channels The input's channel count.
 * @param target The output rate.
 * @returns Mono 16-bit samples at the target rate.
 */
export function toMono(
	input: Int16Array,
	rate: number,
	channels: number,
	target = SPEECH_RATE,
): Int16Array {
	const frames = Math.floor(input.length / Math.max(1, channels));
	const mono = new Float32Array(frames);

	for (let frame = 0; frame < frames; frame++) {
		let sum = 0;

		for (let channel = 0; channel < channels; channel++)
			sum += input[frame * channels + channel]!;

		mono[frame] = sum / channels;
	}

	const ratio = rate / target;
	const length = Math.floor(frames / ratio);
	const output = new Int16Array(length);

	for (let index = 0; index < length; index++) {
		const start = index * ratio;
		let value: number;

		if (ratio > 1) {
			const from = Math.floor(start);
			const to = Math.min(frames, Math.floor(start + ratio));
			let sum = 0;

			for (let frame = from; frame < to; frame++) sum += mono[frame]!;

			value = sum / Math.max(1, to - from);
		} else {
			const from = Math.floor(start);
			const weight = start - from;

			value =
				mono[from]! * (1 - weight) + (mono[Math.min(frames - 1, from + 1)] ?? 0) * weight;
		}

		output[index] = Math.max(-32768, Math.min(32767, Math.round(value)));
	}

	return output;
}
