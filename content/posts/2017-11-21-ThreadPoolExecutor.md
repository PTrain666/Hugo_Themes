---
layout: post
title:  "ThreadPoolExecutor"
date: "2017-11-21"
author: "北邙山之光"
category: "Java"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Java
---



## 使用
一般我们都会根据相应的参数，创建一些相应特性的线程池

但是调用就是两个方法，execute 和 submit一个是不带返回值的一个带返回值。

<!--more-->
## execute 分析
```java
public void execute(Runnable command) {
        if (command == null)
            throw new NullPointerException();
        /*
         * Proceed in 3 steps:
         *
         * 1. If fewer than corePoolSize threads are running, try to
         * start a new thread with the given command as its first
         * task.  The call to addWorker atomically checks runState and
         * workerCount, and so prevents false alarms that would add
         * threads when it shouldn't, by returning false.
         *
         * 2. If a task can be successfully queued, then we still need
         * to double-check whether we should have added a thread
         * (because existing ones died since last checking) or that
         * the pool shut down since entry into this method. So we
         * recheck state and if necessary roll back the enqueuing if
         * stopped, or start a new thread if there are none.
         *
         * 3. If we cannot queue task, then we try to add a new
         * thread.  If it fails, we know we are shut down or saturated
         * and so reject the task.
         */
        int c = ctl.get();
        if (workerCountOf(c) < corePoolSize) {
            if (addWorker(command, true))
                return;
            c = ctl.get();
        }
        if (isRunning(c) && workQueue.offer(command)) {
            int recheck = ctl.get();
            if (! isRunning(recheck) && remove(command))
                reject(command);
            else if (workerCountOf(recheck) == 0)
                addWorker(null, false);
        }
        else if (!addWorker(command, false))
            reject(command);
    }
```

很清晰的说明，如果当前的线程数量小于设置的 corePoolSize，那么会调用 addWorker 方法创建一个线程，之后分析。

如果成功进入 queue,需要检测当前线程和线程池是否还存货，如果不在了，要 reject,如果发现 worker 是 0，则新启动一个线程。

如果没能加入进队列，那么创建一个线程，如果失败，那么就 reject。

### addWorker
```java
private boolean addWorker(Runnable firstTask, boolean core) {

        boolean workerStarted = false;
        boolean workerAdded = false;
        Worker w = null;
        try {
            w = new Worker(firstTask);
            final Thread t = w.thread;
            if (t != null) {
                final ReentrantLock mainLock = this.mainLock;
                mainLock.lock();
                try {
                    // Recheck while holding lock.
                    // Back out on ThreadFactory failure or if
                    // shut down before lock acquired.
                    int rs = runStateOf(ctl.get());

                    if (rs < SHUTDOWN ||
                        (rs == SHUTDOWN && firstTask == null)) {
                        if (t.isAlive()) // precheck that t is startable
                            throw new IllegalThreadStateException();
                        workers.add(w);
                        int s = workers.size();
                        if (s > largestPoolSize)
                            largestPoolSize = s;
                        workerAdded = true;
                    }
                } finally {
                    mainLock.unlock();
                }
                if (workerAdded) {
                    t.start();
                    workerStarted = true;
                }
            }
        } finally {
            if (! workerStarted)
                addWorkerFailed(w);
        }
        return workerStarted;
    }
```
省略了一段代码，是对于线程池状态和线程个数的一些要求，可能会直接 return false。

关键代码就是上面的，首先 new Worker(firstTask), worker 是一个 Runnable，继承 AbstractQueuedSynchronizer

```java
Worker(Runnable firstTask) {
           setState(-1); // inhibit interrupts until runWorker
           this.firstTask = firstTask;
           this.thread = getThreadFactory().newThread(this);
       }
```
下面的 Thread 来自 ThreadFactory 创建新的线程。

之后是一个加锁的步骤，重新检查线程池的状态，并且检查 worker 所在线程的状态，可能会有一些异常情况

如果一切正常，workers.add记 录一下，更新一下线程池中的线程个数

workerAdd=true成功

之后就执行了 t.start 就是 worker 所在线程的 start 方法，就是执行了 worker 的 run 方法

### Worker的run
run方法直接调用runWorker方法

