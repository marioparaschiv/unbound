#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace loader::ffi
{
    enum class Kind
    {
        Void,
        Bool,
        Int8,
        UInt8,
        Int16,
        UInt16,
        Int32,
        UInt32,
        Int64,
        UInt64,
        Float,
        Double,
        CString,
        Pointer,
        Struct,
    };

    struct StructLayout;

    struct Type
    {
        Kind                kind;
        std::string         name;
        const StructLayout *layout = nullptr;
    };

    struct StructField
    {
        std::string name;
        Type        type;
        std::size_t offset;
    };

    struct StructLayout
    {
        std::string              name;
        std::vector<StructField> fields;
        std::size_t              size;
        std::size_t              alignment;
    };

    std::optional<Type> parseType(const std::string &name);
    const StructLayout *structLayout(const std::string &name);
    std::size_t         typeSize(const Type &type);
    std::size_t         typeAlignment(const Type &type);
}
