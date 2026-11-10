#pragma once

#include <jsi/jsi.h>
#include <memory>
#include <string>

namespace loader {
class OwnedBuffer : public facebook::jsi::Buffer
{
public:
    explicit OwnedBuffer(std::string data);

    size_t         size() const override;
    const uint8_t *data() const override;

private:
    std::string data_;
};

// A read-only private mapping of a whole file. Hermes pages bytecode in from it lazily, and its
// pages stay clean and reclaimable, as React Native's own bundle loading does.
class MappedFileBuffer : public facebook::jsi::Buffer
{
public:
    // Null for a missing, empty or unmappable file.
    static std::shared_ptr<MappedFileBuffer> map(const std::string &path);
    ~MappedFileBuffer() override;

    size_t         size() const override;
    const uint8_t *data() const override;

private:
    MappedFileBuffer(void *data, size_t size);

    void  *data_;
    size_t size_;
};

bool evaluateScript(facebook::jsi::Runtime &runtime, std::string script, const std::string &tag);
bool evaluateBytecodeBuffer(facebook::jsi::Runtime                             &runtime,
                            const std::shared_ptr<const facebook::jsi::Buffer> &bytecode,
                            const std::string                                  &tag);
facebook::jsi::Value evaluateSource(facebook::jsi::Runtime &runtime, const std::string &source,
                                    const std::string &tag);
facebook::jsi::Value evaluateBytecode(facebook::jsi::Runtime &runtime, std::string bytecode,
                                      const std::string &tag);
}
