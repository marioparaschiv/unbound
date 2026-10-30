#pragma once

#include <cassert>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

namespace cryptovectors {
struct Vector {
    std::string              kind;
    std::vector<std::string> fields;
};

inline std::string fromHex(const std::string &encoded)
{
    if (encoded == "-")
    {
        return {};
    }
    assert(encoded.size() % 2 == 0);
    std::string decoded;
    for (size_t index = 0; index < encoded.size(); index += 2)
    {
        decoded.push_back(static_cast<char>(std::stoi(encoded.substr(index, 2), nullptr, 16)));
    }
    return decoded;
}

inline std::vector<Vector> load()
{
    std::ifstream file(ASTRAL_CORE_TEST_VECTORS_DIR "/crypto-cross-check.txt");
    assert(file);
    std::vector<Vector> vectors;
    std::string         line;
    while (std::getline(file, line))
    {
        std::istringstream stream(line);
        Vector             vector;
        stream >> vector.kind;
        for (std::string field; stream >> field;)
        {
            vector.fields.push_back(field);
        }
        if (!vector.kind.empty())
        {
            vectors.push_back(vector);
        }
    }
    return vectors;
}

inline std::vector<Vector> load(const std::string &kind)
{
    std::vector<Vector> matching;
    for (const Vector &vector : load())
    {
        if (vector.kind == kind)
        {
            matching.push_back(vector);
        }
    }
    assert(!matching.empty());
    return matching;
}
}
