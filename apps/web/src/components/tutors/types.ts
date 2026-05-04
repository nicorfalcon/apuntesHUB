import type {
  Profile,
  Subject,
  TutorAvailability,
  TutorSubject,
} from "@/lib/database.types";

export type TutorProfile = Pick<
  Profile,
  | "id"
  | "display_name"
  | "avatar_url"
  | "university"
  | "career"
  | "bio"
  | "tutor_bio"
  | "tutor_verified_at"
  | "tutor_rating_avg"
  | "tutor_rating_count"
>;

export type TutorSubjectItem = TutorSubject & {
  subject: Subject;
};

export type TutorAvailabilitySlot = TutorAvailability;

export interface TutorListItem {
  id: string;
  profile: TutorProfile;
  subjects: TutorSubjectItem[];
  availability: TutorAvailabilitySlot[];
  minHourlyRate: number;
}

