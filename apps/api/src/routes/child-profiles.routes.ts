import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  childProfileNoteParamsSchema,
  childProfileReminderParamsSchema,
  createChildProfileNoteBodySchema,
  createChildProfileReminderBodySchema,
  updateChildProfileNoteBodySchema,
  updateChildProfileReminderBodySchema
} from "../schemas/child-profile-notes-reminders.schemas.js";
import {
  childProfileParamsSchema,
  createChildProfileBodySchema,
  updateChildProfileBodySchema
} from "../schemas/child-profiles.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  archiveChildProfileNote,
  cancelChildProfileReminder,
  createChildProfileNote,
  createChildProfileReminder,
  listChildProfileNotes,
  listChildProfileReminders,
  type ChildProfileNoteResponse,
  type ChildProfileReminderResponse,
  updateChildProfileNote,
  updateChildProfileReminder
} from "../services/child-profile-notes-reminders.service.js";
import {
  createChildProfile,
  deleteChildProfile,
  listChildProfiles,
  listLifecycleRecommendations,
  type ChildProfileResponse,
  type LifecycleRecommendationResponse,
  updateChildProfile
} from "../services/child-profiles.service.js";

type ChildProfilesResponse = ApiResponse<{
  childProfiles: ChildProfileResponse[];
}>;

type ChildProfileResponseBody = ApiResponse<{
  childProfile: ChildProfileResponse;
}>;

type LifecycleRecommendationsResponse = ApiResponse<{
  groups: LifecycleRecommendationResponse[];
}>;

type DeleteChildProfileResponse = ApiResponse<{
  deleted: true;
}>;

type ChildProfileNotesResponse = ApiResponse<{
  notes: ChildProfileNoteResponse[];
}>;

type ChildProfileNoteResponseBody = ApiResponse<{
  note: ChildProfileNoteResponse;
}>;

type ArchiveChildProfileNoteResponse = ApiResponse<{
  archived: true;
}>;

type ChildProfileRemindersResponse = ApiResponse<{
  reminders: ChildProfileReminderResponse[];
}>;

type ChildProfileReminderResponseBody = ApiResponse<{
  reminder: ChildProfileReminderResponse;
}>;

type CancelChildProfileReminderResponse = ApiResponse<{
  cancelled: true;
}>;

export function registerChildProfileRoutes(app: FastifyInstance): void {
  app.get<{ Reply: ChildProfilesResponse | ApiFailure }>("/child-profiles", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        childProfiles: await listChildProfiles(app, currentUser.profile.id)
      }
    };
  });

  app.post<{ Body: unknown; Reply: ChildProfileResponseBody | ApiFailure }>(
    "/child-profiles",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = createChildProfileBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidChildProfileRequest());
      }

      return reply.status(201).send({
        ok: true,
        data: {
          childProfile: await createChildProfile(app, currentUser.profile.id, parsedBody.data)
        }
      });
    }
  );

  app.get<{ Reply: LifecycleRecommendationsResponse | ApiFailure }>(
    "/child-profiles/lifecycle-recommendations",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return {
        ok: true,
        data: {
          groups: await listLifecycleRecommendations(app, currentUser.profile.id)
        }
      };
    }
  );

  app.get<{
    Params: unknown;
    Reply: ChildProfileNotesResponse | ApiFailure;
  }>("/child-profiles/:childProfileId/notes", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileNoteParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await listChildProfileNotes(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        notes: result.notes
      }
    };
  });

  app.post<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileNoteResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId/notes", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileNoteParamsSchema.safeParse(request.params);
    const parsedBody = createChildProfileNoteBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await createChildProfileNote(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return reply.status(201).send({
      ok: true,
      data: {
        note: result.note
      }
    });
  });

  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileNoteResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId/notes/:noteId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileNoteParamsSchema.safeParse(request.params);
    const parsedBody = updateChildProfileNoteBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedParams.data.noteId || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await updateChildProfileNote(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedParams.data.noteId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        note: result.note
      }
    };
  });

  app.delete<{
    Params: unknown;
    Reply: ArchiveChildProfileNoteResponse | ApiFailure;
  }>("/child-profiles/:childProfileId/notes/:noteId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileNoteParamsSchema.safeParse(request.params);

    if (!parsedParams.success || !parsedParams.data.noteId) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await archiveChildProfileNote(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedParams.data.noteId
    );

    if (result === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        archived: true
      }
    };
  });

  app.get<{
    Params: unknown;
    Reply: ChildProfileRemindersResponse | ApiFailure;
  }>("/child-profiles/:childProfileId/reminders", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileReminderParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await listChildProfileReminders(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        reminders: result.reminders
      }
    };
  });

  app.post<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileReminderResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId/reminders", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileReminderParamsSchema.safeParse(request.params);
    const parsedBody = createChildProfileReminderBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await createChildProfileReminder(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return reply.status(201).send({
      ok: true,
      data: {
        reminder: result.reminder
      }
    });
  });

  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileReminderResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId/reminders/:reminderId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileReminderParamsSchema.safeParse(request.params);
    const parsedBody = updateChildProfileReminderBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedParams.data.reminderId || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await updateChildProfileReminder(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedParams.data.reminderId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        reminder: result.reminder
      }
    };
  });

  app.delete<{
    Params: unknown;
    Reply: CancelChildProfileReminderResponse | ApiFailure;
  }>("/child-profiles/:childProfileId/reminders/:reminderId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileReminderParamsSchema.safeParse(request.params);

    if (!parsedParams.success || !parsedParams.data.reminderId) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await cancelChildProfileReminder(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedParams.data.reminderId
    );

    if (result === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        cancelled: true
      }
    };
  });

  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileParamsSchema.safeParse(request.params);
    const parsedBody = updateChildProfileBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await updateChildProfile(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        childProfile: result.childProfile
      }
    };
  });

  app.delete<{
    Params: unknown;
    Reply: DeleteChildProfileResponse | ApiFailure;
  }>("/child-profiles/:childProfileId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await deleteChildProfile(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId
    );

    if (result === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        deleted: true
      }
    };
  });
}

function invalidChildProfileRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CHILD_PROFILE_REQUEST",
      message: "Child profile request is invalid."
    }
  };
}

function childProfileNotFound(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "CHILD_PROFILE_NOT_FOUND",
      message: "Child profile was not found."
    }
  };
}
