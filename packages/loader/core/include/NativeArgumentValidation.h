#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace loader::native {
enum class NativeIntegerKind
{
    None,
    Signed,
    Unsigned,
};

struct NativeNumberArgument {
    double            value         = 0;
    NativeIntegerKind integer       = NativeIntegerKind::None;
    int64_t           signedValue   = 0;
    uint64_t          unsignedValue = 0;
};

struct NativeArgumentShape {
    std::optional<NativeNumberArgument> number;
    bool                                null          = false;
    bool                                string        = false;
    bool                                classObject   = false;
    const char                         *boxedEncoding = nullptr;
};

void validateScalarArgument(const std::optional<NativeNumberArgument> &number,
                            const std::string                         &type);
void validateBatchArgument(const NativeArgumentShape &argument, const char *encoding);
}
