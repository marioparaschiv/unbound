#import "NativePluginBlocks.h"

#import <Foundation/Foundation.h>
#include <atomic>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <objc/runtime.h>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#import "Logger.h"
#import "NativeFFI.h"
#import "NativePluginObjCValues.h"
#import "NativePluginRuntime.h"
#import "NativePluginThreading.h"

extern "C" void *_NSConcreteMallocBlock[32];

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
namespace {
    constexpr int32_t kBlockNeedsFree    = 1 << 24;
    constexpr int32_t kBlockCopyDispose  = 1 << 25;
    constexpr int32_t kBlockHasSignature = 1 << 30;
    constexpr int32_t kBlockOneReference = 2;
    constexpr size_t  kRegisters         = 8;
    constexpr size_t  kMaximumFloatSlots = 4;

    struct IntegerReturn {
        uint64_t first;
        uint64_t second;
    };

    struct FloatReturn {
        double values[kMaximumFloatSlots];
    };

    struct Registers {
        uint64_t x[kRegisters];
        double   d[kRegisters];
    };

    enum class Passing
    {
        Integer,
        Float,
        Double,
        FloatAggregate,
        IntegerAggregate,
        Indirect,
    };

    struct Slot {
        Passing passing;
        size_t  count = 1;
        size_t  size  = 0;
    };

    struct BlockDescriptor {
        unsigned long reserved;
        unsigned long size;
        void (*copy)(void *, const void *);
        void (*dispose)(const void *);
        const char *signature;
    };

    struct Callback {
        loader::ffi::Signature    signature;
        std::vector<Slot>         slots;
        Slot                      result{Passing::Integer};
        bool                      floatReturn  = false;
        bool                      receivesSelf = false;
        std::shared_ptr<Function> function;
        uint64_t                  generation = 0;
        std::string               encoding;
        std::string               label;
    };

    struct BlockState {
        BlockDescriptor           descriptor{};
        std::shared_ptr<Callback> callback;
    };

    struct BlockLiteral {
        void                *isa;
        std::atomic<int32_t> flags;
        int32_t              reserved;
        void                *invoke;
        BlockDescriptor     *descriptor;
        BlockState          *state;
    };

    bool isFloating(loader::ffi::Kind kind)
    {
        return kind == loader::ffi::Kind::Float || kind == loader::ffi::Kind::Double;
    }

    void flattenFields(const loader::ffi::StructLayout &layout,
                       std::vector<loader::ffi::Kind>  &leaves)
    {
        for (const loader::ffi::StructField &field : layout.fields)
        {
            if (field.type.kind == loader::ffi::Kind::Struct && field.type.layout)
            {
                flattenFields(*field.type.layout, leaves);
            }
            else
            {
                leaves.push_back(field.type.kind);
            }
        }
    }

    Slot slotFor(const loader::ffi::Type &type)
    {
        using loader::ffi::Kind;
        if (type.kind == Kind::Float)
        {
            return {Passing::Float, 1, sizeof(float)};
        }
        if (type.kind == Kind::Double)
        {
            return {Passing::Double, 1, sizeof(double)};
        }
        if (type.kind == Kind::Struct && type.layout)
        {
            std::vector<Kind> leaves;
            flattenFields(*type.layout, leaves);
            bool aggregate = !leaves.empty() && leaves.size() <= kMaximumFloatSlots &&
                             isFloating(leaves.front());
            for (Kind leaf : leaves)
            {
                aggregate = aggregate && leaf == leaves.front();
            }
            if (aggregate)
            {
                return {Passing::FloatAggregate, leaves.size(), type.layout->size};
            }
            if (type.layout->size <= 2 * sizeof(uint64_t))
            {
                return {Passing::IntegerAggregate, (type.layout->size + 7) / 8, type.layout->size};
            }
            return {Passing::Indirect, 1, type.layout->size};
        }
        return {Passing::Integer, 1, loader::ffi::typeSize(type)};
    }

    bool usesFloatRegisters(const Slot &slot)
    {
        return slot.passing == Passing::Float || slot.passing == Passing::Double ||
               slot.passing == Passing::FloatAggregate;
    }

