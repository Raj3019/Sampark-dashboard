import { SabhaType } from '@/lib/types';

export const SABHA_TYPES: SabhaType[] = [
  'Chirag Nagar',
  'Chirag Nagar(Kishor)',
  'Bal Sabha',
];

export const SABHA_DISPLAY: Record<SabhaType, {
  shortLabel: string;
  fullLabel: string;
  navLabel: string;
  route: string;
  accent: 'blue' | 'purple' | 'orange';
  emoji: string;
  subtitle: string;
}> = {
  'Chirag Nagar': {
    shortLabel: 'CN',
    fullLabel: 'Chirag Nagar Sabha',
    navLabel: 'Yuva Sabha',
    route: '/sabha/chirag-nagar',
    accent: 'blue',
    emoji: 'YS',
    subtitle: 'STD 13+ · Senior gathering',
  },
  'Chirag Nagar(Kishor)': {
    shortLabel: 'AYC',
    fullLabel: 'AYC Sabha',
    navLabel: 'AYC Sabha',
    route: '/sabha/kishor',
    accent: 'purple',
    emoji: 'KS',
    subtitle: 'STD 9-12 · Youth gathering',
  },
  'Bal Sabha': {
    shortLabel: 'Bal',
    fullLabel: 'Bal Sabha',
    navLabel: 'Bal Sabha',
    route: '/sabha/bal',
    accent: 'orange',
    emoji: 'BS',
    subtitle: 'Bal karyakar and attendance',
  },
};
