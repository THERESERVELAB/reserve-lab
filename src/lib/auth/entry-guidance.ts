/* ════════════════════════════════════════════════════════════════════════
   ENTRY GUIDANCE — what the member can do about a sign-in error.

   The authentication service reports what went wrong in its own words
   ("Invalid login credentials"). Those words stay on screen, but on their
   own they tell a member nothing about the next step. This maps the message
   to one plain instruction. It never changes what happened and never claims
   to know more than the message says.
   ════════════════════════════════════════════════════════════════════════ */

export function entryErrorGuidance(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "Check your email and password. If you have forgotten the password, choose Forgot your password.";
  }
  if (text.includes("not confirmed")) {
    return "Open the confirmation email we sent, then sign in again.";
  }
  if (text.includes("already registered") || text.includes("already exists")) {
    return "That email already has an account. Sign in instead, or choose Forgot your password.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts in a short time. Wait a minute, then try again.";
  }
  if (text.includes("fetch") || text.includes("network") || text.includes("reach")) {
    return "Check your connection, then try again.";
  }
  if (text.includes("password")) {
    return "Check the password requirement shown under the field, then try again.";
  }
  return "Try again. If it keeps happening, use the other way to sign in.";
}
