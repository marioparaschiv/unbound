package app.unbound.android

import android.content.res.AssetManager
import java.lang.reflect.Method
import java.lang.reflect.Modifier

internal object ReactBundleLoaders {
    private const val BUNDLE_LOADER = "com.facebook.react.bridge.JSBundleLoader"

    fun find(reactInstance: Class<*>, classLoader: ClassLoader): List<Method> {
        syntheticAccessors(reactInstance).takeIf(List<Method>::isNotEmpty)?.let { return it }

        val bundleLoader = runCatching { classLoader.loadClass(BUNDLE_LOADER) }.getOrNull()
        val loadJSBundle = bundleLoader?.let { reactInstance.legacyMethod("loadJSBundle", it) }
        if (loadJSBundle != null) return listOf(loadJSBundle)

        return emptyList()
    }

    fun instance(loader: Method, target: Any?, firstArgument: Any?): Any? =
        if (Modifier.isStatic(loader.modifiers)) firstArgument else target

    private fun syntheticAccessors(reactInstance: Class<*>): List<Method> {
        val assets = listOf(reactInstance, AssetManager::class.java, String::class.java)
        val file = listOf(reactInstance, String::class.java, String::class.java)
        val accessors = reactInstance.declaredMethods.filter { method ->
            Modifier.isStatic(method.modifiers) &&
                method.isSynthetic &&
                method.returnType == Void.TYPE
        }
        val matching = accessors.filter { it.parameterTypes.toList() == assets || it.parameterTypes.toList() == file }
        val signatures = matching.groupBy { it.parameterTypes.toList() }
        if (signatures.values.any { it.size > 1 }) return emptyList()
        return matching
    }
}
