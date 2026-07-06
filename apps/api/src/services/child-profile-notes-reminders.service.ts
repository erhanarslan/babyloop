import {
  childProfileNotes,
  childProfileReminders,
  childProfiles
} from "@babyloop/database/schema";
import { and, asc, eq, lte, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  ChildProfileNoteType,
  ChildProfileReminderChannel,
  ChildProfileReminderScheduleKind,
  ChildProfileReminderStatus,
  ChildProfileReminderType,
  CreateChildProfileNoteBody,
  CreateChildProfileReminderBody
} from "../schemas/child-profile-notes-reminders.schemas.js";

const disallowedMedicalReminderCopyPattern =
  /(ilaç|ilac|ilacı|ilaci|ilaçı|ılaç|ılac|ılacı|ılaci|ılaçı|doz|dozu|dozaj|antibiyotik|antibiotic|paracetamol|parasetamol|calpol|aferin|ateş düşürücü|ates dusurucu|tedavi|treatment|medicine|medication|drug|dose|dosage|vitamin|vitamini|supplement|takviye|şurup|surup|damla|drop|drops|aşı|asi|vaccine|serum|antihistamin|antihistamine|kortizon|cortisone|ibuprofen|mg|ml)/iu;

function assertNoMedicalReminderCopy(input: {
  title?: string | null | undefined;
  description?: string | null | undefined;
  body?: string | null | undefined;
  content?: string | null | undefined;
}): void {
  const text = [input.title, input.description, input.body, input.content]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  if (!disallowedMedicalReminderCopyPattern.test(text)) {
    return;
  }

  const error = new Error("Child reminders cannot include medical, medication, diagnosis, treatment, or dosage instructions.");
  error.name = "ValidationError";
  throw error;
}

export type ChildProfileNoteResponse = {
  id: string;
  childProfileId: string;
  noteType: ChildProfileNoteType;
  title: string;
  body: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChildProfileReminderResponse = {
  id: string;
  childProfileId: string;
  title: string;
  description: string | null;
  reminderType: ChildProfileReminderType;
  scheduleKind: ChildProfileReminderScheduleKind;
  intervalMinutes: number | null;
  dueAt: string | null;
  eventAt: string | null;
  notifyBeforeMinutes: number | null;
  localTime: string | null;
  timezone: string;
  remindAt: string;
  nextRunAt: string | null;
  channel: ChildProfileReminderChannel;
  status: ChildProfileReminderStatus;
  lastTriggeredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpdateChildProfileNotePatch = {
  noteType?: ChildProfileNoteType | undefined;
  title?: string | undefined;
  body?: string | null | undefined;
  isPinned?: boolean | undefined;
  isArchived?: boolean | undefined;
};

type UpdateChildProfileReminderPatch = {
  title?: string | undefined;
  description?: string | null | undefined;
  reminderType?: ChildProfileReminderType | undefined;
  scheduleKind?: ChildProfileReminderScheduleKind | undefined;
  intervalMinutes?: number | null | undefined;
  remindAt?: Date | undefined;
  dueAt?: Date | null | undefined;
  eventAt?: Date | null | undefined;
  notifyBeforeMinutes?: number | null | undefined;
  localTime?: string | null | undefined;
  timezone?: string | undefined;
  channel?: ChildProfileReminderChannel | undefined;
  status?: ChildProfileReminderStatus | undefined;
};

export async function listChildProfileNotes(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string
): Promise<{ status: "ok"; notes: ChildProfileNoteResponse[] } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const rows = await app.db
    .select()
    .from(childProfileNotes)
    .where(and(
      eq(childProfileNotes.childProfileId, childProfileId),
      eq(childProfileNotes.isArchived, false)
    ))
    .orderBy(asc(childProfileNotes.createdAt));

  return {
    status: "ok",
    notes: rows.map(mapNote)
  };
}

export async function createChildProfileNote(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  body: CreateChildProfileNoteBody
): Promise<{ status: "created"; note: ChildProfileNoteResponse } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const [created] = await app.db
    .insert(childProfileNotes)
    .values({
      childProfileId,
      noteType: body.noteType,
      title: body.title,
      body: body.body ?? null,
      isPinned: body.isPinned
    })
    .returning();

  if (!created) {
    throw new Error("Child profile note could not be created.");
  }

  return {
    status: "created",
    note: mapNote(created)
  };
}

