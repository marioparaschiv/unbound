export type TagGradients = {
	start: () => () => void;
	/** Resolves once every gradient layer is removed after `start`'s cleanup ran. */
	settled: () => Promise<void>;
	/** Reads back the gradients drawn on screen and lists the tags whose gradient is gone, colorless or empty. */
	problems: () => Promise<string[]>;
	drawn: () => number;
};
