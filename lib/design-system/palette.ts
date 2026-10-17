/** Shared Daira design tokens. Keep these values aligned with app/globals.css. */
export const dairaPalette = {
  background: {
    page: "#F4F7FC",
    section: "#EEF3FB",
    surface: "#FFFFFF",
    surfaceHover: "#F8FAFC",
    surfaceActive: "#F1F5F9",
  },
  primary: {
    main: "#2F61FD",
    hover: "#1E4BD8",
    active: "#1539A8",
    disabledBackground: "#E2E8F0",
    disabledText: "#94A3B8",
  },
  secondary: {
    outline: "#CBD5E1",
    hoverBackground: "#EFF6FF",
    activeBackground: "#DBEAFE",
  },
  text: {
    heading: "#18233C",
    body: "#5A6B87",
    muted: "#94A3B8",
    link: "#2F61FD",
    linkHover: "#1E4BD8",
  },
  form: {
    background: "#FFFFFF",
    border: "#E2E8F0",
    borderHover: "#CBD5E1",
    focus: "#2F61FD",
    error: "#EF4444",
  },
  status: {
    accent: "#DB4CF2",
    accentHover: "#C026D3",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  border: "#E2E8F0",
  heroGlow: "#E0EAFF",
  pinkGlow: "#FCE7F3",
} as const;

export type DairaPalette = typeof dairaPalette;