    std::string typeEncoding(const loader::ffi::Type &type)
    {
        using loader::ffi::Kind;
        switch (type.kind)
        {
            case Kind::Void:
                return "v";
            case Kind::Bool:
                return "B";
            case Kind::Int8:
                return "c";
            case Kind::UInt8:
                return "C";
            case Kind::Int16:
                return "s";
            case Kind::UInt16:
                return "S";
            case Kind::Int32:
                return "i";
            case Kind::UInt32:
                return "I";
            case Kind::Int64:
                return "q";
            case Kind::UInt64:
                return "Q";
            case Kind::Float:
                return "f";
            case Kind::Double:
                return "d";
            case Kind::CString:
                return "*";
            case Kind::Pointer:
                return "^v";
            case Kind::Struct: {
                if (!type.layout)
                {
                    return "{?=}";
                }
                std::string fields;
                for (const loader::ffi::StructField &field : type.layout->fields)
                {
                    fields += typeEncoding(field.type);
                }
                return "{" + type.layout->name + "=" + fields + "}";
            }
            case Kind::Extension:
                if (type.name == "object")
                {
                    return "@";
                }
                if (type.name == "class")
                {
                    return "#";
                }
                if (type.name == "selector")
                {
                    return ":";
                }
                return "^v";
        }
        return "^v";
    }

    std::string argumentEncoding(const std::shared_ptr<Callback> &callback)
    {
        std::string encoding;
        for (const loader::ffi::Type &type : callback->signature.arguments)
        {
            encoding += typeEncoding(type);
        }
        return encoding;
    }

    std::vector<uint8_t> readArgument(const Slot &slot, const Registers &registers, size_t &x,
                                      size_t &d)
    {
        std::vector<uint8_t> buffer(std::max<size_t>(slot.size, sizeof(uint64_t)));
        switch (slot.passing)
        {
            case Passing::Integer:
                std::memcpy(buffer.data(), &registers.x[x++], sizeof(uint64_t));
                break;
            case Passing::Float: {
                float value = 0;
                std::memcpy(&value, &registers.d[d++], sizeof(float));
                std::memcpy(buffer.data(), &value, sizeof(float));
                break;
            }
            case Passing::Double:
                std::memcpy(buffer.data(), &registers.d[d++], sizeof(double));
                break;
            case Passing::FloatAggregate: {
                size_t element = slot.size / slot.count;
                for (size_t index = 0; index < slot.count; index++)
                {
                    std::memcpy(buffer.data() + index * element, &registers.d[d++], element);
                }
                break;
            }
            case Passing::IntegerAggregate:
                std::memcpy(buffer.data(), &registers.x[x], slot.size);
                x += slot.count;
                break;
            case Passing::Indirect: {
                const void *source = reinterpret_cast<const void *>(registers.x[x++]);
                if (source)
                {
                    std::memcpy(buffer.data(), source, slot.size);
                }
                break;
            }
        }
        return buffer;
    }

    void keepReturnedObject(const loader::ffi::Type &type, const uint8_t *result)
    {
        if (type.kind != loader::ffi::Kind::Extension || type.name != "object")
        {
            return;
        }
        void *object = nullptr;
        std::memcpy(&object, result, sizeof(object));
        if (object)
        {
            CFAutorelease(CFRetain(object));
        }
    }