export async function updateChildProfileNote(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  noteId: string,
  body: UpdateChildProfileNotePatch
): Promise<{ status: "updated"; note: ChildProfileNoteResponse } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const [updated] = await app.db
    .update(childProfileNotes)
    .set({
      ...(body.noteType !== undefined ? { noteType: body.noteType } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
      ...(body.isArchived !== undefined ? { isArchived: body.isArchived } : {}),
      updatedAt: new Date()
    })
    .where(and(eq(childProfileNotes.id, noteId), eq(childProfileNotes.childProfileId, childProfileId)))
    .returning();

  if (!updated) {
    return { status: "not_found" };
  }

  return {
    status: "updated",
    note: mapNote(updated)
  };
}

export async function archiveChildProfileNote(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  noteId: string
): Promise<"archived" | "not_found"> {
  const result = await updateChildProfileNote(app, profileId, childProfileId, noteId, {
    isArchived: true
  });

  return result.status === "updated" ? "archived" : "not_found";
}

export async function listChildProfileReminders(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string
): Promise<{ status: "ok"; reminders: ChildProfileReminderResponse[] } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const rows = await app.db
    .select()
    .from(childProfileReminders)
    .where(and(
      eq(childProfileReminders.childProfileId, childProfileId),
      ne(childProfileReminders.status, "cancelled")
    ))
    .orderBy(asc(childProfileReminders.nextRunAt), asc(childProfileReminders.remindAt));

  return {
    status: "ok",
    reminders: rows.map(mapReminder)
  };
}

export async function createChildProfileReminder(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  body: CreateChildProfileReminderBody
): Promise<{
  status: "created"; reminder: ChildProfileReminderResponse } | { status: "not_found" }> {
  assertNoMedicalReminderCopy(body);
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const schedule = resolveReminderSchedule(body);
  const [created] = await app.db
    .insert(childProfileReminders)
    .values({
      childProfileId,
      title: body.title,
      description: body.description ?? null,
      reminderType: body.reminderType,
      scheduleKind: body.scheduleKind,
      intervalMinutes: body.intervalMinutes ?? null,
      dueAt: schedule.dueAt,
      eventAt: body.eventAt ?? null,
      notifyBeforeMinutes: body.notifyBeforeMinutes ?? null,
      localTime: body.localTime ?? null,
      timezone: body.timezone,
      remindAt: schedule.remindAt,
      nextRunAt: schedule.nextRunAt,
      channel: body.channel
    })
    .returning();

  if (!created) {
    throw new Error("Child profile reminder could not be created.");
  }

  return {
    status: "created",
    reminder: mapReminder(created)
  };
}

