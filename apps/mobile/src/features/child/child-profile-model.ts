import type {
  CreateMobileChildProfileRequest,
  MobileChildAgeBand,
  MobileChildProfile
} from "./child-reminders-api";

export type MobileChildProfileSetupState = {
  ageMonths: string;
  label: string;
};

export type MobileChildProfileSetupResult =
  | { ok: true; payload: CreateMobileChildProfileRequest }
  | { ok: false; message: string };

export function createMobileChildProfileSetupState(): MobileChildProfileSetupState {
  return {
    ageMonths: "",
    label: ""
  };
}

export function buildMobileChildProfileCreatePayload(
  state: MobileChildProfileSetupState
): MobileChildProfileSetupResult {
  const label = state.label.trim().replace(/\s+/gu, " ");
  const normalizedAge = state.ageMonths.trim();
  const ageMonths = Number(normalizedAge);

  if (!label) {
    return { ok: false, message: "Çocuğun için bir isim veya kısa ad yazmalısın." };
  }

  if (label.length > 80) {
    return { ok: false, message: "İsim en fazla 80 karakter olabilir." };
  }

  if (!/^\d{1,3}$/u.test(normalizedAge) || !Number.isInteger(ageMonths) || ageMonths > 216) {
    return { ok: false, message: "Yaşı 0–216 arasında tamamlanmış ay olarak yazmalısın." };
  }

  return {
    ok: true,
    payload: {
      label,
      ageBand: deriveMobileChildAgeBand(ageMonths),
      ageMonths,
      notificationCadence: "monthly"
    }
  };
}

export function formatMobileChildAge(profile: Pick<MobileChildProfile, "ageBand" | "ageMonths">): string {
  if (profile.ageMonths !== null) {
    if (profile.ageMonths < 24) {
      return `${profile.ageMonths} aylık`;
    }

    const years = Math.floor(profile.ageMonths / 12);
    const months = profile.ageMonths % 12;

    return months === 0 ? `${years} yaşında` : `${years} yaş ${months} aylık`;
  }

  return formatMobileChildAgeBand(profile.ageBand);
}

export function formatMobileChildBirthDate(
  profile: Pick<MobileChildProfile, "birthMonth" | "birthYear">
): string | null {
  if (profile.birthMonth === null || profile.birthYear === null) {
    return null;
  }

  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık"
  ];

  const monthName = monthNames[profile.birthMonth - 1];

  return monthName ? `${monthName} ${profile.birthYear}` : null;
}

function deriveMobileChildAgeBand(ageMonths: number): MobileChildAgeBand {
  if (ageMonths < 3) return "newborn_0_3";
  if (ageMonths < 6) return "infant_3_6";
  if (ageMonths < 12) return "infant_6_12";
  if (ageMonths < 24) return "toddler_12_24";
  if (ageMonths < 36) return "preschool_24_36";
  return "child_3_plus";
}

function formatMobileChildAgeBand(ageBand: MobileChildAgeBand): string {
  const labels: Record<MobileChildAgeBand, string> = {
    expecting: "Bebek bekleniyor",
    newborn_0_3: "0–3 ay",
    infant_3_6: "3–6 ay",
    infant_6_12: "6–12 ay",
    toddler_12_24: "12–24 ay",
    preschool_24_36: "24–36 ay",
    child_3_plus: "3 yaş ve üzeri"
  };

  return labels[ageBand];
}
