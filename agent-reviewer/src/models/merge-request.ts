// Merge Request tracking models

export interface MergeRequestDetails {
  id: number;
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  title: string;
  description: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  source_branch: string;
  target_branch: string;
  status: 'opened' | 'merged' | 'closed' | 'locked';
  action: 'open' | 'update' | 'close' | 'merge' | 'reopen';
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  merge_time_hours?: number;
  repository_url: string;
  web_url: string;
  is_repopo_event: boolean;
  repopo_token?: string;
}

export interface UserMRStatistics {
  username: string;
  user_id: number;
  projects: ProjectMRStats[];
  overall: {
    total_mrs_created: number;
    total_mrs_merged: number;
    total_mrs_closed: number;
    total_mrs_rejected: number;
    success_rate: number;
    avg_merge_time_hours: number;
    last_mr_created_at?: string;
    last_mr_merged_at?: string;
  };
}

export interface ProjectMRStats {
  project_id: number;
  project_name: string;
  total_mrs_created: number;
  total_mrs_merged: number;
  success_rate: number;
  avg_merge_time_hours: number;
}

export interface MRAnalytics {
  total_mrs: number;
  mrs_by_status: {
    opened: number;
    merged: number;
    closed: number;
  };
  mrs_by_user: UserBreakdown[];
  mrs_by_project: ProjectBreakdown[];
  merge_time_trends: TimeSeriesData[];
  daily_mr_creation: TimeSeriesData[];
  repopo_vs_gitlab: {
    repopo_count: number;
    gitlab_count: number;
  };
}

export interface UserBreakdown {
  username: string;
  total_mrs: number;
  merged_mrs: number;
  success_rate: number;
  avg_merge_time_hours: number;
}

export interface ProjectBreakdown {
  project_id: number;
  project_name: string;
  total_mrs: number;
  merged_mrs: number;
  success_rate: number;
  avg_merge_time_hours: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

// API request/response types
export interface MergeRequestListParams {
  page?: number;
  limit?: number;
  project_id?: number;
  author_username?: string;
  status?: 'opened' | 'merged' | 'closed';
  from_date?: string;
  to_date?: string;
}

export interface AnalyticsFilters {
  from_date?: string;
  to_date?: string;
  project_id?: number;
  author_username?: string;
}

export interface ReportFilters extends AnalyticsFilters {
  format?: 'csv' | 'json';
}

// Database record types
export interface MergeRequestTrackingRecord {
  id?: number;
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  title: string;
  description?: string;
  author_id: number;
  author_username: string;
  author_name?: string;
  source_branch: string;
  target_branch: string;
  status: string;
  action: string;
  created_at: Date;
  updated_at: Date;
  merged_at?: Date;
  closed_at?: Date;
  merge_commit_sha?: string;
  repository_url: string;
  web_url: string;
  is_repopo_event: boolean;
  repopo_token?: string;
}

export interface UserMRStatisticsRecord {
  id?: number;
  user_id: number;
  username: string;
  project_id: number;
  total_mrs_created: number;
  total_mrs_merged: number;
  total_mrs_closed: number;
  total_mrs_rejected: number;
  avg_merge_time_hours?: number;
  last_mr_created_at?: Date;
  last_mr_merged_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// GitLab webhook event types for MR tracking
export interface GitLabMergeRequestEventForTracking {
  object_kind: 'merge_request';
  project: {
    id: number;
    name: string;
    web_url: string;
  };
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: string;
    action: string;
    author_id: number;
    source_branch: string;
    target_branch: string;
    created_at: string;
    updated_at: string;
    merged_at?: string;
    closed_at?: string;
    merge_commit_sha?: string;
    url: string;
  };
  user: {
    id: number;
    username: string;
    name: string;
  };
}
