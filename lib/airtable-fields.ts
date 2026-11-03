const PUBLIC_ORIGIN = "https://wonders.hackclub.com";

export type FieldName =
  | "Code URL"
  | "Playable URL"
  | "First Name"
  | "Last Name"
  | "Email"
  | "Description"
  | "GitHub Username"
  | "Address (Line 1)"
  | "Address (Line 2)"
  | "City"
  | "State / Province"
  | "Country"
  | "ZIP / Postal Code"
  | "Birthday"
  | "Screenshot"
  | "Optional - Override Hours Spent"
  | "Justification - Hackatime Project Name(s) + Date Range(s)"
  | "Justification - Specific Technical Features"
  | "Justification - Additional Justification";

export interface AirtableInput {
  repoUrl: string;
  demoUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  description: string;
  imageUrl: string;
  hours: number | null;
  hackatimeProjects: string[];
  technicalNotes: string;
  additionalNotes: string;
  birthday: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  zip: string;
}

export function githubUsernameFromRepoUrl(repoUrl: string): string {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    return "";
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return "";
  }
  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

export function absoluteImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return "";
  }
  if (imageUrl.startsWith("/")) {
    return PUBLIC_ORIGIN + imageUrl;
  }
  return imageUrl;
}

export function hoursFromSeconds(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) {
    return null;
  }
  return Math.round((Number(seconds) / 3600) * 10) / 10;
}

export function buildAirtableFields(input: AirtableInput): Partial<Record<FieldName, unknown>> {
  const fields: Partial<Record<FieldName, unknown>> = {
    "Code URL": input.repoUrl,
    "Playable URL": input.demoUrl,
    "First Name": input.firstName,
    "Last Name": input.lastName,
    Email: input.email,
    Description: input.description,
    "GitHub Username": githubUsernameFromRepoUrl(input.repoUrl),
    "Address (Line 1)": input.addressLine1,
    "Address (Line 2)": input.addressLine2,
    City: input.city,
    "State / Province": input.state,
    Country: input.country,
    "ZIP / Postal Code": input.zip,
  };
  if (input.birthday) {
    fields.Birthday = input.birthday;
  }
  if (input.hours !== null) {
    fields["Optional - Override Hours Spent"] = input.hours;
  }
  if (input.imageUrl) {
    fields.Screenshot = [{ url: input.imageUrl }];
  }
  if (input.hackatimeProjects.length > 0) {
    fields["Justification - Hackatime Project Name(s) + Date Range(s)"] = input.hackatimeProjects.join(", ");
  }
  if (input.technicalNotes) {
    fields["Justification - Specific Technical Features"] = input.technicalNotes;
  }
  if (input.additionalNotes) {
    fields["Justification - Additional Justification"] = input.additionalNotes;
  }
  return fields;
}
