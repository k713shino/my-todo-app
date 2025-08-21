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

    // インポート開始のローディングトースター
    const loadingToast = toast.loading('📤 ファイルをアップロード中...', {
      duration: Infinity // 手動で削除するまで表示
    })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/auth/import-data', {
        method: 'POST',
        body: formData
      })

      // ローディングトースターを削除
      toast.dismiss(loadingToast)

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
          toast.success(`✅ ${importedCount}件のTodoをインポートしました！${skippedCount > 0 ? ` (${skippedCount}件は重複のためスキップ)` : ''}`, {
            duration: 5000
          })
          
          // 新しいTodoがインポートされた場合のみページをリロード
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        } else if (skippedCount > 0) {
          toast(`ℹ️ ${totalCount}件のTodoがすべて重複のためスキップされました。新しいTodoはインポートされませんでした。`, {
            duration: 4000
          })
        } else {
          toast.error('⚠️ ファイルに有効なTodoデータが見つかりませんでした。', {
            duration: 4000
          })
        }
        
      } else {
        const data = await response.json()
        if (data.maintenanceMode) {
          toast.error('🔧 ' + (data.error || 'データベースメンテナンス中です'), {
            duration: 6000
          })
        } else {
          toast.error('❌ ' + (data.error || 'インポートに失敗しました'), {
            duration: 6000
          })
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      // ローディングトースターを削除（エラー時）
      toast.dismiss(loadingToast)
      toast.error('❌ ネットワークエラーまたはサーバーエラーが発生しました', {
        duration: 6000
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow-md mt-6 transition-all duration-300 ${
      isImporting ? 'opacity-75 pointer-events-none' : ''
    }`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📥 データインポート {isImporting && <span className="text-orange-500 text-sm ml-2">処理中...</span>}
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
            className={`w-full px-4 py-3 rounded-md transition-all duration-300 flex items-center justify-center space-x-2 ${
              isImporting 
                ? 'bg-orange-500 text-white cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg'
            }`}
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span className="font-medium">📤 処理中...</span>
              </>
            ) : (
              <>
                <span>📁</span>
                <span className="font-medium">ファイルを選択してインポート</span>
              </>
            )}
          </button>
        </div>

        {/* 注意事項 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📋 インポートについて</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 🆕 <strong>GDPR準拠エクスポートファイル</strong>をそのままインポート可能</li>
            <li>• 同じタイトルのTodoは重複として自動的にスキップされます</li>
            <li>• JSON形式とCSV形式に対応しています（エクスポート形式完全互換）</li>
            <li>• ファイルサイズは最大10MBまでです</li>
            <li>• インポート後、ページが自動的に更新されます</li>
          </ul>
        </div>

        {/* GDPR準拠インポートの説明 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">✅ GDPR準拠データ互換性</h4>
          <p className="text-sm text-green-700">
            データエクスポート機能で作成されたJSONファイルやCSVファイルを
            そのままインポートできます。エクスポート時の完了状態、カテゴリ、
            優先度などの情報が正しく復元されます。
          </p>
        </div>
      </div>
    </div>
  )
}