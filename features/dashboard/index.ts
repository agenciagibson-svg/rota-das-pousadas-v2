/**
 * Dashboard feature — shared shell + data-viz used by the owner and admin panels.
 */
export { DashboardShell, type NavItem } from '@/components/dashboard/shell'
export { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
export {
  addDays,
  calculateOccupancy,
  dayMovements,
  monthlyRevenue,
  nightsWithin,
  roomsOccupiedOn,
  summarizeReviews,
  toISODate,
  weeklyDailies,
  type MetricBooking,
  type MonthlyRevenuePoint,
  type OccupancySnapshot,
  type ReviewSummary,
  type WeeklyDailies,
} from './metrics'
