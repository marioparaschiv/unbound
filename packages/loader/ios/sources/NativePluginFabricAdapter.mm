#import "NativePluginFabricAdapter.h"

#import <UIKit/UIKit.h>
#include <mutex>
#import <objc/message.h>
#include <stdexcept>
#include <string>
#include <unordered_map>

#import "CoreConversions.h"
#import "NativePluginRuntime.h"

@interface NSObject (FabricHost)
- (id)createSurfaceWithModuleName:(NSString *)moduleName
                             mode:(NSInteger)mode
                initialProperties:(NSDictionary *)properties;
@end

@interface                          FabricContainer : UIView
@property (nonatomic, weak) UIView *surfaceView;
- (void)setFabricFrame:(CGRect)frame;
@end

@implementation FabricContainer

{
    BOOL _fabricFrameProtected;
    BOOL _fabricSettingFrame;
}

- (void)setFrame:(CGRect)frame
{
    if (_fabricFrameProtected && !_fabricSettingFrame)
    {
        return;
    }
    [super setFrame:frame];
}

- (void)setFabricFrame:(CGRect)frame
{
    _fabricFrameProtected = YES;
    _fabricSettingFrame   = YES;
    [super setFrame:frame];
    _fabricSettingFrame = NO;
}

- (void)layoutSubviews
{
    [super layoutSubviews];
    UIView *surfaceView = self.surfaceView;
    if (surfaceView)
    {
        surfaceView.frame = self.bounds;
        surfaceView.autoresizingMask =
            UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
}

@end

static __weak id gNativePluginFabricHost = nil;

static void fabricStart(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function) objc_msgSend)(surface, @selector(start));
}

static void fabricStop(id surface)
{
    using Function = void (*)(id, SEL);
    ((Function) objc_msgSend)(surface, @selector(stop));
}

static UIView *fabricView(id surface)
{
    using Function = UIView *(*)(id, SEL);
    return ((Function) objc_msgSend)(surface, @selector(view));
}

static void fabricSetProperties(id surface, NSDictionary *properties)
{
    using Function = void (*)(id, SEL, NSDictionary *);
    ((Function) objc_msgSend)(surface, @selector(setProperties:), properties);
}

static void fabricSetMinimumSize(id surface, CGSize minimumSize, CGSize maximumSize)
{
    using Function = void (*)(id, SEL, CGSize, CGSize);
    ((Function) objc_msgSend)(surface, @selector(setMinimumSize:maximumSize:), minimumSize,
                              maximumSize);
}