    std::vector<uint8_t> runCallback(const std::shared_ptr<Callback> &callback,
                                     const Registers &registers, size_t leading)
    {
        std::vector<uint8_t> result(
            std::max<size_t>(callback->result.size, kMaximumFloatSlots * sizeof(double)));
        if (!callback->function || callback->generation != loader::native::runtimeGeneration())
        {
            return result;
        }
        size_t                            x = leading;
        size_t                            d = 0;
        std::vector<std::vector<uint8_t>> arguments;
        for (const Slot &slot : callback->slots)
        {
            arguments.push_back(readArgument(slot, registers, x, d));
        }
        bool completed = executeRuntimeSynchronously([&](Runtime &runtime) {
            if (callback->generation != loader::native::runtimeGeneration())
            {
                return;
            }
            std::vector<Value> values;
            values.reserve(arguments.size() + 1);
            if (callback->receivesSelf)
            {
                values.push_back(
                    loader::ffi::readValue(runtime, loader::ffi::resolveType("object"),
                                           reinterpret_cast<const uint8_t *>(&registers.x[0])));
            }
            for (size_t index = 0; index < arguments.size(); index++)
            {
                values.push_back(loader::ffi::readValue(
                    runtime, callback->signature.arguments[index], arguments[index].data()));
            }
            Value returned = callback->function->call(
                runtime, static_cast<const Value *>(values.data()), values.size());
            if (callback->signature.result.kind == loader::ffi::Kind::Void)
            {
                return;
            }
            loader::ffi::ArgumentStorage storage;
            loader::ffi::writeValue(runtime, returned, callback->signature.result, result.data(),
                                    storage);
            keepReturnedObject(callback->signature.result, result.data());
        });
        if (!completed)
        {
            [Logger
                warning:LOG_CATEGORY_PLUGINS
                 format:@"Skipped the native callback %s: the JavaScript thread did not answer.",
                        callback->label.c_str()];
        }
        return result;
    }

    std::vector<uint8_t> safelyRun(const std::shared_ptr<Callback> &callback,
                                   const Registers &registers, size_t leading)
    {
        try
        {
            return runCallback(callback, registers, leading);
        }
        catch (const std::exception &error)
        {
            [Logger error:LOG_CATEGORY_PLUGINS
                   format:@"Failed to run the native callback %s: %s", callback->label.c_str(),
                          error.what()];
        }
        return std::vector<uint8_t>(kMaximumFloatSlots * sizeof(double));
    }

    IntegerReturn integerResult(const std::vector<uint8_t> &result)
    {
        IntegerReturn value{0, 0};
        std::memcpy(&value, result.data(), std::min(result.size(), sizeof(value)));
        return value;
    }

    FloatReturn floatResult(const std::shared_ptr<Callback> &callback,
                            const std::vector<uint8_t>      &result)
    {
        FloatReturn value{};
        const Slot &slot = callback->result;
        if (slot.passing == Passing::FloatAggregate)
        {
            size_t element = slot.size / slot.count;
            for (size_t index = 0; index < slot.count; index++)
            {
                std::memcpy(&value.values[index], result.data() + index * element, element);
            }
        }
        else
        {
            std::memcpy(&value.values[0], result.data(),
                        slot.passing == Passing::Float ? sizeof(float) : sizeof(double));
        }
        return value;
    }

    std::shared_ptr<Callback> blockCallback(uint64_t block)
    {
        auto *literal = reinterpret_cast<BlockLiteral *>(block);
        return literal && literal->state ? literal->state->callback : nullptr;
    }

    std::mutex                                                 gMethodsMutex;
    std::map<std::pair<Class, SEL>, std::shared_ptr<Callback>> gMethods;
    std::map<std::string, std::vector<std::pair<Class, SEL>>>  gDefinedClasses;

    std::shared_ptr<Callback> methodCallback(uint64_t self, uint64_t command)
    {
        id                          object   = (__bridge id) reinterpret_cast<void *>(self);
        SEL                         selector = reinterpret_cast<SEL>(command);
        std::lock_guard<std::mutex> lock(gMethodsMutex);
        for (Class cls = object_getClass(object); cls; cls = class_getSuperclass(cls))
        {
            auto found = gMethods.find({cls, selector});
            if (found != gMethods.end())
            {
                return found->second;
            }
        }
        return nullptr;
    }

    Registers capture(uint64_t x0, uint64_t x1, uint64_t x2, uint64_t x3, uint64_t x4, uint64_t x5,
                      uint64_t x6, uint64_t x7, double d0, double d1, double d2, double d3,
                      double d4, double d5, double d6, double d7)
    {
        return {{x0, x1, x2, x3, x4, x5, x6, x7}, {d0, d1, d2, d3, d4, d5, d6, d7}};
    }

    IntegerReturn blockIntegerTrampoline(uint64_t x0, uint64_t x1, uint64_t x2, uint64_t x3,
                                         uint64_t x4, uint64_t x5, uint64_t x6, uint64_t x7,
                                         double d0, double d1, double d2, double d3, double d4,
                                         double d5, double d6, double d7)
    {
        std::shared_ptr<Callback> callback = blockCallback(x0);
        if (!callback)
        {
            return {0, 0};
        }
        Registers registers =
            capture(x0, x1, x2, x3, x4, x5, x6, x7, d0, d1, d2, d3, d4, d5, d6, d7);
        return integerResult(safelyRun(callback, registers, 1));
    }

