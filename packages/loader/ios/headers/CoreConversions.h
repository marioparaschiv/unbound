#pragma once

#import <Foundation/Foundation.h>

#include <string>

#include <nlohmann/json.hpp>

namespace unbound::ios
{
    inline std::string toStdString(NSString *value)
    {
        const char *utf8 = value.UTF8String;
        return utf8 ? std::string(utf8) : std::string();
    }

    inline NSString *toNSString(const std::string &value)
    {
        return [NSString stringWithUTF8String:value.c_str()] ?: @"";
    }

    id objectFromJSON(const nlohmann::json &value);
    nlohmann::json jsonFromObject(id value);
}
