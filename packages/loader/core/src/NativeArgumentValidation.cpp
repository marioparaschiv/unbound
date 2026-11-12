#include "NativeArgumentValidation.h"

#include <stdexcept>

#include "NativeNumericValidation.h"
#include "NativeTypeEncoding.h"

namespace loader::native {
static bool boxesPointer(const NativeArgumentShape &argument)
{
    return argument.boxedEncoding && argument.boxedEncoding[0] == '^';
}

void validateScalarArgument(const std::optional<NativeNumberArgument> &number,
                            const std::string                         &type)
{
    if (!number)
    {
        throw std::runtime_error("Native scalar argument must be a number");
    }
    if (type == "bool")
    {
        if (number->value == 0 || number->value == 1)
            return;
        throw std::runtime_error("Native boolean argument is invalid");
    }
    bool signedInteger   = number->integer == NativeIntegerKind::Signed;
    bool unsignedInteger = number->integer == NativeIntegerKind::Unsigned;
    if (type == "i64")
    {
        if (signedInteger || (unsignedInteger && number->unsignedValue <= INT64_MAX))
            return;
    }
    if (type == "u64")
    {
        if (unsignedInteger || (signedInteger && number->signedValue >= 0))
            return;
    }
    if (!validNativeNumericValue(number->value, type))
    {
        throw std::runtime_error("Native scalar argument is out of range");
    }
}

void validateBatchArgument(const NativeArgumentShape &argument, const char *encoding)
{
    std::string type = nativeFFITypeName(encoding);
    if (type.empty() || type == "void")
    {
        throw std::runtime_error("Native batch method argument type is unsupported");
    }
    if (type == "object")
    {
        if (boxesPointer(argument))
        {
            throw std::runtime_error("Native batch object argument cannot be a pointer");
        }
        return;
    }
    if (type == "class")
    {
        if (argument.null || argument.classObject)
            return;
        throw std::runtime_error("Native batch class argument is invalid");
    }
    if (type == "selector")
    {
        if (argument.null || argument.string)
            return;
        throw std::runtime_error("Native batch selector argument is invalid");
    }
    if (type == "pointer")
    {
        if (argument.null || boxesPointer(argument) ||
            (normalizedType(encoding) == '*' && argument.string))
            return;
        throw std::runtime_error("Native batch pointer argument is invalid");
    }
    if (type.starts_with("struct:"))
    {
        if (argument.boxedEncoding && nativeFFITypeName(argument.boxedEncoding) == type)
            return;
        throw std::runtime_error("Native batch struct argument has the wrong layout");
    }
    validateScalarArgument(argument.number, type);
}
}
