'use client'

import { useState } from 'react'

interface XStyleFABProps {
  onClick: () => void
}

/**
 * X (Twitter) 風のフローティングアクションボタン
 * 特徴: 右下固定、青い円形ボタン、影付き
 */
export default function XStyleFAB({ onClick }: XStyleFABProps) {
  const [isPressed, setIsPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 ${
        isPressed ? 'scale-95' : 'scale-100'
      }`}
      title="新しいタスクを追加"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  )
}
