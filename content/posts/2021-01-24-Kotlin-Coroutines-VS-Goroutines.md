---
layout: post
title:  "Kotlin Coroutines VS Goroutines"
date: "2021-01-24"
author: "北邙山之光"
category: "kotlin"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - kotlin
---

### 前言

最近一直在看 Kotlin 协程，因为以前也写过 Golang，所以试着去对比了一下，发现了很多好玩的事情。

### 一个 Kotlin 的小例子

试问下面一段代码，执行结果是什么呢？

```kotlin
fun main() = runBlocking {
    //创建自定义线程池
    val coroutineDispatcher = Executors.newFixedThreadPool(1).asCoroutineDispatcher()
    val name = Thread.currentThread().name
    println("main start thread-id = $name")
    for (i in 0..2) {
        launch(coroutineDispatcher) {
            while (true) {
                val j = i + 1
                val filename = "/Users/xxxx/Desktop/mapping$j.txt"
                val file = File(filename)
                val contents = file.readText()
                val name = Thread.currentThread().name
                println("thread-id = $name, do  work $i")
            }
        }
    }
    println("main end thread-id = $name")

}
```

这段代码不说 runBlocking 的情况下，启动了3个协程，且执行在一个单线程的线程池中且都是 `死循环`，在死循环中读取 mapping.txt(一个大概 30M 的文件)。

>我的机器是 Mac  
 kotlin 的版本号如下：  
 kotlinx-coroutines-core: 1.4.2  
 kotlin-stdlib: 1.4.0

结果如下：  

```text
main start thread-id = main
main end thread-id = main
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
thread-id = pool-1-thread-1, do  work 0
// 无限多···
```

可以看到，协程的载体是 `线程`，协程的代码逻辑可以理解为一个 `任务`，多线程多任务且没有特殊的阻塞任务(死循环等)的情况下，任务早晚是可以被执行的。  

但是这段逻辑是死循环，且是单线程，以致于 i = 0 时，创建的协程任务占用住了当前线程，第二个协程任务 `无法被执行`。

所以看得出，对于 Kotlin 的协程任务因为其是 `非抢占式` 的，是存在不被执行的情况的(协程被 `饿死了`)。

### 一个 Golang 的小例子

试问下面一段代码，执行结果是什么呢？

```go
package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"runtime"
	"syscall"
	"time"
)

func main() {
	runtime.GOMAXPROCS(1)
	for i := 0; i < 3; i++ {
		go func(j int) {
			for {
				file, err := os.Open(fmt.Sprint("/Users/xxxx/Desktop/mapping", (j + 1), ".txt"))
				if err != nil {
					panic(err)
				}
				defer file.Close()
				ioutil.ReadAll(file)
				tid := gettid()
				fmt.Printf("thread-id = %d, do work %d\n", tid, j)
			}
		}(i)
	}
	time.Sleep(1 * time.Second)
	fmt.Println("finish work")
}

func gettid() (n uint64) {
	r0, _, _ := syscall.RawSyscall(syscall.SYS_THREAD_SELFID, 0, 0, 0)
	n = uint64(r0)
	return n
}

```

这段代码也很简单，`runtime.GOMAXPROCS(1)` 设置了 P 只有一个，Golang 中的 `go` 关键字会启动一个`协程`，其余逻辑和 Kotlin 代码的逻辑基本一致，都是启动三个协程读3个文件，那结果跟是不是像 Kotlin 一样，`阻塞在第一个任务` 呢？

结果如下：

```text
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 0
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 1
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 2
thread-id = 2873233, do work 0
thread-id = 2873233, do work 0
thread-id = 2873233, do work 1
thread-id = 2873233, do work 1
finish work
```

是不是很神奇！结果 `不一致` 了！并没有因为死循环卡死在第一个任务上，且在1s后主线程结束、程序退出(因为代码里，主线程只是 sleep 了1s)。

这里就很神奇了，通过 `gettid()` 打印的线程 id 显示，这3个协程运行在了同一个线程之上，居然可以打破死循环···

#### gettid 的小插曲

因为电脑是 MacOSX，一开始使用 Golang 自己提供的 `syscall.Gettid()` 方法来获取 tid，结果发现报错：`undefined Gettid()`，似乎是 MacOSX 并没有实现这个方法，所以问了大哥得到了另一种方法

```go
func gettid() (n uint64) {
	r0, _, _ := syscall.RawSyscall(syscall.SYS_THREAD_SELFID, 0, 0, 0)
	n = uint64(r0)
	return n
}
```

### 疑问和总结

#### 总结

首先，确认了 Kotlin 的协程似乎并没有任务调度上的优化，只是在线程池中执行任务，存在协程饿死的情况。

其次，Golang 的协程存在一些神奇的优化，即使是死循环，任务也可以交替执行。

#### 疑问

一开始以为是我的 go 版本比较高，因为 `go1.14` 加入了抢占式调度，我以为是这个的原因。后来发现上面的例子在 `go1.13` 乃至 `go1.10` 表现都一致，所以这里的真实原因是什么呢？估计是 `netpoller` 的作用吧。