    FloatReturn blockFloatTrampoline(uint64_t x0, uint64_t x1, uint64_t x2, uint64_t x3,
                                     uint64_t x4, uint64_t x5, uint64_t x6, uint64_t x7, double d0,
                                     double d1, double d2, double d3, double d4, double d5,
                                     double d6, double d7)
    {
        std::shared_ptr<Callback> callback = blockCallback(x0);
        if (!callback)
        {
            return {};
        }
        Registers registers =
            capture(x0, x1, x2, x3, x4, x5, x6, x7, d0, d1, d2, d3, d4, d5, d6, d7);
        return floatResult(callback, safelyRun(callback, registers, 1));
    }

    IntegerReturn methodIntegerTrampoline(uint64_t x0, uint64_t x1, uint64_t x2, uint64_t x3,
                                          uint64_t x4, uint64_t x5, uint64_t x6, uint64_t x7,
                                          double d0, double d1, double d2, double d3, double d4,
                                          double d5, double d6, double d7)
    {
        std::shared_ptr<Callback> callback = methodCallback(x0, x1);
        if (!callback)
        {
            return {0, 0};
        }
        Registers registers =
            capture(x0, x1, x2, x3, x4, x5, x6, x7, d0, d1, d2, d3, d4, d5, d6, d7);
        return integerResult(safelyRun(callback, registers, 2));
    }

    FloatReturn methodFloatTrampoline(uint64_t x0, uint64_t x1, uint64_t x2, uint64_t x3,
                                      uint64_t x4, uint64_t x5, uint64_t x6, uint64_t x7, double d0,
                                      double d1, double d2, double d3, double d4, double d5,
                                      double d6, double d7)
    {
        std::shared_ptr<Callback> callback = methodCallback(x0, x1);
        if (!callback)
        {
            return {};
        }
        Registers registers =
            capture(x0, x1, x2, x3, x4, x5, x6, x7, d0, d1, d2, d3, d4, d5, d6, d7);
        return floatResult(callback, safelyRun(callback, registers, 2));
    }

    std::shared_ptr<Callback> makeCallback(Runtime &runtime, const Value &signature,
                                           const Value &function, size_t leading, std::string label)
    {
        if (!function.isObject() || !function.asObject(runtime).isFunction(runtime))
        {
            throw JSError(runtime, label + " expects a function");
        }
        auto callback       = std::make_shared<Callback>();
        callback->label     = std::move(label);
        callback->signature = loader::ffi::signatureFromValue(runtime, signature);
        size_t integers     = leading;
        size_t floats       = 0;
        for (const loader::ffi::Type &type : callback->signature.arguments)
        {
            Slot slot = slotFor(type);
            (usesFloatRegisters(slot) ? floats : integers) += slot.count;
            callback->slots.push_back(slot);
        }
        if (integers > kRegisters || floats > kRegisters)
        {
            throw JSError(runtime, callback->label +
                                       " has more arguments than fit in registers; pass a struct "
                                       "or fewer values");
        }
        callback->result = slotFor(callback->signature.result);
        if (callback->result.passing == Passing::Indirect)
        {
            throw JSError(runtime, callback->label +
                                       " cannot return a struct larger than 16 bytes unless it "
                                       "holds only floats or only doubles");
        }
        callback->floatReturn = usesFloatRegisters(callback->result);
        callback->function =
            std::make_shared<Function>(function.asObject(runtime).asFunction(runtime));
        callback->generation = loader::native::runtimeGeneration();
        return callback;
    }

    void releaseFunction(const std::shared_ptr<Callback> &callback)
    {
        std::shared_ptr<Function> function = std::move(callback->function);
        if (function && callback->generation == loader::native::runtimeGeneration())
        {
            executeRuntimeAsynchronously([function](Runtime &) {});
        }
    }

    void copyBlock(void *, const void *) {}

