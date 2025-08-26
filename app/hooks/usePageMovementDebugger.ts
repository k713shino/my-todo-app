'use client'

import { useEffect } from 'react'

/**
 * ページの動きを詳細に監視するデバッグフック
 * リロード、スクロール、フォーカス変更、DOM操作を検出
 */
export function usePageMovementDebugger() {
  useEffect(() => {
    console.log('🔍 ページ移動デバッガー開始')
    
    // 1. ページリロード検出
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('🔄 RELOAD DETECTED: ページがリロードされようとしています')
      console.trace('リロード発生箇所')
    }
    
    // 2. スクロール位置変更検出
    let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop
    let lastScrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    
    const handleScroll = () => {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop
      const currentScrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      
      if (currentScrollTop !== lastScrollTop || currentScrollLeft !== lastScrollLeft) {
        console.log('📜 SCROLL DETECTED:', {
          from: { top: lastScrollTop, left: lastScrollLeft },
          to: { top: currentScrollTop, left: currentScrollLeft },
          timestamp: new Date().toISOString()
        })
        console.trace('スクロール発生箇所')
        
        lastScrollTop = currentScrollTop
        lastScrollLeft = currentScrollLeft
      }
    }
    
    // 3. フォーカス変更検出
    const handleFocusIn = (e: FocusEvent) => {
      console.log('🎯 FOCUS IN:', {
        target: e.target,
        tagName: (e.target as HTMLElement)?.tagName,
        id: (e.target as HTMLElement)?.id,
        className: (e.target as HTMLElement)?.className
      })
    }
    
    const handleFocusOut = (e: FocusEvent) => {
      console.log('🎯 FOCUS OUT:', {
        target: e.target,
        tagName: (e.target as HTMLElement)?.tagName,
        id: (e.target as HTMLElement)?.id,
        className: (e.target as HTMLElement)?.className
      })
    }
    
    // 4. DOM変更検出
    const domObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          console.log('🔧 DOM CHANGE DETECTED:', {
            type: mutation.type,
            addedNodes: mutation.addedNodes.length,
            target: mutation.target,
            timestamp: new Date().toISOString()
          })
        }
      })
    })
    
    // 5. 履歴変更検出（SPA ナビゲーション）
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      console.log('🧭 NAVIGATION - pushState:', args)
      console.trace('pushState発生箇所')
      return originalPushState.apply(this, args)
    }
    
    history.replaceState = function(...args) {
      console.log('🧭 NAVIGATION - replaceState:', args)
      console.trace('replaceState発生箇所')
      return originalReplaceState.apply(this, args)
    }
    
    const handlePopState = (e: PopStateEvent) => {
      console.log('🧭 NAVIGATION - popState:', e.state)
    }
    
    // 6. 入力フィールド関連イベント
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.type === 'text' || target.tagName === 'TEXTAREA') {
        console.log('⌨️ INPUT EVENT:', {
          tagName: target.tagName,
          type: target.type,
          value: target.value,
          id: target.id,
          className: target.className,
          scrollBefore: {
            top: window.pageYOffset || document.documentElement.scrollTop,
            left: window.pageXOffset || document.documentElement.scrollLeft
          }
        })
        
        // 入力後の状態も監視
        setTimeout(() => {
          console.log('⌨️ INPUT AFTER:', {
            scrollAfter: {
              top: window.pageYOffset || document.documentElement.scrollTop,
              left: window.pageXOffset || document.documentElement.scrollLeft
            }
          })
        }, 0)
      }
    }
    
    // イベントリスナーを追加
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('input', handleInput, { capture: true })
    
    // DOM監視開始
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    })
    
    // クリーンアップ
    return () => {
      console.log('🔍 ページ移動デバッガー終了')
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('input', handleInput)
      domObserver.disconnect()
      
      // history関数を復元
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [])
}