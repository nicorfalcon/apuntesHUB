import { describe, it, expect } from "vitest";
import {
  COURSE_VIDEO_ALLOWED_TYPES,
  isAllowedCourseVideoType,
  getCourseVideoExtension,
} from "../config";

describe("isAllowedCourseVideoType", () => {
  it("dado un tipo permitido, entonces devuelve true", () => {
    for (const type of COURSE_VIDEO_ALLOWED_TYPES) {
      expect(isAllowedCourseVideoType(type)).toBe(true);
    }
  });

  it("dado un tipo no permitido, entonces devuelve false", () => {
    expect(isAllowedCourseVideoType("video/avi")).toBe(false);
    expect(isAllowedCourseVideoType("image/png")).toBe(false);
    expect(isAllowedCourseVideoType("")).toBe(false);
  });
});

describe("getCourseVideoExtension", () => {
  it("dado un nombre de archivo con extensión conocida, entonces la extrae (case-insensitive)", () => {
    expect(getCourseVideoExtension("clase.mp4", "video/mp4")).toBe("mp4");
    expect(getCourseVideoExtension("CLASE.WEBM", "video/webm")).toBe("webm");
    expect(getCourseVideoExtension("grabacion.MOV", "video/quicktime")).toBe("mov");
  });

  it("dado un nombre sin extensión, entonces la deriva del content-type", () => {
    expect(getCourseVideoExtension("sin-extension", "video/webm")).toBe("webm");
    expect(getCourseVideoExtension("sin-extension", "video/quicktime")).toBe("mov");
  });

  it("dado un nombre y content-type sin pista clara, entonces cae a mp4 por defecto", () => {
    expect(getCourseVideoExtension("archivo", "video/mp4")).toBe("mp4");
    expect(getCourseVideoExtension("archivo", "application/octet-stream")).toBe("mp4");
  });

  it("dado un nombre con extensión, entonces ésta gana sobre el content-type", () => {
    // El archivo dice .mov pero el content-type es mp4: manda la extensión real.
    expect(getCourseVideoExtension("video.mov", "video/mp4")).toBe("mov");
  });
});