export async function updateChildProfileReminder(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  reminderId: string,
  body: UpdateChildProfileReminderPatch
): Promise<{
  status: "updated"; reminder: ChildProfileReminderResponse } | { status: "not_found" }> {
  assertNoMedicalReminderCopy(body);
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const now = new Date();
  const nextStatus = body.status;
  const schedule = resolveReminderPatch(body);

  const [updated] = await app.db
    .update(childProfileReminders)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.reminderType !== undefined ? { reminderType: body.reminderType } : {}),
      ...(body.scheduleKind !== undefined ? { scheduleKind: body.scheduleKind } : {}),
      ...(body.intervalMinutes !== undefined ? { intervalMinutes: body.intervalMinutes } : {}),
      ...(schedule.dueAt !== undefined ? { dueAt: schedule.dueAt } : {}),
      ...(body.eventAt !== undefined ? { eventAt: body.eventAt } : {}),
      ...(body.notifyBeforeMinutes !== undefined ? { notifyBeforeMinutes: body.notifyBeforeMinutes } : {}),
      ...(body.localTime !== undefined ? { localTime: body.localTime } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(schedule.remindAt !== undefined ? { remindAt: schedule.remindAt } : {}),
      ...(schedule.nextRunAt !== undefined ? { nextRunAt: schedule.nextRunAt } : {}),
      ...(body.channel !== undefined ? { channel: body.channel } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
      ...(nextStatus === "completed" ? { completedAt: now, cancelledAt: null } : {}),
      ...(nextStatus === "cancelled" ? { cancelledAt: now, completedAt: null } : {}),
      ...(nextStatus === "scheduled" ? { completedAt: null, cancelledAt: null } : {}),
      updatedAt: now
    })
    .where(and(
      eq(childProfileReminders.id, reminderId),
      eq(childProfileReminders.childProfileId, childProfileId)
    ))
    .returning();

  if (!updated) {
    return { status: "not_found" };
  }

  return {
    status: "updated",
    reminder: mapReminder(updated)
  };
}

export async function listDueChildProfileReminders(
  app: FastifyInstance,
  now: Date = new Date(),
  limit = 50
): Promise<Array<ChildProfileReminderResponse & { ownerProfileId: string; childLabel: string }>> {
  const rows = await app.db
    .select({
      reminder: childProfileReminders,
      ownerProfileId: childProfiles.profileId,
      childLabel: childProfiles.label
    })
    .from(childProfileReminders)
    .innerJoin(childProfiles, eq(childProfiles.id, childProfileReminders.childProfileId))
    .where(and(
      eq(childProfileReminders.status, "scheduled"),
      lte(childProfileReminders.nextRunAt, now),
      eq(childProfiles.isActive, true)
    ))
    .orderBy(asc(childProfileReminders.nextRunAt), asc(childProfileReminders.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...mapReminder(row.reminder),
    ownerProfileId: row.ownerProfileId,
    childLabel: row.childLabel
  }));
}

export async function advanceChildProfileReminderAfterTrigger(
  app: FastifyInstance,
  reminder: ChildProfileReminderResponse,
  now: Date = new Date()
): Promise<void> {
  const nextRunAt = getNextRunAfterTrigger(reminder, now);
  await app.db
    .update(childProfileReminders)
    .set({
      lastTriggeredAt: now,
      ...(nextRunAt
        ? {
            remindAt: nextRunAt,
            nextRunAt,
            status: "scheduled" as const
          }
        : {
            status: "completed" as const,
            completedAt: now
          }),
      updatedAt: now
    })
    .where(eq(childProfileReminders.id, reminder.id));
}

export async function cancelChildProfileReminder(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  reminderId: string
): Promise<"cancelled" | "not_found"> {
  const result = await updateChildProfileReminder(app, profileId, childProfileId, reminderId, {
    status: "cancelled"
  });

  return result.status === "updated" ? "cancelled" : "not_found";
}

async function ownsChildProfile(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string
): Promise<boolean> {
  const [row] = await app.db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childProfileId), eq(childProfiles.profileId, profileId)))
    .limit(1);

  return Boolean(row);
}