static void fabricRequire(bool condition, const char *message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

static constexpr NSTimeInterval kFabricFirstRenderWait = 0.1;

static void fabricWaitForFirstRender(id surface)
{
    if (![surface respondsToSelector:@selector(synchronouslyWaitFor:)])
    {
        return;
    }
    using Function = BOOL (*)(id, SEL, NSTimeInterval);
    ((Function) objc_msgSend)(surface, @selector(synchronouslyWaitFor:), kFabricFirstRenderWait);
}

struct IOSFabricSurface {
    __strong id      surface     = nil;
    __strong UIView *view        = nil;
    __strong UIView *surfaceView = nil;
};

static IOSFabricSurface fabricMountNative(id host, UIView *containerView, NSString *moduleName,
                                          NSDictionary *properties)
{
    fabricRequire(host != nil, "Fabric host is unavailable");
    fabricRequire(
        [host respondsToSelector:@selector(createSurfaceWithModuleName:mode:initialProperties:)],
        "Fabric host does not expose surface creation");
    id surface = [host createSurfaceWithModuleName:moduleName mode:0 initialProperties:properties];
    fabricRequire(surface != nil, "Fabric host could not create the requested surface");
    fabricRequire([surface respondsToSelector:@selector(start)] &&
                      [surface respondsToSelector:@selector(view)],
                  "Fabric surface does not expose start and view");

    fabricStart(surface);
    UIView *view = fabricView(surface);
    if (!view)
    {
        fabricStop(surface);
        throw std::runtime_error("Fabric surface did not create a view");
    }

    FabricContainer *surfaceContainer =
        [[FabricContainer alloc] initWithFrame:containerView.bounds];
    surfaceContainer.clipsToBounds = NO;
    surfaceContainer.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    surfaceContainer.surfaceView = view;
    view.frame                   = surfaceContainer.bounds;
    view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [surfaceContainer addSubview:view];
    [containerView addSubview:surfaceContainer];
    [surfaceContainer setNeedsLayout];
    [surfaceContainer layoutIfNeeded];
    if (loader::native::runningAsynchronousMainOperation() &&
        [surface respondsToSelector:@selector(synchronouslyWaitFor:)])
    {
        fabricWaitForFirstRender(surface);
    }
    return {surface, surfaceContainer, view};
}

static bool fabricUpdateNative(id surface, NSDictionary *properties)
{
    if (![surface respondsToSelector:@selector(setProperties:)])
    {
        return false;
    }
    fabricSetProperties(surface, properties);
    return true;
}

static void fabricSetSizeNative(id surface, CGSize minimumSize, CGSize maximumSize)
{
    if ([surface respondsToSelector:@selector(setMinimumSize:maximumSize:)])
    {
        fabricSetMinimumSize(surface, minimumSize, maximumSize);
    }
}

static void fabricSetFrameNative(UIView *view, UIView *surfaceView, CGRect frame)
{
    view.autoresizingMask = UIViewAutoresizingNone;
    if ([view respondsToSelector:@selector(setFabricFrame:)])
    {
        [(FabricContainer *) view setFabricFrame:frame];
    }
    else
    {
        view.frame = frame;
    }
    [view setNeedsLayout];
    [view layoutIfNeeded];
    if (surfaceView)
    {
        surfaceView.frame = view.bounds;
        surfaceView.autoresizingMask =
            UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
}

static void fabricUnmountNative(id surface, UIView *view)
{
    [view removeFromSuperview];
    if ([surface respondsToSelector:@selector(stop)])
    {
        fabricStop(surface);
    }
}

class IOSFabricView final : public loader::native::FabricView
{
public:
    explicit IOSFabricView(UIView *view) : view_(view) {}

    UIView *view() const
    {
        return view_;
    }

private:
    __strong UIView *view_;
};

static NSDictionary *fabricDictionary(const nlohmann::json &properties)
{
    id object = unbound::ios::objectFromJSON(properties);
    return [object isKindOfClass:[NSDictionary class]] ? object : @{};
}

static loader::native::NativeFrame nativeFrame(CGRect frame)
{
    return {frame.origin.x, frame.origin.y, frame.size.width, frame.size.height};
}

static CGSize cgSize(const loader::native::NativeSize &size)
{
    return CGSizeMake(size.width, size.height);
}

class IOSFabricAdapter final : public loader::native::FabricAdapter
{
public:
    IOSFabricAdapter(loader::ios::NativeObjCResolver resolver, loader::ios::NativeObjCGuard guard,
                     loader::ios::NativeOperationSignposter signposter)
        : resolver_(std::move(resolver)), guard_(std::move(guard)),
          signposter_(std::move(signposter))
    {
    }

    std::shared_ptr<loader::native::FabricView> view(facebook::jsi::Runtime     &runtime,
                                                     const facebook::jsi::Value &handle) override
    {
        id object = resolver_(runtime, handle);
        if (![object isKindOfClass:[UIView class]])
        {
            throw facebook::jsi::JSError(runtime, "Fabric expects a UIView");
        }
        return std::make_shared<IOSFabricView>((UIView *) object);
    }

    std::string mount(const loader::native::FabricView &container, const std::string &moduleName,
                      const nlohmann::json &properties) override
    {
        IOSFabricSurface mounted;
        guard_([&]() {
            NSString *name = [NSString stringWithUTF8String:moduleName.c_str()] ?: @"";
            signposter_("fabric mount", [&]() {
                mounted = fabricMountNative(gNativePluginFabricHost,
                                            static_cast<const IOSFabricView &>(container).view(),
                                            name, fabricDictionary(properties));
            });
        });
        std::lock_guard<std::mutex> lock(mutex_);
        std::string                 id = "surface-" + std::to_string(next_++);
        surfaces_[id]                  = mounted;
        return id;
    }

    bool update(const std::string &surface, const nlohmann::json &properties) override
    {
        IOSFabricSurface mounted = find(surface);
        bool             updated = false;
        guard_([&]() {
            updated = fabricUpdateNative(mounted.surface, fabricDictionary(properties));
        });
        return updated;
    }

    void setSize(const std::string &surface, const loader::native::NativeSize &minimum,
                 const loader::native::NativeSize &maximum) override
    {
        IOSFabricSurface mounted = find(surface);
        guard_([&]() {
            fabricSetSizeNative(mounted.surface, cgSize(minimum), cgSize(maximum));
        });
    }

    void setFrame(const std::string &surface, const loader::native::NativeFrame &frame) override
    {
        IOSFabricSurface mounted = find(surface);
        guard_([&]() {
            fabricSetFrameNative(mounted.view, mounted.surfaceView,
                                 CGRectMake(frame.x, frame.y, frame.width, frame.height));
        });
    }

    loader::native::NativeFrame measure(const loader::native::FabricView &view) override
    {
        return nativeFrame(static_cast<const IOSFabricView &>(view).view().frame);
    }

    loader::native::NativeFrame measureSurface(const std::string &surface) override
    {
        return nativeFrame(find(surface).view.frame);
    }

    bool postsVoidCalls() const override
    {
        return true;
    }

    bool measuresLastSetFrame() const override
    {
        return true;
    }

    bool detachesEverySurface() const override
    {
        return true;
    }

    bool detach(const std::string &surface) override
    {
        IOSFabricSurface mounted = find(surface);
        guard_([&]() {
            [mounted.view removeFromSuperview];
        });
        return true;
    }

    bool attach(const std::string &surface, const loader::native::FabricView &container) override
    {
        IOSFabricSurface mounted       = find(surface);
        UIView          *containerView = static_cast<const IOSFabricView &>(container).view();
        guard_([&]() {
            mounted.view.frame = containerView.bounds;
            [containerView addSubview:mounted.view];
            [mounted.view setNeedsLayout];
        });
        return true;
    }

    void unmount(const std::string &surface) override
    {
        IOSFabricSurface mounted;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto                        found = surfaces_.find(surface);
            if (found == surfaces_.end())
            {
                return;
            }
            mounted = found->second;
            surfaces_.erase(found);
        }
        guard_([&]() {
            fabricUnmountNative(mounted.surface, mounted.view);
        });
    }

private:
    IOSFabricSurface find(const std::string &surface)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        found = surfaces_.find(surface);
        if (found == surfaces_.end())
        {
            throw std::runtime_error("The Fabric surface is no longer mounted");
        }
        return found->second;
    }

    loader::ios::NativeObjCResolver                   resolver_;
    loader::ios::NativeObjCGuard                      guard_;
    loader::ios::NativeOperationSignposter            signposter_;
    std::mutex                                        mutex_;
    std::unordered_map<std::string, IOSFabricSurface> surfaces_;
    uint64_t                                          next_ = 1;
};

std::shared_ptr<loader::native::FabricAdapter>
loader::ios::makeNativePluginFabricAdapter(NativeObjCResolver resolver, NativeObjCGuard guard,
                                           NativeOperationSignposter signposter)
{
    return std::make_shared<IOSFabricAdapter>(std::move(resolver), std::move(guard),
                                              std::move(signposter));
}

void loader::ios::setNativePluginFabricHost(id instance)
{
    gNativePluginFabricHost = instance;
}

void loader::ios::observeNativePluginFabricMemoryWarnings()
{
    static dispatch_once_t observing;
    dispatch_once(&observing, ^{
        [[NSNotificationCenter defaultCenter]
            addObserverForName:UIApplicationDidReceiveMemoryWarningNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *) { loader::native::evictIdleFabricSurfaces(); }];
    });
}
