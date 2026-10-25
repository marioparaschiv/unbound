#pragma once

#include <cstddef>
#include <cstdint>
#include <deque>
#include <memory>
#include <string>
#include <variant>
#include <vector>

#include "NativeFFITypes.h"

namespace loader::ffi
{
    struct NativeAddress
    {
        void *value;
    };

    struct NativeValue;
    using NativeFields = std::vector<NativeValue>;

    struct NativeValue
    {
        std::variant<std::monostate, bool, double, std::int64_t, std::uint64_t, std::string, NativeAddress, NativeFields>
            data;
    };

    class ArgumentStorage
    {
    public:
        const char *keep(std::string value);
        void        retain(std::shared_ptr<const void> value);

    private:
        std::deque<std::string>                  strings_;
        std::vector<std::shared_ptr<const void>> retained_;
    };

    std::size_t valueStorageSize(const Type &type);
    void        encodeValue(const Type &type, const NativeValue &value, std::uint8_t *target, ArgumentStorage &storage);
    NativeValue decodeValue(const Type &type, const std::uint8_t *source);
}
