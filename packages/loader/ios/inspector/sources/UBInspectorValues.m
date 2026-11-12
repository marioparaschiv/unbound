#import "FLEXObjcInternal.h"
#import "FLEXPropertyAttributes.h"
#import "FLEXRuntimeSafety.h"
#import "FLEXTypeEncodingParser.h"
#import "UBInspectorInternal.h"

// Values are read from memory first: an ivar, or the ivar behind a property, is copied out without
// sending a message, and object pointers are validated before ARC retains them. Getters run only on
// request.

static NSDictionary *UBValue(NSString *name, NSString *kind, NSString *text)
{
    return @{@"name" : name, @"kind" : kind, @"text" : UBTruncate(text)};
}

static BOOL UBIsKindOf(Class cls, const char *name)
{
    Class target = objc_getClass(name);
    for (Class current = cls; target && current; current = class_getSuperclass(current))
    {
        if (current == target)
            return YES;
    }
    return NO;
}

/** Skips type qualifiers and a quoted field name, such as `r` or `"origin"`. */
static const char *UBSkipPrefix(const char *encoding)
{
    while (*encoding && strchr("rnNoORV", *encoding))
        encoding++;
    if (*encoding == '"')
    {
        const char *end = strchr(encoding + 1, '"');
        return end ? end + 1 : encoding + strlen(encoding);
    }
    return encoding;
}

/** The end of the single type at `encoding`, nested brackets and `@"Class"` included. */
static const char *UBSkipType(const char *encoding)
{
    encoding  = UBSkipPrefix(encoding);
    char open = *encoding;
    if (!open)
        return encoding;
    if (open == '^')
        return UBSkipType(encoding + 1);
    if (open == '@')
    {
        encoding++;
        if (*encoding == '?')
            encoding++;
        if (*encoding == '"')
        {
            const char *end = strchr(encoding + 1, '"');
            return end ? end + 1 : encoding + strlen(encoding);
        }
        return encoding;
    }
    if (open == 'b')
    {
        encoding++;
        while (*encoding >= '0' && *encoding <= '9')
            encoding++;
        return encoding;
    }

    char close = open == '{' ? '}' : open == '(' ? ')' : open == '[' ? ']' : 0;
    if (!close)
        return encoding + 1;

    int depth = 0;
    for (; *encoding; encoding++)
    {
        if (*encoding == '"')
        {
            const char *end = strchr(encoding + 1, '"');
            if (!end)
                break;
            encoding = end;
        }
        else if (*encoding == '{' || *encoding == '(' || *encoding == '[')
        {
            depth++;
        }
        else if ((*encoding == '}' || *encoding == ')' || *encoding == ']') && --depth == 0)
        {
            return encoding + 1;
        }
    }
    return encoding;
}

/** A number or BOOL at `pointer`, or nil when `type` is not a scalar. */
static NSString *UBScalarText(const void *pointer, char type)
{
    switch (type)
    {
        case 'B':
            return *(const bool *) pointer ? @"YES" : @"NO";
        case 'c':
            return [@(*(const char *) pointer) stringValue];
        case 'C':
            return [@(*(const unsigned char *) pointer) stringValue];
        case 's':
            return [@(*(const short *) pointer) stringValue];
        case 'S':
            return [@(*(const unsigned short *) pointer) stringValue];
        case 'i':
            return [@(*(const int *) pointer) stringValue];
        case 'I':
            return [@(*(const unsigned int *) pointer) stringValue];
        case 'l':
            return [@(*(const long *) pointer) stringValue];
        case 'L':
            return [@(*(const unsigned long *) pointer) stringValue];
        case 'q':
            return [@(*(const long long *) pointer) stringValue];
        case 'Q':
            return [@(*(const unsigned long long *) pointer) stringValue];
        case 'f':
            return [@(*(const float *) pointer) stringValue];
        case 'd':
        case 'D':
            return [@(*(const double *) pointer) stringValue];
        default:
            return nil;
    }
}

/** `{x=0, y=0}` for a struct at `pointer`, fields named when the encoding names them; nil when
 * unsupported. */
