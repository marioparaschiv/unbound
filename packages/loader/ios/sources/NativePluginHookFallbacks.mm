#import "NativePluginHookFallbacks.h"

#import <UIKit/UIKit.h>
#include <string_view>
#include <type_traits>
#include <unordered_map>
#include <vector>

#import "NativePluginHookDispatch.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
template <typename Result, typename... Arguments>
static Result dispatchTypedHook(HookDispatcher *dispatcher, id object, SEL selector,
                                Arguments... values)
{
    @autoreleasepool
    {
        void *arguments[] = {&object, &selector, &values...};
        if constexpr (std::is_void_v<Result>)
        {
            dispatchFFIHookBody(nullptr, nullptr, arguments, dispatcher);
        }
        else if constexpr (std::is_same_v<Result, id> || std::is_same_v<Result, Class>)
        {
            void *returnValue = nullptr;
            dispatchFFIHookBody(nullptr, &returnValue, arguments, dispatcher);
            return (__bridge Result) returnValue;
        }
        else
        {
            Result returnValue{};
            dispatchFFIHookBody(nullptr, &returnValue, arguments, dispatcher);
            return returnValue;
        }
    }
}

template <typename Result, typename... Arguments>
static IMP makeTypedHook(HookDispatcher *dispatcher)
{
    SEL selector = dispatcher->selector;
    return imp_implementationWithBlock(^Result(id object, Arguments... values) {
        return dispatchTypedHook<Result, Arguments...>(dispatcher, object, selector, values...);
    });
}

namespace {
    struct FallbackHook {
        std::string_view              result;
        std::vector<std::string_view> arguments;
        IMP (*make)(HookDispatcher *dispatcher);
    };
}

template <typename Result, typename... Arguments>
static FallbackHook fallbackHook(std::string_view result, std::vector<std::string_view> arguments)
{
    return {result, std::move(arguments), makeTypedHook<Result, Arguments...>};
}

static const std::vector<FallbackHook> &fallbackHooks()
{
    static const std::vector<FallbackHook> hooks = {
        fallbackHook<id>("object", {}),
        fallbackHook<Class>("class", {}),
        fallbackHook<int8_t>("i8", {}),
        fallbackHook<int64_t>("i64", {}),
        fallbackHook<int32_t>("i32", {}),
        fallbackHook<double>("double", {}),
        fallbackHook<float>("float", {}),
        fallbackHook<CGPoint>("struct:CGPoint", {}),
        fallbackHook<CGRect>("struct:CGRect", {}),
        fallbackHook<UIEdgeInsets>("struct:UIEdgeInsets", {}),
        fallbackHook<NSRange>("struct:NSRange", {}),
        fallbackHook<int8_t, id, id>("i8", {"object", "object"}),
        fallbackHook<int8_t, id>("i8", {"object"}),
        fallbackHook<int8_t, Class>("i8", {"class"}),
        fallbackHook<int8_t, SEL>("i8", {"selector"}),
        fallbackHook<int8_t, int64_t>("i8", {"i64"}),
        fallbackHook<int8_t, CGPoint, id>("i8", {"struct:CGPoint", "object"}),
        fallbackHook<id, CGRect>("object", {"struct:CGRect"}),
        fallbackHook<id, CGPoint, id>("object", {"struct:CGPoint", "object"}),
        fallbackHook<id, id>("object", {"object"}),
        fallbackHook<id, int64_t>("object", {"i64"}),
        fallbackHook<id, id, int64_t>("object", {"object", "i64"}),
        fallbackHook<int64_t, id>("i64", {"object"}),
        fallbackHook<int64_t, id, int64_t>("i64", {"object", "i64"}),
        fallbackHook<void, id>("void", {"object"}),
        fallbackHook<void, int64_t>("void", {"i64"}),
        fallbackHook<void, int32_t>("void", {"i32"}),
        fallbackHook<void, int8_t>("void", {"i8"}),
        fallbackHook<void, double>("void", {"double"}),
        fallbackHook<void, float>("void", {"float"}),
        fallbackHook<void, CGPoint>("void", {"struct:CGPoint"}),
        fallbackHook<void, CGSize>("void", {"struct:CGSize"}),
        fallbackHook<void, CGRect>("void", {"struct:CGRect"}),
        fallbackHook<void, UIEdgeInsets>("void", {"struct:UIEdgeInsets"}),
        fallbackHook<void, NSRange>("void", {"struct:NSRange"}),
        fallbackHook<void, CGAffineTransform>("void", {"struct:CGAffineTransform"}),
        fallbackHook<void, int8_t, int8_t>("void", {"i8", "i8"}),
        fallbackHook<void, CGPoint, int8_t>("void", {"struct:CGPoint", "i8"}),
        fallbackHook<void, id, int8_t>("void", {"object", "i8"}),
        fallbackHook<void, id, int64_t>("void", {"object", "i64"}),
        fallbackHook<void, id, double>("void", {"object", "double"}),
        fallbackHook<void, id, CGRect>("void", {"object", "struct:CGRect"}),
        fallbackHook<void, int64_t, id>("void", {"i64", "object"}),
        fallbackHook<void, id, id>("void", {"object", "object"}),
        fallbackHook<void, id, int64_t, int8_t>("void", {"object", "i64", "i8"}),
        fallbackHook<void, id, id, id>("void", {"object", "object", "object"}),
        fallbackHook<CGRect, id>("struct:CGRect", {"object"}),
        fallbackHook<double, id, id>("double", {"object", "object"}),
        fallbackHook<CGSize>("struct:CGSize", {}),
        fallbackHook<CGSize, CGSize>("struct:CGSize", {"struct:CGSize"}),
        fallbackHook<CGSize, CGSize, float, float>("struct:CGSize",
                                                   {"struct:CGSize", "float", "float"}),
        fallbackHook<CGSize, CGSize, double, double>("struct:CGSize",
                                                     {"struct:CGSize", "double", "double"}),
    };
    return hooks;
}

static std::string_view fallbackTypeName(const std::string &name)
{
    static const std::unordered_map<std::string_view, std::string_view> sameRegister = {
        {"bool", "i8"}, {"u8", "i8"}, {"u16", "i16"}, {"u32", "i32"}, {"u64", "i64"}};
    auto alias = sameRegister.find(name);
    return alias == sameRegister.end() ? std::string_view(name) : alias->second;
}

static bool matchesFallbackHook(const HookSignature &signature, const FallbackHook &hook)
{
    if (fallbackTypeName(signature.result.name) != hook.result ||
        signature.arguments.size() != hook.arguments.size() + 2)
    {
        return false;
    }
    for (size_t index = 0; index < hook.arguments.size(); index++)
    {
        if (fallbackTypeName(signature.arguments[index + 2].name) != hook.arguments[index])
        {
            return false;
        }
    }
    return true;
}

void *fallbackHookCode(HookDispatcher *dispatcher)
{
    for (const FallbackHook &hook : fallbackHooks())
    {
        if (matchesFallbackHook(*dispatcher->signature, hook))
        {
            return (void *) hook.make(dispatcher);
        }
    }
    if (dispatcher->signature->result.name == "void" &&
        dispatcher->signature->arguments.size() == 2)
    {
        return (void *) makeTypedHook<void>(dispatcher);
    }
    return nullptr;
}
}
