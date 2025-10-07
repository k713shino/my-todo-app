'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface DataExportFormProps {
  userId: string
}

export default function DataExportForm({ userId: _userId }: DataExportFormProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true)
    
    try {
      const response = await fetch(`/api/auth/export-data?format=${format}`, {
        method: 'GET'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `my-todo-data-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`データが${format.toUpperCase()}形式でエクスポートされました`)
      } else {
        const data = await response.json()
        if (data.maintenanceMode) {
          toast.error('🔧 ' + (data.error || 'データベースメンテナンス中です'))
        } else {
          toast.error(data.error || 'エクスポートに失敗しました')
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📤 データエクスポート
      </h3>

      <p className="text-gray-600 mb-4">
        あなたのすべてのTodoデータをダウンロードできます。
        GDPR準拠の完全なデータポータビリティを提供します。
      </p>

      <div className="space-y-4">
        {/* エクスポート形式選択 */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">エクスポート形式</h4>
          <div className="flex space-x-4">
            <button
              onClick={() => handleExport('json')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isExporting}
            >
              {isExporting ? 'エクスポート中...' : 'JSON形式'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isExporting}
            >
              {isExporting ? 'エクスポート中...' : 'CSV形式'}
            </button>
          </div>
        </div>

        {/* エクスポート内容説明 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">📋 エクスポートされるデータ</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• アカウント情報（名前、メール、作成日時）</li>
            <li>• すべてのTodoアイテム（タイトル、説明、ステータス、優先度、カテゴリ、タグ、期限、作成・更新日時）</li>
            <li>• 統計情報（総数・完了数などの概要）</li>
          </ul>
        </div>

        {/* 法的情報 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📋 データポータビリティ</h4>
          <p className="text-sm text-blue-700">
            このエクスポート機能はGDPR第20条（データポータビリティの権利）に準拠しています。
            エクスポートされたデータは他のサービスでインポートしたり、バックアップとして保存できます。
          </p>
        </div>
      </div>
    </div>
  )
}