static NSString *UBStructText(const uint8_t *pointer, const char *encoding, int depth)
{
    const char *fields = strchr(encoding, '=');
    const char *end    = UBSkipType(encoding);
    if (!fields || fields > end || depth > 4)
        return nil;

    NSMutableArray<NSString *> *parts  = [NSMutableArray new];
    NSUInteger                  offset = 0;
    for (const char *field = fields + 1; field < end - 1 && *field != '}' && parts.count < 32;)
    {
        NSString *label = nil;
        if (*field == '"')
        {
            const char *close = strchr(field + 1, '"');
            if (!close)
                return nil;
            label = [[NSString alloc] initWithBytes:field + 1
                                             length:close - field - 1
                                           encoding:NSUTF8StringEncoding];
            field = close + 1;
        }

        const char *next      = UBSkipType(field);
        NSString   *type      = [[NSString alloc] initWithBytes:field
                                                         length:next - field
                                                       encoding:NSUTF8StringEncoding];
        ssize_t     alignment = 0;
        ssize_t     size = [FLEXTypeEncodingParser sizeForTypeEncoding:type alignment:&alignment];
        if (size < 0 || *field == 'b')
            return nil;
        if (alignment > 1)
            offset = (offset + alignment - 1) / alignment * alignment;

        const uint8_t *address = pointer + offset;
        const char    *bare    = UBSkipPrefix(field);
        NSString      *text    = UBScalarText(address, *bare);
        if (!text && *bare == '{')
            text = UBStructText(address, bare, depth + 1);
        if (!text && strchr("@#^*:", *bare))
            text = [NSString stringWithFormat:@"%p", *(void *const *) address];
        [parts addObject:label.length ? [NSString stringWithFormat:@"%@=%@", label, text ?: @"?"] : text ?: @"?"];

        offset += size;
        field = next;
    }
    return [NSString stringWithFormat:@"{%@}", [parts componentsJoinedByString:@", "]];
}

static NSDictionary *UBObjectValue(NSString *name, const void *raw)
{
    if (!raw)
        return UBValue(name, @"nil", @"nil");
    if (!UBPointerIsObject(raw))
        return UBValue(name, @"pointer", [NSString stringWithFormat:@"%p (not an object)", raw]);

    __unsafe_unretained id unretained = (__bridge id) raw;
    Class                  cls        = object_getClass(unretained);
    NSString              *className  = @(class_getName(cls));
    if (object_isClass(unretained))
    {
        return @{
            @"name" : name,
            @"kind" : @"class",
            @"text" : @(class_getName((Class) unretained)),
            @"className" : className
        };
    }
    if (!UBClassIsSafe(cls))
    {
        return UBValue(name, @"skipped",
                       [NSString stringWithFormat:@"<%@: %p> (unsafe class)", className, raw]);
    }

    id value = unretained;
    if (UBIsKindOf(cls, "NSString"))
    {
        return @{
            @"name" : name,
            @"kind" : @"string",
            @"text" : UBTruncate(value),
            @"className" : className
        };
    }
    if (UBIsKindOf(cls, "NSNumber"))
    {
        BOOL      boolean = CFGetTypeID((__bridge CFTypeRef) value) == CFBooleanGetTypeID();
        NSString *text    = boolean ? ([value boolValue] ? @"YES" : @"NO") : [value stringValue];
        return @{
            @"name" : name,
            @"kind" : boolean ? @"bool" : @"number",
            @"text" : text,
            @"className" : className
        };
    }

    return @{
        @"name" : name,
        @"kind" : @"object",
        @"text" : [NSString stringWithFormat:@"<%@: %p>", className, raw],
        @"object" : value,
        @"className" : className,
    };
}

