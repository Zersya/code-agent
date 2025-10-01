// Developer Performance Types
export interface DeveloperPerformanceMetrics {
  id?: number;
  developer_id: number;
  project_id: number;
  performance_date: string;
  total_mrs: number;
  merged_mrs: number;
  success_rate: number;
  avg_merge_time_hours: number;
  quality_score: number;
  issues_created: number;
  issues_resolved: number;
  avg_resolution_time_days: number;
  calculated_at?: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  username?: string;
  developer_name?: string;
  project_name?: string;
}

export interface MRQualityMetrics {
  id?: number;
  merge_request_id: number;
  developer_id: number;
  project_id: number;
  quality_score: number;
  review_cycles: number;
  critical_issues_count: number;
  fixes_implemented_count: number;
  time_to_first_review_hours?: number;
  time_to_merge_hours?: number;
  code_complexity_score?: number;
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
  title: string;
  description?: string;
  issue_type: string;
  status: string;
  priority_level: string;
  creator_id?: number;
  assignee_id?: number;
  project_id?: number;
  merge_request_id?: number;
  created_at?: string;
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
  resolution_time_days?: number;
  priority_level?: string;
  created_at?: string;
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
  assignee_id?: number;
  assignee_username?: string;
  assignee_name?: string;
  project_id?: number;
  created_at: Date;
  completed_at?: Date;
  // Additional timing fields from Notion for later calculations
  estimation_start?: Date;
  estimation_end?: Date;
  developer_start?: Date;
  developer_end?: Date;
  ready_to_test_at?: Date;
  // New fields for bug fix lead time
  task_type?: string;
  notion_created_at?: Date;
  points?: number;

  updated_at?: Date;
  // Joined fields
  project_name?: string;
}

export interface TaskMRMapping {
  id?: number;
  notion_task_id: number;
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  created_at?: string;
  updated_at?: string;
  // Joined fields from merge_request_tracking
  task_title?: string;
  mr_title?: string;
  mr_status?: string;
  mr_merged_at?: string;
  mr_web_url?: string;
  mr_approved_at?: string;
  mr_created_at?: string;
}

export interface FeatureCompletionRate {
  id?: number;
  developer_id?: number;
  username: string;
  project_id: number;
  month: number;
  year: number;
  total_tasks: number;
  tasks_with_mrs: number;
  completed_tasks: number;
  completion_rate: number;
  calculated_at: Date;
  created_at?: Date;
  updated_at?: Date;
  // Joined fields
  project_name?: string;
  developer_name?: string;
}

export interface CompletionRateBreakdown {
  taskId: number;
  taskTitle: string;
  taskStatus: string;
  hasAssociatedMR: boolean;
  mrStatus?: string;
  mrMergedAt?: Date;
  isCompleted: boolean;
  // Timing fields for validation/analytics
  estimationStart?: Date;
  estimationEnd?: Date;
  developerStart?: Date;
  developerEnd?: Date;
  completedAt?: Date;
  // MR timing fields
  approvalAt?: Date;
  // Derived analytics
  devLeadTimeHours?: number;
  qaTimeHours?: number;
  approvalTimeHours?: number;
  estimationOverrunHours?: number;
  isLate?: boolean;
  // Links & identifiers for UI actions
  notionPageId?: string;
  mrProjectId?: number;
  mrIid?: number;
  mrWebUrl?: string;
}

export interface CompletionRateResponse {
  developerId?: number;
  username: string;
  month: string;
  totalTasks: number;
  tasksWithMRs: number;
  completedTasks: number;
  completionRate: number;
  taskBreakdown: CompletionRateBreakdown[];
  projectId?: number;
  projectName?: string;
}

export interface TeamCompletionRateResponse {
  month: string;
  teamStats: {
    avgCompletionRate: number;
    totalDevelopers: number;
    totalTasks: number;
    totalCompletedTasks: number;
  };
  developers: CompletionRateResponse[];
}

export interface CompletionRateTrend {
  month: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}

export interface CompletionRateTrendsResponse {
  developerId?: number;
  username: string;
  trends: CompletionRateTrend[];
}

export interface CompletionRateFilters {
  month?: string;
  developerId?: number;
  username?: string;
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
}