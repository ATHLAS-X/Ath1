import { createHash, randomInt } from 'crypto'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

export function generateOtp(): string {
  return String(randomInt(100000, 999999))
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS)
}

export function isOtpExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime()
}

export { MAX_ATTEMPTS }
