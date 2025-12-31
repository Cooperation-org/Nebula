/**
 * COOK Ledger Aggregation Utilities
 *
 * Provides functions to aggregate COOK ledger entries by time periods
 *
 * Story 8.2: View COOK Ledger with Time-Based Aggregation
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'

export interface AggregatedPeriod {
  period: string // Format: "YYYY-MM" for month, "YYYY" for year
  totalCook: number
  selfCook: number
  spendCook: number
  entryCount: number
  entries: CookLedgerEntry[]
}

/**
 * Aggregate COOK ledger entries by month
 *
 * @param entries - Array of COOK ledger entries
 * @returns Map of month period (YYYY-MM) to aggregated data
 */
export function aggregateByMonth(
  entries: CookLedgerEntry[]
): Map<string, AggregatedPeriod> {
  const monthMap = new Map<string, AggregatedPeriod>()

  entries.forEach(entry => {
    const date = new Date(entry.issuedAt)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const existing = monthMap.get(monthKey)
    if (existing) {
      existing.totalCook += entry.cookValue
      existing.entryCount += 1
      existing.entries.push(entry)

      if (entry.attribution === 'self') {
        existing.selfCook += entry.cookValue
      } else {
        existing.spendCook += entry.cookValue
      }
    } else {
      monthMap.set(monthKey, {
        period: monthKey,
        totalCook: entry.cookValue,
        selfCook: entry.attribution === 'self' ? entry.cookValue : 0,
        spendCook: entry.attribution === 'spend' ? entry.cookValue : 0,
        entryCount: 1,
        entries: [entry]
      })
    }
  })

  return monthMap
}

/**
 * Aggregate COOK ledger entries by year
 *
 * @param entries - Array of COOK ledger entries
 * @returns Map of year period (YYYY) to aggregated data
 */
export function aggregateByYear(
  entries: CookLedgerEntry[]
): Map<string, AggregatedPeriod> {
  const yearMap = new Map<string, AggregatedPeriod>()

  entries.forEach(entry => {
    const date = new Date(entry.issuedAt)
    const yearKey = String(date.getFullYear())

    const existing = yearMap.get(yearKey)
    if (existing) {
      existing.totalCook += entry.cookValue
      existing.entryCount += 1
      existing.entries.push(entry)

      if (entry.attribution === 'self') {
        existing.selfCook += entry.cookValue
      } else {
        existing.spendCook += entry.cookValue
      }
    } else {
      yearMap.set(yearKey, {
        period: yearKey,
        totalCook: entry.cookValue,
        selfCook: entry.attribution === 'self' ? entry.cookValue : 0,
        spendCook: entry.attribution === 'spend' ? entry.cookValue : 0,
        entryCount: 1,
        entries: [entry]
      })
    }
  })

  return yearMap
}

/**
 * Format month period for display (e.g., "2024-01" -> "January 2024")
 *
 * @param monthKey - Month key in format "YYYY-MM"
 * @returns Formatted month string
 */
export function formatMonthPeriod(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Get total COOK across all entries
 *
 * @param entries - Array of COOK ledger entries
 * @returns Total COOK value
 */
export function getTotalCook(entries: CookLedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.cookValue, 0)
}

/**
 * Get total Self-COOK across all entries
 *
 * @param entries - Array of COOK ledger entries
 * @returns Total Self-COOK value
 */
export function getTotalSelfCook(entries: CookLedgerEntry[]): number {
  return entries
    .filter(entry => entry.attribution === 'self')
    .reduce((total, entry) => total + entry.cookValue, 0)
}

/**
 * Get total Spend-COOK across all entries
 *
 * @param entries - Array of COOK ledger entries
 * @returns Total Spend-COOK value
 */
export function getTotalSpendCook(entries: CookLedgerEntry[]): number {
  return entries
    .filter(entry => entry.attribution === 'spend')
    .reduce((total, entry) => total + entry.cookValue, 0)
}

/**
 * COOK Velocity calculation result
 */
