---
layout: post
title:  "Kotlin(一) lateinit 和 by lazy"
date: "2019-05-15"
author: "北邙山之光"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - kotlin
---

再不学 kotlin,google 的 sample 都看不懂了···  
但是对于一些 kotlin 的关键字和写法理解不够深刻，自己基础不够扎实，不知道 jvm 执行代码的原理，以后研究一哈！

<!--more-->

## 先来总结

<https://stackoverflow.com/questions/36623177/kotlin-property-initialization-using-by-lazy-vs-lateinit>

1. by lazy{} 只能用于被 val 修饰的变量上，lateinit 只能用于 var 修饰的变量上，lateinit 之后必须要初始化，否则运行时报错
2. lateinit 不能用于可空属性或者基本类型
3. lateinit 可以在任何地方初始化，by lazy{} 只能写在代码块中
4. lateinit 无法保证线程安全，by lazy{} 可以
5. lateinit 可以使用::指向属性并可以调用 isInitialized 判断是否已经初始化，只能在 getter, setter 中。by lazy{} 因为实现了 Lazy 接口，其中也有个 isInitialized() 方法，可以反射调用，没必要。
6. by lazy{} 可能会导致内存泄漏

## 解析

看一段简单的 lateinit 和 by lazy{} 代码

```kotlin
class A{
    val lazyA by lazy { 1 }
    lateinit var lateInitA : String
}

fun main() {
    val a = A()
    
    print(a.lazyA)
    
    print(a.lateInitA) // 这行会抛出异常 kotlin.UninitializedPropertyAccessException: lateinit property lateInitA has not been initialized

    var delegate= a::lazyA.apply { isAccessible = true }.getDelegate()  // 反射拿代理强转Lazy就可以调用isInitialized  
    
    print((delegate as Lazy<*>).isInitialized())
}

```

反编译之后的 java 代码

```java
public final class A {
   // $FF: synthetic field
   static final KProperty[] $$delegatedProperties = new KProperty[]{(KProperty)Reflection.property1(new PropertyReference1Impl(Reflection.getOrCreateKotlinClass(A.class), "lazyA", "getLazyA()I"))};
   @NotNull
   private final Lazy lazyA$delegate;
   @NotNull
   public String lateInitA;

   public final int getLazyA() {
      Lazy var1 = this.lazyA$delegate;
      KProperty var3 = $$delegatedProperties[0];
      return ((Number)var1.getValue()).intValue();
   }

   @NotNull
   public final String getLateInitA() {
      String var10000 = this.lateInitA;
      if (var10000 == null) {
         Intrinsics.throwUninitializedPropertyAccessException("lateInitA");
      }

      return var10000;
   }

   public final void setLateInitA(@NotNull String var1) {
      Intrinsics.checkParameterIsNotNull(var1, "<set-?>");
      this.lateInitA = var1;
   }

   public A() {
      this.lazyA$delegate = LazyKt.lazy((Function0)null.INSTANCE);
   }
}

A a = new A();
int var1 = a.getLazyA();
System.out.print(var1);
String var2 = a.getLateInitA();
System.out.print(var2);
```

+ lateinit
  
    其实 lateinit 修饰的属性其实没啥改动，只是在 get 方法调用的时候会自动判断是否为 null(所以也印证了lateinit无法修饰基本类型)，如果未初始化抛出异常。

    再看 by lazy{} 就复杂很多了

+ by lazy{}

    首先，getLazyA 方法体中，去取了 `lazyA$delegate`，这个 `lazyA$delegate` 又是什么？

    + lazyA$delegate 是什么

        ```java
        public A() {
            this.lazyA$delegate = LazyKt.lazy((Function0)null.INSTANCE);
            // 这里用的idea的内置工具show kotlin byte code再decompile的，似乎有点问题，这个地方应该是个lambda表达式，变成了个null
        }
        ```

        在构造方法中看到这几行代码，清楚的告诉了我们这个 `lazyA$delegate` 哪里来的。就是 LazyKt.lazy 方法得到的，这个方法在 `LazyJVM.kt` 里面，直接调用了 `SynchronizedLazyImpl(initializer)` 

    + SynchronizedLazyImpl

        这个 get 方法真正实现了延迟加载，并且是线程安全的。

      ```java
      override val value: T
        get() {
            val _v1 = _value
            if (_v1 !== UNINITIALIZED_VALUE) {
                @Suppress("UNCHECKED_CAST")
                return _v1 as T
            }

            return synchronized(lock) {
                val _v2 = _value
                if (_v2 !== UNINITIALIZED_VALUE) {
                    @Suppress("UNCHECKED_CAST") (_v2 as T)
                } else {
                    val typedValue = initializer!!()// 执行lambda表达式呦~~
                    _value = typedValue
                    initializer = null
                    typedValue
                }
            }
        }
      ```  

    &nbsp;

    &nbsp;
    **至此**，by lazy{} 分析结束了~~因为 kotlin 默认的访问，都是调用属性的 get 方法，而 by lazy 修饰的属性的 get 方法是自动帮我们生成的，如下

    ```java
    public final int getLazyA() {
      Lazy var1 = this.lazyA$delegate;
      KProperty var3 = $$delegatedProperties[0];
      return ((Number)var1.getValue()).intValue();
   }
    ```
   
   `lazyA$delegate` 的 getValue 获取的就是 value 属性，被重写了，就是前面 `SynchronizedLazyImpl` 的 value 的 get 方法。


## 总结  

其实也没必要看得这么仔细，使用的时候，我个人感觉就是 lateinit 就是在你调用之前一定要初始化的东西，不论任何时候，并且你自己初始化，不然一定抛出异常，且不是单例，多个实例多次初始化。

而 by lazy{} 就是延迟调用的单例，注意 lambda 表达式里面的东西就好。


