---
layout: post
title:  "Kotlin Scope Function"
date: "2021-01-22"
author: "北邙山之光"
category: "kotlin"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - kotlin
---

### 前言

经常看公司里的人写的一些基础库(基于 Kotlin)看不太懂，总有各种关键字和函数，不知道他们是在刻意用还是咋地，所以学一波，就从出现次数最多的 Scope Function 开始了。

> The Kotlin standard library contains several functions whose sole `purpose is to execute a block of code within the context of an object`. When you call such a function on an object with a lambda expression provided, it forms a temporary scope. In this scope, you can access the object without its name. Such functions are called scope functions. There are five of them: `let, run, with, apply, and also`.

所以总共有5个 Scope Function，至于它的作用是什么？我觉得没有什么实质性作用，可能是一些操作放在了一个 function 中，代码更整洁了吧，因为你完全可以不使用他们。


### 总览源码

先看一眼源码

```kotlin
/**
 * Calls the specified function [block] with `this` value as its receiver and returns its result.
 *
 * For detailed usage information see the documentation for [scope functions](https://kotlinlang.org/docs/reference/scope-functions.html#run).
 */
@kotlin.internal.InlineOnly
public inline fun <T, R> T.run(block: T.() -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return block()
}

/**
 * Calls the specified function [block] with the given [receiver] as its receiver and returns its result.
 *
 * For detailed usage information see the documentation for [scope functions](https://kotlinlang.org/docs/reference/scope-functions.html#with).
 */
@kotlin.internal.InlineOnly
public inline fun <T, R> with(receiver: T, block: T.() -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return receiver.block()
}

/**
 * Calls the specified function [block] with `this` value as its receiver and returns `this` value.
 *
 * For detailed usage information see the documentation for [scope functions](https://kotlinlang.org/docs/reference/scope-functions.html#apply).
 */
@kotlin.internal.InlineOnly
public inline fun <T> T.apply(block: T.() -> Unit): T {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    block()
    return this
}

/**
 * Calls the specified function [block] with `this` value as its argument and returns `this` value.
 *
 * For detailed usage information see the documentation for [scope functions](https://kotlinlang.org/docs/reference/scope-functions.html#also).
 */
@kotlin.internal.InlineOnly
@SinceKotlin("1.1")
public inline fun <T> T.also(block: (T) -> Unit): T {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    block(this)
    return this
}

/**
 * Calls the specified function [block] with `this` value as its argument and returns its result.
 *
 * For detailed usage information see the documentation for [scope functions](https://kotlinlang.org/docs/reference/scope-functions.html#let).
 */
@kotlin.internal.InlineOnly
public inline fun <T, R> T.let(block: (T) -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return block(this)
}
```

#### Inline Function

可以看到这5个方法全是 `Inline Function`。这也可以理解，因为这几个方法编译后，对应 Java 代码都会产生 Function 对象，存在多余的对象创建等，所以使用 `inline` 这个关键字，直接将代码内联，这也是 Kotlin 中的东西，作用于编译器，用于优化代码，不影响看函数主体逻辑。

#### Extension Function

同时，也可以看到4个方法是 `Extension Functions`，这也是 Kotlin 中的概念，所谓的扩展函数(Extension Functions)，就是支持给一个类新增函数。

比如，可以这样写

```kotlin
fun String.hello(world : String) : String {
    return "hello " + world;
}
fun main() {
    System.out.println("abc".hello("world"));
}
```

上面的代码，可以看到 String 类居然可以调用 hello 方法了，这个其实是个 `语法糖`，实际是 `编译器` 帮忙生成了一个 static 的 hello 方法(自行查阅 class 文件)

#### Generic Function

同时，还可以看到这5个方法全是泛型方法，也正是因为如此，配合 `Extension Function` 你才可以在任意类上调用除 with(with 本身不是 `Extention Function`) 之外的四个方法。

### 各有不同

前面看了这5个方法有很多共同点，他们也有一些细微的差别.

官网已经说得很好了，并总结成了表格~~我就不去再翻译一遍了···

主要是两点吧

> 1.The way to refer to the context object.  
  2.The return value.


| Function | Object reference| Return value|
| :-----:| :----: | :--------: |
| let | it | Lambda result |
| run | this | Lambda result |
| run | - | Lambda result |
| with | this | Lambda result |
| apply | this | Context object |
| also | it | Context object |


这里发现居然有两个 run，是的，确实还有一个 run 方法，但是我也不知道它存在的意义

```kotlin
// 这个就是很单纯的执行了 lambda 函数返回结果，为啥要提供一个这个方法呢？
@kotlin.internal.InlineOnly
public inline fun <R> run(block: () -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return block()
}
```

其实这几个方法都可以互转的，只不过有一些方便和不方便的问题，官方只有建议，用不用、怎么用，还是看你自己。