    void disposeBlock(const void *block)
    {
        auto *literal = static_cast<const BlockLiteral *>(block);
        if (BlockState *state = literal->state)
        {
            releaseFunction(state->callback);
            delete state;
        }
    }

    loader::ffi::Type objectType()
    {
        return loader::ffi::resolveType("object");
    }

    Value makeBlock(Runtime &runtime, const Value *args, size_t count)
    {
        if (count < 2)
        {
            throw JSError(runtime, "objc.block expects a signature and a function");
        }
        std::shared_ptr<Callback> callback =
            makeCallback(runtime, args[0], args[1], 1, "objc.block");
        callback->encoding =
            typeEncoding(callback->signature.result) + "@?" + argumentEncoding(callback);

        auto *state                 = new BlockState();
        state->callback             = callback;
        state->descriptor.size      = sizeof(BlockLiteral);
        state->descriptor.copy      = copyBlock;
        state->descriptor.dispose   = disposeBlock;
        state->descriptor.signature = callback->encoding.c_str();

        auto *literal = static_cast<BlockLiteral *>(std::calloc(1, sizeof(BlockLiteral)));
        if (!literal)
        {
            delete state;
            throw JSError(runtime, "objc.block could not allocate the block");
        }
        literal->isa = _NSConcreteMallocBlock;
        literal->flags.store(kBlockNeedsFree | kBlockCopyDispose | kBlockHasSignature |
                             kBlockOneReference);
        literal->invoke = callback->floatReturn ? reinterpret_cast<void *>(blockFloatTrampoline)
                                                : reinterpret_cast<void *>(blockIntegerTrampoline);
        literal->descriptor = &state->descriptor;
        literal->state      = state;

        id    block  = (__bridge id) literal;
        Value handle = objcHandleResult(runtime, block);
        CFRelease((__bridge CFTypeRef) block);
        return handle;
    }

    Value callBlock(Runtime &runtime, const Value *args, size_t count)
    {
        if (count < 2)
        {
            throw JSError(runtime, "objc.callBlock expects a block and a signature");
        }
        id block = objcValue(runtime, args[0]);
        if (!block || ![block isKindOfClass:NSClassFromString(@"NSBlock")])
        {
            throw JSError(runtime, "objc.callBlock expects a block");
        }
        auto                  *literal   = (__bridge BlockLiteral *) block;
        loader::ffi::Signature signature = loader::ffi::signatureFromValue(runtime, args[1]);
        if (signature.arguments.size() != count - 2)
        {
            throw JSError(runtime, "objc.callBlock was given a different number of arguments than "
                                   "its signature lists");
        }
        std::vector<loader::ffi::Type> frame{objectType()};
        frame.insert(frame.end(), signature.arguments.begin(), signature.arguments.end());
        loader::ffi::CallFrame call(loader::ffi::callInterface(signature.result, frame));
        void                  *self = (__bridge void *) block;
        std::memcpy(call.argument(0), &self, sizeof(self));
        for (size_t index = 0; index < signature.arguments.size(); index++)
        {
            loader::ffi::writeValue(runtime, args[index + 2], signature.arguments[index],
                                    call.argument(index + 1), call.storage());
        }
        call.invoke(literal->invoke);
        return loader::ffi::readValue(runtime, signature.result, call.result());
    }

    void addProtocols(Runtime &runtime, Class cls, const Value &value)
    {
        if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
        {
            return;
        }
        Array protocols = value.asObject(runtime).asArray(runtime);
        for (size_t index = 0; index < protocols.size(runtime); index++)
        {
            Value name = protocols.getValueAtIndex(runtime, index);
            if (!name.isString())
            {
                continue;
            }
            std::string protocolName = name.getString(runtime).utf8(runtime);
            Protocol   *protocol     = objc_getProtocol(protocolName.c_str());
            if (!protocol)
            {
                throw JSError(runtime, "objc.defineClass found no protocol named " + protocolName);
            }
            class_addProtocol(cls, protocol);
        }
    }

