---
layout: post
title:  "ActionBar"
date: "2018-04-19"
author: "北邙山之光"
category: "Android"
catalog: true  
excerpt_separator: <!--more-->
tags: 
    - Android
---

## getActionBar
如果我们继承的是 Activity，而不是 AppCompatActivity，我们可以在 Activity 中调用 getActionBar 来获取 ActionBar。

getActionBar 可能会是 null，取决于我们给 Activity 设置的 theme。
<!--more-->
### 小Tip
Activity 可以单独设置一个 theme（AndroidManifest文件中修改），以前没注意过这种很细的点。我们完全可以让一个应用中 Activity 的 theme 不同。
```xml
<activity
           android:name=".xxxxxxxxx"
           android:theme="@android:style/Theme.DeviceDefault.Light"/>
```
当然也可以自定义 theme，这就不说了

## getSupportActionBar
如果我们继承的是 AppCompatActivity，我们就需要调用 getSupportActionBar，想使用 getSupportActionBar(toolbar)是 5.0 以后的事情了~~

## ActionBar 的通用方法
不论如何，我们都可以通过，调用
```Java
actionBar.setDisplayHomeAsUpEnabled(true);
actionBar.setHomeButtonEnabled(true);
actionBar.setDisplayShowTitleEnabled(true);
actionBar.setTitle("XPanel Debug");
```
就会在 ActionBar 上展示出一个返回箭头，并且重写
```Java
public boolean onOptionsItemSelected(MenuItem item) {
       switch (item.getItemId()) {
           case android.R.id.home:
               finish();
               return true;
       }
       return super.onOptionsItemSelected(item);
   }
```
R.id.home 就是返回箭头在 android 系统中的 Id,我们可以自己设置一些事件，这里直接 finish 当前 Activity 了。


## windowNoTitle
windowNoTitle 和 windowActionBar 是什么关系呢？我真的没搞清楚···

如果 Theme 设置成了 appcompact 系列，那么 windowActionbar 一定是 true，如果是 false 抛异常！此时 windowNoTitle 属性操作的区间似乎是包括了 actionBar 区域，一起消失或者存在。

这里还有一个叫做 android:windowNoTitle 的属性，一旦为 false 出现一个 titleBar 和一个 actionBar。

完全被搞晕，这里代码没找到在哪里，只有看源码才知道了···
