'use client'

import { useLayoutEffect, useRef, useCallback } from 'react'

/**
 * コンポーネント更新時にスクロール位置を保持するカスタムフック
 */
export function useScrollPreservation() {
  const scrollPositionRef = useRef<number>(0)

  // 更新前にスクロール位置を保存
  const preserveScroll = () => {
    scrollPositionRef.current = window.pageYOffset || document.documentElement.scrollTop
  }

  // 更新後にスクロール位置を復元
  useLayoutEffect(() => {
    if (scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current)
      scrollPositionRef.current = 0 // リセット
    }
  })

  return { preserveScroll }
}

/**
 * 任意の関数実行前後でスクロール位置を保持する高階関数
 */
export function withScrollPreservation<T extends any[], R>(
  fn: (...args: T) => R
) {
  return (...args: T): R => {
    // スクロール位置を保存
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    
    console.log('🔍 スクロール位置保存:', { scrollTop, scrollLeft })
    
    // 関数を実行
    const result = fn(...args)
    
    // より確実な遅延でスクロール位置を復元
    setTimeout(() => {
      console.log('📍 スクロール位置復元中:', { scrollTop, scrollLeft })
      window.scrollTo(scrollLeft, scrollTop)
      // さらに確実にするため、もう一度実行
      setTimeout(() => {
        window.scrollTo(scrollLeft, scrollTop)
      }, 50)
    }, 10)
    
    return result
  }
}

/**
 * レイアウト効果を使用した即座のスクロール位置保持フック
 * より早いタイミングでスクロール位置を復元
 */
export function useScrollPositionPreservation() {
  const scrollPosition = useRef<{ top: number; left: number }>({ top: 0, left: 0 })
  
  const preservePosition = useCallback(() => {
    scrollPosition.current = {
      top: window.pageYOffset || document.documentElement.scrollTop,
      left: window.pageXOffset || document.documentElement.scrollLeft
    }
    console.log('🔐 スクロール位置保持:', scrollPosition.current)
  }, [])
  
  const restorePosition = useCallback(() => {
    console.log('🔓 スクロール位置復元:', scrollPosition.current)
    window.scrollTo(scrollPosition.current.left, scrollPosition.current.top)
  }, [])
  
  // レイアウトが変更される前に位置を復元
  useLayoutEffect(() => {
    if (scrollPosition.current.top !== 0 || scrollPosition.current.left !== 0) {
      restorePosition()
    }
  })
  
  return { preservePosition, restorePosition }
}
