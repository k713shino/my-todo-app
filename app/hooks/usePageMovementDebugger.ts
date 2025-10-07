'use client'

import { useEffect } from 'react'

/**
 * ページの動きを詳細に監視するデバッグフック
 * リロード、スクロール、フォーカス変更、DOM操作を検出
 */
export function usePageMovementDebugger() {
  useEffect(() => {
    // 開発環境でのみデバッグ機能を有効化
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    console.log('🔍 ページ移動デバッガー開始')
    
    // 1. ページリロード検出
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('🔄 RELOAD DETECTED: ページがリロードされようとしています')
      console.trace('リロード発生箇所')
    }
    
    // 2. スクロール位置変更検出（debounce付き）
    let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop
    let lastScrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    let scrollLogTimer: NodeJS.Timeout | null = null
    
    const handleScroll = () => {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop
      const currentScrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      
      if (currentScrollTop !== lastScrollTop || currentScrollLeft !== lastScrollLeft) {
        // スクロールログのdebounce（連続スクロール時は最後のみログ）
        if (scrollLogTimer) clearTimeout(scrollLogTimer)
        
        const fromTop = lastScrollTop
        const fromLeft = lastScrollLeft
        
        scrollLogTimer = setTimeout(() => {
          console.log('📜 SCROLL DETECTED:', {
            from: { top: fromTop, left: fromLeft },
            to: { top: currentScrollTop, left: currentScrollLeft },
            distance: Math.abs(currentScrollTop - fromTop),
            timestamp: new Date().toISOString()
          })
        }, 200) // 200ms後にログ出力
        
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
    
    // 4. DOM変更検出（重要な変更のみ）
    const domObserver = new MutationObserver((mutations) => {
      // DOM変更の頻度を制限
      const now = Date.now()
      if (now - (domObserver as any).lastLogTime < 1000) return // 1秒以内は無視
      (domObserver as any).lastLogTime = now

      const significantChanges = mutations.filter(mutation =>
        mutation.type === 'childList' &&
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false
          const element = node as Element
          // SVG要素やその他の特殊要素に対応するため、getAttributeを使用
          const classNames = element.getAttribute('class') || ''
          return !classNames.includes('toast') // トースト通知は除外
        })
      )
      
      if (significantChanges.length > 0) {
        console.log('🔧 DOM CHANGE DETECTED:', {
          type: 'significant_changes',
          count: significantChanges.length,
          timestamp: new Date().toISOString()
        })
      }
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
    
    // 6. 入力フィールド関連イベント（検索フォームは除外）
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      
      // 検索フォームの入力は除外（パフォーマンス最適化）
      if (target.placeholder?.includes('検索') || target.placeholder?.includes('キーワード')) {
        return
      }
      
      if (target.type === 'text' || target.tagName === 'TEXTAREA') {
        // 入力イベントのログ頻度を制限（デバウンス）
        const now = Date.now()
        const lastInputTime = (target as any).lastDebugTime || 0
        
        if (now - lastInputTime < 500) { // 500ms以内の連続入力は無視
          return
        }
        (target as any).lastDebugTime = now
        
        console.log('⌨️ INPUT EVENT:', {
          tagName: target.tagName,
          type: target.type,
          valueLength: target.value.length, // 値の長さのみ記録（プライバシー考慮）
          id: target.id,
          className: target.className?.substring(0, 50), // クラス名は最初の50文字のみ
          scrollBefore: {
            top: window.pageYOffset || document.documentElement.scrollTop,
            left: window.pageXOffset || document.documentElement.scrollLeft
          }
        })
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