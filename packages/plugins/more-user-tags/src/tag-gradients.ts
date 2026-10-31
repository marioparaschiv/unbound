export type TagGradients = {
	/** Installs the hooks and returns the function that removes them and starts the teardown. */
	start: () => () => void;
	/** Resolves once every gradient layer is removed after `start`'s cleanup ran. */
	settled: () => Promise<void>;
	/** Reads back the gradients drawn on screen and lists the tags whose gradient is gone, colorless or empty. */
	problems: () => Promise<string[]>;
	/** How many gradients are drawn on screen. */
	drawn: () => number;
};
