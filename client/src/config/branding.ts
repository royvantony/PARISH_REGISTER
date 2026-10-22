/**
 * Client Branding Configuration
 * 
 * To update branding for a new client/parish:
 * 1. Place the new client logo in `client/public/branding/logo.png`
 * 2. Optionally update the parameters below if custom overrides are needed.
 */
export const CLIENT_BRANDING = {
  // Logo path served from client/public/branding/logo.png
  logoUrl: '/branding/logo.png',
  logoAlt: 'Parish Official Seal & Crest',
  systemName: 'PARISH REGISTER',
  defaultParishName: 'St. Alphonsa Syro-Malabar Catholic Parish Brisbane',
  defaultParishCode: 'SABN',
  defaultCity: 'Brisbane',
  defaultState: 'QLD',
  dioceseName: 'Diocese of St. Thomas the Apostle, Melbourne',
} as const;
