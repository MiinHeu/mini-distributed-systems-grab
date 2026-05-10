export const Colors = {
  primary: '#00AF50', primaryDark: '#008A3E', primaryLight: '#E8F8EF',
  primaryGlow: 'rgba(0,175,80,0.15)',
  accent: '#1D4ED8', accentLight: '#EFF6FF',
  danger: '#EF4444', dangerLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
  success: '#10B981', successLight: '#D1FAE5',
  black: '#0A0A0A', gray900: '#111827', gray700: '#374151',
  gray600: '#4B5563', gray400: '#9CA3AF', gray300: '#D1D5DB',
  gray200: '#E5E7EB', gray100: '#F3F4F6', gray50: '#F9FAFB', white: '#FFFFFF',
  pickup: '#00AF50', dropoff: '#EF4444', route: '#1D4ED8',
  nodeOnline: '#00AF50', nodeOffline: '#EF4444', nodeReadonly: '#F59E0B',
  bgScreen: '#F3F4F6', bgCard: '#FFFFFF', bgInput: '#F9FAFB',
};
export const Spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32 };
export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999 };
export const Shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 5 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 10 },
  primary: { shadowColor: '#00AF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 8, elevation: 6 },
};
export const Typography = {
  h1: { fontSize: 26, fontWeight: '800' as const, color: '#111827' },
  h2: { fontSize: 22, fontWeight: '700' as const, color: '#111827' },
  h3: { fontSize: 18, fontWeight: '700' as const, color: '#111827' },
  h4: { fontSize: 16, fontWeight: '600' as const, color: '#111827' },
  body: { fontSize: 15, fontWeight: '400' as const, color: '#374151' },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, color: '#374151' },
  small: { fontSize: 13, fontWeight: '400' as const, color: '#4B5563' },
  smallBold: { fontSize: 13, fontWeight: '600' as const, color: '#4B5563' },
  tiny: { fontSize: 11, fontWeight: '400' as const, color: '#9CA3AF' },
};
