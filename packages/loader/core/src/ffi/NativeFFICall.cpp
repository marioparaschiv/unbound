#include "NativeFFICall.h"

#include <algorithm>
#include <list>
#include <map>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>

namespace loader::ffi
{
    namespace
    {
        struct StructType
        {
            ffi_type                type{};
            std::vector<ffi_type *> elements;
        };

        std::recursive_mutex                                        structTypeMutex;
        std::map<const StructLayout *, std::unique_ptr<StructType>> structTypes;

        ffi_type *structType(const StructLayout *layout)
        {
            std::lock_guard<std::recursive_mutex> lock(structTypeMutex);
            auto                                  existing = structTypes.find(layout);
            if (existing != structTypes.end())
            {
                return &existing->second->type;
            }

            auto created = std::make_unique<StructType>();
            for (const StructField &field : layout->fields)
            {
                created->elements.push_back(libffiType(field.type));
            }
            created->elements.push_back(nullptr);
            created->type.type     = FFI_TYPE_STRUCT;
            created->type.elements = created->elements.data();
            if (ffi_get_struct_offsets(FFI_DEFAULT_ABI, &created->type, nullptr) != FFI_OK ||
                created->type.size != layout->size)
            {
                throw std::invalid_argument("Native FFI " + layout->name + " layout could not be prepared");
            }
            ffi_type *result    = &created->type;
            structTypes[layout] = std::move(created);
            return result;
        }

        std::string signatureKey(const Type &result, const std::vector<Type> &arguments)
        {
            std::string key = result.name;
            for (const Type &argument : arguments)
            {
                key.push_back('\0');
                key += argument.name;
            }
            return key;
        }

        class CallInterfaceCache
        {
        public:
            std::shared_ptr<CallInterface> find(const std::string &key)
            {
                std::lock_guard<std::mutex> lock(mutex_);
                auto                        entry = entries_.find(key);
                if (entry == entries_.end())
                {
                    return nullptr;
                }
                order_.splice(order_.begin(), order_, entry->second.position);
                return entry->second.interface;
            }

            std::shared_ptr<CallInterface> insert(const std::string &key, std::shared_ptr<CallInterface> interface)
            {
                std::lock_guard<std::mutex> lock(mutex_);
                auto                        existing = entries_.find(key);
                if (existing != entries_.end())
                {
                    order_.splice(order_.begin(), order_, existing->second.position);
                    return existing->second.interface;
                }
                order_.push_front(key);
                entries_.emplace(key, Entry{interface, order_.begin()});
                while (entries_.size() > kCallInterfaceCacheCapacity)
                {
                    entries_.erase(order_.back());
                    order_.pop_back();
                }
                return interface;
            }

            std::size_t size()
            {
                std::lock_guard<std::mutex> lock(mutex_);
                return entries_.size();
            }

        private:
            struct Entry
            {
                std::shared_ptr<CallInterface>   interface;
                std::list<std::string>::iterator position;
            };

            std::mutex                             mutex_;
            std::list<std::string>                 order_;
            std::unordered_map<std::string, Entry> entries_;
        };

        CallInterfaceCache &callInterfaceCache()
        {
            static CallInterfaceCache cache;
            return cache;
        }

        std::size_t wordsFor(std::size_t bytes)
        {
            return (bytes + sizeof(std::uint64_t) - 1) / sizeof(std::uint64_t);
        }
    }

    ffi_type *libffiType(const Type &type)
    {
        switch (type.kind)
        {
        case Kind::Void:
            return &ffi_type_void;
        case Kind::Bool:
        case Kind::UInt8:
            return &ffi_type_uint8;
        case Kind::Int8:
            return &ffi_type_sint8;
        case Kind::Int16:
            return &ffi_type_sint16;
        case Kind::UInt16:
            return &ffi_type_uint16;
        case Kind::Int32:
            return &ffi_type_sint32;
        case Kind::UInt32:
            return &ffi_type_uint32;
        case Kind::Int64:
            return &ffi_type_sint64;
        case Kind::UInt64:
            return &ffi_type_uint64;
        case Kind::Float:
            return &ffi_type_float;
        case Kind::Double:
            return &ffi_type_double;
        case Kind::CString:
        case Kind::Pointer:
        case Kind::Extension:
            return &ffi_type_pointer;
        case Kind::Struct:
            return structType(type.layout);
        }
        throw std::invalid_argument("Unsupported native FFI type " + type.name);
    }

    std::shared_ptr<CallInterface> callInterface(const Type &result, const std::vector<Type> &arguments)
    {
        std::string key = signatureKey(result, arguments);
        if (auto cached = callInterfaceCache().find(key))
        {
            return cached;
        }

        auto created       = std::make_shared<CallInterface>();
        created->result    = result;
        created->arguments = arguments;
        created->argumentTypes.reserve(arguments.size());
        for (const Type &argument : arguments)
        {
            created->argumentTypes.push_back(libffiType(argument));
        }
        if (ffi_prep_cif(&created->cif, FFI_DEFAULT_ABI, static_cast<unsigned>(created->argumentTypes.size()),
                         libffiType(result), created->argumentTypes.data()) != FFI_OK)
        {
            throw std::invalid_argument("Native FFI signature could not be prepared");
        }
        return callInterfaceCache().insert(key, std::move(created));
    }

    std::size_t cachedCallInterfaceCount()
    {
        return callInterfaceCache().size();
    }

    void invoke(const CallInterface &interface, void *function, void *result, void **arguments)
    {
        ffi_call(const_cast<ffi_cif *>(&interface.cif), reinterpret_cast<void (*)()>(function),
                 interface.result.kind == Kind::Void ? nullptr : result, arguments);
    }

    CallFrame::CallFrame(std::shared_ptr<CallInterface> interface) : interface_(std::move(interface))
    {
        argumentBuffers_.reserve(interface_->arguments.size());
        argumentPointers_.reserve(interface_->arguments.size());
        for (const Type &argument : interface_->arguments)
        {
            argumentBuffers_.emplace_back(wordsFor(valueStorageSize(argument)), 0);
            argumentPointers_.push_back(argumentBuffers_.back().data());
        }
        resultBuffer_.assign(wordsFor(std::max(valueStorageSize(interface_->result), sizeof(ffi_arg))), 0);
    }

    const CallInterface &CallFrame::interface() const
    {
        return *interface_;
    }

    std::uint8_t *CallFrame::argument(std::size_t index)
    {
        return reinterpret_cast<std::uint8_t *>(argumentBuffers_.at(index).data());
    }

    void **CallFrame::arguments()
    {
        return argumentPointers_.data();
    }

    std::uint8_t *CallFrame::result()
    {
        return reinterpret_cast<std::uint8_t *>(resultBuffer_.data());
    }

    ArgumentStorage &CallFrame::storage()
    {
        return storage_;
    }

    void CallFrame::invoke(void *function)
    {
        loader::ffi::invoke(*interface_, function, resultBuffer_.data(), argumentPointers_.data());
    }
}
