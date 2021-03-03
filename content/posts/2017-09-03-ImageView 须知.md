---
layout: post
title:  "ImageView 须知"
date: "2017-09-03"
author: "北邙山之光"
category: "自定义View"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - 自定义View
---


ImageView 有很多神奇的地方，比如 background 和 src 的区别，还有 ScaleType 总是记不住，这里记一下。

 <!--more-->
## background和src的区别
+ background
  background 设置之后，会根据设置的长宽来拉伸或者压缩图片，从而覆盖整个 View 的区域
+ src
  src 与 background 不同，会保留原有的图片比例，并且 scaletype 属性可以对其进行调整。

  background 和 src 是可以同时使用的，很常见

## ScaleType
   + center
   图片显示在正中心位置，如果图片很大，超出区域则不显示。
   + center_crop
   按比例进行缩放图片，从而让图片的长或者宽达到了设置的长宽终的最大值
   即长和宽都大于等于我们设置的长和宽，视图是被填满的
   + center_inside
   按比例缩小图片或者就是原图。
   缩小的话，长和宽都要小于等于设置的长和宽。
   如果一个图片很大 1000 * 1000，而设置的大小是 200 * 300
   那么就会缩成 200 * 200
   + fit_XY
   不管比例，扩充至设置的 View 大小

还有几种不是很常用，忽略
