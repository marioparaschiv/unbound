import * as jsxDevRuntime from 'react/jsx-dev-runtime';
import * as jsxRuntime from 'react/jsx-runtime';
import * as React from 'react';

import type { AnyObject } from '../src/patcher';

// React freezes each element it creates in development only; on device (production) code may assign to one, as `result.type = ...`.
function thawed<T>(element: T): T {
	if (typeof element !== 'object' || element === null || !Object.isFrozen(element)) {
		return element;
	}

	const copy: AnyObject = { ...element };

	if (typeof copy.props === 'object' && copy.props !== null) {
		copy.props = { ...copy.props };
	}

	return copy;
}

function thaw<A extends unknown[], R>(create: (...args: A) => R): (...args: A) => R {
	return (...args) => thawed(create(...args));
}

/**
 * @description Builds replacements for the modules that create React elements, whose elements are not frozen, as on device.
 * @returns The replacement modules, by specifier: `react`, `react/jsx-runtime` and `react/jsx-dev-runtime`.
 */
export function createJsxRuntimes(): Record<string, AnyObject> {
	const react: AnyObject = {
		...React,
		createElement: thaw(React.createElement),
		cloneElement: thaw(React.cloneElement),
	};

	return {
		react: { ...react, default: react },
		'react/jsx-runtime': {
			...jsxRuntime,
			jsx: thaw(jsxRuntime.jsx),
			jsxs: thaw(jsxRuntime.jsxs),
		},
		'react/jsx-dev-runtime': {
			...jsxDevRuntime,
			jsxDEV: thaw(jsxDevRuntime.jsxDEV),
		},
	};
}
