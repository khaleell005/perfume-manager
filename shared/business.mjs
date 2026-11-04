export const businessDefaults = Object.freeze({
  name: '', phone: '', whatsapp: '', instagram: '', tiktok: '', email: '', address: '', social: '',
  thanks: 'Thank you for your purchase!', threshold: 5, logo: '',
});

export function businessSocials(business) {
  const handle = value => value?.trim().replace(/^@+/, '');
  return [
    handle(business.instagram) && `Instagram: @${handle(business.instagram)}`,
    handle(business.tiktok) && `TikTok: @${handle(business.tiktok)}`,
    business.whatsapp?.trim() && `WhatsApp: ${business.whatsapp.trim()}`,
  ].filter(Boolean);
}
