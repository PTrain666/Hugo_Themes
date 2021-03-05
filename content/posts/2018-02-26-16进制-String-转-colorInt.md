---
layout: post
title:  "16进制 String 转 colorInt"
date: "2018-02-26"
author: "北邙山之光"
category: "Android"
catalog: true  
excerpt_separator: <!--more-->
tags: 
    - Android
---

## 正确的解决方法
Color 本身提供了 parseColor 方法
```java
    @ColorInt
    public static int parseColor(@Size(min=1) String colorString) {
        if (colorString.charAt(0) == '#') {
            // Use a long to avoid rollovers on #ffXXXXXX
            long color = Long.parseLong(colorString.substring(1), 16);
            if (colorString.length() == 7) {
                // Set the alpha value
                color |= 0x00000000ff000000;
            } else if (colorString.length() != 9) {
                throw new IllegalArgumentException("Unknown color");
            }
            return (int)color;
        } else {
            Integer color = sColorNameMap.get(colorString.toLowerCase(Locale.ROOT));
            if (color != null) {
                return color;
            }
        }
        throw new IllegalArgumentException("Unknown color");
    }
```
我们只要传入一个类似 #FFFFFF 这种字符串，这段代码会帮我们解析对应 Color 的 in t值

## 问题
之前没找到这个方法的时候，我的思路和这个程序的代码是相同的，区别在于它使用的是 Long.parseLong，而我使用的是 Integer.paseInt。  
确实，Integer.paseInt 正如它的注释所说会有问题，当我们传入类似 FFXXXXXX 时会出现问题。  
问题出现在第一个 bit 位上，java 中 parseInt 是不会支持无符号数的，FXXXXXXX 本身并没有越界  
<!--more-->
比如
```java
int a =0xFFFFFFFF
System.out.println(a);//完全正确
//此时a是-1，因为这是补码 假设只有8bit
//-1 10000001  反码 11111110  补码11111111
```

但是，parseInt 的时候如果不带负号，都当做了正数来处理，所以会出现越界的情况，抛出异常。    
所以只要传入的 String 第一个比特位是1，那么就完蛋了，最终肯定会越界。  
源码中正是使用了 Long 避免了这种情况。  

一开始实在不解，因为我传入了一个 FFFFFFFF的 颜色，按照 parseInt 解析报错了，最后看了代码之后才算是清楚了,我传入8个F,它并不会帮我解析成-1，而是一个越界了的正数。而 Color.parseColor用 Long 避开了这个问题。
