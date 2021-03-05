---
layout: post
title:  "RecyclerView 的 onMeasure"
date: "2018-02-24"
author: "北邙山之光"
category: "自定义View"
catalog: true  
excerpt_separator: <!--more-->
tags: 
    - 自定义View
---

## 交给 LayoutManager
首先，RecyclerView 的 onMeasure 会通过一个 if 判断，是否交由 LayoutManager 来管理。
```java
if (mLayout.mAutoMeasure) {
    mLayout.onMeasure(mRecycler, mState, widthSpec, heightSpec);
  }
```
mAutoMeasure 这个值，在我们经常使用的 LinearLayoutManager 中是 true，所以会走进这个 if 判断

  详见 LinearLayoutManager 的构造函数：  
```java
public LinearLayoutManager(Context context, int orientation, boolean reverseLayout) {
        setOrientation(orientation);
        setReverseLayout(reverseLayout);
        setAutoMeasureEnabled(true);
    }
```
<!--more-->
  而 setAutoMeasureEnabled 就是给 mAutoMeasure 赋值为 true，此时交给了 LayoutManager

## 不同 SpecMode 情况不同
 1. specMode = EXACTLY  
   如果设置了 RecyclerView 的 specMode 是 EXACTLY，那么 onMeasure 直接结束。
 2. other  
   不会直接 return，而会调用 dispatchLayoutstep1 和 2 等各种方法，十分复杂。  
   并且如果在 onMeasure 时就已经调用 dispatchLayoutStep1 和 2，那么它的 State 将会被改变为 State.STEP_LAYOUT，在执行 onLayout 的时候，如果没有其他变化会跳过这两个函数。  


  根据注释可以知道，dispatchLayoutstep1 只是一个初步的测量并且主要是保存了之前的 recyclerview 中的 itemView 的信息，因为还有一个 dispatchLayoutStep3(onMeasure 时不调用)，这个函数保存数据更改之后的 recyclerview 中的信息，两者可以进行比对，从而执行一些删除、添加等的动画效果。  

  dispatchlayoutStep2 是真正进行了计算和布局，这其中包括一个很重要的 fill 函数，它会不断填充布局，直至没有空间。在这个过程中 view 从哪里得来？还涉及到了 recyclerview 的回收部分。除此之外，在 recyclerview 滑动时，也要进行相应的 fill，十分复杂。

  整体只是理清楚了大致流程，但是具体的细节代码实在是看不明白，也没有一位前辈站出来，写一篇完整的2w行的 recyclerview 的真·解析。
