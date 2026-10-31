#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <hermes/hermes.h>
#include <memory>
#include <random>
#include <vector>

#include "NativeJSIFuzz.h"

int main()
{
    const char *iterationsVariable = std::getenv("UNBOUND_FUZZ_ITERATIONS");
    const long  iterations =
        iterationsVariable ? std::strtol(iterationsVariable, nullptr, 10) : 3000;
    std::mt19937 random(0x15eed);
    auto         runtime = facebook::hermes::makeHermesRuntime();
    for (long iteration = 0; iteration < iterations; iteration++)
    {
        std::vector<std::uint8_t> input(2 + random() % 96);
        for (std::uint8_t &byte : input)
        {
            byte = static_cast<std::uint8_t>(random());
        }
        native_jsi_fuzz::fuzzOne(*runtime, input.data(), input.size());
        if (iteration % 500 == 499)
        {
            runtime = facebook::hermes::makeHermesRuntime();
        }
    }
    const native_jsi_fuzz::FuzzStats &stats = native_jsi_fuzz::stats();
    std::printf(
        "native JSI fuzz: %ld generated values, %ld evaluated, %ld conversions accepted, %ld rejected\n",
        iterations, stats.evaluated, stats.serialized, stats.rejected);
    if (stats.evaluated * 2 < iterations || stats.serialized == 0 || stats.rejected == 0)
    {
        std::fprintf(stderr, "native JSI fuzz: the generator stopped producing useful values\n");
        return 1;
    }
    return 0;
}
