#include "LoaderJSI.h"

#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

#include "HermesBytecodeHeader.h"
#include "LoaderLog.h"

namespace loader {
namespace jsi = facebook::jsi;

OwnedBuffer::OwnedBuffer(std::string data) : data_(std::move(data)) {}

size_t OwnedBuffer::size() const
{
    return data_.size();
}

const uint8_t *OwnedBuffer::data() const
{
    return reinterpret_cast<const uint8_t *>(data_.data());
}

std::shared_ptr<MappedFileBuffer> MappedFileBuffer::map(const std::string &path)
{
    int descriptor = open(path.c_str(), O_RDONLY | O_CLOEXEC);
    if (descriptor < 0)
    {
        return nullptr;
    }
    struct stat status{};
    if (fstat(descriptor, &status) != 0 || !S_ISREG(status.st_mode) || status.st_size <= 0)
    {
        close(descriptor);
        return nullptr;
    }
    size_t size = static_cast<size_t>(status.st_size);
    void  *data = mmap(nullptr, size, PROT_READ, MAP_PRIVATE, descriptor, 0);
    close(descriptor);
    if (data == MAP_FAILED)
    {
        return nullptr;
    }
    return std::shared_ptr<MappedFileBuffer>(new MappedFileBuffer(data, size));
}

MappedFileBuffer::MappedFileBuffer(void *data, size_t size) : data_(data), size_(size) {}

MappedFileBuffer::~MappedFileBuffer()
{
    munmap(data_, size_);
}

size_t MappedFileBuffer::size() const
{
    return size_;
}

const uint8_t *MappedFileBuffer::data() const
{
    return static_cast<const uint8_t *>(data_);
}

static void logEvaluationFailure(const std::string &tag, const char *kind, const char *detail)
{
    log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
        "JSI eval of '" + tag + "' threw " + kind + (detail ? std::string(": ") + detail : ""));
}

bool evaluateBytecodeBuffer(jsi::Runtime                             &runtime,
                            const std::shared_ptr<const jsi::Buffer> &bytecode,
                            const std::string                        &tag)
{
    if (!bytecode || !isHermesBytecode(bytecode->data(), bytecode->size()))
    {
        return false;
    }
    try
    {
        runtime.evaluatePreparedJavaScript(runtime.prepareJavaScript(bytecode, tag));
        return true;
    }
    catch (const jsi::JSError &error)
    {
        logEvaluationFailure(tag, "JSError", error.what());
    }
    catch (const std::exception &error)
    {
        logEvaluationFailure(tag, "exception", error.what());
    }
    catch (...)
    {
        logEvaluationFailure(tag, "an unknown error", nullptr);
    }
    return false;
}

bool evaluateScript(jsi::Runtime &runtime, std::string script, const std::string &tag)
{
    if (script.empty())
    {
        return false;
    }

    try
    {
        if (isHermesBytecode(script.data(), script.size()))
        {
            auto prepared =
                runtime.prepareJavaScript(std::make_shared<OwnedBuffer>(std::move(script)), tag);
            runtime.evaluatePreparedJavaScript(prepared);
        }
        else
        {
            runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(script)), tag);
        }
        return true;
    }
    catch (const jsi::JSError &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw JSError: " + error.what());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw exception: " + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI eval of '" + tag + "' threw an unknown error");
    }
    return false;
}

jsi::Value evaluateSource(jsi::Runtime &runtime, const std::string &source, const std::string &tag)
{
    if (source.empty())
    {
        return jsi::Value();
    }

    try
    {
        return runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), tag);
    }
    catch (const jsi::JSError &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw JSError: " + error.what());
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw exception: " + error.what());
    }
    catch (...)
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT,
            "JSI source eval of '" + tag + "' threw an unknown error");
    }
    return jsi::Value();
}

jsi::Value evaluateBytecode(jsi::Runtime &runtime, std::string bytecode, const std::string &tag)
{
    if (bytecode.empty())
    {
        throw jsi::JSError(runtime, "evaluateBytecode: bytecode is empty");
    }

    if (!isHermesBytecode(bytecode.data(), bytecode.size()))
    {
        throw jsi::JSError(runtime, "evaluateBytecode: data is not Hermes bytecode");
    }

    auto prepared =
        runtime.prepareJavaScript(std::make_shared<OwnedBuffer>(std::move(bytecode)), tag);
    return runtime.evaluatePreparedJavaScript(prepared);
}
}
