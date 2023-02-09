declare type Fn = (...args: any) => any;

declare type Constructor = (new () => any);

declare type AnyProps<T extends { [prop: string]: any; } = Record<string, any>> = {
  [name: string]: any;
} & T;