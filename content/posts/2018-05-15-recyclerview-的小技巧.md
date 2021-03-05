---
layout: post
title:  "recyclerview 的小技巧"
date: "2018-05-15"
author: "北邙山之光"
category: "Android"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android
---

# recyclerview 停留在任意位置

## smoothScrollToPosition

+ 具体代码

  重写 SmoothScroller，可以改写其滚动时间和距离等等，可以继承 LinearSmoothScroller 实现

  ```java
  protected float calculateSpeedPerPixel(DisplayMetrics displayMetrics) {
       return MILLISECONDS_PER_INCH / displayMetrics.densityDpi;
   }

   */
  protected int calculateTimeForScrolling(int dx) {
      // In a case where dx is very small, rounding may return 0 although dx > 0.
      // To avoid that issue, ceil the result so that if dx > 0, we'll always return positive
      // time.
      return (int) Math.ceil(Math.abs(dx) * MILLISECONDS_PER_PX);
  }
  ```

  <!--more-->
  这两个函数分别控制了时间和速度，完全可以自定义

  重点是如何实现停留在一些不规则的位置！首先，这个方法没法停留在一些不规则位置。他只能停在一个 item 的顶部露出或者底部等等，比如我要滑动到漏出一半的位置，这就不行了。

  默认情况是不可以，但是我们还是可以重写一个方法来实现。

  ```java
  public int calculateDyToMakeVisible(View view, int snapPreference) {
         final RecyclerView.LayoutManager layoutManager = getLayoutManager();
         if (layoutManager == null || !layoutManager.canScrollVertically()) {
             return 0;
         }
         final RecyclerView.LayoutParams params = (RecyclerView.LayoutParams)
                 view.getLayoutParams();
         final int top = layoutManager.getDecoratedTop(view) - params.topMargin-OFFSET ;
         final int bottom = layoutManager.getDecoratedBottom(view) + params.bottomMargin;
         final int start = layoutManager.getPaddingTop();
         final int end = layoutManager.getHeight() - layoutManager.getPaddingBottom();
         return calculateDtToFit(top, bottom, start, end, SNAP_TO_START);
     }
  ```

  我们在正常的流程中，比如 top 值，我多减去一个 offset 值，这个值是我自己定义的，可以是 item 的一半高度，这样就 ok 了

+ 问题
  1. smoothScrollToPosition 这个方法有时候并不能起到我们想要的作用，而是滚动到一个···不是很能理解的位置，这个还是需要进一步研究 smoothScroller 就知道了！
  2. smoothScrollToPosition 的滑动全部依赖于 smoothScroller，所以我认为，可以重写它实现任意效果
  3. smoothScrollToPosition 自带的滚动效果不是很平滑，改变速度的话，又怪怪的。需要我们了解一些数学公式，自定义一个合理的速度。

## smoothScrollBy

+ 具体方式
  这个方法，就是传入将要滚动的距离，相比之下，麻烦的是每次要计算要滑动多远。要考虑很多复杂的情况，view 被销毁了？等等！可能会算不准，但是逻辑都考率到的话，反正我是没遇到什么问题。

  相比于 smoothScrollToPosition 的方式，它不会出现问题，滚动距离只要制定，就会滑动到我们想要的位置。重要的是，overScroller 自带的动画效果很平滑。这一点的话，我觉得把这里拦截器的代码拷贝到 smoothScroller 里面应该也可以有相同的结果

## Crash

+ Inconsistency detected. Invalid item position 5(offset:5).state:6
+ Inconsistency detected. Invalid view holder adapter positionViewHolder

  这两个 crash 基本使用了 recyclerview 的人都有遇到过，其实就是数据没有及时更新的问题。但是由于业务的复杂性，我们提供一些增删数据的接口被其他人滥用，导致了一些问题。

  比如，外面调用了一个 remove 方法，删除了adapter中的一条数据，但是可能因为一些奇怪的原因，并没有及时通知 adapter，这个时候如果你去滚动 recyclerview 必定 crash。invalid item。

  再比如，你的 recyclerview 要被销毁了，你调用了 adapter 中存储数据的结构的清理函数，比如用 List 存储，你调用了 List.clear，但是你每调用 notifydataSetchanged。这个时候，你去滑动 recyclerview，必定 crash。

  所以，处理 recyclerview 的时候，一定要注意数据的问题，及时通知 adapter！

  问题是，有时候你都不知道为啥别人这么调用你的接口，而且瞎鸡儿调用。这个时候咋办呢？

  **只能这样：**

  你在 adapter 中维护一个 final 的 list，外部再维护一个网络请求、增删改查使用的 list，每次更新完后，让这个 final 类型的 list 先清空，再重新 addAll。这样，即使你外部的 list 被无限滥用，你 adapter 内部维护的 list 始终是稳定的，只要你没有调用更新 final list 的方法，list 里面的数据就还是之前那些，就不会出现以上的各种 indexOutOfBounds 的 crash。

## 获取滑动速度的问题

+ velocitytracker
  velocitytracker 这个东西用于获取速度,之前没有使用过，根据 demo 学习时发现，可以获取到 action_move 的速度，但是 up 的时候却没有速度，而且如果触发 fling 特别快的时候，move 的最后时刻获取到的速度值为0。这很让我无语。我甚至把 recyclerview 的 action_up 等都 copy 了过来，还是不行。至今不知道为啥，所以已经加入了我的 question 列表中···

+ fling
  既然 velocitytracker 不太会用，在看 recyclerview 源码的时候发现，它就是在 action_up 的时候获取了速度，然后调用 fling。所以我在 fling 回调里面拿到的速度肯定是对的。于是可以 addOnFlingListener，这样回调里可以获取到速度，根据 overScroller 的源码，我们可以算出来当前速度可以滚动多远。进而，进行一些判断，比如说，让滑动距离不超过xxx，就回弹等等的效果。
