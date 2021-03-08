---
layout: post
title:  "MMKV 和 mmap"
date: "2021-02-26"
author: "北邙山之光"
category: "Android"
excerpt_separator: <!--more-->
catalog: true  
resources:
- name: "featured-image"
  src: "mmap.png"
tags: 
    - Android
---

### 前言

最近看了点 MMKV 的代码，其核心就是通过 mmap 来读写文件。当然还有多进程、序列化、扩容重排 key等问题(这些随便找篇文章都有讲)。本文主要通过 mmap 实现简单的文件的读写。

具体包括 `mmap 函数的使用` 和 `如何扩展文件大小`

### mmap() 是什么

```c
#include <sys/mman.h>
void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
int munmap(void *addr, size_t length);
```

> `mmap()` creates a new mapping in the virtual address space of the
calling process.  The starting address for the new mapping is
specified in `addr`.  The `length` argument specifies the length of
the mapping (which must be greater than 0).
If `addr` is `NULL`, then the kernel chooses the (page-aligned)
address at which to create the mapping; this is the most portable
method of creating a new mapping.

还有一部分描述没有贴。

总之，作用就是 `内存映射`，参数 addr 为起始地址， length 为长度，还有一些 flags，`MAP_SHARED` 等等，prot 是映射区域的保护方式 `PROT_READ` 等等，offset 是文件映射的偏移量，offset 必须是一页内存大小的整数倍，否则 mmap 会调用失败，一般读文件使用的时候 offset 通常为 0，表示文件开头

### mmap() 的原理

[https://zhuanlan.zhihu.com/p/83398714 有比较详细的解释](https://zhuanlan.zhihu.com/p/83398714)

因为 Linux Kernel 层的东西不是很了解，比如 pageCache，比如 read/write 系统调用究竟如何完成的等等，所以就不 `人云亦云` 了，等哪天补齐了这部分知识，再来更新。

### 用 mmap 来读写文件

因为有看一些 MMKV 的代码，它首先会创建文件或者读取文件(如果文件已经存在的话)，大小均为 pageSize 的整数倍。

那么就会有一个问题，试想一下如下的情形：

首先创建文件，写入一个字节的数据，假设一页的大小是 4kb，那么这个大小 4kb 的文件其实只有 1byte 的实际内容。下次读取文件时，我们肯定是要从上一次写入的末尾追加写入的。

这就涉及到了如何存储之前内容的长度的问题，MMKV 采用了文件的前 4byte 用来记录文件内容的真实长度(32位机器下)。

所以本文中我也使用头 4byte 存储文件实际长度。

#### 代码示例

完整代码 [github](https://github.com/PTrain666/mmap_test)

其实就一个 c 文件~

主逻辑

```c
// open 打开或者创建文件
fd = open(fileName, O_RDWR | O_CREAT, 0777);
// 获取一页的内存大小
int pageSize = getpagesize();
// 如果需要，改变文件大小到 pageSize 整数倍
ftruncate(fd, mmapSize)
// mmap 映射
mmapPointer = (char *) mmap(NULL, mmapSize, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
// 获取真实的文件内容的长度到 offset
memcpy(&offset, mmapPointer, offsetSize);
// 写入数据到内存中(这里也包含扩容的过程)
memcpy(mmapPointer + offset + offsetSize, data, strlen(data));
// 更新 offset
memcpy(mmapPointer, &offset, offsetSize);
// 释放资源
munmap(mmapPointer, mmapSize);
close(fd);
```

首先我们打开一个文件获得文件描述符，然后通过 getpagesize 获得一个页的大小，然后使用 `ftruncate 改变文件大小`，之后通过 mmap 映射，mmapPointer 即是文件内容在内存的首地址。

> 如果 mmap 设置的 size 比本身文件内容要大，会有什么效果？  
  1.如果操作了 fileSize ~ mmapSize 之间的内存区域，会触发 SIGBUS  
  2.如果操作了 > mmapSize 之间的内存区域，会触发 SIGSEGV

考虑之前说的，前四个字节记录真实文件长度的问题，我们读取前四个字节，转成 int offset，那么 `mmapPointer + offset + 4` 就是我们文件的真实的内容在内存中的尾地址，然后使用 memcpy 修改这片内存区域的内容即可。

至于何时回写，因为使用的 mmap 的 flag 为 MAP_SHARED，操作系统会在合适的时机帮助我们回写到磁盘(详细查看 mmap 文档)。

#### Protobuf

通过上文对于文件的读写，我们可以将数据写入文件。但是，如果写入如 int 类型的值时，用 sizeof 取值的话肯定是4字节，但是如果这个 int 仅仅是 1，其实理论最低只要 1bit 就可以单纯的表示它的值是1。

所以 MMKV 使用了 protobuf。protobuf 有自己的编码，可以减少内存占用(不过如果都是字符串呢？)，编解码速度更快(好像也不一定？)。

### 总结

通过阅读了部分 MMKV 的代码，学到了如下知识：

1. 学会了基本的 mmap() 和 memcpy() 的使用
2. 了解了部分 mmap() 原理
3. 了解了一些 protobuf 相关的内容