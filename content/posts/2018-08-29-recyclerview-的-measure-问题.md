---
layout: post
title:  "recyclerview 的 measure 问题"
date: "2018-08-29"
author: "北邙山之光"
category: "自定义View"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - 自定义View
---

之前写过一篇 recyclerview 的 onMeasure 问题，但是只是看看博客，泛泛而谈，至今也没有看源码

最近遇到了一个奇怪的问题，一个 wrap_content 的 relativelayout 布局，放到 recyclerview 中变成了 match_parent

<!--more-->

## 原因解析  

发现了这个问题之后，通过在onMeasure中打log，发现了MeasureSpec的mode被改变了，从而计算的时候成了match_parent。  
项目中使用了 measureChildWithMargins

```java
  public void measureChildWithMargins(View child, int widthUsed, int heightUsed) {
            final LayoutParams lp = (LayoutParams) child.getLayoutParams();

            final Rect insets = mRecyclerView.getItemDecorInsetsForChild(child);
            widthUsed += insets.left + insets.right;
            heightUsed += insets.top + insets.bottom;

            final int widthSpec = getChildMeasureSpec(getWidth(), getWidthMode(),
                    getPaddingLeft() + getPaddingRight() +
                            lp.leftMargin + lp.rightMargin + widthUsed, lp.width,
                    canScrollHorizontally());
            final int heightSpec = getChildMeasureSpec(getHeight(), getHeightMode(),
                    getPaddingTop() + getPaddingBottom() +
                            lp.topMargin + lp.bottomMargin + heightUsed, lp.height,
                    canScrollVertically());
            if (shouldMeasureChild(child, widthSpec, heightSpec, lp)) {
                child.measure(widthSpec, heightSpec);
            }
        }
```

通过源码可以发现 MeasureSpec 和canScrollVertically 有关，而项目中，因为有个加载动画，所以在 recyclerview 出现的时候，我强制设置了 canScrollVertically = false，导致了计算错误。

```java
 public static int getChildMeasureSpec(int parentSize, int parentMode, int padding,
                int childDimension, boolean canScroll) {
            int size = Math.max(0, parentSize - padding);
            int resultSize = 0;
            int resultMode = 0;
            if (canScroll) {
                if (childDimension >= 0) {
                    resultSize = childDimension;
                    resultMode = MeasureSpec.EXACTLY;
                } else if (childDimension == LayoutParams.MATCH_PARENT) {
                    switch (parentMode) {
                        case MeasureSpec.AT_MOST:
                        case MeasureSpec.EXACTLY:
                            resultSize = size;
                            resultMode = parentMode;
                            break;
                        case MeasureSpec.UNSPECIFIED:
                            resultSize = 0;
                            resultMode = MeasureSpec.UNSPECIFIED;
                            break;
                    }
                } else if (childDimension == LayoutParams.WRAP_CONTENT) {
                    resultSize = 0;
                    resultMode = MeasureSpec.UNSPECIFIED;
                }
            } else {
                if (childDimension >= 0) {
                    resultSize = childDimension;
                    resultMode = MeasureSpec.EXACTLY;
                } else if (childDimension == LayoutParams.MATCH_PARENT) {
                    resultSize = size;
                    resultMode = parentMode;
                } else if (childDimension == LayoutParams.WRAP_CONTENT) {
                    resultSize = size;
                    if (parentMode == MeasureSpec.AT_MOST || parentMode == MeasureSpec.EXACTLY) {
                        resultMode = MeasureSpec.AT_MOST;
                    } else {
                        resultMode = MeasureSpec.UNSPECIFIED;
                    }

                }
            }
            //noinspection WrongConstant
            return MeasureSpec.makeMeasureSpec(resultSize, resultMode);
        }
```

上面源码可以看到 canScroll = false，直接走进 else, 从而 resultSize = 父 View 的高度，就是这个 item 的高度就和 recyclerview 一样高，所以出现了 match_parent 的情况。

## 解决方法

因为有动画存在，不想让 recyclerview 滑动，所以我不能在这里做文章。  
只能重写 measureChildWithMargins，把 recyclerview 源码中的代码抽出来，然后 canScrollVertically 这个地方直接传入true。  
其他方法基本都是 public 的没什么问题，只有 shouldMeasureChild() 这个方法有一些问题，但是也可以将 mMeasurementCacheEnabled 设置为 true 即可。