/** The value of `encoding` stored at `pointer`; `weak` reads an object through `objc_loadWeak`. */
static NSDictionary *UBValueAt(NSString *name, const void *pointer, const char *encoding, BOOL weak)
{
    const char *bare   = UBSkipPrefix(encoding ?: "");
    NSString   *scalar = UBScalarText(pointer, *bare);
    if (scalar)
        return UBValue(name, *bare == 'B' ? @"bool" : @"number", scalar);

    switch (*bare)
    {
        case '@': {
            if (!weak)
                return UBObjectValue(name, *(const void *const *) pointer);
            id loaded = objc_loadWeak((__autoreleasing id *) (void *) pointer);
            return UBObjectValue(name, (__bridge const void *) loaded);
        }
        case '#':
            return UBObjectValue(name, *(const void *const *) pointer);
        case ':': {
            const void *selector = *(const void *const *) pointer;
            if (!selector)
                return UBValue(name, @"nil", @"nil");
            if (!FLEXPointerIsReadable(selector))
                return UBValue(name, @"pointer", [NSString stringWithFormat:@"%p", selector]);
            return UBValue(name, @"selector", @(sel_getName((SEL) selector)));
        }
        case '^':
        case '*': {
            const void *target = *(const void *const *) pointer;
            return target ? UBValue(name, @"pointer", [NSString stringWithFormat:@"%p", target])
                          : UBValue(name, @"nil", @"NULL");
        }
        case '{': {
            NSString *text = UBStructText(pointer, bare, 0);
            if (text)
                return UBValue(name, @"struct", text);
            break;
        }
        default:
            break;
    }
    return UBValue(name, @"other", [NSString stringWithFormat:@"(%s)", encoding ?: "?"]);
}

static NSDictionary *UBIvarValue(NSString *name, id object, Ivar ivar, BOOL weak)
{
    if (FLEXPointerIsTaggedPointer(object))
        return UBValue(name, @"skipped", @"Tagged pointers have no ivars");
    const uint8_t *base = (__bridge const void *) object;
    return UBValueAt(name, base + ivar_getOffset(ivar), ivar_getTypeEncoding(ivar), weak);
}

/** Runs a no-argument getter through NSInvocation and reads its return value like memory. */
static NSDictionary *UBGetterValue(NSString *name, id target, Method method)
{
    if (method_getNumberOfArguments(method) != 2)
        return UBValue(name, @"error", @"Getter takes arguments");

    NSString *cleaned  = nil;
    NSString *encoding = @(method_getTypeEncoding(method) ?: "");
    if (![FLEXTypeEncodingParser methodTypeEncodingSupported:encoding cleaned:&cleaned])
    {
        return UBValue(name, @"other",
                       [@"Unsupported return type " stringByAppendingString:encoding]);
    }

    NSMethodSignature *signature = [NSMethodSignature signatureWithObjCTypes:cleaned.UTF8String];
    if (signature.methodReturnLength == 0)
        return UBValue(name, @"other", @"(void)");

    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
    invocation.target        = target;
    invocation.selector      = method_getName(method);
    [invocation invoke];

    NSMutableData *buffer = [NSMutableData dataWithLength:signature.methodReturnLength];
    [invocation getReturnValue:buffer.mutableBytes];
    char         *returnType = method_copyReturnType(method);
    NSDictionary *value      = UBValueAt(name, buffer.bytes, returnType, NO);
    free(returnType);
    return value;
}

/** The instance property `name` of `cls`, else its class property, which sets `classProperty`. */
static objc_property_t UBFindProperty(Class cls, NSString *name, BOOL *classProperty)
{
    objc_property_t property = class_getProperty(cls, name.UTF8String);
    *classProperty           = NO;
    if (property)
        return property;

    property       = class_getProperty(object_getClass(cls), name.UTF8String);
    *classProperty = property != NULL;
    return property;
}

static NSDictionary *UBPropertyValue(NSString *name, id object, Class cls, BOOL invokeGetters)
{
    BOOL            classProperty = NO;
    objc_property_t property      = UBFindProperty(cls, name, &classProperty);
    if (!property)
        return UBValue(
            name, @"error",
            [NSString stringWithFormat:@"No property %@ on %s", name, class_getName(cls)]);

    NSString *read = UBPropertyRead(cls, property, classProperty);
    if (read == UBReadNever)
    {
        BOOL denied = UBMemberDenied(cls, @"properties", name);
        return UBValue(name, @"skipped",
                       denied ? @"Crashed Discord before; not read again" : @"Unsafe to read");
    }

    FLEXPropertyAttributes *attributes = [FLEXPropertyAttributes attributesForProperty:property];
    if (read == UBReadAuto)
    {
        Ivar ivar = class_getInstanceVariable(cls, attributes.backingIvar.UTF8String);
        return UBIvarValue(name, object, ivar, attributes.isWeak);
    }
    if (!invokeGetters)
        return UBValue(name, @"skipped", @"Computed; read it to run the getter");

    SEL    getter = attributes.customGetter ?: NSSelectorFromString(name);
    id     target = classProperty ? (id) cls : object;
    Method method = classProperty ? class_getClassMethod(cls, getter)
                                  : class_getInstanceMethod(object_getClass(object), getter);
    if (!method)
        return UBValue(name, @"error",
                       [NSString stringWithFormat:@"No getter %@", NSStringFromSelector(getter)]);
    return UBGetterValue(name, target, method);
}

