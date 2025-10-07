'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import ImportResultModal from './ImportResultModal'

interface DataImportFormProps {
  userId: string
}

export default function DataImportForm({ userId: _userId }: DataImportFormProps) {
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modalResult, setModalResult] = useState<{
    type: 'success' | 'info' | 'error'
    title: string
    message: string
    importedCount?: number
    skippedCount?: number
    totalCount?: number
  } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイル形式チェック
    const allowedTypes = ['application/json', 'text/csv', 'text/plain']
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.json') && !file.name.endsWith('.csv')) {
      setModalResult({
        type: 'error',
        title: 'ファイル形式エラー',
        message: 'JSON形式またはCSV形式のファイルを選択してください。対応形式: .json, .csv'
      })
      setShowModal(true)
      return
    }

    // ファイルサイズチェック (10MB制限)
    if (file.size > 10 * 1024 * 1024) {
      setModalResult({
        type: 'error',
        title: 'ファイルサイズエラー',
        message: `ファイルサイズが制限を超えています。10MB以下のファイルを選択してください。\n現在のサイズ: ${(file.size / 1024 / 1024).toFixed(1)}MB`
      })
      setShowModal(true)
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

      // 新フロー: init -> parents (チャンク処理)
      const initRes = await fetch('/api/auth/import/init', { method: 'POST', body: formData })
      if (!initRes.ok) {
        // フォールバック: 旧APIで単発インポート（大容量ではタイムアウトの可能性）
        const legacy = await fetch('/api/auth/import-data', { method: 'POST', body: formData })
        toast.dismiss(loadingToast)
        if (legacy.ok) {
          const result = await legacy.json()
          const importedCount = result.importedCount || 0
          const skippedCount = result.skippedCount || 0
          const totalCount = result.totalCount || 0
          if (fileInputRef.current) fileInputRef.current.value = ''
          if (importedCount > 0) {
            setModalResult({ type:'success', title:'インポート完了（フォールバック）', message:`旧方式でインポートしました。${skippedCount>0?'重複は自動スキップ。':''}`, importedCount, skippedCount, totalCount })
            setShowModal(true)
            setTimeout(() => { window.location.reload() }, 2000)
          } else if (skippedCount > 0) {
            setModalResult({ type:'info', title:'インポート完了（フォールバック）', message:'すべて重複のためスキップされました。', importedCount:0, skippedCount, totalCount })
            setShowModal(true)
          } else {
            setModalResult({ type:'error', title:'インポートエラー', message:'有効なデータが見つかりませんでした。', totalCount:0 })
            setShowModal(true)
          }
        } else {
          const data = await legacy.json().catch(()=>({}))
          setModalResult({ type:'error', title:'初期化エラー', message: (await initRes.json().catch(()=>({}))).error || data.error || 'インポート初期化に失敗しました。' })
          setShowModal(true)
        }
        setIsImporting(false)
        return
      }
      const init = await initRes.json()
      const importId: string = init.importId
      let importedCount = 0
      let skippedCount = 0

      // データをチャンク処理
      let cursor = 0
      const limit = Math.max(1, parseInt(process.env.NEXT_PUBLIC_IMPORT_CHUNK_SIZE || '100', 10))
      while (true) {
        const res = await fetch('/api/auth/import/parents', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ importId, cursor, limit })
        })
        if (!res.ok) break
        const data = await res.json()
        importedCount += data.imported || 0
        skippedCount += data.skipped || 0
        cursor = data.nextCursor || 0
        if (data.done) break
      }

      // ローディングトースターを削除
      toast.dismiss(loadingToast)

      {
        const totalCount = (init?.total || 0)
        
        // ファイル入力をリセット
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // 詳細な結果をモーダルで表示
        if (importedCount > 0) {
          setModalResult({
            type: 'success',
            title: 'インポート完了！',
            message: `Todoのインポートが正常に完了しました。${skippedCount > 0 ? '重複するTodoは自動的にスキップされました。' : ''}`,
            importedCount,
            skippedCount,
            totalCount
          })
          setShowModal(true)
          
          // 新しいTodoがインポートされた場合のみページをリロード
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else if (skippedCount > 0) {
          setModalResult({
            type: 'info',
            title: 'インポート完了',
            message: 'すべてのTodoが重複のためスキップされました。新しいTodoはインポートされませんでした。',
            importedCount: 0,
            skippedCount,
            totalCount
          })
          setShowModal(true)
        } else {
          setModalResult({
            type: 'error',
            title: 'インポートエラー',
            message: 'ファイルに有効なTodoデータが見つかりませんでした。ファイル形式やデータ内容を確認してください。',
            totalCount: 0
          })
          setShowModal(true)
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      // ローディングトースターを削除（エラー時）
      toast.dismiss(loadingToast)
      setModalResult({
        type: 'error',
        title: 'ネットワークエラー',
        message: 'ネットワークエラーまたはサーバーエラーが発生しました。インターネット接続を確認して再度お試しください。'
      })
      setShowModal(true)
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

      {/* インポート結果モーダル */}
      <ImportResultModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        result={modalResult}
      />
    </div>
  )
}
