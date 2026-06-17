import { describe, expect, it } from "vitest";
import {
  childProfileParamsSchema,
  createChildProfileBodySchema,
  updateChildProfileBodySchema
} from "../src/schemas/child-profiles.schemas.js";

describe("child profile schemas", () => {
  it("accepts a safe child profile create payload", () => {
    const result = createChildProfileBodySchema.safeParse({
      label: "Çocuğum",
      ageBand: "infant_6_12",
      ageMonths: 9,
      gender: "prefer_not_to_say",
      notificationCadence: "monthly",
      isActive: true
    });

    expect(result.success).toBe(true);
  });

  it("defaults the child profile label and active state", () => {
    const result = createChildProfileBodySchema.safeParse({
      ageBand: "newborn_0_3"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.label).toBe("Çocuğum");
    expect(result.data.isActive).toBe(true);
    expect(result.data.notificationCadence).toBe("off");
  });

  it("rejects unsupported child age bands", () => {
    const result = createChildProfileBodySchema.safeParse({
      ageBand: "exact_birth_date"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown create fields", () => {
    const result = createChildProfileBodySchema.safeParse({
      ageBand: "infant_6_12",
      exactBirthDate: "2025-01-01"
    });

    expect(result.success).toBe(false);
  });

  it("accepts birth month and year without exact birth day", () => {
    const result = createChildProfileBodySchema.safeParse({
      label: "Kızım",
      ageBand: "toddler_12_24",
      birthMonth: 1,
      birthYear: 2024,
      gender: "female",
      notificationCadence: "yearly"
    });

    expect(result.success).toBe(true);
  });

  it("rejects incomplete birth month and year details", () => {
    const result = createChildProfileBodySchema.safeParse({
      label: "Oğlum",
      ageBand: "toddler_12_24",
      birthMonth: 1
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one update field", () => {
    const result = updateChildProfileBodySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("accepts safe child profile update payloads", () => {
    const result = updateChildProfileBodySchema.safeParse({
      ageBand: "toddler_12_24",
      ageMonths: 18,
      notificationCadence: "off",
      isActive: false
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid child profile id param", () => {
    const result = childProfileParamsSchema.safeParse({
      childProfileId: "00000000-0000-0000-0000-000000000001"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid child profile id params", () => {
    const result = childProfileParamsSchema.safeParse({
      childProfileId: "not-a-uuid"
    });

    expect(result.success).toBe(false);
  });
});
