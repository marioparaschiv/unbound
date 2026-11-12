#include <cassert>
#include <cstdint>
#include <functional>
#include <stdexcept>
#include <string>

#include "NativeArgumentValidation.h"

using loader::native::NativeArgumentShape;
using loader::native::NativeIntegerKind;
using loader::native::NativeNumberArgument;
using loader::native::validateBatchArgument;
using loader::native::validateScalarArgument;

static std::string failure(const std::function<void()> &validate)
{
    try
    {
        validate();
    }
    catch (const std::runtime_error &error)
    {
        return error.what();
    }
    return "";
}

static NativeNumberArgument number(double value)
{
    return {value, NativeIntegerKind::None, static_cast<int64_t>(value),
            static_cast<uint64_t>(value < 0 ? 0 : value)};
}

static NativeNumberArgument signedInteger(int64_t value)
{
    return {static_cast<double>(value), NativeIntegerKind::Signed, value,
            static_cast<uint64_t>(value)};
}

static NativeNumberArgument unsignedInteger(uint64_t value)
{
    return {static_cast<double>(value), NativeIntegerKind::Unsigned, static_cast<int64_t>(value),
            value};
}

static std::string scalar(const std::optional<NativeNumberArgument> &value, const char *type)
{
    return failure([&] {
        validateScalarArgument(value, type);
    });
}

static std::string batch(const NativeArgumentShape &argument, const char *encoding)
{
    return failure([&] {
        validateBatchArgument(argument, encoding);
    });
}

static NativeArgumentShape boxedNumber(NativeNumberArgument value, const char *encoding)
{
    NativeArgumentShape shape;
    shape.number        = value;
    shape.boxedEncoding = encoding;
    return shape;
}

static NativeArgumentShape boxed(const char *encoding)
{
    NativeArgumentShape shape;
    shape.boxedEncoding = encoding;
    return shape;
}

static NativeArgumentShape nullArgument()
{
    NativeArgumentShape shape;
    shape.null = true;
    return shape;
}

static NativeArgumentShape stringArgument()
{
    NativeArgumentShape shape;
    shape.string = true;
    return shape;
}

static NativeArgumentShape classArgument()
{
    NativeArgumentShape shape;
    shape.classObject = true;
    return shape;
}

int main()
{
    assert(scalar(std::nullopt, "i32") == "Native scalar argument must be a number");
    assert(scalar(number(1), "bool").empty());
    assert(scalar(number(0), "bool").empty());
    assert(scalar(number(2), "bool") == "Native boolean argument is invalid");
    assert(scalar(number(127), "i8").empty());
    assert(scalar(number(128), "i8") == "Native scalar argument is out of range");
    assert(scalar(number(1.5), "i32") == "Native scalar argument is out of range");
    assert(scalar(number(1.5), "double").empty());
    assert(scalar(signedInteger(INT64_MIN), "i64").empty());
    assert(scalar(unsignedInteger(INT64_MAX), "i64").empty());
    assert(scalar(unsignedInteger(static_cast<uint64_t>(INT64_MAX) + 1), "i64") ==
           "Native scalar argument is out of range");
    assert(scalar(unsignedInteger(UINT64_MAX), "u64").empty());
    assert(scalar(signedInteger(0), "u64").empty());
    assert(scalar(signedInteger(-1), "u64") == "Native scalar argument is out of range");
    assert(scalar(number(9007199254740991.0), "u64").empty());
    assert(scalar(number(-1), "u64") == "Native scalar argument is out of range");

    assert(batch(stringArgument(), "v") == "Native batch method argument type is unsupported");
    assert(batch(stringArgument(), "?") == "Native batch method argument type is unsupported");

    assert(batch(stringArgument(), "@").empty());
    assert(batch(nullArgument(), "@").empty());
    assert(batch(boxedNumber(number(1), "i"), "@").empty());
    assert(batch(boxed("^v"), "@") == "Native batch object argument cannot be a pointer");

    assert(batch(nullArgument(), "#").empty());
    assert(batch(classArgument(), "#").empty());
    assert(batch(stringArgument(), "#") == "Native batch class argument is invalid");

    assert(batch(nullArgument(), ":").empty());
    assert(batch(stringArgument(), ":").empty());
    assert(batch(boxed("^v"), ":") == "Native batch selector argument is invalid");

    assert(batch(nullArgument(), "^v").empty());
    assert(batch(boxed("^{CGRect}"), "^v").empty());
    assert(batch(stringArgument(), "*").empty());
    assert(batch(stringArgument(), "^v") == "Native batch pointer argument is invalid");
    assert(batch(boxedNumber(number(1), "q"), "^v") == "Native batch pointer argument is invalid");

    assert(batch(boxed("{CGPoint=dd}"), "{CGPoint=dd}").empty());
    assert(batch(boxed("{_CGPoint=dd}"), "{CGPoint=dd}").empty());
    assert(batch(boxed("{CGSize=dd}"), "{CGPoint=dd}") ==
           "Native batch struct argument has the wrong layout");
    assert(batch(stringArgument(), "{CGPoint=dd}") ==
           "Native batch struct argument has the wrong layout");

    assert(batch(boxedNumber(number(1), "d"), "B").empty());
    assert(batch(boxedNumber(number(300), "d"), "C") == "Native scalar argument is out of range");
    assert(batch(stringArgument(), "i") == "Native scalar argument must be a number");
    assert(batch(boxedNumber(signedInteger(-5), "q"), "rq").empty());
}
