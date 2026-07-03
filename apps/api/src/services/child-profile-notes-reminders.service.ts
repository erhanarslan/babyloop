import {
  childProfileNotes,
  childProfileReminders,
  childProfiles
} from "@babyloop/database/schema";
import { and, asc, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  ChildProfileNoteType,
  ChildProfileReminderChannel,
  ChildProfileReminderStatus,
  CreateChildProfileNoteBody,
  CreateChildProfileReminderBody
} from "../schemas/child-profile-notes-reminders.schemas.js";

export type ChildProfileNoteResponse = {
  id: string;
  childProfileId: string;
  noteType: ChildProfileNoteType;
  title: string;
  body: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChildProfileReminderResponse = {
  id: string;
  childProfileId: string;
  title: string;
  description: string | null;
  remindAt: string;
  channel: ChildProfileReminderChannel;
  status: ChildProfileReminderStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpdateChildProfileNotePatch = {
  noteType?: ChildProfileNoteType | undefined;
  title?: string | undefined;
  body?: string | null | undefined;
  isArchived?: boolean | undefined;
};

type UpdateChildProfileReminderPatch = {
  title?: string | undefined;
  description?: string | null | undefined;
  remindAt?: Date | undefined;
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
      body: body.body ?? null
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
    .orderBy(asc(childProfileReminders.remindAt));

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
): Promise<{ status: "created"; reminder: ChildProfileReminderResponse } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const [created] = await app.db
    .insert(childProfileReminders)
    .values({
      childProfileId,
      title: body.title,
      description: body.description ?? null,
      remindAt: body.remindAt,
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
): Promise<{ status: "updated"; reminder: ChildProfileReminderResponse } | { status: "not_found" }> {
  if (!(await ownsChildProfile(app, profileId, childProfileId))) {
    return { status: "not_found" };
  }

  const now = new Date();
  const nextStatus = body.status;

  const [updated] = await app.db
    .update(childProfileReminders)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.remindAt !== undefined ? { remindAt: body.remindAt } : {}),
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
    remindAt: row.remindAt.toISOString(),
    channel: row.channel,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
