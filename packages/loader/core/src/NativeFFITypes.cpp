#include "NativeFFITypes.h"

#include <algorithm>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <utility>

namespace loader::ffi
{
    namespace
    {
        struct FieldDefinition
        {
            const char *name;
            const char *type;
        };

        struct StructDefinition
        {
            const char                  *name;
            std::vector<FieldDefinition> fields;
        };

        const std::vector<StructDefinition> &structDefinitions()
        {
            static const std::vector<StructDefinition> definitions = {
                {"CGPoint", {{"x", "double"}, {"y", "double"}}},
                {"CGSize", {{"width", "double"}, {"height", "double"}}},
                {"CGVector", {{"dx", "double"}, {"dy", "double"}}},
                {"CGRect", {{"origin", "struct:CGPoint"}, {"size", "struct:CGSize"}}},
                {"NSRange", {{"location", "u64"}, {"length", "u64"}}},
                {"UIEdgeInsets", {{"top", "double"}, {"left", "double"}, {"bottom", "double"}, {"right", "double"}}},
                {"CGAffineTransform",
                 {{"a", "double"}, {"b", "double"}, {"c", "double"}, {"d", "double"}, {"tx", "double"}, {"ty", "double"}}},
                {"timespec", {{"tv_sec", "i64"}, {"tv_nsec", "i64"}}},
                {"timeval", {{"tv_sec", "i64"}, {"tv_usec", "i64"}}},
            };
            return definitions;
        }

        const std::map<std::string, Kind> &scalarKinds()
        {
            static const std::map<std::string, Kind> kinds = {
                {"void", Kind::Void},       {"bool", Kind::Bool},       {"i8", Kind::Int8},
                {"u8", Kind::UInt8},        {"i16", Kind::Int16},       {"u16", Kind::UInt16},
                {"i32", Kind::Int32},       {"u32", Kind::UInt32},      {"i64", Kind::Int64},
                {"u64", Kind::UInt64},      {"float", Kind::Float},     {"double", Kind::Double},
                {"cstring", Kind::CString}, {"pointer", Kind::Pointer},
            };
            return kinds;
        }

        std::size_t alignUp(std::size_t value, std::size_t alignment)
        {
            return (value + alignment - 1) / alignment * alignment;
        }

        std::mutex                                                   layoutMutex;
        std::map<std::string, std::unique_ptr<StructLayout>>         layouts;

        std::mutex                                                   extensionMutex;
        std::map<std::string, std::shared_ptr<const TypeCodec>>      extensions;

        const StructLayout *buildLayout(const std::string &name)
        {
            auto existing = layouts.find(name);
            if (existing != layouts.end())
            {
                return existing->second.get();
            }

            for (const StructDefinition &definition : structDefinitions())
            {
                if (name != definition.name)
                {
                    continue;
                }

                auto layout       = std::make_unique<StructLayout>();
                layout->name      = name;
                layout->size      = 0;
                layout->alignment = 1;
                for (const FieldDefinition &field : definition.fields)
                {
                    std::string typeName = field.type;
                    Type        type;
                    if (typeName.rfind("struct:", 0) == 0)
                    {
                        const StructLayout *nested = buildLayout(typeName.substr(7));
                        if (!nested)
                        {
                            return nullptr;
                        }
                        type = {Kind::Struct, typeName, nested};
                    }
                    else
                    {
                        type = {scalarKinds().at(typeName), typeName, nullptr};
                    }

                    std::size_t alignment = typeAlignment(type);
                    layout->size          = alignUp(layout->size, alignment);
                    layout->fields.push_back({field.name, type, layout->size});
                    layout->size += typeSize(type);
                    layout->alignment = std::max(layout->alignment, alignment);
                }
                layout->size = alignUp(layout->size, layout->alignment);

                const StructLayout *result = layout.get();
                layouts.emplace(name, std::move(layout));
                return result;
            }
            return nullptr;
        }
    }

    const StructLayout *structLayout(const std::string &name)
    {
        std::lock_guard<std::mutex> lock(layoutMutex);
        return buildLayout(name);
    }

    std::optional<Type> parseType(const std::string &name)
    {
        if (name.rfind("struct:", 0) == 0)
        {
            const StructLayout *layout = structLayout(name.substr(7));
            if (!layout)
            {
                return std::nullopt;
            }
            return Type{Kind::Struct, name, layout};
        }

        auto kind = scalarKinds().find(name);
        if (kind != scalarKinds().end())
        {
            return Type{kind->second, name, nullptr};
        }

        std::lock_guard<std::mutex> lock(extensionMutex);
        auto                        extension = extensions.find(name);
        if (extension == extensions.end())
        {
            return std::nullopt;
        }
        return Type{Kind::Extension, name, nullptr, extension->second.get()};
    }

    void registerExtensionType(const std::string &name, std::shared_ptr<const TypeCodec> codec)
    {
        if (!codec || name.empty() || name.rfind("struct:", 0) == 0 || scalarKinds().count(name) != 0)
        {
            throw std::invalid_argument("Native FFI type " + name + " cannot be registered");
        }

        std::lock_guard<std::mutex> lock(extensionMutex);
        if (!extensions.emplace(name, std::move(codec)).second)
        {
            throw std::invalid_argument("Native FFI type " + name + " is already registered");
        }
    }

    Signature makeSignature(Type result, std::vector<Type> arguments)
    {
        if (arguments.size() > kMaximumArguments)
        {
            throw std::invalid_argument("Native FFI signatures take at most " + std::to_string(kMaximumArguments) +
                                        " arguments");
        }
        for (const Type &argument : arguments)
        {
            if (argument.kind == Kind::Void)
            {
                throw std::invalid_argument("Native FFI arguments cannot be void");
            }
        }
        return Signature{std::move(result), std::move(arguments)};
    }

    std::size_t typeSize(const Type &type)
    {
        switch (type.kind)
        {
        case Kind::Void:
            return 0;
        case Kind::Bool:
        case Kind::Int8:
        case Kind::UInt8:
            return 1;
        case Kind::Int16:
        case Kind::UInt16:
            return 2;
        case Kind::Int32:
        case Kind::UInt32:
        case Kind::Float:
            return 4;
        case Kind::Int64:
        case Kind::UInt64:
        case Kind::Double:
            return 8;
        case Kind::CString:
        case Kind::Pointer:
        case Kind::Extension:
            return sizeof(void *);
        case Kind::Struct:
            return type.layout ? type.layout->size : 0;
        }
        return 0;
    }

    std::size_t typeAlignment(const Type &type)
    {
        if (type.kind == Kind::Struct)
        {
            return type.layout ? type.layout->alignment : 1;
        }
        return std::max<std::size_t>(1, typeSize(type));
    }
}
