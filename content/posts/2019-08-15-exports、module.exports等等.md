---
layout: post
title:  "exports、module.exports等等"
date: "2019-08-15"
author: "北邙山之光"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - JavaScript
---

最近一直在用 weex 写工程，weex 使用 vue.js，我们每个项目一个工程，未免太乱，而且有很多重复代码。
不仅如此，我们不是专业前端，所以现在的凌乱的代码在前端眼里肯定是会鄙视的！

为此，我们做了很多工作，首先统一 lint，其次统一 vue 代码风格，这样至少我们的代码是一致的！
之后，我们重构了那些写的很挫的代码，用规范的前端方式去书写，还有 webpack 脚本的改造，这就遇到了各种 exports 的问题！

我就不装逼了,这篇文章讲的很清楚，将别人说的话再讲一遍也没啥意思，mark一下 

[exports、module.exports和export、export default到底是咋回事?](https://segmentfault.com/a/1190000010426778)

