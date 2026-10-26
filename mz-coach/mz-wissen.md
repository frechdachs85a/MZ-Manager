# MZ-Wissensbasis FC Toho

Stand: 25.10.2026. Alles hier ist entweder von Marcus vorgegeben oder aus echten ManagerZone-Daten belegt. Nichts davon ist geschätzt. Diese Datei ist die Startbasis für die KI der Webseite und wird laufend erweitert.

---

## 1. Grundlagen

- Team: FC Toho, tid 847159, Manager Marcus (spielt allein, Ansprache "du")
- Liga: Seniorenliga Germany div1.1 (sid 12087). Ligaspiele immer mittwochs und sonntags.
- Ziel: Aufstieg in die Bundesliga (höchste Liga)
- Gespielte Spiele eines Teams: https://www.managerzone.com/?p=match&sub=played&tid=<TID>
- Kader eines Teams: https://www.managerzone.com/?p=players&tid=<TID>
- Managerwertung (Top-Teams): https://www.managerzone.com/?p=rank&sub=userrank
- Taktik-Editor: https://www.managerzone.com/?p=tactics

## 2. Datenquellen und wie man sie zuverlässig bekommt (getestet 21.10.2026)

### Spielliste eines Teams
POST `/ajax.php?p=matches&sub=list&sport=soccer` mit FormData:
`type=played, hidescore=false, tid1=<TID>, offset=, selectType=<all|series|world_series>, limit=<default|max>`
- `series` = Liga, `world_series` = Weltliga
- In der Antwort stehen die Spiel-IDs als `mid=<ZAHL>`. Jedes Spiel ist ein `dd` in `dl.hitlist_dl`.
- Aktuelle Saison filtern: Ligaspiele dieser Saison haben mid > 1620000000, Weltligaspiele mid > 1630000000 (Stand Saison 100, bei neuer Saison prüfen).

### Stats-XML eines Spiels (Formation, Einstellungen, Wechsel, Regeln, Tore)
Die XML ist oft leer, bis der 2D-Viewer das Spiel angefordert hat. Deshalb IMMER zuerst:
1. GET `/ajax.php?p=matchViewer&sub=check-match&type=2d&mid=<MID>&sport=soccer` liefert JSON `{response: "ok" | "queued"}`
2. Bei "queued" alle 5 bis 6 Sekunden wiederholen, bis "ok" (meist nach 6 bis 20 Sekunden)
3. Dann GET `/matchviewer/getMatchFiles.php?type=stats&mid=<MID>&sport=soccer`
4. Nur wenn danach immer noch leer: "XML LEER"

Hinweise:
- Ohne `&sport=soccer` kommt die XML oft leer zurück.
- Direkt nach dem Spiel rechnet ManagerZone noch ("Statistik wird berechnet"), dann am Abend erneut versuchen.
- Auch Scoutspiele liefern auf diesem Weg eine XML.
- `type=data` liefert die komplette Spielszenen-Datei (ca. 2,7 MB, binär), wird für die Analyse nicht gebraucht.

Aufbau der XML:
- `<Team id name shortname tactic playstyle aggression>` mit `<Statistics goals possession shotsOnGoal shotsWide ...>` und `HalfStatistics`
- `<Player id teamId name shirtno goalkeeper origin>`: Player-Elemente hängen NICHT unter Team, sondern tragen teamId. `origin` = Startposition, leer bei Bankspielern.
- `<Substitution time clock playerId substitutedId teamId reason minute scorecondition score>`: reason "preset" = Regel, "injury" = Verletzung. minute = eingestellte Regelminute.
- `<Tactic teamId type new_setting time>`: type = tactic, playstyle oder aggression. Die Bedingung steht NICHT drin.
- `<Goal time clock team assister>`
- `<Card ... type="yellow|second yellow">`
- In der XML stehen nur Regeln, die tatsächlich ausgelöst haben.

### Komplette Spielstatistik (Spielberichtsseite)
`/?p=match&sub=result&mid=<MID>`, Reiter "Komplette Spielstatistik", Schalter "Ausführlich" (greift der erste Klick nicht, direkt auf den Schalter klicken). 33 Felder je Spieler:
Nr, Name, Po, MP, T (Tore), A, S, G%, SchaT, SOT%, OG, p, SP, PF, P%, PL, a.P., T (Zweikämpfe), ST, TF, T%, Pos, Pos%, Dist, DistP, SpP, SpR, Cr (Ecken), Fk, Pen, YC, RC, gSch

