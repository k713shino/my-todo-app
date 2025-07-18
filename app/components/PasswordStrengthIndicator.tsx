'use client'

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirements {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export default function PasswordStrengthIndicator({ password, showRequirements = true }: PasswordStrengthIndicatorProps) {
  // パスワード要件チェック
  const getPasswordRequirements = (password: string): PasswordRequirements => {
    return {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    }
  }

  // パスワード強度計算
  const getPasswordStrength = (password: string) => {
    const requirements = getPasswordRequirements(password)
    const fulfilled = Object.values(requirements).filter(Boolean).length
    
    // 強度レベルの定義（0-5の範囲）
    const levels = ['とても弱い', '弱い', '普通', '強い', 'とても強い']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
    
    // インデックス調整（0-4の範囲に収める）
    const levelIndex = Math.min(fulfilled - 1, 4)
    const safeIndex = Math.max(0, levelIndex)
    
    return { 
      level: levels[safeIndex], 
      color: colors[safeIndex], 
      score: fulfilled,
      requirements
    }
  }

  const passwordData = getPasswordStrength(password)

  // 要件の詳細情報
  const requirementDetails = [
    { key: 'length', label: '8文字以上', fulfilled: passwordData.requirements.length },
    { key: 'lowercase', label: '小文字を含む', fulfilled: passwordData.requirements.lowercase },
    { key: 'uppercase', label: '大文字を含む', fulfilled: passwordData.requirements.uppercase },
    { key: 'number', label: '数字を含む', fulfilled: passwordData.requirements.number },
    { key: 'special', label: '特殊文字を含む (@$!%*?&)', fulfilled: passwordData.requirements.special }
  ]

  if (!password) {
    return null
  }

  return (
    <div className="mt-2">
      {/* 強度インジケーター */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${passwordData.color}`}
            style={{ width: `${(passwordData.score / 5) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-600">{passwordData.level}</span>
      </div>

      {/* 要件の詳細表示 */}
      {showRequirements && (
        <div className="mt-2 space-y-1">
          {requirementDetails.map((req) => (
            <div key={req.key} className="flex items-center space-x-2 text-xs">
              {req.fulfilled ? (
                <span className="text-green-600">✅</span>
              ) : (
                <span className="text-gray-400">❌</span>
              )}
              <span className={req.fulfilled ? 'text-green-600' : 'text-gray-500'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* サマリーメッセージ */}
      <div className="mt-2">
        {passwordData.score === 5 ? (
          <p className="text-xs text-green-600">✅ 強力なパスワードです</p>
        ) : (
          <p className="text-xs text-amber-600">
            ⚠️ より安全にするため、不足している要件を満たしてください
          </p>
        )}
      </div>
    </div>
  )
}