import { describe, expect, it } from "vitest";
import { nameFuer, nameWiderspruch } from "./portfolio-plan";

describe("nameFuer", () => {
  it("baut Formation + Taktik + Spielweise", () => {
    expect(nameFuer("5-3-2 wings/offensive", [])).toBe("532flo");
    expect(nameFuer("3-4-3 shortpass/normal", [])).toBe("343kp");
    expect(nameFuer("4-3-3 oder 4-2-4 longball/defensive", [])).toBe("433lbd");
  });
  it("hängt bei belegtem Namen eine Ziffer an, höchstens 6 Zeichen", () => {
    expect(nameFuer("5-3-2 wings/offensive", ["532FLO"])).toBe("532fl2");
  });
});

describe("nameWiderspruch", () => {
  const feld = [{ x: 200, y: 63 }, { x: 100, y: 95 }, { x: 60, y: 95 }];
  it("erkennt falsche Formation und Spielweise", () => {
    expect(nameWiderspruch("532de", "4-3-3 wings/offensive", feld)).toEqual(["Name sagt 5-3-2, aufgestellt ist 4-3-3", "Name sagt defensiv, eingestellt ist offensive"]);
  });
  it("vergleicht 4-stellige Namen über Abwehr und Sturm", () => {
    expect(nameWiderspruch("3313of", "3-4-3 wings/offensive", feld)).toEqual([]);
    expect(nameWiderspruch("3313of", "4-3-3 wings/offensive", feld)).toHaveLength(1);
  });
  it("prüft die Seite bei außenR/außenL und Kurzpass", () => {
    expect(nameWiderspruch("außenR", "4-3-3 wings/offensive", feld)).toEqual([]);
    expect(nameWiderspruch("außenL", "4-3-3 wings/offensive", feld)).toEqual(["Name sagt Eckstürmer links, er steht rechts"]);
    expect(nameWiderspruch("Kupass", "4-3-3 wings/offensive", feld)).toEqual(["Name sagt shortpass, eingestellt ist wings"]);
  });
  it("sagt nichts zu Namen ohne Aussage", () => {
    expect(nameWiderspruch("freund", "4-3-3 wings/offensive", feld)).toEqual([]);
  });
});