### Kaderseite fremder Teams
Zeigt Alter und Marktwert, Skills nur bei Spielern, deren Skills öffentlich sichtbar sind (in den Top 30 bei ca. 10 Teams, 104 Spieler, Stand 21.10.). Container `div[id^="thePlayers_"]`.

### Eigene Spieler
`/?p=players` (eingeloggt): alle Skills mit Rot/Schwarz (Klasse "maxed"), Scout-Sterne, Trainingslager-Status, Verletzungen/Sperren (Reiter "Verletzt / Gesperrt").
Im Taktik-Editor haben Spieler im Trainingslager die Klasse `tc` und Opazität 0.6 (ausgegraut, nicht einsetzbar).
Ergänzung 24.10.2026 (Marcus, an den Seiten bestätigt): Trainingslager heißt nicht automatisch "nicht einsetzbar". Mit einem Chip ausgestattete Spieler im Trainingslager sind trotzdem aufstellbar, Spieler im Jugendaufbau-Trainingslager (1 Woche) ebenfalls. Maßgeblich ist der Kegel auf der Taktikseite (`dd.tc`). Am 24.10. waren 12 Spieler im Trainingslager, davon 7 mit Kegel; 3 mit Chip und 2 im Jugendaufbau-Trainingslager waren aufstellbar.
Sperren (`?p=players&sub=unavailable`, "Platzverweise") gelten je Wettbewerb, z. B. Rote Karte im Pokal nur für den Pokal.

### Scoutspiele
Laufen gegen die Aufstellung aus dem letzten Ligaspiel des Gegners. Der Gegner sieht sie nicht. Lohnen sich nur, wenn der Gegner stabil gleich spielt. Kosten Geld.

## 3. Umrechnung origin (XML) in Editor-Koordinaten (am eigenen Spiel auf 1 Punkt genau bestätigt)

- Torwart bei origin-y = 1000: Abstand d = 1000 − origin-y, x unverändert
- Torwart bei origin-y = 0: Abstand d = origin-y, x vorher spiegeln: x' = 750 − origin-x
- Editor-x = 0,2555 × x + 8,4
- Editor-y = 318 − 0,31 × d (mindestens 63)

## 4. Taktik-Editor: Regeln und Grenzen

- x ca. 8 bis 200, y vorne mindestens 63, tiefste getestete Feldposition y 267
- Mindestabstand zwischen Spielern ca. 47
- Zonen: Abwehr y ≥ 215 (belegt am Spielbericht Sydney FC vom 25.10.2026: Spieler bei y 215 = „Vert.“, bei y 190 = „Mi.“; korrigiert am 26.10.2026, vorher hier 222), 212 zählt als Mittelfeld, 213 und 214 nicht belegt. Sturm y ≤ 110 (112 = Mittelfeld, 111 nicht belegt)
- Höchstens 3 Stürmer
- Bankplätze von oben: subgoalie (y117), Abwehr (y140), Mittelfeld (y163), Sturm (y186), X (y209). Bank nach Position sortieren, alle 5 Plätze besetzen. Ein Feldspieler auf subgoalie kann in Regeln nicht eingewechselt werden.
- Auf der Bank oder im Feld bekommen Spieler Erfahrung und Form.
- Zeitregeln greifen erst bei der nächsten Spielunterbrechung (beobachtet: 30 Sekunden bis 11 Minuten später). Das wissen alle Manager, Minuten nicht deswegen korrigieren.

XML-Format einer Taktik:
```xml
<SoccerTactics>
  <Team tactics="wings|shortpass|longball" playstyle="offensive|normal|defensive" aggression="aggressive|normal|passive" captain="<pid>" />
  <Pos pos="goalie|normal" pid="" x="" y="" x1="" y1="" x2="" y2="" pt="" fk="" />
  <Sub pos="sub|subgoalie" pid="" x="228" y="117..209" ... />
  <TacticRule name="Taktikregel" check_time="true|false" time="" check_goal_condition="true|false" goal_condition="tie|down_by_at_least|ahead_by_at_least" goals="1" check_player_event="true|false" player_event_player_type="anyone" player_event="sent_off|receives_yellow" out_player="<pid>|no_change" in_player_id="<pid>|NULL" tactics="no_change|wings|shortpass" playstyle="no_change|offensive|normal" aggression="no_change|aggressive|normal|passive" formation="no_change|1|2" />
</SoccerTactics>
```
x/y = Startaufstellung, x1/y1 = Alternative 1, x2/y2 = Alternative 2. pt und fk (je 1 bis 16): sehr wahrscheinlich Reihenfolge der Elfmeter- (penalty taker) und Freistoßschützen (free kick), nicht bestätigt; gegenprüfen im Editor unter dem Reiter "Standards" (Marcus, 25.10.2026). Führung heißt `ahead_by_at_least` (`up_by_at_least` funktioniert nicht).

