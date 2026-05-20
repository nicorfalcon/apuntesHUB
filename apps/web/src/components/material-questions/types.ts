export type MaterialTargetType = "resume" | "course";
export type MaterialQuestionStatus = "open" | "answered" | "resolved" | "hidden";

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
    hasMeToo: boolean;
    isOwner: boolean;
  };
  answers: MaterialQuestionAnswerDto[];
}
