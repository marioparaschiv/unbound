import { shallow as zustandShallow, useShallow as zustandUseShallow } from 'zustand/shallow';

// Typed, not re-exported, so the SDK needs no zustand.

/** Compares two values one level deep: each own key, or each entry of a Map, Set or array, by `Object.is`. Pass it as `isEqual`. */
export const shallow: <T>(previous: T, next: T) => boolean = zustandShallow;

/** Wraps a selector so a result shallow-equal to its last one returns the last one, which skips the re-render. */
export const useShallow: <S, U>(selector: (state: S) => U) => (state: S) => U = zustandUseShallow;