## 5. PRÜFLISTE: vor jeder ausgegebenen Taktik zwingend

1. In allen drei Aufstellungen höchstens 3 Stürmer (y ≤ 110) und nirgends y < 63
2. Alle Abstände mindestens 47
3. Zwei zentrale Stürmer nie nebeneinander auf gleicher Höhe, sondern versetzt. Gilt bei genau zwei zentralen Stürmern (Marcus, 25.10.2026). Bei drei zentralen ist das Profi-Muster zwei hinten auf gleicher Höhe, einer vorne davor (红黑之恋 69/98, 131/98, 100/63, genauso Bulgarien und Essen); kupass ist damit korrekt.
4. Eckstürmer immer mit Zulieferer auf seiner Seite (z. B. rechter Sechser 151/183, tiefer Stürmer 129/95 bei Ecke rechts)
5. Höchstens 3 Wechsel, ohne Konflikte untereinander. Kein Spieler darf in zwei Wechselregeln vorkommen (Marcus, 25.10.2026).
6. Bei Rückstand nur offensiver, nie absichern
7. Rote-Karte-Regel in jeder Taktik, aber ohne Spielerwechsel, nur Umstellung auf Alternative 1. Kein Spieler darf in zwei Wechselregeln vorkommen. Rot-Logik: 2 Stürmer = Flügel (einer außen, einer zentral), 1 Stürmer = zentral + Kurzpass. Eckstürmer ohne guten Flankengeber rückt in die Mitte + Kurzpass.
8. Bank nach Position, subgoalie nie Regel-Einwechsler
9. Kopfball bei Innenverteidigern und Mittelstürmer beachten (Marcus' Regel, zählt in der Formel kaum)
10. Spieler mit Kegel auf der Taktikseite (Trainingslager ohne Chip) oder gesperrt/verletzt nicht aufstellen. Ob Kegel-Spieler auf der Bank sitzen dürfen, ist nicht getestet (Marcus, 25.10.2026): bis bestätigt auch nicht auf die Bank. Trainingslager mit Chip oder Jugendaufbau-Trainingslager ist erlaubt. Sperre nur für den Wettbewerb, für den sie gilt.
11. Immer kompletten XML-Code ausgeben, nie Einzelzeilen

## 6. MZ-Formel (mzlive "MZ Manager"-Wert = Summe Skill × Gewicht)

Reihenfolge: Sprint, Ausdauer, Spielübersicht, Passen, Schuss, Kopfball, Torwart, Technik, Zweikampf, Flanken, Erfahrung
- TW: .09 .09 .09 .02 0 0 .55 .09 0 .02 .05
- VT: .25 .16 .07 .02 0 0 0 .08 .30 .07 .05
- Anchorman: .25 .18 .05 .05 0 .02 0 .10 .25 .05 .05
- MF: .15 .15 .10 .15 0 0 0 .12 .20 .08 .05
- Flügel: .25 .20 .06 .04 .05 0 0 .15 .05 .15 .05
- Sturm: .23 .15 .05 .04 .28 .03 0 .15 .02 0 .05
Standards, Form, Alter, Größe zählen nicht.

## 7. Spieler-Regeln von Marcus

- Skillanzeige: rot = ausgemaxt, schwarz = trainierbar. Markierung "1" = stärkste Skills, "2" = Schwächen. Hoch 4 Sterne = mind. eine 10, 3 Sterne = 9 oder 10. Kein Skill wird höher als die stärksten.
  Ergänzung 24.10.2026 (an der Spieleransicht geprüft): Auf der Seite heißen die Markierungen "Hoch" (1) und "Niedrig" (2). Die Sterne-Regel gilt für das Potenzial: bei allen Spielern mit ausgemaxten 1-Skills bestätigt, bei Jugendspielern sind die 1-Skills oft noch niedrig.
- Ausdauer unter 8: muss ca. 60. bis 80. raus (fällt nicht um, wird schlechter). Ab 8 hält er 90 Minuten.
- Torwart ohne Ausdauer 8 = K.-o.-Kriterium
- Ab 30 Jahren: erst 1 Ball Sprint weg, dann 1 Ausdauer. Beim Einkauf "99-Regel": Sprint und Ausdauer je 9+. Ausnahme: Ausdauer 8 bei sehr günstigen Spielern oder geplanten Einwechslern.
- Erfahrung steigt ca. 1 bis 1,2 Bälle pro Jahr, nur durch Spiele
- Spielübersicht ist im Spiel sehr wichtig
- Marktwert ist kein Preismaßstab. Beispiel: Flügelspieler 26 J., Fl10 Sch9 Sü9 Sp9 Au8, Marktwert 1,16 Mio, ging für 2,80 Mio weg.
- Jugend: Nr. 100 bis 110 sind die Talente. Ab Nr. 195 nach und nach ersetzen (dienstags 3 neue losen). Behalten nur Scout-Rang 1 bis 3 (Spitzenklasse 4/2, Elite 4/1, Spitzenspieler 3/2), alle anderen sind Abgabekandidaten (Marcus, 25.10.2026; vorher nur 4/1 und 4/2).
- Scout-Sätze: 4/2 "erstaunliches Potenzial ... Spitzenklasse"; 4/1 "großartiges Talent ... Elitespieler"; 3/2 "vielseitig ... Spitzenspieler"; 3/1 "vielversprechend ... Schlüsselfähigkeiten"; 2/2 "vielseitig, keine Hauptstärken"; 2/1 "etwas weniger Talent ... kein Platz im Kader". Rang 1 = 4/2 bis Rang 6 = 2/1, Hoch-Sterne zählen mehr. Passen Sterne und Satz nicht zusammen oder ist der Text unbekannt (z. B. "Weltklasse", 1 Stern Hoch): "Scoutbericht unbekannt", nicht raten.
- Scout-Prognose: Hoch 4 = mindestens eine Stärke wird 10; Hoch 3 = Stärken enden bei 9 oder 10; Niedrig 1 = Schwächen ca. 4 bis 5; Niedrig 2 = Schwächen ca. 5 bis 6. Kein Skill wird höher als die Stärken, alle anderen offen. Nur rote Skills sind sicher ausgemaxt.
- Loyale Spieler (Herz-Symbol, blau hinterlegt): kein Scoutbericht, nicht verkaufbar (nur entlassen), günstiges Gehalt, oft sehr gut.
- Wichtige Spieler brauchen 4 Freundschaftsspiele pro Woche (Bank reicht), sonst sinkt die Form am Dienstag
- Test- und Scoutspiele kosten Geld, neue Taktiken lieber live gegen schwache Ligagegner testen

## 8. Taktiken im Editor (Reiter)

| Reiter | Inhalt | Einsatz |
|---|---|---|
| außenR | 4-2-1-3, Eckstürmer rechts, Flügel/offensiv/normal, = Template der Topteams | Standard |
| außenL | gespiegelt, Ecke links | Variante |
| kupass | 4-2-1-3 ohne Eckstürmer, 3 zentrale Stürmer, Kurzpass/normal | gegen Fünferkette und dichte Mitte |
| 3313of | 3-3-1-3 offensiv, ohne Führungsregel | gegen Schwache |
| 532de | 5-2-3 Lyon-Kopie, Flügel/offensiv/normal (trotz Name nicht defensiv) | gegen Übermächtige |
| indivi | Essen-Kopie 3-1-2-1-3, Kurzpass/normal/passiv | gegen Schwache (nur 1 Scoutspiel belegt) |
| freund | Freundschaftsspiel-Taktik | Form halten |
| U18 | 5-2-1-2 Kurzpass defensiv aus Profi-Bausteinen (Lyon-Fünferkette, Raureni-Spielmacher und Sturm) | Jugend, nicht aktiv betreut |

Gemeinsame Regeln in außenR/außenL/3313of/532de: 50. Hyuga raus, Ishizaki rein (Eckstürmer früh frisch); 60. Kaupa für Nazarov und Rodekamp für Cytrynski (532de: Salzer für Nazarov); ab 60. bei 1 Tor Rückstand offensiv + aggressiv; ab 65. bei 2 Toren Rückstand Kurzpass + Alternative 2 + aggressiv; ab 70. bei Führung Spielweise normal (nur außenR und außenL); ab 80. bei Gleichstand offensiv + aggressiv; Rot: nur Umstellung auf Alternative 1 (Flügel bzw. Kurzpass bei kupass/indivi), KEIN Spielerwechsel (seit 25.10.2026, wie Lyon; vorher kollidierte "Schobel raus, Kaupa rein" mit dem Kaupa-Wechsel in der 60.). Gilt in allen Taktiken inkl. kupass, indivi, freund.

Template-Koordinaten außenR (Editor): Abwehr 26/224, 76/224, 125/224, 175/224; Sechser 101/183 und 151/183; Spielmacher 101/135; Sturm 129/95, 82/77; Ecke 200/63.
kupass-Koordinaten: Abwehr 33/222, 79/235, 127/235, 175/222; Sechser 79/186, 127/186; Spielmacher 103/142; Sturm 72/100, 134/100, vorne 103/63.

## 9. Erkenntnisse aus den Top 10 der Managerwertung (21.10.2026, 236 Spiele mit XML)

Top 10: 1 Bazellatin (102604), 2 Nagyváradi AC (864852), 3 Formation Pure Lyonnaise (1200022), 4 Tabachana (105125), 5 Real Kikkabu (1230813), 6 CARDINAL (340771), 7 Nibiru X (561256), 8 Real Llull de Reus (499737), 9 THE ROKERY PIMKIS (113102), 10 Beek City (359371).

- Grundform fast aller: 4-2-1-3 mit Eckstürmer, Flügel, offensiv, normal. Lyon und Nibiru (Weltliga) spielen 5-2-3 mit Ecke links. Rokery als einziges Kurzpass 3-4-3 mit 3 zentralen Stürmern.
- Das Template gewinnt nicht allein: Bazellatin und Tabachana spielen in der Weltliga identisch, Bazellatin 6-1-10, Tabachana 11-2-4. Der Kader entscheidet.
- Liga-Variante bei Bazellatin/Tabachana: Außenverteidiger höher (38/217, 168/217), Innenverteidiger tiefer (80/238, 127/238), Sechser symmetrisch (80/192, 128/192). Nicht nachweislich besser.
- Bazellatin, Lyon, Tabachana, Llull, Beek stellen nie um. Nur die Eckstürmer-Seite wechselt manchmal, ohne erkennbare Regel.
- Gegentaktik gegen Fünferkette und dichte Mitte: weg vom Eckstürmer, mehr Leute in die Mitte. Nagyváradi: 3 zentrale Stürmer + Kurzpass (10:0, 7:0, 2:2). Nibiru (Liga): ohne Ecke, 2 zentrale Stürmer. CARDINAL: Dreierkette mit Linksüberladung.
- Gegentaktik richtet sich nach der Formation des Gegners, nicht nach seinem Kaderwert (CARDINAL-Prüfung mit Marktwerten).
- NIEMALS die Formation des Gegners spiegeln: Kikkabu hat das 3-mal gegen starke Gegner gemacht, 3 Niederlagen. Im Standard gegen gleich starke Gegner 4 S, 1 U, 1 N.
- Wechsel: fast alle zu fester Minute, Eckstürmer wird bei allen gewechselt (Kikkabu 30./45., Nibiru 50., Bazellatin/Tabachana/Nagyváradi 55., Lyon 65.). Beek wechselt nie.
- Führungsregeln: Kikkabu (normal 66. bis 92.), Nibiru (normal 78. bis 96.), Llull (Wechsel bei Führung 55.). Rückstand: Kikkabu/CARDINAL aggressiv, Llull/CARDINAL/Nibiru Kurzpass, Rokery offensiv.
- CARDINAL startet normal und schaltet nach 5 bis 24 Minuten auf offensiv.
- Startelf-Werte Top 10: 13,7 bis 16,1 Mio, Altersschnitt meist 29 bis 32. FC Toho: 12,4 Mio, 27,3 Jahre.
- Profile sichtbarer Topspieler: IV immer Zweikampf 10; Mittelstürmer Schuss 9-10, Kopfball 9-10, Spielübersicht 10; Eckstürmer Flanken 10, Passen 9-10, Kopfball egal; Sechser Passen 9-10, Zweikampf 9-10; Torwart Tw10, Sü9, Fl8-9.

### Muster aus 278 Spielen der Top 10 und ihrer Gegner (25.10.2026, 540 Team-Spiele mit Marktwerten)
Hinweis: Marktwerte sind die Werte vom Abrufdatum, nicht vom Spieltag. Alles Zusammenhänge, keine bewiesenen Ursachen.
- Kaderwert entscheidet am stärksten. Verhältnis Startelf eigene/Gegner: unter 0,85 = 0,14 Pkt/Spiel (2 Siege in 70); 0,85 bis 1,15 = 1,26 bis 1,58 Pkt (offen); 1,15 bis 1,3 = 2,44 Pkt; über 1,3 = 34 Siege in 34.
- Kein Heimvorteil messbar: Heim 1,45 Pkt, auswärts 1,42; bei ausgeglichenem Kaderwert sogar auswärts etwas besser.
- Bei ausgeglichenem Kaderwert (0,9 bis 1,1): Flügel 1,43 Pkt, Kurzpass 1,22; offensiv 1,44, normal 1,27; mit Eckstürmer 1,43, ohne 1,26; Einsatz aggressiv ab Anpfiff nur 0,74 (normal 1,46).
- Einsatz aggressiv bringt NICHT mehr Karten (Gelb pro Spiel 0,20 gegen 0,21) und nicht mehr gewonnene Zweikämpfe.
- Mehr Schüsse aufs Tor als der Gegner: 1,64 Pkt, weniger: 1,17. Ballbesitz ab 55 %: 2,04 Pkt, unter 45 %: 0,27.
- Verwertung: 16 % der Schüsse aufs Tor werden Tore.
- 20 % aller Tore fallen zwischen 75. und 90., in den anderen Viertelstunden je 14 bis 17 %.
- Joker wirken: eingewechselte Stürmer 1,09 Tore pro 90 Minuten, Startstürmer 0,71; Startstürmer nach der 55. nur noch 0,62. 20 % aller Tore machen Eingewechselte.
- Häufigste Regelminuten für Wechsel: 55. (510), 60. (231), 50. (196), 65. (112), 45. (56).
- Bei 1 bis 2 Toren Rückstand in der 65.: Teams mit Umstellung (aggressiv, offensiv oder Passspiel) holen 0,57 Pkt und in 29 % noch mindestens einen Punkt; ohne Umstellung 0,43 Pkt und 22 %.
- Bei Führung in der 70.: Umstellung auf normal hält den Sieg in 88 % (0,50 Gegentore danach), ohne 84 % (0,55). Kleiner Vorteil, kleine Stichprobe (26).
- Altersschnitt der Startelf 32+ schneidet bei gleichem Kaderwert schlechter ab (1,19 Pkt) als 30 bis 32 (1,49).

### Aus dem MZ-Forum (Erfahrungsberichte, nicht offiziell)
- Taktik-Guide (topic 12766444): Flügelspiel braucht Flügelspieler mit Sprint/Ausdauer mind. 9/8, Flanken mind. 8; Kurzpass braucht Passen, Spielübersicht, Technik überall; ein Spieler im Mittelkreis fängt die Abstöße ab; Verteidiger so nah wie möglich an die gegnerischen Flügelspieler; Abwehr in zwei Linien, nie die ganze Abwehr in den Strafraum.
- Form-Thread (topic 12023582): Form ist ein Multiplikator, jeder Ball zählt; Form wird dienstags berechnet; Liga- und Freundschaftsspiele wirken positiv und negativ (Überspielen möglich), Pokale, Freundschaftsligen und Herausforderungen nur positiv; alle Spieler im Aufgebot (auch ungenutzte Bank) bekommen denselben Formeffekt; Trainingslager ändert die Form nicht; Faustregel bei Form 7 bis 10: 4 Freundschaftsspiele plus 2 Ligaspiele pro Woche.

## 10. Faustregeln Gegneranalyse

- Nur Ligaspiele der laufenden Saison des Gegners.
- Spielt der Gegner nachweislich immer gleich (mehrere XML, auch gegen Starke), Taktik gezielt anpassen: jeder Stürmer bekommt einen Manndecker (gleiche x, leicht zum eigenen Tor versetzt) plus Absicherer; Spielmacher zentral; Eckstürmer mit Zulieferer behalten.
- Spielt er wechselnd oder ist die Datenlage dünn: Standard-Taktik wählen, nicht anpassen. (Essen-Lektion: Essen spielte im Ligaspiel anders als in den Scoutspielen.)
- Fünferkette oder enge Mitte beim Gegner: kupass. Sonst außenR.
  Ergänzung 25.10.2026 (Marcus): "Enge Mitte" ist eine Arbeitsdefinition, kein ManagerZone-Begriff: oberhalb der Abwehr steht niemand außen, außen = x ≤ 40 oder ≥ 170 (Grenze unscharf; Beispiele Essen, YugiPeeK mit allem zwischen x 60 und 153). Eine Fünferkette ist ein eigener Auslöser für kupass, auch wenn außen jemand steht.
- Gegen starke Gegner beim Standard bleiben.
- Immer Kaderwert vergleichen: Startelf-Marktwert eigene Taktik gegen Gegner.

## 11. Kader FC Toho (Kurzfassung, Stand 19. bis 23.10.2026)

Format: Nr Name (Alter) pid, wichtigste Skills
- 1 Liu Chao Feng (29) 225496434, TW, Tw10
- 2 Cytrynski (28) 225629108, Pa10 Te10, Ausdauer 7 gemaxt
- 3 Nazarov (27) 227162857, Zk10 Kb9, Ausdauer 7 gemaxt, bulgarischer Nationalspieler
- 4 Chille (24) 229926279, Sp10 Zk9
- 5 Salzer (32) 227393631, Nationalspieler
- 6 Kaupa (33) 226471405, Kb10 Pa10, Sprint am 22.10. auf 6 gefallen
- 7 Hyuga (24) 229906765, Sp10 Fl9 Pa9 Sch9, Ausdauer 7 gemaxt
- 8 Ishizaki (24) 230162433, Sp10 Au9 Sü9 Fl9
- 9 Cavalcante (26) 227653119, Sp10 Sch9 Kb9
- 10 Pinheiro (28) 226189000, Pa10 Sch9 Zk9, Kapitän
- 11 Schobel (27) 231999845, Au10 Sü10 Sch9
- 12 Fleur (24) 229866139, TW Tw10
- 13 Mauer (27) 232093954
- 14 Wiesenberg (27) 231999835, Sch9 Sü9
- 16 Misugi (21) 232733543, Kapitän U21-Nationalmannschaft, Sü10 Sch10 Au10 Sp9, Kopfball 8 noch trainierbar (also mind. 9), danach Passen trainieren; nur Angebote über 15 Mio relevant
- 17 Rodekamp (27) 231999847, Au10, Loyal Player
- 18 Peschke (24) 229926290, Pa9 Zk9 Au9, als MF 8,37, als VT 8,36
- 19 Zahl (28) 231091969, Sp10 Zk9 Pa9
- 20 Scholze (24) 230045369, Schuss 8 gemaxt, trainiert Zweikampf für Verteidiger-Rolle
- 21 Vranken (27) 227322975, Sp9 Au9 Kb9 Zk9
- Jito am 23.10.2026 für 1,4 Mio verkauft

Kaderziele: Ersatz für Cytrynski (intern Peschke), zweiter Flügelspieler (intern kurzfristig niemand), junger Innenverteidiger. Gute Spieler sind selten auf dem Markt und teuer, eher selbst aufbauen.

## 12. Scoutspiele gegen kommende Gegner

### 12.1 Sydney FC (tid 97246), 22 Scoutspiele vom 26.10.2026 (Auswertung von Marcus)

Grundlage: 11 Spiele mit außenR (Flügel/offensiv/normal), 11 mit kupass (Kurzpass/normal/normal), alle Stats-XML gelesen. Sydney spielt in Scoutspielen fest die Aufstellung aus dem letzten Ligaspiel (25.10. gegen Hannover) und reagiert nicht auf FC Toho.

- Sydney: Guderian 104/318; Knapp 103/240, Roos 64/215, Zhou 142/215; Lopez 103/190; Reifer 62/167, Raufelder 143/165; Mogg 102/143; Gimenez 74/106, Alberts 120/99, Lenz 91/63. Kurzpass/normal/aggressiv, Flügel leer. Aus FC-Toho-Sicht gespiegelt (x = 208 − x): Alberts bei x 88 (Zone Nazarov), Gimenez bei x 134 (Zone Vranken), Lenz/Toscano bei x 117.
- Wechsel in jedem Spiel 40.: Toscano für Lenz, Denzin für Reifer, danach keine.
- Sydney hat eine Rot-Regel: nach eigener Roter Karte sofort Spielweise defensiv (Zhou Rot 43. → 43. defensiv, Knapp Rot 92. → 92. defensiv). Erklärt vermutlich das „45. defensiv“ im Ligaspiel vom 14.10.
- Ergebnisse: außenR 4 S / 2 U / 5 N, Tore 17:20, Schüsse aufs Tor 150:171, Ballbesitz 47,9 %, Ecken 14:6. kupass 4 S / 3 U / 4 N, Tore 15:23, Schüsse 167:184, Ballbesitz 53,5 %, Ecken 6:4.
- außenR ohne das Spiel mit Vranken-Rot (18.): bis zur 50. 12:8 Tore, ab der 51. 4:9. Hyuga als Eckstürmer 8 Vorlagen, alle vor seiner Auswechslung in der 50.; Cavalcante 12 der 17 Tore. Ishizaki (ab 50. für Hyuga): 0 Vorlagen, 0 Schüsse aufs Tor, Zweikämpfe 2:11.
- kupass: bis zur 55. 8:12, danach 7:11 (kein Einbruch durch den Hyuga-Wechsel). Wiesenberg als Joker (55.): 2 Tore, 17 Schüsse aufs Tor. Nach Umschalten der Rückstandsregel (offensiv + aggressiv, bei 2 Toren Alt2 Flügel) 1:5 Tore in 7 Spielen, in außenR 1:1.
- Spieler: Pinheiro wichtigster Abräumer (Zweikämpfe außenR 67:47, kupass 43:39). Nazarov hält die Alberts-Zone (40:29, 33:32). Vranken in außenR 46:56 (Schwachstelle gegen die Gimenez/Toscano-Seite), in kupass 53:44. Kaupa ab 60. gut (19:10, 11:9). Zahl in außenR 52 angekommene / 68 abgefangene Pässe auf 151/183, in kupass 127/49. Schobel in außenR Zweikämpfe 26:44.
- Karten: FC Toho Rot Vranken (außenR, 18.), Zahl (kupass, 88.); Sydney Rot Zhou, Knapp.
- Empfehlung von Marcus: außenR beibehalten; Hyuga frühestens ca. 70. auswechseln (Ausdauer 7); gegen Sydney keine aggressiven Rückstandsregeln in kupass; Wiesenberg wirksamster Einwechsel-Stürmer; Vorbehalt: gegen den einzigen Gegner mit Eckstürmer (BOD, 07.10.) stellte Sydney live auf Viererkette um; bei Rot für Sydney wird es defensiv, dann Druck nach vorn.

Eigene Einordnung (Claude, 26.10.2026), nicht blind übernommen:
- Punkte pro Spiel 1,27 gegen 1,36 bei je 11 Spielen ist kein Unterschied, der über Zufall hinausgeht. Deutlich verschieden ist die Tordifferenz (−3 gegen −8), dazu Ecken 14:6 und die starke erste Stunde: das spricht für außenR.
- Der Einbruch nach der 50. in außenR fällt mit zwei Dingen zusammen: Hyuga raus (50.) und Sydneys frische Spieler (40.). Dass kupass trotz derselben Sydney-Wechsel nicht einbricht, stützt den Hyuga-Effekt. Bei 10 Spielen bleibt es eine gut begründete Hypothese.
- Die Rückstandsregel wird nur bei Rückstand ausgelöst; 1:5 danach ist auch durch diesen Auswahleffekt erklärbar. Hinweis, kein Beweis.
- Scoutspiele zeigen Sydneys Aufstellung vom 25.10.; live kann er gegen einen Eckstürmer umstellen (1 Ligaspiel als Beleg). Direkte Spiele gegen genau diesen Gegner wiegen schwerer als die allgemeine Faustregel aus Abschnitt 10, ersetzen aber den Live-Vorbehalt nicht.
