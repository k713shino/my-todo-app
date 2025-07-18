'use client'

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  // パスワード強度チェック
  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[@$!%*?&]/.test(password)) strength++
    
    const levels = ['とても弱い', '弱い', '普通', '強い', 'とても強い']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
    
    return { level: levels[strength] || 'とても弱い', color: colors[strength] || 'bg-red-500', score: strength }
  }

  const passwordStrength = getPasswordStrength(password)

  return (
    <div className="mt-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-600">{passwordStrength.level}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        8文字以上、大文字・小文字・数字・特殊文字を含むパスワードを推奨
      </p>
    </div>
  )
}