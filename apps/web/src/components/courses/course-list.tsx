import { CourseCard } from "./course-card";
import type { RecordedCourseItem } from "./types";

interface CourseListProps {
  courses: RecordedCourseItem[];
}

export function CourseList({ courses }: CourseListProps) {
  if (courses.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
