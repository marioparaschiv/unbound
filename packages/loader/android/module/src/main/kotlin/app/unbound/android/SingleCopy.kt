package app.unbound.android

object SingleCopy {
    private const val OWNER_PROPERTY = "unbound.loader.owner"
    private const val DUPLICATE_PROPERTY = "unbound.loader.duplicate"

    fun claim(source: String, loader: ClassLoader?): Boolean {
        val identity = "$source#${System.identityHashCode(loader)}"
        val owner = System.getProperty(OWNER_PROPERTY)

        if (owner == null) {
            System.setProperty(OWNER_PROPERTY, identity)
            return true
        }

        if (owner == identity) return true

        System.setProperty(DUPLICATE_PROPERTY, source)
        return false
    }

    fun duplicate(): String = System.getProperty(DUPLICATE_PROPERTY) ?: ""
}
