#pragma once

#import <Foundation/Foundation.h>
#include <atomic>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#import <objc/runtime.h>
#include <vector>

#import "NativeFFI.h"

namespace loader::ios {
class ObjCCallPlanHost final : public facebook::jsi::HostObject
{
public:
    ObjCCallPlanHost(Class ownerClass, SEL selector, bool classMethod, NSMethodSignature *signature,
                     loader::ffi::Type resultType, std::vector<loader::ffi::Type> argumentTypes,
                     uint64_t runtimeIdentity, uint64_t runtimeGeneration);
    ~ObjCCallPlanHost() override;

    void validate(facebook::jsi::Runtime &runtime, id target) const;

    SEL selector() const
    {
        return selector_;
    }

    NSMethodSignature *signature() const
    {
        return signature_;
    }

    const loader::ffi::Type &resultType() const
    {
        return resultType_;
    }

    const std::vector<loader::ffi::Type> &argumentTypes() const
    {
        return argumentTypes_;
    }

    void dispose();

private:
    void releasePlanSlot();

    Class                          ownerClass_;
    SEL                            selector_;
    bool                           classMethod_;
    __strong NSMethodSignature    *signature_;
    loader::ffi::Type              resultType_;
    std::vector<loader::ffi::Type> argumentTypes_;
    uint64_t                       runtimeIdentity_;
    uint64_t                       runtimeGeneration_;
    std::atomic_bool               active_{true};
    std::atomic_bool               slotActive_{true};
};

std::shared_ptr<ObjCCallPlanHost> objcCallPlanHost(facebook::jsi::Runtime     &runtime,
                                                   const facebook::jsi::Value &value);
std::shared_ptr<ObjCCallPlanHost> prepareObjCCallPlan(facebook::jsi::Runtime &runtime, id target,
                                                      SEL selector);
}
