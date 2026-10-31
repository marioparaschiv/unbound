#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <random>
#include <string>
#include <vector>

#include "fuzz/NativeBridgeFuzz.h"

using native_bridge_fuzz::Target;

static std::vector<std::uint8_t> seed(Target target, const std::string &body)
{
    std::vector<std::uint8_t> input{static_cast<std::uint8_t>(target)};
    input.insert(input.end(), body.begin(), body.end());
    return input;
}

static std::vector<std::vector<std::uint8_t>> corpus()
{
    std::vector<std::vector<std::uint8_t>> inputs;
    for (const char *encoding : {"@",
                                 "v",
                                 "^v",
                                 ":",
                                 "#",
                                 "*",
                                 "B",
                                 "q",
                                 "Q",
                                 "d",
                                 "r^{CGRect={CGPoint=dd}{CGSize=dd}}",
                                 "{CGRect={CGPoint=dd}{CGSize=dd}}",
                                 "{_NSRange=QQ}",
                                 "{CGPoint=dd}",
                                 "{UIEdgeInsets=dddd}",
                                 "{CGAffineTransform=dddddd}",
                                 "nO{CGSize=dd}",
                                 "{=}",
                                 "{CGRect=",
                                 "{"})
    {
        inputs.push_back(seed(Target::TypeEncoding, encoding));
    }
    for (const char *name :
         {"void", "bool", "i8", "u64", "double", "pointer", "cstring", "struct:CGRect",
          "struct:NSRange", "struct:", "struct:timeval", "i32 "})
    {
        inputs.push_back(seed(Target::TypeName, name));
    }
    for (std::uint8_t type = 0; type < 18; type++)
    {
        inputs.push_back({static_cast<std::uint8_t>(Target::ValueRoundTrip),
                          type,
                          0xff,
                          0x7f,
                          0x80,
                          0x00,
                          0xf0,
                          0x7f,
                          0x01,
                          0x02,
                          0x03,
                          0x04,
                          0x05,
                          0x06,
                          0x07,
                          0x08,
                          0x09,
                          0x0a,
                          0x0b,
                          0x0c,
                          0x0d,
                          0x0e,
                          0x0f});
    }
    for (std::uint8_t type = 0; type < 14; type++)
    {
        inputs.push_back(
            {static_cast<std::uint8_t>(Target::NumericValue), type, 0, 0, 0, 0, 0, 0, 0xf8, 0x7f});
        inputs.push_back(
            {static_cast<std::uint8_t>(Target::NumericValue), type, 0, 0, 0, 0, 0, 0, 0xe0, 0x43});
    }
    for (const char *name :
         {"setTitle:", "", "{\"id\":\"handle-1\"}", "{\"id\":7}", "[]", "{\"id\":\"\"}",
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
    {
        inputs.push_back(seed(Target::Names, name));
    }
    for (
        const char *manifest :
        {R"({"revision":"abc","channel":"release","buildTime":"2026-10-27T20:00:00Z","bytecodeVersions":[96,98],"sha512":{"unbound.98.bundle":"00"}})",
         R"({"revision":"","bytecodeVersions":[4294967295],"sha512":{}})",
         R"({"buildTime":"2026-13-40T99:99:99Z"})",
         R"({"source":"x","channel":"c","buildTime":"t","revision":"r","buildTimeMilliseconds":-1})",
         "{", "null", "1e999"})
    {
        inputs.push_back(seed(Target::BundleManifest, manifest));
    }
    return inputs;
}

static std::vector<std::uint8_t> mutate(std::vector<std::uint8_t>                     input,
                                        const std::vector<std::vector<std::uint8_t>> &inputs,
                                        std::mt19937                                 &random)
{
    static const char *const tokens[] = {"{",    "}",  "=",     "\"",          ":",
                                         ",",    "[",  "]",     "struct:",     "\\u0000",
                                         "null", "-0", "1e308", "{CGPoint=dd}"};
    int                      edits    = 1 + static_cast<int>(random() % 4);
    for (int edit = 0; edit < edits; edit++)
    {
        std::size_t position = input.size() > 1 ? 1 + random() % (input.size() - 1) : 1;
        switch (random() % 6)
        {
            case 0:
                if (input.size() > 1)
                    input[position] ^= static_cast<std::uint8_t>(1u << (random() % 8));
                break;
            case 1:
                input.insert(input.begin() + std::min(position, input.size()),
                             static_cast<std::uint8_t>(random()));
                break;
            case 2:
                if (input.size() > 1)
                    input.erase(input.begin() + position);
                break;
            case 3: {
                const char *token = tokens[random() % (sizeof(tokens) / sizeof(tokens[0]))];
                input.insert(input.begin() + std::min(position, input.size()), token,
                             token + std::strlen(token));
                break;
            }
            case 4: {
                const std::vector<std::uint8_t> &other = inputs[random() % inputs.size()];
                if (other.size() > 1)
                {
                    std::size_t start = 1 + random() % (other.size() - 1);
                    input.insert(input.begin() + std::min(position, input.size()),
                                 other.begin() + start, other.end());
                }
                break;
            }
            default:
                input.resize(std::max<std::size_t>(1, position));
                break;
        }
    }
    if (input.size() > 4096)
    {
        input.resize(4096);
    }
    return input;
}

int main()
{
    const char *iterationsVariable = std::getenv("UNBOUND_FUZZ_ITERATIONS");
    const long  iterations =
        iterationsVariable ? std::strtol(iterationsVariable, nullptr, 10) : 200000;
    std::mt19937                           random(0x5eed);
    std::vector<std::vector<std::uint8_t>> inputs = corpus();
    for (const std::vector<std::uint8_t> &input : inputs)
    {
        native_bridge_fuzz::fuzzOne(input.data(), input.size());
    }
    for (long iteration = 0; iteration < iterations; iteration++)
    {
        std::vector<std::uint8_t> input = mutate(inputs[random() % inputs.size()], inputs, random);
        native_bridge_fuzz::fuzzOne(input.data(), input.size());
    }
    std::printf("native bridge fuzz: %ld mutated inputs from %zu seeds\n", iterations,
                inputs.size());
    return 0;
}
