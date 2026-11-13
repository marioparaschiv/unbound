package app.unbound.android

import dalvik.system.DexFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.lang.reflect.Modifier

object ClassSearch {
    private const val DEFAULT_LIMIT = 50
    private const val MAX_LIMIT = 1000
    private const val CACHE_FILE = "unbound-class-search.json"
    private val LIBRARY_PREFIXES = listOf(
        "android.",
        "androidx.",
        "kotlin.",
        "kotlinx.",
        "java.",
        "javax.",
        "com.google.",
        "org.jetbrains.",
        "okhttp3.",
        "okio.",
        "com.facebook.",
    )

    private data class MethodShape(
        val name: String?,
        val parameters: List<String>?,
        val returns: String?,
        val isStatic: Boolean?,
        val declared: Boolean,
    )

    private data class FieldShape(val name: String?, val type: String?, val isStatic: Boolean?)

    private data class Query(
        val prefix: String?,
        val extends: String?,
        val implements: List<String>,
        val methods: List<MethodShape>,
        val fields: List<FieldShape>,
        val limit: Int,
    )

    private var classNames: List<String>? = null
    private var cached: JSONObject? = null

    fun find(loader: ClassLoader, queryJSON: String): String {
        val key = canonical(queryJSON)
        val version = appVersion()
        cachedResult(version, key)?.let { return it.toString() }

        val query = parse(JSONObject(queryJSON))
        val found = JSONArray()
        for (name in names()) {
            if (found.length() >= query.limit) break
            if (!eligible(name, query)) continue
            val type = runCatching { Class.forName(name, false, loader) }.getOrNull() ?: continue
            if (runCatching { matches(type, query) }.getOrDefault(false)) found.put(name)
        }
        remember(version, key, found)
        return found.toString()
    }

    private fun canonical(queryJSON: String): String = JSONObject(queryJSON).toString()

    private fun string(list: JSONArray?): List<String> =
        if (list == null) emptyList() else (0 until list.length()).map { list.getString(it) }

    private fun optionalBoolean(value: JSONObject, name: String): Boolean? =
        if (value.has(name) && !value.isNull(name)) value.getBoolean(name) else null

    private fun optionalString(value: JSONObject, name: String): String? =
        if (value.has(name) && !value.isNull(name)) value.getString(name) else null

    private fun parse(value: JSONObject): Query {
        val methods = value.optJSONArray("methods")
        val fields = value.optJSONArray("fields")
        return Query(
            prefix = optionalString(value, "package"),
            extends = optionalString(value, "extends"),
            implements = string(value.optJSONArray("implements")),
            methods = (0 until (methods?.length() ?: 0)).map {
                val method = methods!!.getJSONObject(it)
                MethodShape(
                    optionalString(method, "name"),
                    method.optJSONArray("parameters")?.let { list -> string(list) },
                    optionalString(method, "returns"),
                    optionalBoolean(method, "static"),
                    method.optBoolean("declared", true),
                )
            },
            fields = (0 until (fields?.length() ?: 0)).map {
                val field = fields!!.getJSONObject(it)
                FieldShape(optionalString(field, "name"), optionalString(field, "type"), optionalBoolean(field, "static"))
            },
            limit = value.optInt("limit", DEFAULT_LIMIT).coerceIn(1, MAX_LIMIT),
        )
    }

    private fun eligible(name: String, query: Query): Boolean {
        if (query.prefix != null) return name.startsWith(query.prefix)
        return LIBRARY_PREFIXES.none { name.startsWith(it) }
    }

    private fun ancestors(type: Class<*>): Sequence<Class<*>> = generateSequence(type.superclass) { it.superclass }

    private fun allInterfaces(type: Class<*>): Set<String> {
        val names = HashSet<String>()
        fun visit(current: Class<*>) {
            for (item in current.interfaces) if (names.add(item.name)) visit(item)
        }
        visit(type)
        ancestors(type).forEach { visit(it) }
        return names
    }

    private fun matches(type: Class<*>, query: Query): Boolean {
        if (query.extends != null && ancestors(type).none { it.name == query.extends }) return false
        if (query.implements.isNotEmpty() && !allInterfaces(type).containsAll(query.implements)) return false
        if (query.methods.isNotEmpty()) {
            val declared = type.declaredMethods
            val inherited by lazy { runCatching { type.methods }.getOrDefault(emptyArray()) }
            for (shape in query.methods) {
                val candidates = if (shape.declared) declared else inherited
                if (candidates.none { methodMatches(it, shape) }) return false
            }
        }
        if (query.fields.isNotEmpty()) {
            val declared = type.declaredFields
            for (shape in query.fields) {
                if (declared.none { field ->
                        (shape.name == null || field.name == shape.name) &&
                            (shape.type == null || field.type.name == shape.type) &&
                            (shape.isStatic == null || Modifier.isStatic(field.modifiers) == shape.isStatic)
                    }
                ) {
                    return false
                }
            }
        }
        return true
    }

    private fun methodMatches(method: java.lang.reflect.Method, shape: MethodShape): Boolean =
        (shape.name == null || method.name == shape.name) &&
            (shape.returns == null || method.returnType.name == shape.returns) &&
            (shape.isStatic == null || Modifier.isStatic(method.modifiers) == shape.isStatic) &&
            (shape.parameters == null || method.parameterTypes.map { it.name } == shape.parameters)

    @Suppress("DEPRECATION")
    private fun names(): List<String> = synchronized(this) {
        classNames?.let { return it }
        val info = Platform.application()?.applicationInfo ?: return emptyList()
        val paths = listOfNotNull(info.sourceDir) + (info.splitSourceDirs?.toList() ?: emptyList())
        val names = paths.flatMap { path ->
            runCatching {
                val dex = DexFile(path)
                try {
                    dex.entries().toList()
                } finally {
                    dex.close()
                }
            }.getOrDefault(emptyList())
        }.distinct()
        classNames = names
        names
    }

    private fun appVersion(): String {
        val context = Platform.application() ?: return "unknown"
        return runCatching {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            "${info.longVersionCode}"
        }.getOrDefault("unknown")
    }

    private fun cacheFile(): File? = Platform.application()?.cacheDir?.let { File(it, CACHE_FILE) }

    private fun cachedResult(version: String, key: String): JSONArray? = synchronized(this) {
        val cache = cached ?: runCatching { JSONObject(cacheFile()!!.readText()) }.getOrNull().also { cached = it }
        if (cache?.optString("version") != version) return null
        return cache.optJSONObject("results")?.optJSONArray(key)
    }

    private fun remember(version: String, key: String, found: JSONArray) = synchronized(this) {
        val cache = cached?.takeIf { it.optString("version") == version }
            ?: JSONObject().put("version", version).put("results", JSONObject())
        cache.getJSONObject("results").put(key, found)
        cached = cache
        runCatching { cacheFile()?.writeText(cache.toString()) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to save the class search cache", it) }
    }
}
