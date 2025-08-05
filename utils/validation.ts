export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateTodoTitle(title: string): ValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    errors.push('タイトルは必須です');
  }

  if (title.length > 200) {
    errors.push('タイトルは200文字以内で入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateTodoDescription(description?: string): ValidationResult {
  const errors: string[] = [];

  if (description && description.length > 1000) {
    errors.push('説明は1000文字以内で入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUserId(userId: string): ValidationResult {
  const errors: string[] = [];

  if (!userId || userId.trim().length === 0) {
    errors.push('ユーザーIDは必須です');
  }

  // UUID形式かどうかチェック（簡易版）
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (userId && !uuidRegex.test(userId)) {
    errors.push('無効なユーザーIDです');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}