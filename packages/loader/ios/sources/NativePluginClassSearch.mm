#import "NativePluginClassSearch.h"

#import <Foundation/Foundation.h>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <objc/runtime.h>
#include <string>
#include <vector>

#import "NativePluginObjCValues.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
namespace {
    constexpr size_t kDefaultLimit = 50;
    constexpr size_t kMaximumLimit = 1000;

    struct ClassQuery {
        std::string             prefix;
        std::string             image;
        Class                   superclass = nil;
        std::vector<Protocol *> protocols;
        std::vector<SEL>        methods;
        std::vector<SEL>        ownMethods;
        std::vector<SEL>        classMethods;
        size_t                  limit = kDefaultLimit;
    };

    std::vector<std::string> stringList(Runtime &runtime, const Object &query, const char *name)
    {
        std::vector<std::string> list;
        Value                    value = query.getProperty(runtime, name);
        if (!value.isObject() || !value.asObject(runtime).isArray(runtime))
        {
            return list;
        }
        Array array = value.asObject(runtime).asArray(runtime);
        for (size_t index = 0; index < array.size(runtime); index++)
        {
            Value item = array.getValueAtIndex(runtime, index);
            if (item.isString())
            {
                list.push_back(item.getString(runtime).utf8(runtime));
            }
        }
        return list;
    }

    std::string stringProperty(Runtime &runtime, const Object &query, const char *name)
    {
        Value value = query.getProperty(runtime, name);
        return value.isString() ? value.getString(runtime).utf8(runtime) : std::string();
    }

    std::vector<SEL> selectors(const std::vector<std::string> &names)
    {
        std::vector<SEL> list;
        for (const std::string &name : names)
        {
            list.push_back(sel_registerName(name.c_str()));
        }
        return list;
    }

    ClassQuery parseQuery(Runtime &runtime, const Value &value)
    {
        if (!value.isObject())
        {
            throw JSError(runtime, "objc.findClasses expects a query object");
        }
        Object     object = value.asObject(runtime);
        ClassQuery query;
        query.prefix           = stringProperty(runtime, object, "prefix");
        query.image            = stringProperty(runtime, object, "image");
        std::string superclass = stringProperty(runtime, object, "superclass");
        if (!superclass.empty())
        {
            query.superclass = objc_getClass(superclass.c_str());
            if (!query.superclass)
            {
                throw JSError(runtime, "objc.findClasses found no superclass named " + superclass);
            }
        }
        for (const std::string &name : stringList(runtime, object, "protocols"))
        {
            Protocol *protocol = objc_getProtocol(name.c_str());
            if (!protocol)
            {
                throw JSError(runtime, "objc.findClasses found no protocol named " + name);
            }
            query.protocols.push_back(protocol);
        }
        query.methods      = selectors(stringList(runtime, object, "methods"));
        query.ownMethods   = selectors(stringList(runtime, object, "ownMethods"));
        query.classMethods = selectors(stringList(runtime, object, "classMethods"));
        Value limit        = object.getProperty(runtime, "limit");
        if (limit.isNumber() && limit.getNumber() >= 1)
        {
            query.limit = std::min(kMaximumLimit, static_cast<size_t>(limit.getNumber()));
        }
        return query;
    }

    bool inheritsFrom(Class cls, Class ancestor)
    {
        for (Class current = class_getSuperclass(cls); current;
             current       = class_getSuperclass(current))
        {
            if (current == ancestor)
            {
                return true;
            }
        }
        return false;
    }

    bool declares(Class cls, SEL selector)
    {
        unsigned int count   = 0;
        Method      *methods = class_copyMethodList(cls, &count);
        bool         found   = false;
        for (unsigned int index = 0; index < count && !found; index++)
        {
            found = method_getName(methods[index]) == selector;
        }
        std::free(methods);
        return found;
    }

    bool matches(Class cls, const ClassQuery &query)
    {
        const char *name = class_getName(cls);
        if (!query.prefix.empty() &&
            std::strncmp(name, query.prefix.c_str(), query.prefix.size()) != 0)
        {
            return false;
        }
        if (!query.image.empty())
        {
            const char *image = class_getImageName(cls);
            if (!image || !std::strstr(image, query.image.c_str()))
            {
                return false;
            }
        }
        if (query.superclass && !inheritsFrom(cls, query.superclass))
        {
            return false;
        }
        for (Protocol *protocol : query.protocols)
        {
            if (!class_conformsToProtocol(cls, protocol))
            {
                return false;
            }
        }
        for (SEL selector : query.methods)
        {
            if (!class_getInstanceMethod(cls, selector))
            {
                return false;
            }
        }
        for (SEL selector : query.ownMethods)
        {
            if (!declares(cls, selector))
            {
                return false;
            }
        }
        for (SEL selector : query.classMethods)
        {
            if (!class_getClassMethod(cls, selector))
            {
                return false;
            }
        }
        return true;
    }

    Value findClasses(Runtime &runtime, const Value *args, size_t count)
    {
        Value                    none;
        ClassQuery               query = parseQuery(runtime, count ? args[0] : none);
        std::vector<std::string> found;
        unsigned int             total   = 0;
        Class                   *classes = objc_copyClassList(&total);
        for (unsigned int index = 0; index < total && found.size() < query.limit; index++)
        {
            if (matches(classes[index], query))
            {
                found.emplace_back(class_getName(classes[index]));
            }
        }
        std::free(classes);
        std::sort(found.begin(), found.end());
        Array result(runtime, found.size());
        for (size_t index = 0; index < found.size(); index++)
        {
            result.setValueAtIndex(runtime, index, String::createFromUtf8(runtime, found[index]));
        }
        return result;
    }
}

void installObjCClassSearch(Runtime &runtime, Object &objc)
{
    objc.setProperty(runtime, "findClasses",
                     Function::createFromHostFunction(
                         runtime, PropNameID::forAscii(runtime, "findClasses"), 1,
                         [](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
                             return findClasses(rt, args, count);
                         }));
}
}
