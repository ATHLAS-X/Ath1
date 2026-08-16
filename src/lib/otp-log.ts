import { maskPhone } from '@/lib/otp'

export type OtpFlowType = 'claim_player'
export type OtpEvent =
  | 'generated'
  | 'sent'
  | 'rate_limited'
  | 'verify_attempt'
  | 'verify_success'
  | 'verify_failed'
  | 'consumed'
  | 'expired'

/**
 * Structured OTP event logging — one line per event, masked phone only,
 * never the code. Ported in spirit from feat/w1-w8-and-association-auth's
 * lib/otp-log.ts (DB-table-backed there); this codebase has no otp_events
 * table, so this logs structured JSON to console rather than writing a
 * row — still one consistent, greppable shape per event instead of ad hoc
 * console.log calls scattered per route. Fire-and-forget, never throws
 * into the calling OTP flow.
 */
export function logOtpEvent(input: {
  flowType: OtpFlowType
  event: OtpEvent
  phone?: string | null
  claimId?: string | null
  failureReason?: string
}): void {
  try {
    console.log(
      JSON.stringify({
        otp_event: input.event,
        flow_type: input.flowType,
        masked_phone: maskPhone(input.phone),
        claim_id: input.claimId ?? null,
        failure_reason: input.failureReason,
        at: new Date().toISOString(),
      }),
    )
  } catch {
    // never let logging break the calling OTP flow
  }
}
