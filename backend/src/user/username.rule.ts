/** Letters, digits, dots, dashes and underscores: no spaces, so no blank usernames. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
export const USERNAME_PATTERN_MESSAGE =
  'Username can only contain letters, numbers, dots, dashes and underscores';
