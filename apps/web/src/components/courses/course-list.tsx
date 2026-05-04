import { CourseCard } from "./course-card";
import type { RecordedCourseItem } from "./types";

interface CourseListProps {
  courses: RecordedCourseItem[];
}

export function CourseList({ courses }: CourseListProps) {
  const [featuredCourse, ...rest] = courses;

  if (!featuredCourse) return null;

  return (
    <div className="space-y-4">
      <CourseCard course={featuredCourse} featured />
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
