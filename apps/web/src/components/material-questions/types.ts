export type MaterialTargetType = "resume" | "course";
export type MaterialQuestionStatus = "open" | "answered" | "resolved" | "hidden";

export interface MaterialQuestionsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type MaterialFollowUpRole = "buyer" | "owner";

export interface MaterialQuestionFollowupDto {
  id: string;
  body: string;
  role: MaterialFollowUpRole;
  createdAt: string;
  author: {
    id: string | null;
    displayName: string;
    avatarUrl: string | null;
    isAnonymous: boolean;
  };
}

export interface MaterialQuestionAnswerDto {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
  helpfulCount: number;
  viewerHasHelpful: boolean;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface MaterialQuestionDto {
  id: string;
  targetType: MaterialTargetType;
  resumeId: string | null;
  courseId: string | null;
  moduleId: string | null;
  anchorPage: number | null;
  anchorSeconds: number | null;
  title: string;
  body: string;
  isAnonymousToBuyers: boolean;
  status: MaterialQuestionStatus;
  createdAt: string;
  author: {
    id: string | null;
    displayName: string;
    avatarUrl: string | null;
    isAnonymous: boolean;
  };
  counts: {
    answers: number;
    meToo: number;
  };
  viewer: {
    canAnswer: boolean;
    canModerate: boolean;
    canReact: boolean;
    canEdit: boolean;
    canDelete: boolean;
    hasMeToo: boolean;
    isOwner: boolean;
    isQuestionAuthor: boolean;
    canFollowUp: boolean;
    followUpRole: MaterialFollowUpRole | null;
  };
  answers: MaterialQuestionAnswerDto[];
  followups: MaterialQuestionFollowupDto[];
}
