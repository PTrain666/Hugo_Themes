---
layout: post
title:  "SingleTask 血案"
date: "2020-03-21"
author: "北邙山之光"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android
---

最近还是在做小包的需求(什么是小包···就是功能和体积的阉割版)，测试提了个 bug，说主站的 APP，打开详情页，回到后台，再重新打开 APP，会回到详情页。而小包回到了首页。

一开始没往启动模式上想，debug 了一下几个页面的生命周期，发现详情页总是先被  onDestory，经过一阵思考才觉得是启动模式的问题。


## SingleTask 你真的熟悉吗？

很多人面试都会准备这些启动模式的问题，但是 singleTask 你真的熟悉吗？singleTask 有几个关键点

+ clearTop  
  如果一个 activity 被设置成 singleTask，那么它天然就有 clearTop 效果。也就是`销毁在它之上的 activity 栈中的所有 activity`。  
  这也解释了为啥打开之后回到了首页，因为小包的 HomeActivity 是 SingleTask 的，而主站不是。

+ onNewIntent   
  没错这个生命周期它lei了  
  如果一个 Activity 是 SingleTask 的启动模式，那么他的生命周期就会有所不同，前提是`栈内已经有这个 Activity 的实例了`。  
  onNewIntent -> onRestart -> onStart -> onResume，并没有 onCreate。但是，当有各种神奇的情况让你的 Activity 被销毁的时候，onCreate 肯定还会重新走。  
  这里还有一个坑，就是 onNewIntent 一定要 setIntent()


## 悲哀

工作了也快三年了，每天写出来的东西还是这些，感觉毫无意义···  
API 工程师