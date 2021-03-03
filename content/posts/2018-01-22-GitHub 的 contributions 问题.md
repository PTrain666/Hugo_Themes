---
layout: post
title:  "GitHub 的 contributions 问题"
date: "2018-01-22"
author: "北邙山之光"
catalog: true  
category: "各种坑"
excerpt_separator: <!--more-->
tags: 
    - 各种坑
---

添加网页统计的时候才注意到一个神奇的事情：  
我不断修改并且提交自己的博客代码，博客成功更新，但是 GitHub 得 contributions 图却没有更新！  
我这强迫症果断受不了，而且这个图一定程度上给我一种自我安慰···如果它一直是空的而不是绿色的，我会很难受···

<!--more-->
## 原因
在搜索了一番之后，发现我们提交 git 的邮箱配置需要是在我们 GitHub 账户上存在的

而不知道什么情况，可能是我第一次提交的时候输入了账号和密码，可是邮箱却配置的是一个 xxxxx@github.com  

我也记不得自己是什么时候配置的了，而且这个邮箱也能提交成功

这意思是，只要之前通过 https 方式填写密码成功了之后，后面就可以随便提交了？不是很懂这个

## 解决
虽然不是很懂那个邮箱的问题，但是也懒得管了

修正这个问题很简单

1. 通过 git log 查看下 commit 时的邮箱是多少
2. 和自己 GitHub 上 settings 下的 account 里面的邮箱比对
3. 一致就会记录你的 contribution，不一致就不记录
4. 不一致，可以修改 git 的 config 里面的 user.email，这样就好啦！
