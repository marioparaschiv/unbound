#include "NativeStructLayouts.h"

#include <array>
#include <cstring>
#include <stdexcept>

namespace loader::native {
namespace jsi = facebook::jsi;

static const std::vector<StructLayout> &layouts()
{
    static const std::vector<StructLayout> table = {
        {"NSRange",
         "{_NSRange=QQ}",
         16,
         {{"location", 0, StructScalar::UnsignedLong}, {"length", 8, StructScalar::UnsignedLong}}},
        {"CGPoint",
         "{CGPoint=dd}",
         16,
         {{"x", 0, StructScalar::Double}, {"y", 8, StructScalar::Double}}},
        {"CGSize",
         "{CGSize=dd}",
         16,
         {{"width", 0, StructScalar::Double}, {"height", 8, StructScalar::Double}}},
        {"CGRect",
         "{CGRect={CGPoint=dd}{CGSize=dd}}",
         32,
         {{"origin.x", 0, StructScalar::Double},
          {"origin.y", 8, StructScalar::Double},
          {"size.width", 16, StructScalar::Double},
          {"size.height", 24, StructScalar::Double}}},
        {"UIEdgeInsets",
         "{UIEdgeInsets=dddd}",
         32,
         {{"top", 0, StructScalar::Double},
          {"left", 8, StructScalar::Double},
          {"bottom", 16, StructScalar::Double},
          {"right", 24, StructScalar::Double}}},
        {"CGAffineTransform",
         "{CGAffineTransform=dddddd}",
         48,
         {{"a", 0, StructScalar::Double},
          {"b", 8, StructScalar::Double},
          {"c", 16, StructScalar::Double},
          {"d", 24, StructScalar::Double},
          {"tx", 32, StructScalar::Double},
          {"ty", 40, StructScalar::Double}}},
    };
    return table;
}

const StructLayout *structLayout(std::string_view name)
{
    for (const StructLayout &layout : layouts())
    {
        if (layout.name == name)
        {
            return &layout;
        }
    }
    return nullptr;
}

const StructLayout *structLayoutForTypeName(std::string_view typeName)
{
    static constexpr std::array<std::pair<std::string_view, std::string_view>, 6> kRecognized = {{
        {"_NSRange", "NSRange"},
        {"CGAffineTransform", "CGAffineTransform"},
        {"UIEdgeInsets", "UIEdgeInsets"},
        {"CGRect", "CGRect"},
        {"CGPoint", "CGPoint"},
        {"CGSize", "CGSize"},
    }};
    for (const auto &[needle, name] : kRecognized)
    {
        if (typeName.find(needle) != std::string_view::npos)
        {
            return structLayout(name);
        }
    }
    return structLayout(typeName);
}

static std::vector<std::string_view> pathParts(std::string_view path)
{
    std::vector<std::string_view> parts;
    size_t                        start = 0;
    while (true)
    {
        size_t dot = path.find('.', start);
        parts.push_back(path.substr(start, dot == std::string_view::npos ? dot : dot - start));
        if (dot == std::string_view::npos)
        {
            return parts;
        }
        start = dot + 1;
    }
}

static jsi::Object childObject(jsi::Runtime &runtime, jsi::Object &parent, std::string_view name)
{
    std::string key(name);
    jsi::Value  existing = parent.getProperty(runtime, key.c_str());
    if (existing.isObject())
    {
        return existing.asObject(runtime);
    }
    jsi::Object child(runtime);
    parent.setProperty(runtime, key.c_str(), child);
    return child;
}

static double readScalar(const uint8_t *bytes, const StructField &field)
{
    if (field.scalar == StructScalar::UnsignedLong)
    {
        uint64_t value = 0;
        std::memcpy(&value, bytes + field.offset, sizeof(value));
        return static_cast<double>(value);
    }
    double value = 0;
    std::memcpy(&value, bytes + field.offset, sizeof(value));
    return value;
}

static void writeScalar(uint8_t *bytes, const StructField &field, double number)
{
    if (field.scalar == StructScalar::UnsignedLong)
    {
        uint64_t value = static_cast<uint64_t>(number);
        std::memcpy(bytes + field.offset, &value, sizeof(value));
        return;
    }
    std::memcpy(bytes + field.offset, &number, sizeof(number));
}

static void setPath(jsi::Runtime &runtime, jsi::Object &object,
                    const std::vector<std::string_view> &parts, size_t index, double value)
{
    std::string key(parts[index]);
    if (index + 1 == parts.size())
    {
        object.setProperty(runtime, key.c_str(), value);
        return;
    }
    jsi::Object child = childObject(runtime, object, parts[index]);
    setPath(runtime, child, parts, index + 1, value);
}

jsi::Value structToJS(jsi::Runtime &runtime, const StructLayout &layout, const uint8_t *bytes)
{
    jsi::Object result(runtime);
    for (const StructField &field : layout.fields)
    {
        setPath(runtime, result, pathParts(field.path), 0, readScalar(bytes, field));
    }
    return result;
}

static double readPath(jsi::Runtime &runtime, const jsi::Object &object,
                       const std::vector<std::string_view> &parts, size_t index)
{
    std::string key(parts[index]);
    if (index + 1 == parts.size())
    {
        return object.getProperty(runtime, key.c_str()).asNumber();
    }
    return readPath(runtime, object.getPropertyAsObject(runtime, key.c_str()), parts, index + 1);
}

std::vector<uint8_t> structFromJS(jsi::Runtime &runtime, const StructLayout &layout,
                                  const jsi::Value &fields)
{
    if (!fields.isObject())
    {
        throw std::invalid_argument("Native struct fields must be an object");
    }
    jsi::Object          object = fields.asObject(runtime);
    std::vector<uint8_t> bytes(layout.size);
    for (const StructField &field : layout.fields)
    {
        writeScalar(bytes.data(), field, readPath(runtime, object, pathParts(field.path), 0));
    }
    return bytes;
}
}
