class Counter {
	#count = 0;
	private secret = 1;
	protected step = 1;
	value = 0;

	get doubled(): number {
		return this.value * 2 + this.#count + this.secret;
	}

	increment(): void {
		this.value += this.step;
	}
}

export const counter = new Counter();

/**
 *
 */
export function render(): void {}

export type Widget = { id: string };
