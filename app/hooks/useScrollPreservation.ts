'use client'

import { useLayoutEffect, useRef } from 'react'

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
    
    // 関数を実行
    const result = fn(...args)
    
    // 次のフレームで位置を復元
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollTop)
    })
    
    return result
  }
}