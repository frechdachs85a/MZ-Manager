// Schwärzt Werte, die nie gespeichert oder angezeigt werden dürfen. ManagerZone schickt beim Login eine Anfrage mit
// dem md5-Wert des Passworts und dem Benutzernamen in der Adresse (beobachtet am 25.10.2026:
// ajax.php?p=start&sub=Login&logindata_md5=…&logindata_username=…). Gilt für Adressen und für beliebigen Text.
const PARAMETER = /([?&;]|\b)((?:logindata[_[][a-z0-9_]*\]?)|[a-z_]*(?:md5|pass(?:word|wort)?|token|secret|sid))=([^&#\s"'<>]*)/gi;

// Zugangsdaten, Schlüssel, sid und md5-Werte im Text unkenntlich machen
export function schwaerzen(text: string): string {
  return text
    .replace(PARAMETER, (_g, vor: string, name: string) => `${vor}${name}=***`)
    .replace(/\b[0-9a-f]{32}\b/gi, (h) => (/[a-f]/i.test(h) && /\d/.test(h) ? "***md5***" : h));
}
