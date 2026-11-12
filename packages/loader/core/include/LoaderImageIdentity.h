#pragma once

#include <string>

namespace loader {
struct ImageIdentity {
    std::string name;
    std::string id;
};

ImageIdentity loaderImageIdentity();
std::string   imageIdentityLine(const ImageIdentity &identity);
}
