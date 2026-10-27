#include "NativeTypeEncoding.h"

#include <cstring>
#include <string_view>

static const char *unqualifiedType(const char *encoding)
{
    if (!encoding)
    {
        return "";
    }

    while (*encoding && std::strchr("rnNoORV", *encoding))
    {
        encoding++;
    }
    return encoding;
}

char normalizedType(const char *encoding)
{
    return *unqualifiedType(encoding);
}

std::string nativeFFITypeName(const char *encoding)
{
    const char      *type = unqualifiedType(encoding);
    std::string_view value(type);
    switch (*type)
    {
        case 'v':
            return value == "v" ? "void" : "";
        case '@':
            if (value == "@")
                return "object";
            if (value.size() > 3 && value[1] == '"' && value.back() == '"' &&
                value.find('"', 2) == value.size() - 1)
            {
                return "object";
            }
            return {};
        case '#':
            return value == "#" ? "class" : "";
        case ':':
            return value == ":" ? "selector" : "";
        case '^':
            return value.size() > 1 ? "pointer" : "";
        case '*':
            return value == "*" ? "pointer" : "";
        case 'B':
            return value == "B" ? "bool" : "";
        case 'c':
            return value == "c" ? "i8" : "";
        case 'C':
            return value == "C" ? "u8" : "";
        case 's':
            return value == "s" ? "i16" : "";
        case 'S':
            return value == "S" ? "u16" : "";
        case 'i':
            return value == "i" ? "i32" : "";
        case 'I':
            return value == "I" ? "u32" : "";
        case 'l':
        case 'q':
            return value.size() == 1 ? "i64" : "";
        case 'L':
        case 'Q':
            return value.size() == 1 ? "u64" : "";
        case 'f':
            return value == "f" ? "float" : "";
        case 'd':
            return value == "d" ? "double" : "";
        case '{':
            break;
        default:
            return {};
    }

    if (value.size() < 4 || value.back() != '}')
    {
        return {};
    }
    size_t separator = value.find('=');
    if (separator == std::string_view::npos)
    {
        return {};
    }
    std::string_view name   = value.substr(1, separator - 1);
    std::string_view fields = value.substr(separator + 1, value.size() - separator - 2);
    if ((name == "_NSRange" || name == "NSRange") && fields == "QQ")
        return "struct:NSRange";
    if ((name == "CGPoint" || name == "_CGPoint") && fields == "dd")
        return "struct:CGPoint";
    if ((name == "CGSize" || name == "_CGSize") && fields == "dd")
        return "struct:CGSize";
    if ((name == "UIEdgeInsets" || name == "_UIEdgeInsets") && fields == "dddd")
        return "struct:UIEdgeInsets";
    if ((name == "CGAffineTransform" || name == "_CGAffineTransform") && fields == "dddddd")
        return "struct:CGAffineTransform";
    if (name == "CGRect" || name == "_CGRect")
    {
        if (fields == "{CGPoint=dd}{CGSize=dd}" || fields == "{_CGPoint=dd}{_CGSize=dd}" ||
            fields == "{CGPoint=dd}{_CGSize=dd}" || fields == "{_CGPoint=dd}{CGSize=dd}")
        {
            return "struct:CGRect";
        }
    }
    return {};
}

const char *nativeStructEncoding(std::string_view name)
{
    if (name == "NSRange")
    {
        return "{_NSRange=QQ}";
    }
    if (name == "CGPoint")
    {
        return "{CGPoint=dd}";
    }
    if (name == "CGSize")
    {
        return "{CGSize=dd}";
    }
    if (name == "CGRect")
    {
        return "{CGRect={CGPoint=dd}{CGSize=dd}}";
    }
    if (name == "UIEdgeInsets")
    {
        return "{UIEdgeInsets=dddd}";
    }
    if (name == "CGAffineTransform")
    {
        return "{CGAffineTransform=dddddd}";
    }
    return nullptr;
}
