// Developer Performance Types
export interface DeveloperPerformanceMetrics {
  id?: number;
  user_id: number;
  username: string;
  project_id: number;
  performance_date: string;
  total_mrs: number;
  merged_mrs: number;
  success_rate: number;
  avg_merge_time_hours: number;
  quality_score: number;
  issues_created: number;
  issues_resolved: number;
  avg_resolution_time_hours: number;
  efficiency_score: number;
  bug_fix_rate: number;
  code_review_score: number;
  lines_of_code: number;
  commits_count: number;
  active_days: number;
  performance_score: number;
  calculated_at?: string;
  created_at?: string;
  updated_at?: string;
  last_updated: string;
  period_start: string;
  period_end: string;
  // Joined fields
  developer_name?: string;
  project_name?: string;
}

export interface MRQualityMetrics {
  id?: number;
  mr_id: number;
  mr_iid: number;
  merge_request_id: number;
  author_id: number;
  author_username: string;
  project_id: number;
  quality_score: number;
  review_cycles: number;
  critical_issues_count: number;
  fixes_implemented_count: number;
  time_to_first_review_hours?: number;
  time_to_merge_hours?: number;
  code_coverage: number;
  test_coverage: number;
  complexity_score: number;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  mr_title?: string;
  source_branch?: string;
  target_branch?: string;
}

export interface NotionIssue {
  id: string;
  notion_page_id: string;
  notion_issue_id: string;
  title: string;
  description?: string;
  issue_type: string;
  status: string;
  priority: string;
  priority_level: string;
  creator_id?: number;
  assignee_id?: number;
  project_id?: number;
  merge_request_id?: number;
  is_bug: boolean;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  updated_at?: string;
}

export interface IssueMetrics {
  id?: number;
  notion_issue_id: string;
  developer_id: number;
  project_id: number;
  action_type: 'created' | 'assigned' | 'resolved' | 'reopened';
  action_date: string;
  resolution_time_hours?: number;
  priority_level?: string;
  created_at: string;
  // Joined fields from NotionIssue
  title?: string;
  status?: string;
  priority?: string;
  is_bug?: boolean;
}

// API Response Types
export interface DeveloperPerformanceResponse {
  developers: DeveloperPerformanceMetrics[];
  summary: PerformanceSummary;
}

export interface PerformanceSummary {
  totalDevelopers: number;
  avgSuccessRate: number;
  avgQualityScore: number;
  avgMergeTime: number;
  totalMRs: number;
  totalIssuesResolved: number;
}

export interface MRQualityResponse {
  qualityMetrics: MRQualityMetrics[];
  efficiencyMetrics: MREfficiencyMetrics[];
}

export interface MREfficiencyMetrics {
  developer_id: number;
  username: string;
  avg_time_to_first_review: number;
  avg_time_to_merge: number;
  avg_review_cycles: number;
  efficiency_score: number;
}

export interface IssueTrackingResponse {
  issues: NotionIssue[];
  resolutionTimes: ResolutionTimeMetrics[];
}

export interface ResolutionTimeMetrics {
  developer_id: number;
  username: string;
  avg_resolution_time: number;
  issues_resolved: number;
  resolution_efficiency: number;
}

// Filter Types
export interface PerformanceFilters {
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
  developerId?: number;
}

export interface MRQualityFilters {
  dateFrom?: string;
  dateTo?: string;
  authorId?: number;
  projectId?: number;
}

export interface IssueTrackingFilters {
  dateFrom?: string;
  dateTo?: string;
  issueType?: string;
  projectId?: number;
  status?: string;
}

// Feature Completion Rate Types
export interface NotionTask {
  id?: number;
  notion_page_id: string;
  title: string;
  status: string;
  assignee_username?: string;
  assignee_name?: string;
  project_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TaskMRMapping {
  id?: number;
  notion_task_id: number;
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  is_merged?: boolean;
  merged_at?: string;
  created_at?: string;
}

export interface FeatureCompletionRate {
  id?: number;
  username: string;
  project_id?: number;
  month: number;
  year: number;
  total_tasks: number;
  tasks_with_mrs: number;
  completed_tasks: number;
  completion_rate: number;
  calculated_at?: string;
}

export interface CompletionRateResponse {
  username: string;
  projectId?: number;
  month: number;
  year: number;
  totalTasks: number;
  tasksWithMRs: number;
  completedTasks: number;
  completionRate: number;
  calculatedAt: string;
}

export interface TeamCompletionRateResponse {
  month: number;
  year: number;
  projectId?: number;
  teamStats: {
    totalDevelopers: number;
    avgCompletionRate: number;
    totalTasks: number;
    totalCompletedTasks: number;
  };
  developers: CompletionRateResponse[];
}

export interface CompletionRateTrend {
  month: number;
  year: number;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}

export interface CompletionRateTrendsResponse {
  username: string;
  projectId?: number;
  trends: CompletionRateTrend[];
}

export interface ProjectCompletionRateResponse {
  projectId: number;
  projectName?: string;
  month: number;
  year: number;
  teamStats: {
    totalDevelopers: number;
    avgCompletionRate: number;
    totalTasks: number;
    totalCompletedTasks: number;
  };
  developers: CompletionRateResponse[];
}

export interface CompletionRateStatsResponse {
  totalDevelopers: number;
  totalTasks: number;
  totalCompletedTasks: number;
  overallCompletionRate: number;
  topPerformers: Array<{
    username: string;
    completionRate: number;
    totalTasks: number;
  }>;
  monthlyTrends: Array<{
    month: number;
    year: number;
    avgCompletionRate: number;
    totalTasks: number;
  }>;
}

export interface CompletionRateFilters {
  month?: string; // Format: YYYY-MM
  projectId?: number;
  username?: string;
  months?: number; // For trends
}