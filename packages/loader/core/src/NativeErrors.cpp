#include "NativeErrors.h"

#include <atomic>
#include <cstring>
#include <exception>

#include "LoaderBootstrap.h"
#include "NativeCallActivity.h"
#include "NativePluginRuntime.h"

namespace loader::native {
namespace jsi = facebook::jsi;

#if defined(__ANDROID__)
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Envelope};
#else
static std::atomic<NativeErrorDelivery> gErrorDelivery{NativeErrorDelivery::Throw};
#endif

NativeCodedError::NativeCodedError(std::string code, const std::string &message)
    : std::runtime_error(message), code_(std::move(code))
{
}

const std::string &NativeCodedError::code() const
{
    return code_;
}

NativeFailure describeFailure(std::exception_ptr failure)
{
    try
    {
        if (failure)
        {
            std::rethrow_exception(failure);
        }
    }
    catch (const NativeCodedError &error)
    {
        return {error.code(), error.what()};
    }
    catch (const std::exception &error)
    {
        std::string message = error.what();
        return {kNativeBridgeErrorCode, message.empty() ? "Native operation failed" : message};
    }
    catch (...)
    {
    }
    return {kNativeBridgeErrorCode, "Native operation failed"};
}

NativeErrorDelivery nativeErrorDelivery()
{
    return gErrorDelivery.load();
}

void setNativeErrorDelivery(NativeErrorDelivery delivery)
{
    gErrorDelivery.store(delivery);
}

jsi::Object makeError(jsi::Runtime &runtime, const char *code, const std::string &message)
{
    jsi::Function constructor = runtime.global().getPropertyAsFunction(runtime, "Error");
    jsi::Object   error =
        constructor.callAsConstructor(runtime, jsi::String::createFromUtf8(runtime, message))
            .asObject(runtime);
    error.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, code));
    return error;
}

void throwCoded(jsi::Runtime &runtime, const char *code, const std::string &message)
{
    jsi::JSError failure(runtime, message);
    failure.value().asObject(runtime).setProperty(runtime, "code",
                                                  jsi::String::createFromUtf8(runtime, code));
    throw failure;
}

void attachDefaultCode(jsi::Runtime &runtime, const jsi::JSError &error)
{
    const jsi::Value &value = error.value();
    if (!value.isObject())
    {
        return;
    }

    jsi::Object object = value.asObject(runtime);
    if (object.getProperty(runtime, "code").isString())
    {
        return;
    }

    object.setProperty(runtime, "code",
                       jsi::String::createFromUtf8(runtime, kNativeBridgeErrorCode));
}

static NativeFailure describeJSError(jsi::Runtime &runtime, const jsi::JSError &error)
{
    NativeFailure failure{kNativeBridgeErrorCode, error.getMessage()};
    try
    {
        const jsi::Value &value = error.value();
        if (value.isObject())
        {
            jsi::Value code = value.asObject(runtime).getProperty(runtime, "code");
            if (code.isString())
            {
                failure.code = code.getString(runtime).utf8(runtime);
            }
        }
    }
    catch (...)
    {
    }
    return failure;
}

static jsi::Value failureEnvelope(jsi::Runtime &runtime, const NativeFailure &failure)
{
    jsi::Object details(runtime);
    details.setProperty(runtime, "code", jsi::String::createFromUtf8(runtime, failure.code));
    details.setProperty(runtime, "message", jsi::String::createFromUtf8(runtime, failure.message));
    jsi::Object envelope(runtime);
    envelope.setProperty(runtime, kNativeFailureEnvelopeKey, std::move(details));
    return envelope;
}

static jsi::Value throwingGuard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    try
    {
        return body();
    }
    catch (const jsi::JSError &error)
    {
        attachDefaultCode(runtime, error);
        throw;
    }
    catch (...)
    {
        NativeFailure failure = describeFailure(std::current_exception());
        throwCoded(runtime, failure.code.c_str(), failure.message);
    }
}

static jsi::Value envelopingGuard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    try
    {
        return body();
    }
    catch (const jsi::JSError &error)
    {
        return failureEnvelope(runtime, describeJSError(runtime, error));
    }
    catch (const std::exception &)
    {
        return failureEnvelope(runtime, describeFailure(std::current_exception()));
    }
}

jsi::Value guard(jsi::Runtime &runtime, const std::function<jsi::Value()> &body)
{
    if (nativeErrorDelivery() == NativeErrorDelivery::Envelope)
    {
        return envelopingGuard(runtime, body);
    }
    return throwingGuard(runtime, body);
}

static std::optional<jsi::Function> failureGuard(jsi::Runtime &runtime)
{
    jsi::Value existing = runtime.global().getProperty(runtime, kNativeFailureGuardName);
    if (existing.isObject() && existing.asObject(runtime).isFunction(runtime))
    {
        return existing.asObject(runtime).asFunction(runtime);
    }
    jsi::Value created = bootstrap::evaluate(runtime, bootstrap::kNativeFailureGuard);
    if (!created.isObject() || !created.asObject(runtime).isFunction(runtime))
    {
        return std::nullopt;
    }
    return created.asObject(runtime).asFunction(runtime);
}

static constexpr size_t kLabelledArguments  = 3;
static constexpr size_t kArgumentLabelLimit = 64;

static std::string firstStringArgument(jsi::Runtime &runtime, const jsi::Value *args, size_t count)
{
    for (size_t index = 0; index < count && index < kLabelledArguments; index++)
    {
        if (args[index].isString())
        {
            std::string text = args[index].getString(runtime).utf8(runtime);
            return text.size() > kArgumentLabelLimit ? text.substr(0, kArgumentLabelLimit) : text;
        }
    }
    return {};
}

jsi::Function makeFunction(jsi::Runtime &runtime, const char *name, unsigned int argumentCount,
                           jsi::HostFunctionType handler)
{
    jsi::HostFunctionType guarded = [handler = std::move(handler), label = std::string(name)](
                                        jsi::Runtime &rt, const jsi::Value &thisValue,
                                        const jsi::Value *args, size_t count) -> jsi::Value {
        NativeCallScope scope(label, firstStringArgument(rt, args, count));
        return guard(rt, [&]() {
            return handler(rt, thisValue, args, count);
        });
    };

    jsi::Function native = jsi::Function::createFromHostFunction(
        runtime, jsi::PropNameID::forUtf8(runtime, name), argumentCount, std::move(guarded));
    if (nativeErrorDelivery() == NativeErrorDelivery::Throw)
    {
        return native;
    }
    auto wrap = failureGuard(runtime);
    if (!wrap)
    {
        return native;
    }
    return wrap->call(runtime, std::move(native)).asObject(runtime).asFunction(runtime);
}
}
