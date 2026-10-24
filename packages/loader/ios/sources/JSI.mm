#import "JSI.h"

using namespace facebook;

namespace {

std::string nsStringToStd(NSString *value)
{
    if (!value)
    {
        return std::string();
    }

    const char *utf8 = value.UTF8String;
    return utf8 ? std::string(utf8) : std::string();
}

}

@implementation JSI

+ (jsi::Value)fromObjC:(id)value runtime:(jsi::Runtime &)runtime
{
    if (!value || value == [NSNull null])
    {
        return jsi::Value::null();
    }

    if ([value isKindOfClass:[NSString class]])
    {
        return jsi::String::createFromUtf8(runtime, nsStringToStd((NSString *) value));
    }

    if ([value isKindOfClass:[NSNumber class]])
    {
        CFTypeID numType = CFGetTypeID((__bridge CFTypeRef) value);
        if (numType == CFBooleanGetTypeID())
        {
            return jsi::Value([(NSNumber *) value boolValue]);
        }
        return jsi::Value([(NSNumber *) value doubleValue]);
    }

    if ([value isKindOfClass:[NSArray class]])
    {
        NSArray   *array = (NSArray *) value;
        jsi::Array out(runtime, array.count);
        for (NSUInteger i = 0; i < array.count; i++)
        {
            out.setValueAtIndex(runtime, i, [JSI fromObjC:array[i] runtime:runtime]);
        }
        return out;
    }

    if ([value isKindOfClass:[NSDictionary class]])
    {
        NSDictionary *dict = (NSDictionary *) value;
        jsi::Object   out(runtime);

        for (id key in dict)
        {
            if (![key isKindOfClass:[NSString class]])
            {
                continue;
            }

            out.setProperty(runtime, ((NSString *) key).UTF8String,
                            [JSI fromObjC:dict[key] runtime:runtime]);
        }

        return out;
    }

    return jsi::Value::null();
}

+ (NSString *)toNSString:(const jsi::Value &)value runtime:(jsi::Runtime &)runtime
{
    if (value.isString())
    {
        std::string utf8 = value.asString(runtime).utf8(runtime);
        return [NSString stringWithUTF8String:utf8.c_str() ?: ""];
    }

    return nil;
}

+ (BOOL)toBool:(const jsi::Value &)value runtime:(jsi::Runtime &)runtime fallback:(BOOL)fallback
{
    if (value.isBool())
    {
        return value.getBool();
    }

    if (value.isNumber())
    {
        return value.getNumber() != 0;
    }

    if (value.isString())
    {
        NSString *raw = [JSI toNSString:value runtime:runtime];
        NSString *s   = [raw lowercaseString];
        if ([s isEqualToString:@"true"] || [s isEqualToString:@"1"] || [s isEqualToString:@"yes"])
        {
            return true;
        }
        if ([s isEqualToString:@"false"] || [s isEqualToString:@"0"] || [s isEqualToString:@"no"])
        {
            return false;
        }
    }

    return fallback;
}

+ (double)toNumber:(const jsi::Value &)value fallback:(double)fallback
{
    return value.isNumber() ? value.getNumber() : fallback;
}

+ (jsi::Value)makeFunction:(const char *)name
                  argCount:(unsigned int)argCount
                   runtime:(jsi::Runtime &)runtime
                   handler:(const jsi::HostFunctionType &)handler
{
    return jsi::Function::createFromHostFunction(runtime, jsi::PropNameID::forUtf8(runtime, name),
                                                 argCount, handler);
}

@end
