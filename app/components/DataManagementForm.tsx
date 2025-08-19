'use client'

import DataExportForm from './DataExportForm'
import DataImportForm from './DataImportForm'

interface DataManagementFormProps {
  userId: string
}

export default function DataManagementForm({ userId }: DataManagementFormProps) {
  return (
    <div className="space-y-6">
      <DataExportForm userId={userId} />
      
      {/* インポート機能は現在調整中のため一時的に非表示 */}
      {process.env.NODE_ENV === 'development' && (
        <DataImportForm userId={userId} />
      )}
      
      {process.env.NODE_ENV === 'production' && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            📥 データインポート
          </h3>
          <p className="text-yellow-700">
            インポート機能は現在調整中です。しばらくお待ちください。
          </p>
        </div>
      )}
    </div>
  )
}