export const AUTH_GENERIC_ERROR = "Ha ocurrido un error. Inténtalo de nuevo.";

const INVALID_CREDENTIALS = "Correo o contraseña incorrectos.";
const EMAIL_NOT_CONFIRMED = "Confirma tu correo antes de iniciar sesión.";
const ALREADY_REGISTERED = "Ya existe una cuenta con este correo.";
const RATE_LIMITED = "Demasiados intentos. Espera un momento e inténtalo de nuevo.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: INVALID_CREDENTIALS,
  email_not_confirmed: EMAIL_NOT_CONFIRMED,
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
};

const BY_MESSAGE: [string, string][] = [
  ["invalid login credentials", INVALID_CREDENTIALS],
  ["email not confirmed", EMAIL_NOT_CONFIRMED],
  ["user already registered", ALREADY_REGISTERED],
  ["rate limit", RATE_LIMITED],
];

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Maps a Supabase auth error to a Spain Spanish message. Matches on
 * `error.code` first, then message substrings, then HTTP 429; anything else
 * returns the generic message (raw English text is never shown).
 */
export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return AUTH_GENERIC_ERROR;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const message = error.message?.toLowerCase();
  if (message) {
    for (const [needle, text] of BY_MESSAGE) {
      if (message.includes(needle)) return text;
    }
  }
  if (error.status === 429) return RATE_LIMITED;
  return AUTH_GENERIC_ERROR;
}
