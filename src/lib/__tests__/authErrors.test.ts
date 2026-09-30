import { AUTH_GENERIC_ERROR, mapAuthError } from "../authErrors";

describe("mapAuthError", () => {
  it("exposes the exact generic message", () => {
    expect(AUTH_GENERIC_ERROR).toBe("Ha ocurrido un error. Inténtalo de nuevo.");
  });

  it("maps invalid_credentials", () => {
    expect(mapAuthError({ code: "invalid_credentials", message: "x" })).toBe(
      "Correo o contraseña incorrectos."
    );
  });

  it("maps email_not_confirmed", () => {
    expect(mapAuthError({ code: "email_not_confirmed" })).toBe(
      "Confirma tu correo antes de iniciar sesión."
    );
  });

  it.each(["user_already_exists", "email_exists"])("maps %s", (code) => {
    expect(mapAuthError({ code })).toBe("Ya existe una cuenta con este correo.");
  });

  it.each(["over_request_rate_limit", "over_email_send_rate_limit"])("maps %s", (code) => {
    expect(mapAuthError({ code })).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo."
    );
  });

  it("maps status 429 without a code", () => {
    expect(mapAuthError({ status: 429, message: "whatever" })).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo."
    );
  });

  it("falls back to lowercase message substrings when there is no code", () => {
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe(
      "Correo o contraseña incorrectos."
    );
    expect(mapAuthError({ message: "Email not confirmed" })).toBe(
      "Confirma tu correo antes de iniciar sesión."
    );
    expect(mapAuthError({ message: "User already registered" })).toBe(
      "Ya existe una cuenta con este correo."
    );
    expect(mapAuthError({ message: "Email rate limit exceeded" })).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo."
    );
  });

  it("returns the generic message for unknown codes and code-less errors", () => {
    expect(mapAuthError({ code: "weird_code", message: "Boom" })).toBe(AUTH_GENERIC_ERROR);
    expect(mapAuthError({ message: "Boom" })).toBe(AUTH_GENERIC_ERROR);
    expect(mapAuthError({})).toBe(AUTH_GENERIC_ERROR);
  });

  it("handles null and undefined", () => {
    expect(mapAuthError(null)).toBe(AUTH_GENERIC_ERROR);
    expect(mapAuthError(undefined)).toBe(AUTH_GENERIC_ERROR);
  });

  it("lets the code win over a changed message", () => {
    expect(mapAuthError({ code: "invalid_credentials", message: "Totally new wording" })).toBe(
      "Correo o contraseña incorrectos."
    );
  });
});
