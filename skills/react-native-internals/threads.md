# JS thread latency

`ubd debug timing` measures timer and main-thread round-trip latency. Large numbers mean the JS thread is busy; find what runs with `ubd debug trace` per the `hermes-internals` skill.
