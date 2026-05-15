import type {
  CourseModule,
  Profile,
  RecordedCourse,
  Subject,
} from "@/lib/database.types";

export type CourseAuthor = Pick<
  Profile,
  "id" | "display_name" | "avatar_url" | "university" | "career"
>;

export type CourseSubject = Pick<
  Subject,
  "id" | "name" | "university" | "career"
>;

export type CourseModuleSummary = Pick<
  CourseModule,
  "id" | "position" | "title" | "description" | "duration_seconds"
>;

export type RecordedCourseItem = RecordedCourse & {
  profiles: CourseAuthor | null;
  subjects: CourseSubject | null;
  course_modules: CourseModuleSummary[];
};
