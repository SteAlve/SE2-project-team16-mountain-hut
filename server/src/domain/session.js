// The rules of a login session. The time arrives as a parameter: domain/ never reads the clock.

// A session works until its expiry instant; from that instant on it is over.
export const isSessionActive = (expiresAt, now) => expiresAt.getTime() > now.getTime();
