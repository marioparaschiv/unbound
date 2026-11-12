#import "NativePluginUITraversal.h"

#import <UIKit/UIKit.h>
#import <objc/message.h>

#import "NativePluginObjCValues.h"
#import "NativePluginThreading.h"
#import "NativeTraversalOptions.h"
#import "NativeTypeEncoding.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
Value snapshotUI(Runtime &runtime, const Value *args, size_t count)
{
    id root = count ? objcValue(runtime, args[0]) : nil;
    if (![root isKindOfClass:[UIView class]])
    {
        throw JSError(runtime, "objc.snapshot expects a UIView handle");
    }

    Value                            noOptions = Value::undefined();
    loader::native::TraversalOptions options   = loader::native::parseTraversalOptions(
        runtime, count > 1 ? args[1] : noOptions, loader::native::TraversalProfile::Snapshot);
    NSUInteger maxDepth = options.maxDepth;
    NSUInteger maxNodes = options.maxNodes;

    NSMutableArray<NSDictionary *> *captured = [NSMutableArray arrayWithCapacity:maxNodes];
    return executeMainAsynchronously(
        runtime,
        [root, captured, maxDepth, maxNodes]() {
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxNodes];
            [queue addObject:@{@"view" : root, @"parent" : @(-1), @"depth" : @(0)}];
            for (NSUInteger index = 0; index < queue.count && captured.count < maxNodes; index++)
            {
                NSDictionary *queued       = queue[index];
                UIView       *view         = queued[@"view"];
                NSUInteger    depth        = [queued[@"depth"] unsignedIntegerValue];
                NSString     *text         = nil;
                SEL           textSelector = @selector(text);
                if ([view respondsToSelector:textSelector])
                {
                    NSMethodSignature *signature = [view methodSignatureForSelector:textSelector];
                    if (signature && normalizedType(signature.methodReturnType) == '@')
                    {
                        id value = ((id (*)(id, SEL)) objc_msgSend)(view, textSelector);
                        if ([value isKindOfClass:[NSString class]])
                            text = value;
                    }
                }
                [captured addObject:@{
                    @"view" : view,
                    @"parent" : queued[@"parent"],
                    @"depth" : queued[@"depth"],
                    @"className" : NSStringFromClass([view class]),
                    @"frame" : [NSValue valueWithCGRect:view.frame],
                    @"text" : text ?: [NSNull null],
                    @"visible" : @(!view.hidden && view.alpha > 0 && view.window != nil),
                }];
                if (depth >= maxDepth)
                    continue;
                NSNumber *parent = @(captured.count - 1);
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxNodes)
                        break;
                    [queue addObject:@{
                        @"view" : child,
                        @"parent" : parent,
                        @"depth" : @(depth + 1)
                    }];
                }
            }
        },
        [captured](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, captured.count);
            for (NSUInteger index = 0; index < captured.count; index++)
            {
                NSDictionary *node  = captured[index];
                CGRect        frame = [node[@"frame"] CGRectValue];
                Object        item(completionRuntime);
                Object        bounds(completionRuntime);
                bounds.setProperty(completionRuntime, "x", Value((double) frame.origin.x));
                bounds.setProperty(completionRuntime, "y", Value((double) frame.origin.y));
                bounds.setProperty(completionRuntime, "width", Value((double) frame.size.width));
                bounds.setProperty(completionRuntime, "height", Value((double) frame.size.height));
                item.setProperty(completionRuntime, "view",
                                 objcHandleResult(completionRuntime, node[@"view"]));
                item.setProperty(completionRuntime, "parent", Value([node[@"parent"] doubleValue]));
                item.setProperty(completionRuntime, "depth", Value([node[@"depth"] doubleValue]));
                item.setProperty(completionRuntime, "className",
                                 objcJSIValue(completionRuntime, node[@"className"]));
                item.setProperty(completionRuntime, "frame", std::move(bounds));
                item.setProperty(completionRuntime, "text",
                                 node[@"text"] == [NSNull null]
                                     ? Value::null()
                                     : objcJSIValue(completionRuntime, node[@"text"]));
                item.setProperty(completionRuntime, "visible", Value([node[@"visible"] boolValue]));
                result.setValueAtIndex(completionRuntime, index, std::move(item));
            }
            return result;
        });
}

Value findUIViews(Runtime &runtime, const Value *args, size_t count)
{
    id root = count ? objcValue(runtime, args[0]) : nil;
    if (![root isKindOfClass:[UIView class]] || count < 2 || !args[1].isString())
    {
        throw JSError(runtime, "objc.findViews expects a UIView handle and class name");
    }
    NSString *className = jsiString(runtime, args[1]);
    if (className.length == 0 || className.length > 128)
    {
        throw JSError(runtime, "Native view class name must contain 1 to 128 characters");
    }

    Value                            noOptions = Value::undefined();
    loader::native::TraversalOptions options   = loader::native::parseTraversalOptions(
        runtime, count > 2 ? args[2] : noOptions, loader::native::TraversalProfile::Search);
    NSUInteger maxDepth        = options.maxDepth;
    NSUInteger maxVisited      = options.maxNodes;
    NSUInteger maxResults      = options.maxResults;
    bool       attachedOnly    = options.attachedOnly;
    bool       stopAtMatch     = options.stopAtMatch;
    bool       searchAncestors = options.direction == loader::native::TraversalDirection::Ancestors;

    NSMutableArray<UIView *> *found = [NSMutableArray arrayWithCapacity:maxResults];
    return executeMainAsynchronously(
        runtime,
        [root, className, found, maxDepth, maxVisited, maxResults, attachedOnly, stopAtMatch,
         searchAncestors]() {
            Class expectedClass = NSClassFromString(className);
            if (searchAncestors)
            {
                UIView *view = root;
                for (NSUInteger depth = 0; view && depth <= maxDepth && depth < maxVisited;
                     view             = view.superview, depth++)
                {
                    bool matches = expectedClass
                                       ? [view isKindOfClass:expectedClass]
                                       : [NSStringFromClass([view class]) containsString:className];
                    if (matches && (!attachedOnly || view.window != nil))
                    {
                        [found addObject:view];
                        if (found.count >= maxResults || stopAtMatch)
                            break;
                    }
                }
                return;
            }
            NSMutableArray<NSDictionary *> *queue = [NSMutableArray arrayWithCapacity:maxVisited];
            [queue addObject:@{@"view" : root, @"depth" : @(0)}];
            for (NSUInteger index = 0; index < queue.count && index < maxVisited; index++)
            {
                NSDictionary *queued = queue[index];
                UIView       *view   = queued[@"view"];
                NSUInteger    depth  = [queued[@"depth"] unsignedIntegerValue];
                bool matches = expectedClass
                                   ? [view isKindOfClass:expectedClass]
                                   : [NSStringFromClass([view class]) containsString:className];
                if (matches && (!attachedOnly || view.window != nil))
                {
                    [found addObject:view];
                    if (found.count >= maxResults)
                        break;
                }
                if (depth >= maxDepth || (matches && stopAtMatch))
                    continue;
                for (UIView *child in view.subviews)
                {
                    if (queue.count >= maxVisited)
                        break;
                    [queue addObject:@{@"view" : child, @"depth" : @(depth + 1)}];
                }
            }
        },
        [found](Runtime &completionRuntime) -> Value {
            Array result(completionRuntime, found.count);
            for (NSUInteger index = 0; index < found.count; index++)
            {
                result.setValueAtIndex(completionRuntime, index,
                                       objcHandleResult(completionRuntime, found[index]));
            }
            return result;
        });
}
}
