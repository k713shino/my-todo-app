/**
 * パスワード強度チェック機能
 * 登録時と同様の文字数、大文字・小文字・特殊文字・数字の要件をチェック
 */

export interface PasswordStrength {
  isValid: boolean
  score: number // 0-100
  requirements: {
    length: boolean
    lowercase: boolean
    uppercase: boolean
    numbers: boolean
    special: boolean
  }
  feedback: string[]
}

export function validatePassword(password: string): PasswordStrength {
  const requirements = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
  }

  const feedback: string[] = []
  let score = 0

  // 各要件をチェックしてスコアを計算
  if (requirements.length) {
    score += 20
  } else {
    feedback.push('8文字以上で入力してください')
  }

  if (requirements.lowercase) {
    score += 20
  } else {
    feedback.push('小文字を含む必要があります')
  }

  if (requirements.uppercase) {
    score += 20
  } else {
    feedback.push('大文字を含む必要があります')
  }

  if (requirements.numbers) {
    score += 20
  } else {
    feedback.push('数字を含む必要があります')
  }

  if (requirements.special) {
    score += 20
  } else {
    feedback.push('特殊文字を含む必要があります')
  }

  // 5つの要件のうち3つ以上満たされていればOK
  const fulfilledCount = Object.values(requirements).filter(req => req).length
  const isValid = fulfilledCount >= 3

  return {
    isValid,
    score,
    requirements,
    feedback: isValid ? [`パスワード強度: 良好 (${fulfilledCount}/5条件達成)`] : [`${fulfilledCount}/5条件達成 (3つ以上必要)`]
  }
}

export function getPasswordStrengthColor(score: number): string {
  if (score >= 100) return 'bg-green-500'
  if (score >= 80) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export function getPasswordStrengthText(score: number): string {
  if (score >= 100) return '強い'
  if (score >= 80) return '良好'
  if (score >= 40) return '普通'
  return '弱い'
}