function mapNote(row: typeof childProfileNotes.$inferSelect): ChildProfileNoteResponse {
  return {
    id: row.id,
    childProfileId: row.childProfileId,
    noteType: row.noteType,
    title: row.title,
    body: row.body,
    isPinned: row.isPinned,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapReminder(row: typeof childProfileReminders.$inferSelect): ChildProfileReminderResponse {
  return {
    id: row.id,
    childProfileId: row.childProfileId,
    title: row.title,
    description: row.description,
    reminderType: row.reminderType as ChildProfileReminderType,
    scheduleKind: row.scheduleKind as ChildProfileReminderScheduleKind,
    intervalMinutes: row.intervalMinutes,
    dueAt: row.dueAt?.toISOString() ?? null,
    eventAt: row.eventAt?.toISOString() ?? null,
    notifyBeforeMinutes: row.notifyBeforeMinutes,
    localTime: row.localTime,
    timezone: row.timezone,
    remindAt: row.remindAt.toISOString(),
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    channel: row.channel,
    status: row.status,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function resolveReminderSchedule(body: CreateChildProfileReminderBody): {
  dueAt: Date | null;
  remindAt: Date;
  nextRunAt: Date;
} {
  const remindAt = computeNextRunAt({
    scheduleKind: body.scheduleKind,
    intervalMinutes: body.intervalMinutes ?? null,
    dueAt: body.dueAt ?? body.remindAt ?? null,
    eventAt: body.eventAt ?? null,
    notifyBeforeMinutes: body.notifyBeforeMinutes ?? null,
    localTime: body.localTime ?? null
  });

  return {
    dueAt: body.dueAt ?? body.remindAt ?? remindAt,
    remindAt,
    nextRunAt: remindAt
  };
}

function resolveReminderPatch(body: UpdateChildProfileReminderPatch): {
  dueAt?: Date | null;
  remindAt?: Date;
  nextRunAt?: Date;
} {
  if (
    body.scheduleKind === undefined &&
    body.intervalMinutes === undefined &&
    body.remindAt === undefined &&
    body.dueAt === undefined &&
    body.eventAt === undefined &&
    body.notifyBeforeMinutes === undefined &&
    body.localTime === undefined
  ) {
    return {};
  }

  const dueAt = body.dueAt !== undefined ? body.dueAt : body.remindAt;
  const nextRunAt = computeNextRunAt({
    scheduleKind: body.scheduleKind ?? "one_time",
    intervalMinutes: body.intervalMinutes ?? null,
    dueAt: dueAt ?? null,
    eventAt: body.eventAt ?? null,
    notifyBeforeMinutes: body.notifyBeforeMinutes ?? null,
    localTime: body.localTime ?? null
  });

  return {
    dueAt: dueAt ?? nextRunAt,
    remindAt: nextRunAt,
    nextRunAt
  };
}

function computeNextRunAt(input: {
  scheduleKind: ChildProfileReminderScheduleKind;
  intervalMinutes: number | null;
  dueAt: Date | null;
  eventAt: Date | null;
  notifyBeforeMinutes: number | null;
  localTime: string | null;
}, now = new Date()): Date {
  if (input.scheduleKind === "interval") {
    return new Date(now.getTime() + (input.intervalMinutes ?? 60) * 60 * 1000);
  }

  if (input.scheduleKind === "relative_before_event" && input.eventAt && input.notifyBeforeMinutes) {
    return new Date(input.eventAt.getTime() - input.notifyBeforeMinutes * 60 * 1000);
  }

  if ((input.scheduleKind === "daily" || input.scheduleKind === "weekly") && input.localTime) {
    return buildNextLocalTimeDate(input.localTime, input.scheduleKind, now);
  }

  return input.dueAt ?? now;
}

function buildNextLocalTimeDate(
  localTime: string,
  scheduleKind: Extract<ChildProfileReminderScheduleKind, "daily" | "weekly">,
  now: Date
): Date {
  const [hours = "10", minutes = "00"] = localTime.split(":");
  const next = new Date(now);
  next.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + (scheduleKind === "weekly" ? 7 : 1));
  }

  return next;
}

function getNextRunAfterTrigger(
  reminder: ChildProfileReminderResponse,
  now: Date
): Date | null {
  if (reminder.scheduleKind === "interval" && reminder.intervalMinutes) {
    return new Date(now.getTime() + reminder.intervalMinutes * 60 * 1000);
  }

  if (reminder.scheduleKind === "daily" && reminder.localTime) {
    return buildNextLocalTimeDate(reminder.localTime, "daily", now);
  }

  if (reminder.scheduleKind === "weekly" && reminder.localTime) {
    return buildNextLocalTimeDate(reminder.localTime, "weekly", now);
  }

  return null;
}
