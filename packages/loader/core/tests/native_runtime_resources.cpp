#include <atomic>
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <future>
#include <memory>
#include <string>
#include <thread>

#include "NativeRuntimeResources.h"

int main()
{
    loader::native::RuntimeResourceRegistry resources;
    loader::native::RuntimeResourceRegistry otherResources;
    bool                                    firstReleased    = false;
    bool                                    secondReleased   = false;
    bool                                    deferredReleased = false;
    assert(resources.identity() != otherResources.identity());
    assert(resources.active());
    auto operationResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> operationReference = operationResources;
    auto operation = loader::native::beginRuntimeResourceOperation(operationReference,
                                                                   operationResources->identity());
    bool operationCalled = false;
    assert(operation);
    assert(operationResources->pendingOperationCount() == 1);
    assert(loader::native::withRuntimeResource(operationReference, operationResources->identity(),
                                               operation,
                                               [&](loader::native::RuntimeResourceRegistry &) {
                                                   operationCalled = true;
                                               }));
    assert(operationCalled);
    assert(!operation->active());
    assert(operationResources->pendingOperationCount() == 0);
    auto cancelledOperation = operationResources->beginOperation(operationResources->identity());
    assert(cancelledOperation);
    assert(cancelledOperation->cancel());
    assert(!cancelledOperation->active());
    assert(operationResources->pendingOperationCount() == 0);
    bool cancelledOperationCalled = false;
    assert(!loader::native::withRuntimeResource(operationReference, operationResources->identity(),
                                                cancelledOperation,
                                                [&](loader::native::RuntimeResourceRegistry &) {
                                                    cancelledOperationCalled = true;
                                                }));
    assert(!cancelledOperationCalled);
    auto operationScope  = std::make_shared<loader::native::RuntimeResourceOperationScope>();
    auto scopedOperation = operationResources->beginOperation(operationResources->identity());
    assert(operationScope->track(scopedOperation));
    assert(operationScope->active());
    assert(operationScope->pendingOperationCount() == 1);
    assert(loader::native::withRuntimeResource(operationReference, operationResources->identity(),
                                               scopedOperation,
                                               [](loader::native::RuntimeResourceRegistry &) {}));
    assert(operationScope->pendingOperationCount() == 0);
    auto cancellableScopedOperation =
        operationResources->beginOperation(operationResources->identity());
    assert(operationScope->track(cancellableScopedOperation));
    assert(operationScope->pendingOperationCount() == 1);
    operationScope->cancelPending();
    assert(!operationScope->active());
    assert(!scopedOperation->active());
    assert(operationScope->pendingOperationCount() == 0);
    assert(!cancellableScopedOperation->active());
    assert(operationResources->pendingOperationCount() == 0);
    auto rejectedOperation = operationResources->beginOperation(operationResources->identity());
    assert(!operationScope->track(rejectedOperation));
    assert(rejectedOperation->cancel());
    auto abandonedOperation = operationResources->beginOperation(operationResources->identity());
    assert(operationResources->pendingOperationCount() == 1);
    abandonedOperation.reset();
    assert(operationResources->pendingOperationCount() == 0);
    auto invalidatedOperation = operationResources->beginOperation(operationResources->identity());
    operationResources->invalidate();
    assert(invalidatedOperation);
    assert(!invalidatedOperation->active());
    assert(operationResources->pendingOperationCount() == 0);
    operationResources.reset();
    auto invalidatedResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> invalidatedReference =
        invalidatedResources;
    assert(loader::native::invalidateRuntimeResources(invalidatedReference));
    assert(!invalidatedResources->active());
    assert(!invalidatedResources->retain("stale", std::make_shared<int>(4)));
    invalidatedResources.reset();
    assert(invalidatedReference.expired());
    auto runtimeLifetimeResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> runtimeLifetimeReference =
        runtimeLifetimeResources;
    bool runtimeLifetimeReleased = false;
    auto runtimeLifetimeResource = std::shared_ptr<void>(new int(5), [&](void *value) {
        delete static_cast<int *>(value);
        runtimeLifetimeReleased = true;
    });
    assert(runtimeLifetimeResources->retain("runtime-lifetime", runtimeLifetimeResource));
    runtimeLifetimeResource.reset();
    runtimeLifetimeResources->invalidate();
    runtimeLifetimeResources->clear();
    assert(runtimeLifetimeReleased);
    assert(!runtimeLifetimeResources->active());
    assert(!runtimeLifetimeResources->retain("after-invalidation", std::make_shared<int>(6)));
    runtimeLifetimeResources.reset();
    assert(runtimeLifetimeReference.expired());
    auto first  = std::shared_ptr<void>(new int(1), [&](void *value) {
        delete static_cast<int *>(value);
        firstReleased = true;
    });
    auto second = std::shared_ptr<void>(new int(2), [&](void *value) {
        delete static_cast<int *>(value);
        secondReleased = true;
    });

    assert(resources.retain("hook-1", first));
    first.reset();
    assert(!firstReleased);
    assert(!resources.retain("hook-1", std::make_shared<int>(3)));
    assert(resources.size() == 1);
    assert(resources.release("hook-1"));
    assert(firstReleased);
    assert(!resources.release("hook-1"));

    auto ownerThreadResources = std::make_shared<loader::native::RuntimeResourceRegistry>();
    std::weak_ptr<loader::native::RuntimeResourceRegistry> ownerThreadReference =
        ownerThreadResources;
    bool ownerThreadReleased = false;
    auto ownerThreadResource = std::shared_ptr<void>(new int(7), [&](void *value) {
        delete static_cast<int *>(value);
        ownerThreadReleased = true;
    });
    assert(ownerThreadResources->retain("owner-thread", ownerThreadResource));
    ownerThreadResource.reset();
    bool        releasedFromOtherThread = true;
    std::thread otherThread([&] {
        releasedFromOtherThread = loader::native::releaseRuntimeResourceOnOwnerThread(
            ownerThreadReference, "owner-thread");
    });
    otherThread.join();
    assert(!releasedFromOtherThread);
    assert(!ownerThreadReleased);
    assert(ownerThreadResources->deferRelease("owner-thread"));
    assert(loader::native::drainRuntimeResourceReleases(ownerThreadReference) == 1);
    assert(ownerThreadReleased);
    auto wrongThreadResources        = std::make_shared<loader::native::RuntimeResourceRegistry>();
    bool wrongThreadResourceReleased = false;
    auto wrongThreadResource         = std::shared_ptr<void>(new int(8), [&](void *value) {
        delete static_cast<int *>(value);
        wrongThreadResourceReleased = true;
    });
    assert(wrongThreadResources->retain("wrong-thread-destruction", wrongThreadResource));
    wrongThreadResource.reset();
    std::thread wrongThread([resources = std::move(wrongThreadResources)]() mutable {
        resources.reset();
    });
    wrongThread.join();
    assert(!wrongThreadResourceReleased);

    std::mutex                                                             leaseMutex;
    std::condition_variable                                                leaseCondition;
    bool                                                                   leaseEntered = false;
    bool                                                                   releaseLease = false;
    std::promise<std::shared_ptr<loader::native::RuntimeResourceRegistry>> leasePromise;
    auto        leaseFuture = leasePromise.get_future();
    std::thread leaseOwner([&] {
        auto     registry = std::make_shared<loader::native::RuntimeResourceRegistry>();
        uint64_t identity = registry->identity();
        leasePromise.set_value(registry);
        loader::native::withRuntimeResource(registry, identity,
                                            [&](loader::native::RuntimeResourceRegistry &) {
                                                std::unique_lock<std::mutex> lock(leaseMutex);
                                                leaseEntered = true;
                                                leaseCondition.notify_all();
                                                leaseCondition.wait(lock, [&] {
                                                    return releaseLease;
                                                });
                                            });
    });
    auto        leaseResources = leaseFuture.get();
    {
        std::unique_lock<std::mutex> lock(leaseMutex);
        leaseCondition.wait(lock, [&] {
            return leaseEntered;
        });
    }
    std::atomic_bool invalidationStarted{false};
    std::atomic_bool invalidationFinished{false};
    std::thread      invalidator([&] {
        invalidationStarted.store(true, std::memory_order_release);
        leaseResources->invalidate();
        invalidationFinished.store(true, std::memory_order_release);
    });
    while (!invalidationStarted.load(std::memory_order_acquire))
    {
        std::this_thread::yield();
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    assert(!invalidationFinished.load(std::memory_order_acquire));
    {
        std::lock_guard<std::mutex> lock(leaseMutex);
        releaseLease = true;
    }
    leaseCondition.notify_all();
    leaseOwner.join();
    invalidator.join();
    assert(invalidationFinished.load(std::memory_order_acquire));
    assert(!leaseResources->active());

    assert(resources.retain("hook-2", second));
    second.reset();
    assert(!secondReleased);
    auto deferred = std::shared_ptr<void>(new int(3), [&](void *value) {
        delete static_cast<int *>(value);
        deferredReleased = true;
    });
    assert(resources.retain("hook-3", deferred));
    deferred.reset();
    assert(resources.deferRelease("hook-3"));
    assert(!deferredReleased);
    assert(resources.size() == 1);
    assert(resources.drainDeferredReleases() == 1);
    assert(deferredReleased);
    resources.clear();
    assert(secondReleased);
    assert(resources.size() == 0);
}
