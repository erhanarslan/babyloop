import {
  mobileAuthFetch,
  type MobileApiResponse
} from "../auth/auth-api";

export type MobileChildAgeBand =
  | "expecting"
  | "newborn_0_3"
  | "infant_3_6"
  | "infant_6_12"
  | "toddler_12_24"
  | "preschool_24_36"
  | "child_3_plus";

export type MobileChildProfileNotificationCadence = "off" | "monthly" | "yearly";

export type MobileChildProfile = {
  id: string;
  label: string;
  ageBand: MobileChildAgeBand;
  ageMonths: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  gender: "female" | "male" | "prefer_not_to_say" | null;
  notificationCadence: MobileChildProfileNotificationCadence;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MobileChildNote = {
  id: string;
  childProfileId: string;
  noteType:
    | "general"
    | "feeding"
    | "diaper"
    | "sleep"
    | "activity"
    | "shopping"
    | "health_note"
    | "size"
    | "preference"
    | "daycare"
    | "milestone";
  title: string;
  body: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MobileChildReminder = {
  id: string;
  childProfileId: string;
  title: string;
  description: string | null;
  reminderType: "feeding" | "diaper" | "sleep" | "activity" | "shopping" | "appointment" | "general";
  scheduleKind: "one_time" | "interval" | "daily" | "weekly" | "relative_before_event";
  intervalMinutes: number | null;
  dueAt: string | null;
  eventAt: string | null;
  notifyBeforeMinutes: number | null;
  localTime: string | null;
  timezone: string;
  remindAt: string;
  channel: "in_app" | "email_draft";
  nextRunAt: string | null;
  status: "scheduled" | "paused" | "completed" | "cancelled";
  lastTriggeredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMobileChildProfileRequest = {
  label: string;
  ageBand: MobileChildAgeBand;
  notificationCadence?: MobileChildProfileNotificationCadence;
};

export type UpdateMobileChildProfileRequest = Partial<{
  label: string;
  ageBand: MobileChildAgeBand;
  notificationCadence: MobileChildProfileNotificationCadence;
  isActive: boolean;
}>;

export type CreateMobileChildNoteRequest = {
  noteType?: MobileChildNote["noteType"];
  title: string;
  body?: string | null;
  isPinned?: boolean;
};

export type CreateMobileChildReminderRequest = {
  title: string;
  description?: string | null;
  reminderType?: MobileChildReminder["reminderType"];
  scheduleKind?: MobileChildReminder["scheduleKind"];
  intervalMinutes?: number;
  remindAt?: string;
  dueAt?: string;
  eventAt?: string;
  notifyBeforeMinutes?: number;
  localTime?: string;
  timezone?: string;
  channel?: MobileChildReminder["channel"];
};

export async function fetchMobileChildProfiles(): Promise<MobileApiResponse<{
  childProfiles: MobileChildProfile[];
}>> {
  return requestMobileChildApi("/api/v1/child-profiles");
}

export async function createMobileChildProfile(
  payload: CreateMobileChildProfileRequest
): Promise<MobileApiResponse<{ childProfile: MobileChildProfile }>> {
  return requestMobileChildApi("/api/v1/child-profiles", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMobileChildProfile(
  childProfileId: string,
  payload: UpdateMobileChildProfileRequest
): Promise<MobileApiResponse<{ childProfile: MobileChildProfile }>> {
  return requestMobileChildApi(`/api/v1/child-profiles/${encodeURIComponent(childProfileId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function fetchMobileChildNotes(
  childProfileId: string
): Promise<MobileApiResponse<{ notes: MobileChildNote[] }>> {
  return requestMobileChildApi(`/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/notes`);
}

export async function createMobileChildNote(
  childProfileId: string,
  payload: CreateMobileChildNoteRequest
): Promise<MobileApiResponse<{ note: MobileChildNote }>> {
  return requestMobileChildApi(`/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/notes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function archiveMobileChildNote(
  childProfileId: string,
  noteId: string
): Promise<MobileApiResponse<{ archived: true }>> {
  return requestMobileChildApi(
    `/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/notes/${encodeURIComponent(noteId)}`,
    {
      method: "DELETE"
    }
  );
}

export async function fetchMobileChildReminders(
  childProfileId: string
): Promise<MobileApiResponse<{ reminders: MobileChildReminder[] }>> {
  return requestMobileChildApi(`/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/reminders`);
}

export async function createMobileChildReminder(
  childProfileId: string,
  payload: CreateMobileChildReminderRequest
): Promise<MobileApiResponse<{ reminder: MobileChildReminder }>> {
  return requestMobileChildApi(`/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/reminders`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function completeMobileChildReminder(
  childProfileId: string,
  reminderId: string
): Promise<MobileApiResponse<{ reminder: MobileChildReminder }>> {
  return requestMobileChildApi(
    `/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" })
    }
  );
}

export async function cancelMobileChildReminder(
  childProfileId: string,
  reminderId: string
): Promise<MobileApiResponse<{ cancelled: true }>> {
  return requestMobileChildApi(
    `/api/v1/child-profiles/${encodeURIComponent(childProfileId)}/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: "DELETE"
    }
  );
}

async function requestMobileChildApi<T>(
  path: string,
  init: RequestInit = {}
): Promise<MobileApiResponse<T>> {
  try {
    const headers = new Headers(init.headers);

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await mobileAuthFetch(path, {
      ...init,
      headers
    });

    return parseMobileChildApiResponse<T>(response);
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop API bağlantısı kurulamadı."
      }
    };
  }
}

async function parseMobileChildApiResponse<T>(response: Response): Promise<MobileApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => null);

  if (isMobileApiResponse<T>(payload)) {
    return payload;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: `Request failed with status ${response.status}.`
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "INVALID_API_RESPONSE",
      message: "BabyLoop API returned an invalid response."
    }
  };
}

function isMobileApiResponse<T>(value: unknown): value is MobileApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok === true) {
    return "data" in value;
  }

  return isRecord(value.error) && typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
