---
layout: post
title:  "beginDelayedTransition 的一些源码分析"
date: "2017-08-29"
author: "北邙山之光"
category: "Android动画"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android动画
---


Transition 动画很多时候效果都十分好，但是我苦于只会使用别人写好的一些例子，而实际使用的时候各种 bug 不知道怎么解决。

就在写了这篇文章后还是有很多不理解，比如使用 RecyclerView 的时候有时候在返回的时候突然就 crash 掉了

之前看到了一个 GitHub 上的一个开源库 [DropDownView](https://github.com/AnthonyFermin/DropDownView)

他就使用了 beginDelayedTransition 这个方法实现了一个 dropdown 的效果，所以就学习下相关的知识，也希望可以完全吸收他的控件代码！


 <!--more-->


## TransitonManager.beginDelayedTransition分析

 ```java
 public static void beginDelayedTransition(final ViewGroup sceneRoot, Transition transition) {
        //sceneRoot已经被layout而且之前没有被加入到transition中，这里面记录了所有的要做transition的布局
        if (!sPendingTransitions.contains(sceneRoot) && sceneRoot.isLaidOut()) {
            if (Transition.DBG) {
                Log.d(LOG_TAG, "beginDelayedTransition: root, transition = " +
                        sceneRoot + ", " + transition);
            }
            //加入这个list中,private static ArrayList<ViewGroup> sPendingTransitions = new ArrayList<ViewGroup>();
            sPendingTransitions.add(sceneRoot);
            if (transition == null) {
              //没有特定设置transition,就是一个默认实现的, private static Transition sDefaultTransition = new AutoTransition();
                transition = sDefaultTransition;
            }
            final Transition transitionClone = transition.clone();
            //见1
            sceneChangeSetup(sceneRoot, transitionClone);
            //见2
            Scene.setCurrentScene(sceneRoot, null);
            //见3
            sceneChangeRunTransition(sceneRoot, transitionClone);
        }
    }
 ```

## 1-sceneChangeSetup方法
  ```java
  private static void sceneChangeSetup(ViewGroup sceneRoot, Transition transition) {

      // Capture current values
      //这句我看就是拿到现在这个sceneRoot正在进行的transition动画，有的话就pause了，没有就加入到一个叫做sRunningTranstions的ArrayMap里面,它记录了正在运行的Transitions
      ArrayList<Transition> runningTransitions = getRunningTransitions().get(sceneRoot);

      if (runningTransitions != null && runningTransitions.size() > 0) {
          for (Transition runningTransition : runningTransitions) {
              runningTransition.pause(sceneRoot);
          }
      }
      //如果传进来的transition不是null，而是我们人为设置的transition
      if (transition != null) {
        //计算transition动画所需要的值
        //见1.1
          transition.captureValues(sceneRoot, true);
      }

      // Notify previous scene that it is being exited
      Scene previousScene = Scene.getCurrentScene(sceneRoot);
      if (previousScene != null) {
          previousScene.exit();
      }
  }
  ```

### 1.1-transition.captureValues源码
  ```java
    //代码很长省略了很多
    void captureValues(ViewGroup sceneRoot, boolean start) {
      //根据这个start值是true还是false清空相应的Values值,这些Values值究竟是干什么的，见1.3
      clearValues(start);
      //这里mTargetIds是要通过addTarget才有的值，源码注释如下，mTargetNames和各种mTargetXX同理，主要是用于单独的view的一些操作
      /**
    * Adds the id of a target view that this Transition is interested in
    * animating. By default, there are no targetIds, and a Transition will
    * listen for changes on every view in the hierarchy below the sceneRoot
    * of the Scene being transitioned into. Setting targetIds constrains
    * the Transition to only listen for, and act on, views with these IDs.
    * Views with different IDs, or no IDs whatsoever, will be ignored.
    *
    * <p>Note that using ids to specify targets implies that ids should be unique
    * within the view hierarchy underneath the scene root.</p>
    *
    * @see View#getId()
    * @param targetId The id of a target view, must be a positive number.
    * @return The Transition to which the targetId is added.
    * Returning the same object makes it easier to chain calls during
    * construction, such as
    * <code>transitionSet.addTransitions(new Fade()).addTarget(someId);</code>
    */
      if ((mTargetIds.size() > 0 || mTargets.size() > 0)
              && (mTargetNames == null || mTargetNames.isEmpty())
              && (mTargetTypes == null || mTargetTypes.isEmpty())) {
              //省略若干
              //代码是处理一些指定view的处理，默认是走不到这里面的
      } else {
          //贼重要开始全靠他来遍历sceneRoot来计算需要的Values，见1.2
          captureHierarchy(sceneRoot, start);
      }

      if (!start && mNameOverrides != null) {
          //省略若干
      }
    }
  ```

### 1.2-captureHierarchy源码
  ```java
    private void captureHierarchy(View view, boolean start) {
        if (view == null) {
            return;
        }
        int id = view.getId();
        if (mTargetIdExcludes != null && mTargetIdExcludes.contains(id)) {
            return;
        }
        if (mTargetExcludes != null && mTargetExcludes.contains(view)) {
            return;
        }
        if (mTargetTypeExcludes != null && view != null) {
            int numTypes = mTargetTypeExcludes.size();
            for (int i = 0; i < numTypes; ++i) {
                if (mTargetTypeExcludes.get(i).isInstance(view)) {
                    return;
                }
            }
        }
        //这里开始计算值
        if (view.getParent() instanceof ViewGroup) {
            //这就是Values类很重要，同见1.3
            TransitionValues values = new TransitionValues();
            values.view = view;
            //根据start判断是开始动画的场景要计算的值还是结束时的值
            if (start) {
                //这个方法和captureEndValues基本一致
                //这个方法是抽象方法，根据我们传入的transition的类别而各有实现
                //比如Fade就有相应的方法，主要就是放入TransitionValues中的values这个ArrayMap中
                captureStartValues(values);
            } else {
                captureEndValues(values);
            }
            //也是加入到values的一个属性中，这个targetedTransitions是个list，记录了这个view的所有transiton
            values.targetedTransitions.add(this);
            // 这个东西也是计算值用的，内部调用了TransitionPropagation的captureValues方法，这个方法也是抽象方法
            //比如Explode这个场景动画就用到了这个类的一个实现类VisibilityPropagation的子类CircularPropagation
            //实现了一种时差的效果
            capturePropagationValues(values);
            if (start) {
                //整合Values到map中
                addViewValues(mStartValues, view, values);
            } else {
                addViewValues(mEndValues, view, values);
            }
        }
        if (view instanceof ViewGroup) {
            // Don't traverse child hierarchy if there are any child-excludes on this view
            if (mTargetIdChildExcludes != null && mTargetIdChildExcludes.contains(id)) {
                return;
            }
            if (mTargetChildExcludes != null && mTargetChildExcludes.contains(view)) {
                return;
            }
            if (mTargetTypeChildExcludes != null) {
                int numTypes = mTargetTypeChildExcludes.size();
                for (int i = 0; i < numTypes; ++i) {
                    if (mTargetTypeChildExcludes.get(i).isInstance(view)) {
                        return;
                    }
                }
            }
            //如果是ViewGroup就会遍历子View
            ViewGroup parent = (ViewGroup) view;
            for (int i = 0; i < parent.getChildCount(); ++i) {
                captureHierarchy(parent.getChildAt(i), start);
            }
        }
    }
  ```

### 1.3-TransitionValues和TransitionValuesMaps源码
  + TransitionValues

  ```java
  /**
    * The View with these values   在captureHierarchy中就赋值了
    */
   public View view;

   /**
    * The set of values tracked by transitions for this scene 通过captureStartValues或者endvalues算出
    */
   public final Map<String, Object> values = new ArrayMap<String, Object>();

   /**
    * The Transitions that targeted this view. 这个就是View的所有被设置的transiton动画
    */
   final ArrayList<Transition> targetedTransitions = new ArrayList<Transition>();
  ```


  + TransitionValuesMaps

  ```java
  class TransitionValuesMaps {
    ArrayMap<View, TransitionValues> viewValues =
            new ArrayMap<View, TransitionValues>();
    SparseArray<View> idValues = new SparseArray<View>();
    LongSparseArray<View> itemIdValues = new LongSparseArray<View>();
    ArrayMap<String, View> nameValues = new ArrayMap<String, View>();
}
  ```

## 2-Scene.setCurrentScene(sceneRoot, null)
  ```java
    //就是保存了Scence吧
   view.setTagInternal(com.android.internal.R.id.current_scene, scene);
  ```

  ```java
  public void setTagInternal(int key, Object tag) {
       if ((key >>> 24) != 0x1) {
           throw new IllegalArgumentException("The key must be a framework-specific "
                   + "resource id.");
       }

       setKeyedTag(key, tag);
   }
  ```
## 3-sceneChangeRunTransition方法
  ```java
  private static void sceneChangeRunTransition(final ViewGroup sceneRoot,
         final Transition transition) {
     if (transition != null && sceneRoot != null) {
       /**
        * 创建了MultiListener，这个listener实现了OnPreDrawListener，之后也被sceneRoot绑定在了一起
        * 那么当sceneRoot将要被绘制的时候，会先调用到MultiListener中去，MultiListener中的OnPreDraw方法很长见3.1
        */
         MultiListener listener = new MultiListener(transition, sceneRoot);
         sceneRoot.addOnAttachStateChangeListener(listener);
         sceneRoot.getViewTreeObserver().addOnPreDrawListener(listener);
     }
 }
  ```

### 3.1-MultiListener的OnPreDraw
  ```java
  public boolean onPreDraw() {
          removeListeners();

          // Don't start the transition if it's no longer pending.
          //就是判断还在不再等待序列里面，不在就直接返回了，在的话就删除因为要执行这个transtion了
          if (!sPendingTransitions.remove(mSceneRoot)) {
              return true;
          }

          // Add to running list, handle end to remove it
          //如注释所说
          final ArrayMap<ViewGroup, ArrayList<Transition>> runningTransitions =
                  getRunningTransitions();
          ArrayList<Transition> currentTransitions = runningTransitions.get(mSceneRoot);
          ArrayList<Transition> previousRunningTransitions = null;
          if (currentTransitions == null) {
              currentTransitions = new ArrayList<Transition>();
              runningTransitions.put(mSceneRoot, currentTransitions);
          } else if (currentTransitions.size() > 0) {
              previousRunningTransitions = new ArrayList<Transition>(currentTransitions);
          }
          currentTransitions.add(mTransition);
          mTransition.addListener(new Transition.TransitionListenerAdapter() {
              @Override
              public void onTransitionEnd(Transition transition) {
                  ArrayList<Transition> currentTransitions =
                          runningTransitions.get(mSceneRoot);
                  currentTransitions.remove(transition);
              }
          });
          //这里注意到是false了，计算了一些结束时scene的值
          mTransition.captureValues(mSceneRoot, false);
          if (previousRunningTransitions != null) {
              for (Transition runningTransition : previousRunningTransitions) {
                  runningTransition.resume(mSceneRoot);
              }
          }
          //真正构建动画见3.2
          mTransition.playTransition(mSceneRoot);

          return true;
      }
  ```

### 3.2-mTransition.playTransition源码
  ```java
  void playTransition(ViewGroup sceneRoot) {
       mStartValuesList = new ArrayList<TransitionValues>();
       mEndValuesList = new ArrayList<TransitionValues>();
       //这里是将这两个List通过之前存在TransitionValuesMaps中的值来赋值
       //然后根据instance、name、id、itemid来判断是否是一组开始和结束的值,是就加入相应List中并且从Map中删除
       //那么生下来的都是不匹配的，我看到源代码中最后还是会调用addUnmatched(unmatchedStart, unmatchedEnd)，然后还是把这些没match的也加入了相应的list中去了
       matchStartAndEnd(mStartValues, mEndValues);

       ArrayMap<Animator, AnimationInfo> runningAnimators = getRunningAnimators();
       int numOldAnims = runningAnimators.size();
       WindowId windowId = sceneRoot.getWindowId();
       for (int i = numOldAnims - 1; i >= 0; i--) {
           Animator anim = runningAnimators.keyAt(i);
           if (anim != null) {
               AnimationInfo oldInfo = runningAnimators.get(anim);
               if (oldInfo != null && oldInfo.view != null && oldInfo.windowId == windowId) {
                   TransitionValues oldValues = oldInfo.values;
                   View oldView = oldInfo.view;
                   TransitionValues startValues = getTransitionValues(oldView, true);
                   TransitionValues endValues = getMatchedTransitionValues(oldView, true);
                   if (startValues == null && endValues == null) {
                       endValues = mEndValues.viewValues.get(oldView);
                   }
                   boolean cancel = (startValues != null || endValues != null) &&
                           oldInfo.transition.isTransitionRequired(oldValues, endValues);
                   if (cancel) {
                       if (anim.isRunning() || anim.isStarted()) {
                           if (DBG) {
                               Log.d(LOG_TAG, "Canceling anim " + anim);
                           }
                           anim.cancel();
                       } else {
                           if (DBG) {
                               Log.d(LOG_TAG, "removing anim from info list: " + anim);
                           }
                           runningAnimators.remove(anim);
                       }
                   }
               }
           }
       }

       //创建动画mStartValues和mEndValues还是之前的那个TransitionValuesMaps，mStartValuesList和mEndValuesList是刚刚求得的
       //见3.3
       createAnimators(sceneRoot, mStartValues, mEndValues, mStartValuesList, mEndValuesList);
       //见3.4
       runAnimators();
   }
  ```

### 3.3-crateAnimators
  ```java
  protected void createAnimators(ViewGroup sceneRoot, TransitionValuesMaps startValues,
            TransitionValuesMaps endValues, ArrayList<TransitionValues> startValuesList,
            ArrayList<TransitionValues> endValuesList) {
        if (DBG) {
            Log.d(LOG_TAG, "createAnimators() for " + this);
        }
        ArrayMap<Animator, AnimationInfo> runningAnimators = getRunningAnimators();
        long minStartDelay = Long.MAX_VALUE;
        int minAnimator = mAnimators.size();
        SparseLongArray startDelays = new SparseLongArray();
        int startValuesListCount = startValuesList.size();
        for (int i = 0; i < startValuesListCount; ++i) {
            TransitionValues start = startValuesList.get(i);
            TransitionValues end = endValuesList.get(i);

            //省略了一些无关紧要的代码，根据start和end值判断isChanged
            if (isChanged) {
                //省略了一些代码
                // TODO: what to do about targetIds and itemIds?
                //createAnimator默认是一个空实现return null
                //我们去一个场景的transition动画Fade中去查找，发现也没有这个方法
                //去寻找Fade的弗雷Visibility发现了它重写了createAnimator的方法，然后其中返回的是一个onAppear的Animator，这个Animator是Fade自己重写了Visivbility的
                //ObjectAnimator anim = ObjectAnimator.ofFloat(view, "transitionAlpha", endAlpha);就是这个，最后返回的也是这个
                Animator animator = createAnimator(sceneRoot, start, end);
                if (animator != null) {
                    // Save animation info for future cancellation purposes
                    //如注释所说，是把这些信息都存在了runningAnimators里面了
                    View view = null;
                    TransitionValues infoValues = null;
                    if (end != null) {
                        view = end.view;
                        //根据不同类会有实现，就是属性值的Name数组，比如Fade就会有PROPNAME_VISIBILITY,PROPNAME_PARENT两个
                        String[] properties = getTransitionProperties();
                        if (view != null && properties != null && properties.length > 0) {
                            infoValues = new TransitionValues();
                            infoValues.view = view;
                            TransitionValues newValues = endValues.viewValues.get(view);
                            //把值取出来给infoValues
                            if (newValues != null) {
                                for (int j = 0; j < properties.length; ++j) {
                                    infoValues.values.put(properties[j],
                                            newValues.values.get(properties[j]));
                                }
                            }
                            int numExistingAnims = runningAnimators.size();
                            for (int j = 0; j < numExistingAnims; ++j) {
                                Animator anim = runningAnimators.keyAt(j);
                                AnimationInfo info = runningAnimators.get(anim);
                                if (info.values != null && info.view == view &&
                                        ((info.name == null && getName() == null) ||
                                                info.name.equals(getName()))) {
                                    if (info.values.equals(infoValues)) {
                                        // Favor the old animator
                                        //通过比对values发现都是一样的
                                        //如注释所说，支持了旧的animator，我们create出来的变成了null
                                        animator = null;
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        view = (start != null) ? start.view : null;
                    }
                    if (animator != null) {
                        //animator不是null,Propagation用于计算delay
                        if (mPropagation != null) {
                            long delay = mPropagation
                                    .getStartDelay(sceneRoot, this, start, end);
                            startDelays.put(mAnimators.size(), delay);
                            minStartDelay = Math.min(delay, minStartDelay);
                        }
                        AnimationInfo info = new AnimationInfo(view, getName(), this,
                                sceneRoot.getWindowId(), infoValues);
                        runningAnimators.put(animator, info);
                        //加入到mAnimators中一个List,保存Animator用
                        mAnimators.add(animator);
                    }
                }
            }
        }
        if (startDelays.size() != 0) {
          //之前计算过的startDelays现在可以发挥作用了···
            for (int i = 0; i < startDelays.size(); i++) {
                int index = startDelays.keyAt(i);
                Animator animator = mAnimators.get(index);
                long delay = startDelays.valueAt(i) - minStartDelay + animator.getStartDelay();
                animator.setStartDelay(delay);
            }
        }
    }
  ```

### 3.4-runAnimators
  ```java
  protected void start() {
          if (mNumInstances == 0) {
              if (mListeners != null && mListeners.size() > 0) {
                  ArrayList<TransitionListener> tmpListeners =
                          (ArrayList<TransitionListener>) mListeners.clone();
                  int numListeners = tmpListeners.size();
                  for (int i = 0; i < numListeners; ++i) {
                      tmpListeners.get(i).onTransitionStart(this);
                  }
              }
              mEnded = false;
          }
          mNumInstances++;
      }


  protected void runAnimators() {
        if (DBG) {
            Log.d(LOG_TAG, "runAnimators() on " + this);
        }
        //主要是复制了listener的信息，并且执行了onstart回调，这要看这个transition所add的listener有没有实现这个方法了
        start();
        ArrayMap<Animator, AnimationInfo> runningAnimators = getRunningAnimators();
        // Now start every Animator that was previously created for this transition
        //如注释所说
        for (Animator anim : mAnimators) {
            if (DBG) {
                Log.d(LOG_TAG, "  anim: " + anim);
            }
            if (runningAnimators.containsKey(anim)) {
                //这里为啥又调用了一次start
                start();
                //里面真正开始调用了animator的start方法
                runAnimator(anim, runningAnimators);
            }
        }
        mAnimators.clear();
        end();
    }
  ```


## 总结
  算是跟着源码走了一遭···最后的时候为什么要 start() 两次？这里第一次就是回调 onTransitionStart，其余就是 mNumInstances 的自增

  这个值也只和 end 方法的调用有关，感觉难道是因为可能有各种原因会让 onTransitionEnd 没调用？不是很懂···

  让我自己写一个自定义 transition 还是难度太高了···等我写一个出来也许就了解了···

## 借鉴

[Android Transition Framework 源码分析](http://blog.csdn.net/zwlove5280/article/details/75570864)

[安卓Transition框架](http://icedcap.github.io/2016/06/26/%E5%AE%89%E5%8D%93Transition%E6%A1%86%E6%9E%B6/)
