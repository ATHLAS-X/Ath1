/**
 * Pure-function unit coverage for the academy batch-schedule and
 * attendance-flag helpers, ported from origin/v1-features-sparsh's
 * scripts/test/batches-schedule-helpers.test.ts and
 * attendance-flags-helpers.test.ts (already vitest-style; logic and
 * assertions carried over, imports repointed at src/lib/academy/*).
 * No database needed — these are pure functions.
 */
import { describe, it, expect } from 'vitest'
import {
  formatScheduleLabel,
  mapBatchStatusFromDb,
  mapBatchStatusToDb,
  nextSessionLabel,
  parseAgeGroup,
  parseSchedule,
  scheduleFromDbFields,
  scheduleSlotsShareOneTime,
  scheduleToDbFields,
} from '@/lib/academy/batches'
import {
  classifyFollowUpStatus,
  DEFAULT_ABSENCE_THRESHOLD,
  formatAbsenceReason,
  isSnoozeActive,
  parseSnoozeDurationDays,
  snoozeUntilFromDays,
} from '@/lib/academy/attendance-flags'

describe('batch schedule helpers', () => {
  it('parses a valid uniform-time schedule', () => {
    const result = parseSchedule([{ day: 'Mon', start: '06:00', end: '08:00' }, { day: 'Wed', start: '06:00', end: '08:00' }])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(2)
  })

  it('rejects an empty schedule', () => {
    expect(parseSchedule([]).ok).toBe(false)
  })

  it('rejects an invalid weekday', () => {
    const result = parseSchedule([{ day: 'Someday', start: '06:00', end: '07:00' }])
    expect(result.ok).toBe(false)
  })

  it('rejects end time before start time', () => {
    const result = parseSchedule([{ day: 'Mon', start: '08:00', end: '06:00' }])
    expect(result.ok).toBe(false)
  })

  it('rejects mismatched per-day times', () => {
    const result = parseSchedule([
      { day: 'Mon', start: '06:00', end: '08:00' },
      { day: 'Wed', start: '17:00', end: '18:00' },
    ])
    expect(result.ok).toBe(false)
  })

  it('round-trips schedule encode/decode through db fields', () => {
    const slots = [{ day: 'Mon' as const, start: '06:00', end: '08:00' }, { day: 'Wed' as const, start: '06:00', end: '08:00' }]
    const { schedule_days, schedule_time } = scheduleToDbFields(slots)
    expect(schedule_days).toEqual(['Mon', 'Wed'])
    expect(schedule_time).toBe('06:00-08:00')
    const decoded = scheduleFromDbFields(schedule_days, schedule_time)
    expect(decoded).toEqual(slots)
  })

  it('formats a compact schedule label', () => {
    const label = formatScheduleLabel([{ day: 'Mon', start: '06:30', end: '08:00' }])
    expect(label).toBe('Mon · 6:30am–8:00am')
  })

  it('reports "No times set" for an empty schedule', () => {
    expect(formatScheduleLabel([])).toBe('No times set')
  })

  it('computes the next session label as Today when the slot is later today', () => {
    const now = new Date('2026-09-07T05:00:00.000Z') // a Monday
    const label = nextSessionLabel([{ day: 'Mon', start: '23:59', end: '23:59' }], now)
    expect(['Today · 11:59pm', 'Tomorrow · 11:59pm']).toContain(label)
  })

  it('returns — for an empty schedule', () => {
    expect(nextSessionLabel([])).toBe('—')
  })

  it('maps batch status db<->api values', () => {
    expect(mapBatchStatusFromDb('ARCHIVED')).toBe('archived')
    expect(mapBatchStatusFromDb('ACTIVE')).toBe('active')
    expect(mapBatchStatusFromDb(undefined)).toBe('active')
    expect(mapBatchStatusToDb('archived')).toBe('ARCHIVED')
    expect(mapBatchStatusToDb('active')).toBe('ACTIVE')
  })

  it('validates age group against the known set', () => {
    expect(parseAgeGroup('U-13')).toBe('U-13')
    expect(parseAgeGroup('U-99')).toBeNull()
  })

  it('scheduleSlotsShareOneTime is true for 0/1 slots and for identical windows', () => {
    expect(scheduleSlotsShareOneTime([])).toBe(true)
    expect(
      scheduleSlotsShareOneTime([
        { day: 'Mon', start: '06:00', end: '08:00' },
        { day: 'Wed', start: '06:00', end: '08:00' },
      ]),
    ).toBe(true)
    expect(
      scheduleSlotsShareOneTime([
        { day: 'Mon', start: '06:00', end: '08:00' },
        { day: 'Wed', start: '17:00', end: '18:00' },
      ]),
    ).toBe(false)
  })
})

describe('attendance flag state machine', () => {
  it('formats absence reason singular/plural', () => {
    expect(formatAbsenceReason(1)).toBe('1 absence in a row')
    expect(formatAbsenceReason(3)).toBe('3 absences in a row')
  })

  it('parses snooze duration bounds', () => {
    expect(parseSnoozeDurationDays(7)).toBe(7)
    expect(parseSnoozeDurationDays('7')).toBe(7)
    expect(parseSnoozeDurationDays(0)).toBeNull()
    expect(parseSnoozeDurationDays(91)).toBeNull()
    expect(parseSnoozeDurationDays('abc')).toBeNull()
    expect(parseSnoozeDurationDays(null)).toBeNull()
  })

  it('computes snooze-until and active check', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const until = snoozeUntilFromDays(5, now)
    expect(until.toISOString()).toBe('2026-01-06T00:00:00.000Z')
    expect(isSnoozeActive(until, now)).toBe(true)
    expect(isSnoozeActive(until, new Date('2026-01-07T00:00:00.000Z'))).toBe(false)
    expect(isSnoozeActive(null)).toBe(false)
  })

  it('classifies clear/open/snoozed/dismissed correctly', () => {
    expect(
      classifyFollowUpStatus({ consecutiveAbsences: 0, threshold: DEFAULT_ABSENCE_THRESHOLD, state: null }),
    ).toBe('clear')
    expect(classifyFollowUpStatus({ consecutiveAbsences: 3, threshold: 2, state: null })).toBe('open')
    expect(
      classifyFollowUpStatus({
        consecutiveAbsences: 3,
        threshold: 2,
        state: { status: 'dismissed', snoozed_until: null },
      }),
    ).toBe('dismissed')

    const now = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-01-10T00:00:00.000Z').toISOString()
    const past = new Date('2025-01-10T00:00:00.000Z').toISOString()
    expect(
      classifyFollowUpStatus({
        consecutiveAbsences: 3,
        threshold: 2,
        state: { status: 'snoozed', snoozed_until: future },
        now,
      }),
    ).toBe('snoozed')
    expect(
      classifyFollowUpStatus({
        consecutiveAbsences: 3,
        threshold: 2,
        state: { status: 'snoozed', snoozed_until: past },
        now,
      }),
    ).toBe('open')
  })
})
