import { describe, expect, it } from "vitest";
import { schwaerzen } from "./schwaerzen";

describe("Schwärzen", () => {
  it("Login-Adresse von ManagerZone: md5, Benutzername, sid", () => {
    const u = "https://www.managerzone.com/ajax.php?p=start&sub=Login&logindata_md5=0123456789abcdef0123456789abcdef&logindata_username=Jemand&logindata_remember_me=0&sport=soccer&sid=0.5469";
    const s = schwaerzen(u);
    expect(s).not.toContain("0123456789abcdef");
    expect(s).not.toContain("Jemand");
    expect(s).toContain("p=start&sub=Login");
    expect(s).toContain("sport=soccer");
    expect(s).toContain("sid=***");
  });

  it("Formularfelder und lose md5-Werte im Text", () => {
    expect(schwaerzen('name="logindata[md5]" value="x" logindata[md5]=abc')).not.toContain("=abc");
    expect(schwaerzen("Hash 0123456789abcdef0123456789abcdef da")).toBe("Hash ***md5*** da");
    expect(schwaerzen("mid=1625669278 p=players")).toBe("mid=1625669278 p=players");
  });
});
