#import "NativePluginIvars.h"

#import <Foundation/Foundation.h>
#include <cstring>
#import <objc/runtime.h>

#import "NativePluginObjCValues.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
Value getIvar(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 2)
    {
        throw JSError(runtime, "objc.getIvar expects an object and ivar name");
    }

    id        object = objcValue(runtime, args[0]);
    NSString *name   = jsiString(runtime, args[1]);
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        return Value::undefined();
    }

    const char *type    = ivar_getTypeEncoding(ivar);
    uint8_t    *address = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char        code    = normalizedType(type);
    if (!type || !*type)
    {
        return objcResult(runtime, object_getIvar(object, ivar));
    }
    if (code == '@')
    {
        __unsafe_unretained id value = nil;
        memcpy(&value, address, sizeof(value));
        return objcResult(runtime, value);
    }

    if (code == '#')
    {
        Class value = Nil;
        memcpy(&value, address, sizeof(value));
        return objcResult(runtime, value);
    }

    if (code == ':')
    {
        SEL value = NULL;
        memcpy(&value, address, sizeof(value));
        return value ? String::createFromUtf8(runtime, sel_getName(value)) : Value::null();
    }

    if (code == '^' || code == '*')
    {
        void *value = nullptr;
        memcpy(&value, address, sizeof(value));
        return pointerResult(runtime, value);
    }

    if (code == 'B')
    {
        bool value = false;
        memcpy(&value, address, sizeof(value));
        return Value(value);
    }
    if (code == 'f')
    {
        float value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'd')
    {
        double value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(value);
    }
    if (code == 'c')
    {
        int8_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'C')
    {
        uint8_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 's')
    {
        int16_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'S')
    {
        uint16_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'i')
    {
        int32_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'I')
    {
        uint32_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value((double) value);
    }
    if (code == 'l' || code == 'q')
    {
        int64_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(runtime, BigInt::fromInt64(runtime, value));
    }
    if (code == 'L' || code == 'Q')
    {
        uint64_t value = 0;
        memcpy(&value, address, sizeof(value));
        return Value(runtime, BigInt::fromUint64(runtime, value));
    }
    if (code == '{')
    {
        NSUInteger size      = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(ivar_getTypeEncoding(ivar), &size, &alignment);
        return structResult(runtime, [NSString stringWithUTF8String:type] ?: @"",
                            [NSValue value:address withObjCType:type]);
    }
    throw JSError(runtime, "Unsupported ivar type");
}

Value setIvar(Runtime &runtime, const Value *args, size_t count)
{
    if (count < 3)
    {
        throw JSError(runtime, "objc.setIvar expects an object, ivar name, and value");
    }

    id        object = objcValue(runtime, args[0]);
    NSString *name   = jsiString(runtime, args[1]);
    Ivar ivar = object ? class_getInstanceVariable(object_getClass(object), name.UTF8String) : NULL;
    if (!ivar)
    {
        throw JSError(runtime, "Objective-C ivar is unavailable");
    }

    uint8_t *address     = (uint8_t *) (__bridge void *) object + ivar_getOffset(ivar);
    char     code        = normalizedType(ivar_getTypeEncoding(ivar));
    id       value       = valueToObjC(runtime, args[2]);
    id       scalarValue = value == [NSNull null] ? @0 : value;
    if (code == '@')
    {
        object_setIvar(object, ivar, value == [NSNull null] ? nil : value);
        return Value::undefined();
    }

    if (code == '#')
    {
        Class argument = value != [NSNull null] && object_isClass(value) ? value : Nil;
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == ':')
    {
        SEL argument = NULL;
        if ([value isKindOfClass:[NSString class]])
        {
            argument = NSSelectorFromString((NSString *) value);
        }
        else if ([value isKindOfClass:[NSValue class]])
        {
            argument = (SEL)[(NSValue *) value pointerValue];
        }
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == '^' || code == '*')
    {
        void *argument =
            [value isKindOfClass:[NSValue class]] ? [(NSValue *) value pointerValue] : nullptr;
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }

    if (code == 'B')
    {
        bool argument = [scalarValue boolValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'f')
    {
        float argument = [scalarValue floatValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'd')
    {
        double argument = [scalarValue doubleValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'c')
    {
        int8_t argument = [scalarValue charValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'C')
    {
        uint8_t argument = [scalarValue unsignedCharValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 's')
    {
        int16_t argument = [scalarValue shortValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'S')
    {
        uint16_t argument = [scalarValue unsignedShortValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'i')
    {
        int32_t argument = [scalarValue intValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'I')
    {
        uint32_t argument = [scalarValue unsignedIntValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'l' || code == 'q')
    {
        int64_t argument = [scalarValue longLongValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == 'L' || code == 'Q')
    {
        uint64_t argument = [scalarValue unsignedLongLongValue];
        memcpy(address, &argument, sizeof(argument));
        return Value::undefined();
    }
    if (code == '{')
    {
        if (![value isKindOfClass:[NSValue class]])
        {
            throw JSError(runtime, "Native struct ivar value expected");
        }
        NSUInteger size      = 0;
        NSUInteger alignment = 0;
        NSGetSizeAndAlignment(ivar_getTypeEncoding(ivar), &size, &alignment);
        [(NSValue *) value getValue:address size:size];
        return Value::undefined();
    }
    throw JSError(runtime, "Unsupported ivar type");
}
}
