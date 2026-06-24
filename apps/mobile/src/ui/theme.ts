export const colors = {
  background: "#fff7f2",
  surface: "#ffffff",
  surfaceSoft: "#fff1e8",
  primary: "#d75f3f",
  primaryDark: "#a9432c",
  text: "#2f2521",
  muted: "#74645d",
  subtle: "#9a8176",
  border: "#f0d5c7",
  success: "#34785c",
  warning: "#9a6b25",
  cream: "#ffe5d6",
  peach: "#f7c8b5"
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32
} as const;

export const shadows = {
  card: {
    shadowColor: "#7a3e2d",
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  }
} as const;
