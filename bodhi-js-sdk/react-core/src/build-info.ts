declare const __BODHI_BUILD_MODE__: string;

export const BUILD_MODE =
  typeof __BODHI_BUILD_MODE__ !== 'undefined' ? __BODHI_BUILD_MODE__ : 'unknown';
