---
layout: post
title:  "Ubuntu 下安装 Nodejs"
date: "2017-10-16"
author: "北邙山之光"
category: "Linux & Adb Shell"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Linux & Adb Shell
---



通过百度查到了一些方式，我尝试了两种

首先，因为 Ubuntu16.04 默认安装了 nodejs 4.X 版本，npm 当然也被包含在内，那么可以使用 npm 安装 n 来更新

可是我使用的时候，实在是太慢，而且总是到30%左右就卡住不动了，于是放弃了这个方法

<!--more-->
## 安装方法
去官网下载最新的 nodejs 的压缩包，下载下来，并且解压到目录下，其实就已经安装完成了。

为了可以在全局使用 node 和 npm 命令，我们需要设置软链接。

打开压缩包，bin 目录下就会有 node 和 npm 这两个文件，使用命令

```shell
sudo ln -s /目录/bin/node /usr/local/bin/node
sudo ln -s /目录/bin/npm /usr/local/bin/npm
```
这样即可

## 存在问题
这样安装的话，当我想学习 react 的时候，安装了 create-react-app，但是我在 terminal 中却无法识别这个命令

只是在我们安装 Nodejs 的 bin 目录下多了个 create-react-app 命令，我就只好再设置了一个 create-react-app 的软链接，成功运行

## usr/local/bin 到底是干嘛的
这个目录下一般就是存放我们用户自己的一些程序和可执行的脚本

但是因为 linux 环境变量是包含这个目录的，所以我们将 nodejs 的一些可执行文件放在这个目录下，我们就可以在 terminal 中使用

## linux 下的环境变量
+ /etc/profile文件
  修改这个文件将对所有用户都生效
  export PATH="$PATH:/my_new_path"
  source /etc/profile 立刻生效


+ .bashrc 文件
  修改这个文件是对所在目录的用户生效，每个用户下都有一个这个文件，比如在我自己的目录 zzy 下编辑这个文件，那么在 terminal 中是 zzy 的话，那么就会找得到我们新增的环境变量。
  增加环境变量的命令和生效命令和第一个方法都相同
