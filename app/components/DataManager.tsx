'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

interface DataManagerProps {
  className?: string
}

export default function DataManager({ className = '' }: DataManagerProps) {
  const { data: session } = useSession()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportJSON = async () => {
    if (!session?.user) return

    setIsExporting(true)
    try {
      const response = await fetch('/api/todos/export?format=json')
      if (!response.ok) {
        throw new Error('エクスポートに失敗しました')
      }

      const data = await response.json()
      const jsonString = JSON.stringify(data, null, 2)
      const filename = `todos-${new Date().toISOString().split('T')[0]}.json`
      
      // 複数の方法を試行
      if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edge')) {
        // Chrome/Edge用: showSaveFilePickerを使用（対応している場合）
        try {
          if ('showSaveFilePicker' in window) {
            const fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [{
                description: 'JSON files',
                accept: { 'application/json': ['.json'] }
              }]
            })
            const writable = await fileHandle.createWritable()
            await writable.write(jsonString)
            await writable.close()
            toast.success('JSONデータをエクスポートしました')
            return
          }
        } catch (fileApiError) {
          console.log('File System API不対応、従来方法を使用')
        }
      }
      
      // 従来方法（フォールバック）
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      // ダウンロードリンクを作成
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      // DOMに追加してクリック
      document.body.appendChild(a)
      a.click()
      
      // 少し待ってからクリーンアップ
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
        URL.revokeObjectURL(url)
      }, 1000)

      toast.success('JSONデータをエクスポートしました')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportCSV = async () => {
    if (!session?.user) return

    setIsExporting(true)
    try {
      const response = await fetch('/api/todos/export?format=csv')
      if (!response.ok) {
        throw new Error('エクスポートに失敗しました')
      }

      const csvData = await response.text()
      // BOM付きでCSVを作成（Excelでの文字化け防止）
      const bom = '\uFEFF'
      const csvWithBom = bom + csvData
      const filename = `todos-${new Date().toISOString().split('T')[0]}.csv`
      
      // 複数の方法を試行
      if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edge')) {
        // Chrome/Edge用: showSaveFilePickerを使用（対応している場合）
        try {
          if ('showSaveFilePicker' in window) {
            const fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [{
                description: 'CSV files',
                accept: { 'text/csv': ['.csv'] }
              }]
            })
            const writable = await fileHandle.createWritable()
            await writable.write(csvWithBom)
            await writable.close()
            toast.success('CSVデータをエクスポートしました')
            return
          }
        } catch (fileApiError) {
          console.log('File System API不対応、従来方法を使用')
        }
      }
      
      // 従来方法（フォールバック）
      const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      // ダウンロードリンクを作成
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      // DOMに追加してクリック
      document.body.appendChild(a)
      a.click()
      
      // 少し待ってからクリーンアップ
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
        URL.revokeObjectURL(url)
      }, 1000)

      toast.success('CSVデータをエクスポートしました')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !session?.user) return

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/todos/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'インポートに失敗しました')
      }

      const result = await response.json()
      toast.success(`${result.imported}件のTodoをインポートしました`)
      
      // ページをリロードしてデータを更新
      window.location.reload()
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'インポートに失敗しました')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* データエクスポート */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          📤 データエクスポート
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          あなたのTodoデータをJSON形式またはCSV形式でダウンロードできます
        </p>
        <div className="space-x-3">
          <button
            onClick={handleExportJSON}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'エクスポート中...' : '📥 JSON形式'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'エクスポート中...' : '📊 CSV形式'}
          </button>
        </div>
      </div>

      {/* データインポート */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          📥 データインポート
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          JSONファイルまたはCSVファイルからTodoデータをインポートできます
        </p>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleImport}
            disabled={isImporting}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
          />
          {isImporting && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              インポート中...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
