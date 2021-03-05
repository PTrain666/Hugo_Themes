---
layout: post
title:  "Handler Looper MQ 的几个问题"
date: "2021-03-04"
author: "北邙山之光"
category: "Android"
excerpt_separator: <!--more-->
catalog: true  
resources:
- name: "featured-image"
  src: "epoll.png"
tags: 
    - Android
---

## 前言

Handler、Looper、MessageQueue 是老生常谈的话题了，你可能会觉得没什么好讲的啊，网上文章也一堆。

这里我有几个问题问一下，如果你都很清晰，那就完全不需要看此文。

> 1.多个 Handler 可以往同一个 MQ 里发消息么？如果可以，多个 Handler 都会处理对应的消息么？为什么？

> 2.Looper 会 `单纯` 的因为取不到消息而导致死循环退出么？

> 3.~~Looper 是死循环，为什么主线程没有卡死~~(这个看 [https://www.zhihu.com/question/34652589](https://www.zhihu.com/question/34652589))

> 4.是接着问题2的一系列问题。看过 MQ.next() 方法么？看过 nativePollOnce() 的代码？如果看过会发现调用流程是： nativePollOnce() -> pollOnce() -> pollInner()。但是 pollOnce() 是个死循环，nativePollOnce() 怎么跳出去的？

> 5.Java 层和 Native 层的 MQ、Looper 有什么关系吗？有什么优先级么？

> 6.如果主线程处于休眠状态，点击屏幕的时候又是怎么被唤醒的？点击事件是通过什么机制传递过来的？(IMS)

## 问题解析

### Question 1

Handler 有众多传递事件的方法

诸如： sendMessage()、post() 等等

不过这些方法最终都汇聚于一个方法 enqueueMessage()

```java
private boolean enqueueMessage(MessageQueue queue, Message msg, long uptimeMillis) {
    // this 就是 Handler 对象
    msg.target = this;
    if (mAsynchronous) {
        msg.setAsynchronous(true);
    }
    return queue.enqueueMessage(msg, uptimeMillis);
}
```

Handler 的构造函数也有多个

```java
 public Handler(Looper looper, Callback callback, boolean async) {
    mLooper = looper;
    mQueue = looper.mQueue;
    mCallback = callback;
    mAsynchronous = async;
}
public Handler(Callback callback, boolean async) {
    // 省略
    mLooper = Looper.myLooper();
    if (mLooper == null) {
        throw new RuntimeException(
            "Can't create handler inside thread " + Thread.currentThread()
                    + " that has not called Looper.prepare()");
    }
    mQueue = mLooper.mQueue;
    mCallback = callback;
    mAsynchronous = async;
}

```

通过以上可知，Handler 初始化要么当前线程已经存在 Looper，要么自己绑定一个 Looper。

主线程的 Looper 在 AcitivityThread.main 方法(App 进程创建的时候)已经通过 Looper.prepareMainLooper() 创建完成了。

那么，当然是可以在主线程创建多个 Handler 绑定到同一个 Looper(MQ 与 Looper 相对应)的，这些 Handler.enqueueMessage() 方法均是往同一个 Looper 所对应的同一个 MQ 里发送消息。

但是可以看到 enqueueMessage() 时，每一个 Message 对象的 target 属性都被设置为了发送此消息的 Handler(见上方源码)，所以谁发的 Message 谁自己处理，这当然也是合情合理的。

>答：  
多个 Handler 可以往同一个 MQ 发消息，但是谁发的消息谁处理，因为 Message 保留了 Handler 对象的引用。(当然 Looper 其实也是通过取得 Message 之后，用 Message.target 回调到 Handler.handleMessage() 的)

### Question 2

Looper.loop() 众所周知是一个死循环，但是细看代码你会发现一些问题

loop() 方法部分源码如下：

```java
for (;;) {
    Message msg = queue.next(); // might block
    if (msg == null) {
        // No message indicates that the message queue is quitting.
        return;
    }
    // 省略
}
```

省略了很多代码，只看这个 queue.next() 方法，发现只要 msg == null 就 return 了，不就退出了？但是不会出现这种情况，后面说原因。

#### Looper.quit()

先看看 quit() 方法，其实它调用的是 MQ.quit() 方法，可以传一个 safe 参数判断是否管理剩余的消息。具体的代码如下：

```java
void quit(boolean safe) {
    if (!mQuitAllowed) {
        throw new IllegalStateException("Main thread not allowed to quit.");
    }

    synchronized (this) {
        if (mQuitting) {
            return;
        }
        mQuitting = true;

        if (safe) {
            removeAllFutureMessagesLocked();
        } else {
            removeAllMessagesLocked();
        }

        // We can assume mPtr != 0 because mQuitting was previously false.
        nativeWake(mPtr);
    }
}
```

通过源码会发现 mQuitAllowed 这个值，如果是 false, 就是不让 Looper 退出直接抛出异常，且这个参数是 Looper 初始化时传入的。

所以，其实即使我们想要 `主动` 调用 quit() 方法让 Looper 退出，也要看创建 Looper 时的 `mQuitAllowed` 参数。MainLooper 此处就是 false，所以没法调 quit 方法。

#### queue.next() 为什么不会是 null

先看代码：

```java
Message next() {
    final long ptr = mPtr;
    if (ptr == 0) {
        return null;
    }

    int pendingIdleHandlerCount = -1; // -1 only during first iteration
    int nextPollTimeoutMillis = 0;
    for (;;) {
        if (nextPollTimeoutMillis != 0) {
            Binder.flushPendingCommands();
        }

        nativePollOnce(ptr, nextPollTimeoutMillis);
    }
    // 省略
}
```

mPtr 如果为 0 自然返回 null，但是正常情况下这个不可能的，因为 mPtr 是 MQ 初始化时调用的 nativeInit 返回的一个 NativeMQ 指针。

后面的代码均包含在了 for 死循环中，且只会 return 实体 message，而 nativePollOnce 最终会调用到 epoll_wait() 而使得线程被挂起休眠，具体查看问题3。

所以除非有什么系统故障，否则 Looper 要么因为取不到消息而休眠，要么就返回一个非空消息。

> 答：  
除非有系统故障，否则不会 `单纯` 的因为取不到消息而导致死循环退出。这也合情合理，主 Looper 退出了，后续的事件又如何处理呢？

### Question 3

这个查看知乎链接即可。

[https://www.zhihu.com/question/34652589](https://www.zhihu.com/question/34652589))

首先是因为 epoll_wait() 的情况下，主线程只是被挂起，并不耗费 CPU。其次，如果有事件到来，也会通过 epoll 机制唤醒主线程。再其次，binder 线程池的存在使得可以从其所在线程通过 Handler 发送消息到主线程或者其他方式，最终能够唤醒主线程。

#### 如何唤醒的呢？

首先需要一个 `文件描述符(fd，Linux 一切皆文件)` 且支持 `poll` 操作。之后通过 epoll_ctl() 注册，epoll_wait() 等待事件到来。

#### 事件如何来？

往 fd 里写入数据等等，根据 epoll_ctl 注册的消息类型会进行相应的唤醒。

Looper 处理 Java 层 enqueueMessage 唤醒时，老版本使用了 pipe，新版本使用了 eventfd

### Question 4 & 5

MessageQueue.next() 方法 Question 2 已经看过了。

之后的 native 调用过程是 nativePollOnce() -> pollOnce() -> pollInner()

伪代码大概如下(源码太长自己去看)：

```cpp
// pollOnce
for (;;) {
        while (mResponseIndex < mResponses.size()) {
        const Response& response = mResponses.itemAt(mResponseIndex++);
        int ident = response.request.ident;
        if (ident >= 0) {
            // 省略
            return ident;
        }
    }

    if (result != 0) {
        // 省略
        return result;
    }

    result = pollInner(timeoutMillis);
}

// pollInner
int Looper::pollInner(int timeoutMillis) {
    // 省略
    struct epoll_event eventItems[EPOLL_MAX_EVENTS];
    int eventCount = epoll_wait(mEpollFd.get(), eventItems, EPOLL_MAX_EVENTS, timeoutMillis);
    for (int i = 0; i < eventCount; i++) {
        int fd = eventItems[i].data.fd;
        // 省略
        pushResponse(events, mRequests.valueAt(requestIndex));
    }
    // 省略
    for (size_t i = 0; i < mResponses.size(); i++) {
        Response& response = mResponses.editItemAt(i);
        if (response.request.ident == POLL_CALLBACK) {
            // 省略
            int callbackResult = response.request.callback->handleEvent(fd, events, data);
            if (callbackResult == 0) {
                removeFd(fd, response.request.seq);
            }
            // 省略
        }
    }
    return result;
}

```

可以看到，一进入 pollOnce() 就是一个死循环。但是，是有几个 return 条件的，result 的值通过 pollInner() 返回，pollInner() 才真正调用了 epoll_wait() 使得线程挂起。

当有事件来时，我们会首先读取监听的 event 事件(pushResponse)，之后在循环所有的事件进行处理，而且只要有对应的事件发生，result 的返回值总不会是 0。

result 有几种取值

```cpp
enum {
    /**
        * Result from Looper_pollOnce() and Looper_pollAll():
        * The poll was awoken using wake() before the timeout expired
        * and no callbacks were executed and no other file descriptors were ready.
        */
    POLL_WAKE = -1,

    /**
        * Result from Looper_pollOnce() and Looper_pollAll():
        * One or more callbacks were executed.
        */
    POLL_CALLBACK = -2,

    /**
        * Result from Looper_pollOnce() and Looper_pollAll():
        * The timeout expired.
        */
    POLL_TIMEOUT = -3,

    /**
        * Result from Looper_pollOnce() and Looper_pollAll():
        * An error occurred.
        */
    POLL_ERROR = -4,
};
```

所以，pollOnce() 的死循环 `不会退不出去`，也不会因此一直卡在 nativePollOnce() 方法中。当 pollOnce() 和 nativePollOnce() 返回以后，Java 层的 MQ.next() 方法继续执行，才取到了 MQ.java 中的 Message，进行后续的调用。

> 答：  
pollOnce() 不会一直跳不出，只要有事件到来，都能跳出死循环。同时，Java 层和 Native 层的同样的一套机制可以互相引用，但是，是完全的两套东西，包括 MQ 也是各自管理各自的。但是 Native 的优先级更高，因为处理完了 Native 的事件以后，才开始处理 Java 层的事件。

### Question 6

看过 InputManagerService 都知道，输入事件的传递是依赖 socket 通信的。那么它又是怎么唤醒主线程的呢？

在 Native 层的 Looper 中有 addFd() 方法，socket 同样是一个 fd，Looper.addFd() 通过 epoll_ctl 注册 socket 监听。

当有输入事件需要传递时，只需要往 socket 中写入数据，就可以唤醒主线程。

依然是会回到 pollInner() 相关的代码

`response.request.callback->handleEvent(fd, events, data)`

这里其实已经开始到了主线程相关的事件分发部分，并且通过 Native 层直接调用 Java 层代码的方式调了回去，直到 ViewRootImpl.deliverInputEvent()

详见：
[http://gityuan.com/2016/12/31/input-ipc/](http://gityuan.com/2016/12/31/input-ipc/)

> 答：同样是通过 epoll 机制唤醒

## Worker Pool

其实无论是 Android 还是其他的事件驱动的模型，原理都相似，下文就是介绍一个 Worker Pool 的设计。

其实，我们的主线程可以看做是一个消费者，不断消费各种事件，而各种其他的线程(Android 中，如 InputManagerService 等等系统服务)都可以看做是生产者，不断的产生事件通知，交给主线程处理，从而让整个程序得以运转。

[https://www.yangyang.cloud/blog/2018/11/09/worker-pool-with-eventfd/](https://www.yangyang.cloud/blog/2018/11/09/worker-pool-with-eventfd/)
## 总结

其实了解这些对于实际开发作用并不大，而且整个过程依然有很多细节没有深究。

但是，对于原理和模型的了解是十分必要的，了解了这些才能举一反三。

## 引用
[https://www.yangyang.cloud/blog/2018/11/09/worker-pool-with-eventfd/](https://www.yangyang.cloud/blog/2018/11/09/worker-pool-with-eventfd/)