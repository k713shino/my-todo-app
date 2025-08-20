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
      
      <DataImportForm userId={userId} />
    </div>
  )
}