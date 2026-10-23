/**
 * Instagram app voice notes support up to five minutes.
 * Meta's Instagram Messaging API explicitly documents the audio size limit
 * (25 MB), but does not separately guarantee a five-minute API duration cap.
 * We align Daira's UX and server validation with the Instagram app experience.
 */
export const MAX_INSTAGRAM_VOICE_SECONDS = 5 * 60;
export const MAX_INSTAGRAM_VOICE_BYTES = 25_000_000 - 1;

export const VOICE_MAX_SECONDS = MAX_INSTAGRAM_VOICE_SECONDS;
export const VOICE_MAX_BYTES = MAX_INSTAGRAM_VOICE_BYTES;
