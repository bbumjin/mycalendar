# Keep Kotlinx Serialization metadata
-keep,allowobfuscation,allowshrinking class kotlinx.serialization.KSerializer
-keepclasseswithmembers class * { @kotlinx.serialization.Serializable <init>(...); }
-keepclassmembers,allowobfuscation class **$$serializer {
    *** descriptor;
    *** INSTANCE;
}