static Ivar UBOwnIvar(Class cls, NSString *name)
{
    unsigned int count = 0;
    Ivar        *ivars = class_copyIvarList(cls, &count);
    Ivar         found = NULL;
    for (unsigned int index = 0; index < count && !found; index++)
    {
        if (strcmp(ivar_getName(ivars[index]) ?: "", name.UTF8String) == 0)
            found = ivars[index];
    }
    free(ivars);
    return found;
}

static NSDictionary *UBOwnIvarValue(NSString *name, id object, Class cls)
{
    Ivar ivar = UBOwnIvar(cls, name);
    if (!ivar)
        return UBValue(name, @"error",
                       [NSString stringWithFormat:@"No ivar %@ on %s", name, class_getName(cls)]);
    if (UBIvarRead(cls, ivar) == UBReadNever)
        return UBValue(name, @"skipped", @"Unsafe to read");
    return UBIvarValue(name, object, ivar, UBIvarIsWeak(cls, ivar));
}

/** The names whose read runs a getter, recorded before the batch so a crash denies them. */
static NSArray<NSString *> *UBGetterNames(Class cls, NSArray<NSString *> *names)
{
    NSMutableArray<NSString *> *getters = [NSMutableArray new];
    for (NSString *name in names)
    {
        BOOL            classProperty = NO;
        objc_property_t property      = UBFindProperty(cls, name, &classProperty);
        if (property && UBPropertyRead(cls, property, classProperty) == UBReadManual)
            [getters addObject:name];
    }
    return getters;
}

static BOOL UBObjectIsKindOf(id object, Class cls)
{
    for (Class current = object_getClass(object); current; current = class_getSuperclass(current))
    {
        if (current == cls)
            return YES;
    }
    return NO;
}

NSDictionary *UBReadValues(id object, Class cls, NSString *kind, NSArray<NSString *> *names,
                           BOOL invokeGetters)
{
    if (!object || !cls)
        return @{@"error" : @"Failed to read values: no object or class given"};
    BOOL properties = [kind isEqualToString:@"properties"];
    if (!properties && ![kind isEqualToString:@"ivars"])
    {
        return @{
            @"error" : UBTruncate(
                [NSString stringWithFormat:@"Failed to read values: unknown kind %@", kind])
        };
    }
    if (!UBObjectIsKindOf(object, cls))
    {
        return @{
            @"error" : [NSString
                stringWithFormat:@"Failed to read values: object is not a %s", class_getName(cls)]
        };
    }

    NSMutableArray<NSString *> *requested = [NSMutableArray new];
    for (id name in [names isKindOfClass:NSArray.class] ? names : @[])
    {
        if ([name isKindOfClass:NSString.class] && requested.count < UB_VALUES_LIMIT)
            [requested addObject:name];
    }

    NSArray<NSString *> *getters =
        properties && invokeGetters ? UBGetterNames(cls, requested) : @[];
    if (getters.count)
        UBBeginGetters(cls, kind, getters);

    NSMutableArray<NSDictionary *> *values = [NSMutableArray arrayWithCapacity:requested.count];
    for (NSString *name in requested)
    {
        @try
        {
            [values addObject:properties ? UBPropertyValue(name, object, cls, invokeGetters)
                                         : UBOwnIvarValue(name, object, cls)];
        }
        @catch (NSException *exception)
        {
            [values addObject:UBValue(name, @"error",
                                      [NSString stringWithFormat:@"Threw %@: %@", exception.name,
                                                                 exception.reason])];
        }
    }

    if (getters.count)
        UBEndGetters();
    return @{@"values" : values};
}
