# Client metro internals

**Metro runs on every module lookup: write for speed and Discord's unknown shapes.**

- `any` is allowed in metro (except `cache.ts`).
- Indexed loops with a cached length: `for (let i = 0, len = ids.length; i < len; i++)`.
- Flags as bits: `|=` set, `&= ~flag` clear, `& flag` test, `~idx` for an `indexOf` hit.
- A module that throws during search goes into `blacklist`; the search continues.
