'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'

interface DataImportFormProps {
  userId: string
}

export default function DataImportForm({ userId: _userId }: DataImportFormProps) {
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイル形式チェック
    const allowedTypes = ['application/json', 'text/csv', 'text/plain']
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.json') && !file.name.endsWith('.csv')) {
      toast.error('JSON形式またはCSV形式のファイルを選択してください')
      return
    }

    // ファイルサイズチェック (10MB制限)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズは10MB以下にしてください')
      return
    }

    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/auth/import-data', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        const importedCount = result.importedCount || 0
        const skippedCount = result.skippedCount || 0
        const totalCount = result.totalCount || 0
        
        // ファイル入力をリセット
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // より詳細な成功メッセージ
        if (importedCount > 0) {
          toast.success(`${importedCount}件のTodoをインポートしました！${skippedCount > 0 ? ` (${skippedCount}件は重複のためスキップ)` : ''}`)
          
          // 新しいTodoがインポートされた場合のみページをリロード
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else if (skippedCount > 0) {
          toast.info(`${totalCount}件のTodoがすべて重複のためスキップされました。新しいTodoはインポートされませんでした。`)
        } else {
          toast.warning('ファイルに有効なTodoデータが見つかりませんでした。')
        }
        
      } else {
        const data = await response.json()
        if (data.maintenanceMode) {
          toast.error('🔧 ' + (data.error || 'データベースメンテナンス中です'))
        } else {
          toast.error(data.error || 'インポートに失敗しました')
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📥 データインポート
      </h3>

      <p className="text-gray-600 mb-4">
        以前にエクスポートしたデータファイルをインポートしてTodoを復元できます。
      </p>

      <div className="space-y-4">
        {/* ファイル選択 */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isImporting}
          />
          
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>インポート中...</span>
              </>
            ) : (
              <>
                <span>📁</span>
                <span>ファイルを選択してインポート</span>
              </>
            )}
          </button>
        </div>

        {/* 注意事項 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📋 インポートについて</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 同じタイトルのTodoは重複として自動的にスキップされます</li>
            <li>• JSON形式とCSV形式に対応しています</li>
            <li>• ファイルサイズは最大10MBまでです</li>
            <li>• インポート後、ページが自動的に更新されます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
          </button>
        </div>

        {/* インポート可能形式の説明 */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-purple-800 mb-2">📋 対応形式</h4>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>• JSON形式（エクスポート機能で作成されたファイル）</li>
            <li>• CSV形式（タイトル、説明、優先度、カテゴリ、期限の列を含む）</li>
            <li>• ファイルサイズ上限: 10MB</li>
          </ul>
        </div>

        {/* 注意事項 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ 注意事項</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• インポートしたデータは既存のTodoに追加されます</li>
            <li>• 重複するTodoは自動的にスキップされます</li>
            <li>• インポート後、ページが自動的に更新されます</li>
            <li>• 大量のデータの場合、処理に時間がかかることがあります</li>
          </ul>
        </div>

        {/* CSV形式のサンプル */}
        <details className="bg-gray-50 p-4 rounded-lg">
          <summary className="cursor-pointer text-sm font-medium text-gray-800 mb-2">
            💡 CSV形式のサンプル（クリックして展開）
          </summary>
          <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`title,description,priority,category,dueDate,tags
"買い物リスト作成","明日の買い物リストを作成する","medium","personal","2024-01-20","買い物,リスト"
"会議資料準備","来週の会議資料を準備","high","work","2024-01-25","会議,資料"`}
          </pre>
        </details>
      </div>
    </div>
  )
}