export interface CookVelocity {
  period: string // Month key (YYYY-MM) or "Overall"
  cookValue: number
  velocity: number // COOK per month
  trend: 'increasing' | 'decreasing' | 'stable' | 'new'
  previousVelocity?: number
}

/**
 * Calculate COOK velocity for a specific month
 * Velocity = COOK earned in that month
 *
 * @param monthPeriod - Aggregated period for a month
 * @returns COOK velocity for that month
 */
export function calculateMonthVelocity(monthPeriod: AggregatedPeriod): number {
  // For a single month, velocity is just the total COOK for that month
  return monthPeriod.totalCook
}

/**
 * Calculate overall COOK velocity (average COOK per month)
 *
 * @param entries - Array of COOK ledger entries
 * @returns Overall COOK velocity (COOK per month)
 */
export function calculateOverallVelocity(entries: CookLedgerEntry[]): number {
  if (entries.length === 0) {
    return 0
  }

  // Get date range
  const dates = entries.map(entry => new Date(entry.issuedAt).getTime())
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)

  // Calculate months between first and last entry
  const startDate = new Date(minDate)
  const endDate = new Date(maxDate)
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1 // +1 to include both start and end months

  // If only one month or less, return total COOK
  if (monthsDiff <= 1) {
    return getTotalCook(entries)
  }

  // Average COOK per month
  const totalCook = getTotalCook(entries)
  return totalCook / monthsDiff
}

/**
 * Calculate COOK velocity for each month and determine trends
 *
 * @param monthlyPeriods - Array of aggregated monthly periods (sorted newest first)
 * @returns Array of velocity calculations with trends
 */
export function calculateVelocityTrends(
  monthlyPeriods: AggregatedPeriod[]
): CookVelocity[] {
  const velocities: CookVelocity[] = []

  monthlyPeriods.forEach((period, index) => {
    const velocity = calculateMonthVelocity(period)
    const previousPeriod = monthlyPeriods[index + 1] // Next period (older)
    const previousVelocity = previousPeriod
      ? calculateMonthVelocity(previousPeriod)
      : undefined

    let trend: 'increasing' | 'decreasing' | 'stable' | 'new'
    if (!previousVelocity) {
      trend = 'new'
    } else if (velocity > previousVelocity * 1.1) {
      // 10% increase threshold
      trend = 'increasing'
    } else if (velocity < previousVelocity * 0.9) {
      // 10% decrease threshold
      trend = 'decreasing'
    } else {
      trend = 'stable'
    }

    velocities.push({
      period: period.period,
      cookValue: period.totalCook,
      velocity,
      trend,
      previousVelocity
    })
  })

  return velocities
}

/**
 * Get current month velocity
 *
 * @param monthlyPeriods - Array of aggregated monthly periods (sorted newest first)
 * @returns Current month velocity or null if no entries this month
 */
export function getCurrentMonthVelocity(
  monthlyPeriods: AggregatedPeriod[]
): CookVelocity | null {
  if (monthlyPeriods.length === 0) {
    return null
  }

  const currentMonth = new Date()
  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

  const currentPeriod = monthlyPeriods.find(p => p.period === currentMonthKey)
  if (!currentPeriod) {
    return null
  }

  const velocity = calculateMonthVelocity(currentPeriod)
  const previousPeriod = monthlyPeriods.find(p => p.period !== currentMonthKey)
  const previousVelocity = previousPeriod
    ? calculateMonthVelocity(previousPeriod)
    : undefined

  let trend: 'increasing' | 'decreasing' | 'stable' | 'new'
  if (!previousVelocity) {
    trend = 'new'
  } else if (velocity > previousVelocity * 1.1) {
    trend = 'increasing'
  } else if (velocity < previousVelocity * 0.9) {
    trend = 'decreasing'
  } else {
    trend = 'stable'
  }

  return {
    period: currentPeriod.period,
    cookValue: currentPeriod.totalCook,
    velocity,
    trend,
    previousVelocity
  }
}
