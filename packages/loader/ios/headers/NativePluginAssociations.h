#pragma once

#import <Foundation/Foundation.h>
#include <jsi/jsi.h>
#import <objc/runtime.h>

namespace loader::ios {
class AssociationKeyHost final : public facebook::jsi::HostObject
{
public:
    explicit AssociationKeyHost(id value) : value_(value) {}

    const void *key(void) const
    {
        return (__bridge const void *) value_;
    }

private:
    __strong id value_;
};

objc_AssociationPolicy associationPolicy(facebook::jsi::Runtime     &runtime,
                                         const facebook::jsi::Value *value);
}
