import type { Biz } from '../src/types';
export const businessDefaults: Readonly<Biz>;
export function businessSocials(business: Pick<Biz, 'instagram' | 'tiktok' | 'whatsapp'>): string[];
