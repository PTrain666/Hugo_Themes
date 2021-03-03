---
layout: post
title: "Gradle Plugin 3.0"
date: "2018-06-28"
author: "北邙山之光"
category: "Android"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android
---

## 变化

![](/img/in-post/gradle.png)

`注：compile、provided 和 apk 目前仍然可用。 不过，它们将在下一个主要版本的 Android 插件中消失`

## 解释

+ implementation  
  lib 改变时，只会编译 lib

+ api  
  lib 改变时，会编译 lib 和依赖此 lib 的所有模块

之前的 compil e会重新编译依赖此模块的所有模块，所以十分耗时。为了减少编译时间，plugin 3.0 将 compile 拆分为 implementation 和 api。

另：  
如果工程(假设叫做projectA)依赖的 module(假设叫做mA)，是使用 implementation 方式的，并且 mA 依赖 mB，那么 projectA 重无法直接调用 mB 中的接口，api 则可以。  

所以在不出错的情况下应该尽量使用 implementation 的方式
