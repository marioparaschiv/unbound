#pragma once

#include <nlohmann/json.hpp>

nlohmann::json UnboundEnvironmentReport();
void           UnboundStartHttpsCheck();
