export type BindingStatus =
  | "linked"
  | "already_linked"
  | "conflict"
  | "missing_session";

export interface CourseDto {
  id: string;
  externalId: string;
  title: string;
  subtitle: string;
  coverImageUrl: string | null;
  buyUrl: string;
  accessUrl: string | null;
}

export interface BootstrapResponse {
  bindingStatus: BindingStatus;
  conflictSessionId: string | null;
  ownedCourses: CourseDto[];
  availableCourses: CourseDto[];
  user: {
    id: number;
    firstName: string;
    username: string | null;
  };
}
