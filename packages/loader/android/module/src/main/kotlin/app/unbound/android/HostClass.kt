package app.unbound.android

class HostClass(vararg val names: String) {
    fun find(classLoader: ClassLoader): Class<*>? = names.firstNotNullOfOrNull { name ->
        runCatching { classLoader.loadClass(name) }.getOrNull()
    }

    fun load(classLoader: ClassLoader): Class<*> =
        find(classLoader) ?: throw ClassNotFoundException(names.joinToString(" or "))

    companion object {
        fun legacy(name: String) = HostClass(name)
    }
}
