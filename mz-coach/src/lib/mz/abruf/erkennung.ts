// Erkennung von Seitenzuständen. Nur Merkmale, die auf managerzone.com tatsächlich beobachtet
// wurden (docs/mz-seiten.md, 24.10.2026).

// Nicht eingeloggt aufgerufene Seiten wie /?p=players liefern eine Weiterleitungsseite mit diesem Titel.
export function istAbmeldeSeite(html: string): boolean {
  return /<title>\s*Logout - Managerzone\s*<\/title>/i.test(html);
}

// Das sichtbare Loginformular der Startseite. Steht es auf der Seite, ist niemand eingeloggt.
export function hatLoginFormular(html: string): boolean {
  return /id="login_username"/.test(html) && /id="logindata"/.test(html);
}

// Ist die Seite eingeloggt geladen?
export function istEingeloggt(html: string): boolean {
  return !istAbmeldeSeite(html) && !hatLoginFormular(html);
}

// CSS-Klassen der Fehlermeldungen im Loginformular. Sie stehen immer im HTML,
// deshalb zählt nur, ob sie im Browser sichtbar sind.
export const LOGIN_FEHLER = {
  falsch: ".wrong_username_or_password",
  gesperrt: ".too_many_failed_login_attempts",
} as const;
