// Opaque declaration of facebook::react::ReactInstance (RN 0.83.1): just the two
// executor accessors the loader calls on the real instance from RCTInstance's
// _reactInstance ivar. Methods resolve from the React dylib via dynamic_lookup.
// Do NOT add data members or rely on sizeof(ReactInstance).

#pragma once

#include <ReactCommon/RuntimeExecutor.h>

namespace facebook::react {

class ReactInstance {
 public:
  RuntimeExecutor getUnbufferedRuntimeExecutor() noexcept;
  RuntimeExecutor getBufferedRuntimeExecutor() noexcept;
};

} // namespace facebook::react