    Value defineClass(Runtime &runtime, const Value *args, size_t count)
    {
        if (count < 3 || !args[0].isString() || !args[1].isString() || !args[2].isObject())
        {
            throw JSError(runtime,
                          "objc.defineClass expects a name, a superclass name and the methods");
        }
        std::string name       = args[0].getString(runtime).utf8(runtime);
        std::string superclass = args[1].getString(runtime).utf8(runtime);
        Class       parent     = objc_getClass(superclass.c_str());
        if (!parent)
        {
            throw JSError(runtime, "objc.defineClass found no superclass named " + superclass);
        }

        Object table = args[2].asObject(runtime);
        Array  keys  = table.getPropertyNames(runtime);
        std::vector<std::pair<SEL, std::shared_ptr<Callback>>> methods;
        for (size_t index = 0; index < keys.size(runtime); index++)
        {
            std::string selectorName =
                keys.getValueAtIndex(runtime, index).getString(runtime).utf8(runtime);
            Value entry = table.getProperty(runtime, selectorName.c_str());
            if (!entry.isObject())
            {
                throw JSError(runtime, "objc.defineClass: " + selectorName +
                                           " needs a signature and an implementation");
            }
            Object                    method   = entry.asObject(runtime);
            std::shared_ptr<Callback> callback = makeCallback(
                runtime, method.getProperty(runtime, "signature"),
                method.getProperty(runtime, "implementation"), 2, name + " " + selectorName);
            callback->encoding =
                typeEncoding(callback->signature.result) + "@:" + argumentEncoding(callback);
            callback->receivesSelf = true;
            methods.emplace_back(sel_registerName(selectorName.c_str()), callback);
        }

        std::lock_guard<std::mutex> lock(gMethodsMutex);
        Class                       existing = objc_getClass(name.c_str());
        bool                        ours     = gDefinedClasses.count(name) > 0;
        if (existing && !ours)
        {
            throw JSError(runtime, "objc.defineClass: a class named " + name + " already exists");
        }
        if (existing && class_getSuperclass(existing) != parent)
        {
            throw JSError(runtime, "objc.defineClass: " + name +
                                       " was defined before with another superclass");
        }
        Class cls = existing ?: objc_allocateClassPair(parent, name.c_str(), 0);
        if (!cls)
        {
            throw JSError(runtime, "objc.defineClass could not create " + name);
        }
        for (const std::pair<Class, SEL> &previous : gDefinedClasses[name])
        {
            auto found = gMethods.find(previous);
            if (found != gMethods.end())
            {
                releaseFunction(found->second);
                gMethods.erase(found);
            }
        }
        std::vector<std::pair<Class, SEL>> defined;
        for (auto &[selector, callback] : methods)
        {
            IMP implementation = callback->floatReturn
                                     ? reinterpret_cast<IMP>(methodFloatTrampoline)
                                     : reinterpret_cast<IMP>(methodIntegerTrampoline);
            if (!class_addMethod(cls, selector, implementation, callback->encoding.c_str()))
            {
                class_replaceMethod(cls, selector, implementation, callback->encoding.c_str());
            }
            gMethods[{cls, selector}] = callback;
            defined.emplace_back(cls, selector);
        }
        gDefinedClasses[name] = std::move(defined);
        if (!existing)
        {
            if (count > 3)
            {
                addProtocols(runtime, cls, args[3]);
            }
            objc_registerClassPair(cls);
        }
        return objcHandleResult(runtime, cls);
    }

    Value makeFunction(Runtime &runtime, const char *name, unsigned int argCount,
                       Value (*body)(Runtime &, const Value *, size_t))
    {
        return Function::createFromHostFunction(
            runtime, PropNameID::forAscii(runtime, name), argCount,
            [body](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                try
                {
                    return body(rt, args, count);
                }
                catch (const JSError &)
                {
                    throw;
                }
                catch (const std::exception &error)
                {
                    throw JSError(rt, error.what());
                }
            });
    }
}

void installObjCBlocks(Runtime &runtime, Object &objc)
{
    objc.setProperty(runtime, "block", makeFunction(runtime, "block", 2, makeBlock));
    objc.setProperty(runtime, "callBlock", makeFunction(runtime, "callBlock", 2, callBlock));
}

void installObjCClassDefinition(Runtime &runtime, Object &objc)
{
    objc.setProperty(runtime, "defineClass", makeFunction(runtime, "defineClass", 4, defineClass));
}
}
