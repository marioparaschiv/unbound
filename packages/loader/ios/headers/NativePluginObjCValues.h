#pragma once

#import <Foundation/Foundation.h>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <jsi/jsi.h>
#include <memory>

#import "LoaderAddonHandles.h"
#import "NativeObjectLifetime.h"

namespace loader::ios {
std::atomic<size_t> &liveObjCHandles();
std::atomic<size_t> &liveObjCRetains();

class ObjCHandleHost final : public facebook::jsi::HostObject
{
public:
    explicit ObjCHandleHost(__unsafe_unretained id value,
                            std::atomic<size_t> &live = liveObjCHandles())
        : charge_(loader::chargeHandle()), value_(ownableObject(value)), live_(live)
    {
        if (!charge_.admitted)
        {
            throw facebook::jsi::JSINativeException(
                loader::handleLimitMessage(loader::currentAddon()));
        }

        live_.fetch_add(1, std::memory_order_relaxed);
    }

    // Hermes may finalize this on its GC thread; UIKit objects must take their last release on
    // main.
    ~ObjCHandleHost() override
    {
        loader::releaseHandle(charge_);
        live_.fetch_sub(1, std::memory_order_relaxed);
        if (!value_ || [NSThread isMainThread])
        {
            return;
        }

        void *owned = (__bridge_retained void *) value_;
        value_      = nil;
        dispatch_async_f(dispatch_get_main_queue(), owned, [](void *object) {
            CFRelease(object);
        });
    }

    id value(void) const
    {
        return value_;
    }

private:
    loader::HandleCharge charge_;
    __strong id value_;
    std::atomic<size_t> &live_;
};

class StructHost final : public facebook::jsi::HostObject
{
public:
    StructHost(NSString *name, NSValue *value) : name_([name copy]), value_(value) {}

    facebook::jsi::Value get(facebook::jsi::Runtime &runtime,
                             const facebook::jsi::PropNameID &name) override;
    std::vector<facebook::jsi::PropNameID>
    getPropertyNames(facebook::jsi::Runtime &runtime) override;

    NSString *name(void) const
    {
        return name_;
    }

    NSValue *value(void) const
    {
        return value_;
    }

private:
    NSString *name_;
    NSValue *value_;
};

template <typename T> void storeNativeValue(uint8_t *target, T value)
{
    memcpy(target, &value, sizeof(value));
}

template <typename T> T loadNativeValue(const uint8_t *source)
{
    T value{};
    memcpy(&value, source, sizeof(value));
    return value;
}

facebook::jsi::Value objcJSIValue(facebook::jsi::Runtime &runtime, id value);
NSString *jsiString(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
std::shared_ptr<ObjCHandleHost> objcHost(facebook::jsi::Runtime &runtime,
                                         const facebook::jsi::Value &value);
id objcValue(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
facebook::jsi::Value objcHandleResult(facebook::jsi::Runtime &runtime, id value);
facebook::jsi::Value pointerResult(facebook::jsi::Runtime &runtime, void *pointer);
facebook::jsi::Value objcResult(facebook::jsi::Runtime &runtime, id value);
id valueToObjC(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
id valueToData(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
facebook::jsi::Value dataBytes(facebook::jsi::Runtime &runtime, NSData *data);
facebook::jsi::Value structResult(facebook::jsi::Runtime &runtime, NSString *name, NSValue *value);
facebook::jsi::Value structValue(facebook::jsi::Runtime &runtime, NSString *name,
                                 const facebook::jsi::Value &fields);
facebook::jsi::Value structFields(facebook::jsi::Runtime &runtime, NSString *name, NSValue *value);
NSMutableArray *argumentArray(facebook::jsi::Runtime &runtime, const facebook::jsi::Array &values);
NSArray *argumentArray(facebook::jsi::Runtime &runtime, const facebook::jsi::Value *args,
                       size_t count, size_t start);
Class classFromValue(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value);
}
