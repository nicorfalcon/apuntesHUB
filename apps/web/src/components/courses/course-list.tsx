import { CourseCard } from "./course-card";
import type { RecordedCourseItem } from "./types";

interface CourseListProps {
  courses: RecordedCourseItem[];
}

export function CourseList({ courses }: CourseListProps) {
  const [featuredCourse, ...rest] = courses;

  if (!featuredCourse) return null;

  return (
    <div className="space-y-5">
      <CourseCard course={featuredCourse} featured />
      {rest.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {rest.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
