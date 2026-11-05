#include <cstdlib>
#include <random>
#include <string>
#include <vector>

#include "FontFixtures.h"

#include "fuzz/FontFilesFuzz.h"

// Mutates well-formed fonts, collections, zips and preset JSON, and runs each mutant through every
// reader of untrusted font bytes. `UNBOUND_FUZZ_ITERATIONS` sets the rounds.
static std::vector<std::string> seeds()
{
    font_fixtures::FaceSpec bold;
    bold.weight   = 700;
    bold.italic   = true;
    bold.openType = true;
    font_fixtures::FaceSpec variable;
    variable.variable         = true;
    const std::string regular = font_fixtures::font();
    return {
        regular,
        font_fixtures::font(bold),
        font_fixtures::font(variable),
        font_fixtures::collection(regular),
        font_fixtures::zip({{"a/A.ttf", regular}, {"B.otf", font_fixtures::font(bold)}}),
        font_fixtures::zip({{"Deflated.ttf", regular, static_cast<uint32_t>(regular.size())}}),
        font_fixtures::zip({{"Bomb.ttf", regular, 0x7FFFFFFF}}),
        font_fixtures::zip({{"../x.ttf", regular}}),
        R"({"name":"P","overrides":{"ggsans-Normal":{"google":"Inter","weight":400,"style":"normal"},"ggsans-Bold":{"url":"https://a.test/b.ttf"}}})",
        R"({"version":1,"fonts":[{"id":"A","postScriptName":"A","file":"files/x/A.ttf","weight":400,"style":"normal","source":{"local":"A"}}],"overrides":{"ggsans-Normal":"A"},"presets":[]})",
        R"({"PRIMARY_SEMIBOLD":"ggsans-Semibold, NotoSans","CODE":"SourceCodePro-Regular"})",
    };
}

static std::string mutate(std::string input, std::mt19937 &random)
{
    const auto pick = [&](size_t bound) {
        return bound == 0 ? size_t{0} : static_cast<size_t>(random() % bound);
    };
    for (size_t edits = 1 + pick(4); edits > 0; edits--)
    {
        switch (pick(5))
        {
            case 0:
                if (!input.empty())
                {
                    input[pick(input.size())] = static_cast<char>(random());
                }
                break;
            case 1:
                input.resize(pick(input.size() + 1));
                break;
            case 2:
                input.insert(pick(input.size() + 1),
                             std::string(1 + pick(8), static_cast<char>(random())));
                break;
            case 3:
                // Big-endian field-sized garbage, where table offsets and counts live.
                if (input.size() >= 4)
                {
                    const size_t at = pick(input.size() - 3);
                    for (size_t byte = 0; byte < 4; byte++)
                    {
                        input[at + byte] = static_cast<char>(pick(2) ? 0xFF : random());
                    }
                }
                break;
            default:
                input += input.substr(pick(input.size() + 1));
                break;
        }
    }
    return input;
}

int main()
{
    const char *roundsVariable = std::getenv("UNBOUND_FUZZ_ITERATIONS");
    const long  rounds         = roundsVariable ? std::strtol(roundsVariable, nullptr, 10) : 20000;
    const std::vector<std::string> inputs = seeds();
    std::mt19937                   random(0xF0E7);

    for (const std::string &seed : inputs)
    {
        font_files_fuzz::fuzzOne(reinterpret_cast<const uint8_t *>(seed.data()), seed.size());
    }
    for (long round = 0; round < rounds; round++)
    {
        const std::string input = mutate(inputs[random() % inputs.size()], random);
        font_files_fuzz::fuzzOne(reinterpret_cast<const uint8_t *>(input.data()), input.size());
    }
    return 0;
}
