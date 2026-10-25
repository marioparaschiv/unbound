#pragma once

#include <cstddef>
#include <cstdint>
#include <ffi.h>
#include <memory>
#include <vector>

#include "NativeFFITypes.h"
#include "NativeFFIValues.h"

namespace loader::ffi {
struct CallInterface {
    ffi_cif                 cif{};
    Type                    result;
    std::vector<Type>       arguments;
    std::vector<ffi_type *> argumentTypes;
};

constexpr std::size_t kCallInterfaceCacheCapacity = 128;

ffi_type                      *libffiType(const Type &type);
std::shared_ptr<CallInterface> callInterface(const Type              &result,
                                             const std::vector<Type> &arguments);
std::size_t                    cachedCallInterfaceCount();
void invoke(const CallInterface &interface, void *function, void *result, void **arguments);

class CallFrame
{
public:
    explicit CallFrame(std::shared_ptr<CallInterface> interface);
    CallFrame(const CallFrame &)            = delete;
    CallFrame &operator=(const CallFrame &) = delete;

    const CallInterface &interface() const;
    std::uint8_t        *argument(std::size_t index);
    void               **arguments();
    std::uint8_t        *result();
    ArgumentStorage     &storage();
    void                 invoke(void *function);

private:
    std::shared_ptr<CallInterface>          interface_;
    std::vector<std::vector<std::uint64_t>> argumentBuffers_;
    std::vector<void *>                     argumentPointers_;
    std::vector<std::uint64_t>              resultBuffer_;
    ArgumentStorage                         storage_;
};
}
