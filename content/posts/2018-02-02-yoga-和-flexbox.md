---
layout: post
title:  "yoga 和 flexbox"
date: "2018-02-02"
author: "北邙山之光"
category: "JavaScript"
catalog: true  
excerpt_separator: <!--more-->
tags: 
    - JavaScript
---

## Yoga
[https://facebook.github.io/yoga/](https://facebook.github.io/yoga/)  
facebook 开源的布局框架，支持多种语言  

### Android 中使用 Yoga
通过
```java
compile 'com.facebook.yoga.android:yoga-layout:1.5.0'
compile 'com.facebook.yoga:yoga:1.5.0'
```
即可使用，反正我是忽略了他那个什么 BUCK，看了半天没看懂规则···

<!--more-->
### 优点
可以使用 flexbox 布局的形式来写移动端布局，可以统一 android 和 ios 布局，react-native 底层似乎也是用的 yoga

### 问题
对于 android 的支持，可以使用提供的 YogaLayout 和 VirtualYogaLayout,但是这仅仅限于使用 xml 书写布局的时候。代码书写需要注意一些 addView 的小问题，否则会不显示。

### 原因
YogaLayout 底层是依靠的 YogaNode 涉及到 c++ 层的一些布局算法吧，我没有看。通过一个 view 对应一个 node，形式一个 node 树。然后根据相应的 android 的 view 树一一设置参数，从而达到了相应的布局效果。

但是如果我们使用代码书写布局的时候，就有各种问题。

1. YogaLayout 提供了几个 addView 方法，addView(View v,YogaNode node)。  
这个方法看似像是我们创建一个 node 然后给 node 设置 flex 参数，然后 addView 的时候传入和我们 android 中的 view 绑定，实则不然。    
YogaLayout 在 onLayout 的时候，看的是 children 变量是不是有值，而上述方法 addView，children 变量是不变的，只是 mYogaNodes 变化了多了一个映射关系，并没有对新的 view 进行 layout,所以 add 之后，并不显示

2. 用最简单的 ViewGroup 的 addView 方法，先加入视图之中，之后还会回调参数最多的那个 addView 的方法。  
但是问题，我们这样无法操控 YogaNode，一切的 flexbox 的参数都集成在 YogaNode 上，我们一定要获得 view 对应的 Node 才可以。  
通过阅读 YogaLayout 源码发现，它是这么做的，首先他解析 xml,生成相应 View，在 addView 的时候，形成一个 map，把 view 和 node，一一绑定，然后通过 view 作为 key，取得 node，调用 applyLayoutParams 传入子 View 对应的 node，和相应的参数，然后对 node 进行设置各种 flex 参数。  
所以目前我通过代码也这么写，通过 addView，然后 getYogaNodeForView 拿到 YogaNode.

## FlexBox
flexbox：是一种弹性布局  

1. flex:类似 layout_weight，可以按比例平分空间，填充剩余空间
2. flex-direction: 主轴的方向，横向和纵向和其对应的反向
3. justify-content: 如何布局里面的子 View
    + flex-start: 子 View 从主轴开始的地方排列
    + flex-end: 子 View从主轴的末尾反着排列
    + center: 子 View 排在中间
    + space-around: 子 View 左右间距都相同
    + space-between: 不考虑两边的子 View，其余子 View 间距相同
4. flex-wrap: wrap 或者 nowrap，就是子 View 展现不全，是不是换行来展现内容，还是直接显示一部分。
5. align：align 又分为许多种，align-items 和 align-self 等等，其原理相同
  + 其大部分属性和 justify-content 一样，有一个特殊的叫做 stretch，他会使 View 充满布局。
