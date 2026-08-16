export const MIN_REP_PASSWORD_LENGTH = 3;

export function validateRepresentativePassword(password: string) {
  const value = password.trim();
  if (!value) return { valid: true, message: "" };
  if (value.length < MIN_REP_PASSWORD_LENGTH) {
    return { valid: false, message: `يجب أن تتكون كلمة المرور من ${MIN_REP_PASSWORD_LENGTH} أحرف أو أكثر.` };
  }
  return { valid: true, message: "" };
}
