import { StyleSheet } from "react-native";

export const colors = {
  // Canvas / surfaces
  canvas: "#F4F5F1",
  surface: "#FFFFFF",
  onSurface: "#1A1A18",
  surfaceSecondary: "#F5F5F3",
  onSurfaceSecondary: "#2C2C2A",
  surfaceTertiary: "#E8E8E6",
  onSurfaceTertiary: "#454542",
  surfaceInverse: "#1A1A18",
  onSurfaceInverse: "#FFFFFF",
  // Sidebar
  sidebar: "#FFFFFF",
  sidebarHover: "#F4F5F1",
  sidebarActive: "#E5EBE6",
  // Brand
  brand: "#3C5A44",
  brandSecondary: "#507559",
  brandTertiary: "#E5EBE6",
  onBrandTertiary: "#253A2A",
  onBrand: "#FFFFFF",
  // Semantic
  success: "#3C5A44",
  successSoft: "#E5EBE6",
  warning: "#C78B24",
  warningSoft: "#FFF4DE",
  error: "#B84B4B",
  errorSoft: "#FCE8E8",
  info: "#3B6EA8",
  infoSoft: "#E3EDF8",
  // Neutrals
  border: "#E8E8E6",
  borderStrong: "#CFCFCB",
  divider: "#F0F0ED",
  muted: "#8A8A85",
  mutedLight: "#B5B5B0",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const shadow = StyleSheet.create({
  card: {
    shadowColor: "#0B120E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHover: {
    shadowColor: "#0B120E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});
