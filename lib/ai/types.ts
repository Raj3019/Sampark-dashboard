export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  labels: string[];
  series: ChartSeries[];
}

export type AttendingFilter = 'yes' | 'no' | 'all';
export type TrendMode = 'attending' | 'nonAttending' | 'all';