```java
final void runWorker(Worker w) {
        Thread wt = Thread.currentThread();
        Runnable task = w.firstTask;
        w.firstTask = null;
        w.unlock(); // allow interrupts
        boolean completedAbruptly = true;
        try {
            while (task != null || (task = getTask()) != null) {
                w.lock();
                // If pool is stopping, ensure thread is interrupted;
                // if not, ensure thread is not interrupted.  This
                // requires a recheck in second case to deal with
                // shutdownNow race while clearing interrupt
                if ((runStateAtLeast(ctl.get(), STOP) ||
                     (Thread.interrupted() &&
                      runStateAtLeast(ctl.get(), STOP))) &&
                    !wt.isInterrupted())
                    wt.interrupt();
                try {
                    beforeExecute(wt, task);
                    Throwable thrown = null;
                    try {
                        task.run();
                    } catch (RuntimeException x) {
                        thrown = x; throw x;
                    } catch (Error x) {
                        thrown = x; throw x;
                    } catch (Throwable x) {
                        thrown = x; throw new Error(x);
                    } finally {
                        afterExecute(task, thrown);
                    }
                } finally {
                    task = null;
                    w.completedTasks++;
                    w.unlock();
                }
            }
            completedAbruptly = false;
        } finally {
            processWorkerExit(w, completedAbruptly);
        }
    }
```
只要有 task 就会执行到其 run 方法，并且在其所在的线程执行，最后的 finally 中的方法是对于 workers 回收的方法

### getTask方法
```java
private Runnable getTask() {
       boolean timedOut = false; // Did the last poll() time out?

       for (;;) {
           int c = ctl.get();
           int rs = runStateOf(c);

           // Check if queue empty only if necessary.
           if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
               decrementWorkerCount();
               return null;
           }

           int wc = workerCountOf(c);

           // Are workers subject to culling?
           boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;

           if ((wc > maximumPoolSize || (timed && timedOut))
               && (wc > 1 || workQueue.isEmpty())) {
               if (compareAndDecrementWorkerCount(c))
                   return null;
               continue;
           }

           try {
               Runnable r = timed ?
                   workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                   workQueue.take();
               if (r != null)
                   return r;
               timedOut = true;
           } catch (InterruptedException retry) {
               timedOut = false;
           }
       }
   }
```
其中就是通过阻塞队列去获取相应 task 而已

## 整个的流程梳理
就我目前来看，当我们创建一个线程池之初，并没有创建任何一个线程，而是当执行了 execute 方法之后，才开始创建 worker 线程

worker 本身并不是一个线程而是一个 Runnable，但是它持有一个 thread 的引用，这个 thread 由一个 threadfactory 产生

并且把自己作为参数传入 Thread 中，就是在 addworker 执行的时候，并且正常的话会执行到 t.start 就是 Worker 持有的线程的 start 方法，然后该线程会调用自己线程内部的 target 的 run 方法，也就是Runnable的run方法，也就是我们的worker的run方法。

我们的 Worker的 run方法执行的是一个不断从队列中获取 Runnable 的过程，所以当我们有各种 Runnable 通过 execute 方法传入的线程池的时候，都会被放入一个队列中，然后一旦我们创建了一个worker就不会让它歇着，执行完了一个 task 的 run 方法之后，会继续从队列中获取其他的来执行。

当然还有一部分是关于有 关Worker 回收的部分，以后补！

## 补充processWorkerExit
每次runWorker的finally中都会执行此方法

方法中的重要方法tryTerminate()

```java
final void tryTerminate() {
        for (;;) {
            int c = ctl.get();
            if (isRunning(c) ||
                runStateAtLeast(c, TIDYING) ||
                (runStateOf(c) == SHUTDOWN && ! workQueue.isEmpty()))
                return;
            if (workerCountOf(c) != 0) { // Eligible to terminate
                interruptIdleWorkers(ONLY_ONE);
                return;
            }

            final ReentrantLock mainLock = this.mainLock;
            mainLock.lock();
            try {



                if (ctl.compareAndSet(c, ctlOf(TIDYING, 0))) {
                    try {
                        terminated();
                    } finally {
                        ctl.set(ctlOf(TERMINATED, 0));
                        termination.signalAll();
                    }
                    return;
                }
            } finally {
                mainLock.unlock();
            }
            // else retry on failed CAS
        }

    }
```

这个方法里面有个 interruptIdleWorkers 方法，这里传入的是 ONLY_ONE 参数，一次只会关掉一个空 闲worker，这里就对于 Worker 进行了回收，其实就是中断了线程

后面的 terminated 方法，是提供的一个扩展方法，可以由我们自己重写。
