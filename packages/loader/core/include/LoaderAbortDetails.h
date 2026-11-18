#pragma once

#include <string>

namespace loader {
std::string describeCurrentException();

void installTerminateHandler();

void writeAbortMessages(int descriptor);
}
