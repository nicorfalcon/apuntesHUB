export const COURSE_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;
export const COURSE_VIDEO_MAX_LABEL = "1 GB";

export const COURSE_VIDEO_ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export function isAllowedCourseVideoType(contentType: string) {
  return COURSE_VIDEO_ALLOWED_TYPES.has(contentType);
}

export function getCourseVideoExtension(fileName: string, contentType: string) {
  const extension = fileName.toLowerCase().match(/\.(mp4|webm|mov)$/)?.[1];
  if (extension) return extension;
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  return "mp4";
}
