#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>

#include <jsi/jsi.h>

#include "NativeFFICall.h"
#include "NativeFFITypes.h"
#include "NativeFFIValues.h"

namespace loader::ffi
{
    class PointerHost final : public facebook::jsi::HostObject
    {
    public:
        PointerHost(void *value, bool callable) : value_(value), callable_(callable) {}

        void *value() const
        {
            return value_;
        }

        bool callable() const
        {
            return callable_;
        }

    private:
        void *value_;
        bool  callable_;
    };

    class TypeCodec
    {
    public:
        virtual ~TypeCodec() = default;
        virtual void write(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value, std::uint8_t *target,
                           ArgumentStorage &storage) const                                            = 0;
        virtual facebook::jsi::Value read(facebook::jsi::Runtime &runtime, const std::uint8_t *source) const = 0;
    };

    using PointerResolver =
        std::function<std::optional<void *>(facebook::jsi::Runtime &, const facebook::jsi::Object &)>;
    using StructResultFactory = std::function<std::optional<facebook::jsi::Value>(
        facebook::jsi::Runtime &, const StructLayout &, const std::uint8_t *)>;

    void setPointerResolver(PointerResolver resolver);
    void setStructResultFactory(StructResultFactory factory);

    Type                         resolveType(const std::string &name);
    facebook::jsi::Value         pointerValue(facebook::jsi::Runtime &runtime, void *pointer, bool callable = false);
    std::shared_ptr<PointerHost> pointerHost(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
    void                         writeValue(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value,
                                            const Type &type, std::uint8_t *target, ArgumentStorage &storage);
    facebook::jsi::Value readValue(facebook::jsi::Runtime &runtime, const Type &type, const std::uint8_t *source);

    facebook::jsi::Value lookupSymbol(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                      std::size_t count);
    facebook::jsi::Value callFunction(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                                      std::size_t count);
}
