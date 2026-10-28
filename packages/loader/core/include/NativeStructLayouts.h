#pragma once

#include <cstddef>
#include <cstdint>
#include <jsi/jsi.h>
#include <string>
#include <string_view>
#include <vector>

namespace loader::native {
enum class StructScalar
{
    Double,
    UnsignedLong
};

struct StructField {
    std::string_view path;
    size_t           offset;
    StructScalar     scalar;
};

struct StructLayout {
    std::string_view         name;
    std::string_view         encoding;
    size_t                   size;
    std::vector<StructField> fields;
};

const StructLayout *structLayout(std::string_view name);
const StructLayout *structLayoutForTypeName(std::string_view typeName);

facebook::jsi::Value structToJS(facebook::jsi::Runtime &runtime, const StructLayout &layout,
                                const uint8_t *bytes);
std::vector<uint8_t> structFromJS(facebook::jsi::Runtime &runtime, const StructLayout &layout,
                                  const facebook::jsi::Value &fields);
}
