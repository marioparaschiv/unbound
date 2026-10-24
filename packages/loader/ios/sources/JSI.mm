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

class NSDataBuffer : public jsi::Buffer
{
public:
    explicit NSDataBuffer(NSData *data) : data_(data) {}

    size_t size() const override
    {
        return data_.length;
    }

    const uint8_t *data() const override
    {
        return static_cast<const uint8_t *>(data_.bytes);
    }

private:
    NSData *data_;
};

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

+ (BOOL)evaluate:(NSData *)scriptData tag:(NSString *)tag runtime:(jsi::Runtime &)runtime
{
    if (scriptData.length == 0)
    {
        return NO;
    }

    @try
    {
        try
        {
            if ([Utilities isHermesBytecode:scriptData])
            {
                auto buffer   = std::make_shared<NSDataBuffer>(scriptData);
                auto prepared = runtime.prepareJavaScript(buffer, std::string(tag.UTF8String));
                runtime.evaluatePreparedJavaScript(prepared);
            }
            else
            {
                std::string source((const char *) scriptData.bytes, scriptData.length);
                auto        buffer = std::make_shared<jsi::StringBuffer>(std::move(source));
                runtime.evaluateJavaScript(buffer, std::string(tag.UTF8String));
            }
            return YES;
        }
        catch (const jsi::JSError &e)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"JSI eval of '%@' threw JSError: %s", tag, e.what()];
            return NO;
        }
        catch (const std::exception &e)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"JSI eval of '%@' threw exception: %s", tag, e.what()];
            return NO;
        }
    }
    @catch (NSException *exception)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"JSI eval of '%@' threw NSException %@: %@", tag, exception.name, exception.reason];
        return NO;
    }
}

+ (jsi::Value)evaluateSource:(NSString *)source
                           tag:(NSString *)tag
                       runtime:(jsi::Runtime &)runtime
{
    if (source.length == 0)
    {
        return jsi::Value();
    }

    @try
    {
        try
        {
            std::string              text((const char *) source.UTF8String);
            auto                     buffer = std::make_shared<jsi::StringBuffer>(std::move(text));
            return runtime.evaluateJavaScript(buffer, std::string(tag.UTF8String));
        }
        catch (const jsi::JSError &e)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"JSI source eval of '%@' threw JSError: %s", tag, e.what()];
        }
        catch (const std::exception &e)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"JSI source eval of '%@' threw exception: %s", tag, e.what()];
        }
    }
    @catch (NSException *exception)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"JSI source eval of '%@' threw NSException %@: %@", tag, exception.name,
                      exception.reason];
    }

    return jsi::Value();
}

+ (jsi::Value)evaluateBytecode:(NSData *)bytecodeData tag:(NSString *)tag runtime:(jsi::Runtime &)runtime
{
    if (bytecodeData.length == 0)
    {
        throw jsi::JSError(runtime, "evaluateBytecode: bytecode is empty");
    }

    if (![Utilities isHermesBytecode:bytecodeData])
    {
        throw jsi::JSError(runtime, "evaluateBytecode: data is not Hermes bytecode");
    }

    auto buffer   = std::make_shared<NSDataBuffer>(bytecodeData);
    auto prepared = runtime.prepareJavaScript(buffer, nsStringToStd(tag));
    return runtime.evaluatePreparedJavaScript(prepared);
}

@end
