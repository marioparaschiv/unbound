/** Whether `T` is `any`, so a patch on an untyped method or component keeps loose types. */
export type IsUntyped<T> = 0 extends 1 & T ? true : false;
