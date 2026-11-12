#pragma once

#include <ffi.h>
#include <jsi/jsi.h>

#import "NativeFFI.h"

namespace loader::ios {
void dispatchFFIHook(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
void dispatchFFIHookBody(ffi_cif *cif, void *returnValue, void **arguments, void *userData);
bool setHookReturn(facebook::jsi::Runtime &runtime, const loader::ffi::Type &spec,
                   const facebook::jsi::Value &value, void *returnValue);
}
