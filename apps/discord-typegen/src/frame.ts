import type { FunctionInfo, ModuleContext, Value } from './values';
import type { PendingDefault } from './defaults';
import type { ComponentRecord } from './types';

import { UNKNOWN } from './values';

/** One function being walked: its registers, parameters and what its JSX is attributed to. */
export type Frame = {
	ctx: ModuleContext;
	fn: FunctionInfo | undefined;
	regs: Map<string, Value>;
	params: Value[];
	self: Value;
	/** The component JSX rendered in this frame is attributed to. */
	renderer: ComponentRecord | undefined;
	nested: FunctionInfo[];
	pendingDefault: PendingDefault | undefined;
};

/**
 * @description Reads parameter `index`; past the props object, a walked function's parameters are positional
 * parameters of its record.
 * @param frame The function being walked.
 * @param index The parameter index.
 * @returns What the parameter holds.
 */
export function param(frame: Frame, index: number): Value {
	const component = frame.fn?.component;

	return frame.params[index] ?? (component ? { kind: 'prop', component, name: index } : UNKNOWN);
}

/**
 * @description Reads a closure slot. Inside a generator hermes-dec numbers slots from another base, so none is trusted.
 * @param frame The function being walked.
 * @param name The slot name.
 * @returns What the slot holds.
 */
export function readSlot(frame: Frame, name: string): Value {
	return frame.fn?.generator ? UNKNOWN : (frame.ctx.slots.get(name) ?? UNKNOWN);
}

/**
 * @description Writes a closure slot, logging the previous value so the write can be undone.
 * @param frame The function being walked.
 * @param name The slot name.
 * @param value The value written.
 */
export function writeSlot(frame: Frame, name: string, value: Value) {
	const { ctx } = frame;

	if (frame.fn?.generator) return;

	ctx.slotWrites.push({ name, previous: ctx.slots.get(name) });
	ctx.slots.set(name, value);
}

/**
 * @description Undoes the slot writes made since `mark`, so the next sibling function starts from its parent's
 * slots: siblings reuse slot names for different environments.
 * @param ctx The module.
 * @param mark The write log length to return to.
 */
export function undoSlotWrites(ctx: ModuleContext, mark: number) {
	while (ctx.slotWrites.length > mark) {
		const { name, previous } = ctx.slotWrites.pop()!;

		if (previous === undefined) {
			ctx.slots.delete(name);
		} else {
			ctx.slots.set(name, previous);
		}
	}
}

export default { param, readSlot, writeSlot, undoSlotWrites };
