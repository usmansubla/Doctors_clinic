import { useWindowDimensions } from "react-native";

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const contentMaxWidth = isDesktop ? 1100 : width;
  return { width, isDesktop, isTablet, contentMaxWidth };
}
