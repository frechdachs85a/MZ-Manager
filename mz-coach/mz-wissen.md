# MZ-Wissensbasis FC Toho

Stand: 31.10.2026. Alles hier ist entweder von Marcus vorgegeben oder aus echten ManagerZone-Daten belegt. Nichts davon ist geschätzt. Diese Datei ist die Startbasis für die KI der Webseite und wird laufend erweitert.

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
- Jugend-Einteilung nach Rückennummer (Marcus, 31.10.2026, gilt vor der Scout-Regel): Marcus hat die Nummern bewusst sortiert. Unter Nr. 150 bleibt der Spieler, ab Nr. 150 geht er. Die Seite teilt danach ein; der Scout-Vorschlag steht nur als Info dabei, ein eigener Klick (Behalten/Abgabe) geht vor.
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

Stand der Tabelle: 25.10.2026, Beschreibung von Marcus. Das Archiv der Seite vom 26.10.2026 passt nicht dazu (siehe Abschnitt 17), Reiter neu exportieren. Namen und Inhalt prüft das Taktik-Portfolio (Abschnitt 17).

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

Umgesetzt (Marcus, 26.10.2026, live im Editor per Neuladen geprüft): außenR Wechsel Ishizaki für Hyuga von der 50. auf die 70. verschoben, sonst unverändert. Wechsel jetzt: 60. Kaupa für Nazarov, 60. Rodekamp für Cytrynski, 70. Ishizaki für Hyuga. Gilt für alle Spiele mit außenR; für das Ligaspiel Mi 28.10. 18:45 gegen Sydney (Heim, mid 1625669290) ausgewählt. Nach dem Spiel prüfen: Vergleichswert 4:9 Tore ab der 51. in den Scoutspielen.

Weitere Beobachtungen von Marcus zu Sydney (Ligaspiele): Gegentore bekam Sydney von Flügelteams (Grn, BOD und 1.FC Aufbau-Einsturz je 2; Aufbau-Einsturz gewann 2:0). Kurzpass-Teams mit Spielweise normal erzielten 0 Tore.

## 13. Technik und Datenquellen (Marcus, 26.10.2026)

- Scoutspiele abrufen: POST /ajax.php?p=matches&sub=list&sport=soccer mit type=played, hidescore=false, tid1=847159, offset=, selectType=scout_match, limit=1 (1 Woche) oder max. Weitere selectType-Werte: all, friendlyseries, friendly, series, cup, private_cup, scout_match, u18_series, u21_series.
- In der Spielliste steht hinter jedem eigenen Spiel der Name der genutzten Taktik (z. B. „außenR“, „kupass“): damit Scoutspiele automatisch nach Taktik gruppieren.
- Stats-XML: `<Tactic teamId time="82:23.666" type="aggression|playstyle|tactic" new_setting="…"/>` nur mit time, ohne clock. `<Card time clock type="yellow|red"/>` steckt im `<Player>` (Spieler = Elternelement). `<Possession home="55" away="45"/>`. Player > Statistics: goals, interceptedPasses (= eigene Pässe abgefangen), goodPasses, shotsOnGoal, shotsWide, tacklesWon, tacklesLost, interceptions, yellowCards, redCards, ticks="a,b" (b = Einsatzzeit, 0 = nicht gespielt), distancesCovered. Bankspieler und Eingewechselte haben kein numerisches origin.
- Gegner-Kader mit Marktwert und Alter: GET /?p=players&sub=alt&tid=<TID>; Text je Spieler „Nr Name Wert EUR Gehalt EUR AlterGeboren“ (Alter = erste 2 Ziffern, z. B. „2872“ = 28 Jahre).
- Eigene Verletzte: auf /?p=players steht title="keine verletzten Spieler", wenn niemand verletzt ist.
- Für ein geplantes Spiel gewählte Taktik: auf /?p=match&sub=scheduled im Select-Namen h:<mid>:a:series:<seriesId>:<Taktikname>. Hinweis der Seite: /?p=match ist für automatische Abrufe gesperrt (robots.txt); der Spielplan über ajax.php (type=scheduled) enthält dieselben Auswahllisten.
- Koordinaten des Gegners in die eigene Editor-Sicht spiegeln: x_eigen = 208 − x_gegner.
- Regel für die App: Nach jeder Scout-Serie Tore nach Zeitfenster auswerten (bis zum ersten eigenen Wechsel, danach). Kippt ein Muster nach einem bestimmten Wechsel, den Wechselzeitpunkt als Vorschlag melden. Gegner-Rot-Regeln erkennen: Taktikwechsel direkt nach eigener Roter Karte = Rot-Regel (umgesetzt 26.10.2026: bis 2 Minuten danach).

## 14. Kaderwert und Siegchance (Marcus, 26.10.2026)

- Nicht nur die Startelf vergleichen, sondern den Wert der Spieler, die gerade auf dem Feld stehen: für jedes Zeitfenster zwischen zwei Wechseln (eigene aus den Wechselregeln, gegnerische aus den Wechselminuten seiner letzten Ligaspiele) Summe Marktwerte FC Toho auf dem Feld ÷ Summe Marktwerte Gegner auf dem Feld, danach nach Minuten gewichten: Summe (Verhältnis × Minuten) ÷ 90. Marktwerte immer frisch lesen (eigene: /?p=players&sub=alt&tid=847159, Gegner: /?p=players&sub=alt&tid=<TID>).
- Beispiel Sydney FC, Ligaspiel Mi 28.10.2026 (Werte vom 26.10.2026): bis 40. 12.293.741 ÷ 11.243.191 = 1,09; 40. bis 60. (Toscano 1.185.984 für Lenz 733.878, Denzin 777.024 für Reifer 947.764, Sydney 11.524.557) 1,07; 60. bis 70. (Kaupa 1.260.960 für Nazarov 1.307.990, Rodekamp 1.140.180 für Cytrynski 1.236.354, FC Toho 12.150.537) 1,05; 70. bis 90. (Ishizaki 1.105.418 für Hyuga 1.247.600, FC Toho 12.008.355) 1,04; nach Minuten gewichtet FC Toho 12,21 Mio, Sydney 11,40 Mio, Verhältnis 1,07. Folgerung: Der Vorsprung schrumpft mit jedem Wechsel; Sydneys Wechsel in der 40. macht sie stärker, deine Wechsel machen dich minimal schwächer.
- Einordnung nach Wertbereich (278 Top-10-Spiele vom 25.10.2026, Werte vom Abrufdatum): Verhältnis unter 0,85: 0,14 Punkte pro Spiel (2 Siege in 70); 0,85 bis 1,15: 1,26 bis 1,58 Punkte pro Spiel, offen, die Taktik entscheidet; 1,15 bis 1,30: 2,44 Punkte pro Spiel; über 1,30: 34 Siege in 34 Spielen. Das sind Punkte pro Spiel, keine Siegwahrscheinlichkeiten; Sieg-, Remis- und Niederlagenquoten je Bereich wurden nicht gespeichert. Die App soll beim nächsten Top-10-Scan je Spiel Verhältnis und Ergebnis speichern und daraus echte Quoten berechnen.
- Direkte Messung gegen Sydney (22 Scoutspiele vom 26.10.2026): alle 22: 8 S (36 %), 5 U (23 %), 9 N (41 %); außenR: 4 S (36 %), 2 U (18 %), 5 N (45 %); kupass: 4 S (36 %), 3 U (27 %), 4 N (36 %). Die neue außenR-Version (Hyuga bis zur 70.) ist darin noch nicht enthalten.
- Regel: Gibt es Scoutspiele gegen den konkreten Gegner, haben diese Vorrang vor der allgemeinen Wertbereich-Statistik. Grenze: Im Scoutspiel spielt der Gegner fest mit der Aufstellung seines letzten Ligaspiels und reagiert nicht.
- Nach dem Spiel am Mi 28.10. prüfen: Ergebnis und Tore nach Zeitfenster (bis 50., 51. bis 70., ab 71.) mit den Scoutwerten vergleichen; hat Sydney live die Standardformation gespielt oder wie gegen BOD auf Viererkette umgestellt?

## 15. Bietomat: Regeln (Marcus, 26.10.2026)

- Eigene Spieler per Spielernummer aufnehmen, nicht nur Vorschläge der Seite; Endpreis (Maximalgebot) legt Marcus fest, nie darüber bieten.
- Kurz vor Schluss bieten (Wunsch: 3 bis 2 Minuten vor Ende), aber nur, wenn man nicht selbst Höchstbietender ist.
- Laut Marcus verlängert ein Gebot kurz vor Schluss die Auktion. Ziel ist also nicht ein Gebot, sondern am Ende allein Höchstbietender zu sein: nach jedem Gebot und bis zum tatsächlichen Ende das Auktionsende und das Höchstgebot neu lesen; wird man überboten (auch in der Verlängerung), erneut bieten, solange der Endpreis reicht.
- Immer nur eine Stufe höher bieten (das kleinste zulässige Gebot über dem aktuellen Höchstgebot), nie direkt den Endpreis. Beispiel Marcus: Endpreis 3 Mio, Spieler für 1 Mio zu haben -> nicht höher als nötig bieten. Der Endpreis ist nur die Obergrenze.
- Laut Marcus muss ein neues Gebot um einen bestimmten Prozentsatz über dem vorigen liegen. Gebotsfenster (ajax.php?p=transfer&sub=bid-form&pid=…, gelesen 26.10.2026): ManagerZone füllt das kleinste zulässige Gebot in der Währung des Verkäufers vor (#buyform_bid_player_currency); die Seite bietet genau diesen Betrag, rechnet ihn mit den Kursen der Seite in Euro um und prüft gegen den Endpreis. Danach Rückfrage „Bist Du sicher??“, gelegentlich ein Warnhinweis mit Häkchen (#transferBidConfirm), Knopf #transfer_place_bid_button.
- Harte Grenze: kein Gebot über dem Endpreis, auch nicht um 1 Euro. Liegt die nächste zulässige Stufe darüber, wird nicht geboten (Protokoll: "Endpreis erreicht").
- Verlängerung (Text im Gebotsfenster, gelesen 26.10.2026): jedes Gebot in den letzten 3 Minuten verlängert die Auktion um 3 Minuten. Die Seite liest das Ende trotzdem jedes Mal neu.
- Zeitpunkt fest (kein bewusst zufälliger Zeitpunkt).
- Marcus will keine Spieler zum Testen kaufen: keine Testgebote, keine selbst angelegten Aufträge. Aufträge legt nur Marcus an.
- Endpreis muss mindestens das Startgebot und mehr als das aktuelle Gebot sein. Spieler lassen sich per Spielernummer oder Name aufnehmen. Angezeigt werden Skills wie im Kader (Balken, gemaxt, Scout-Stärken/Schwächen), MZ-Werte, Alter, Nationalität, aktuelles Gebot, Ende, Startgebot, letzter Verkaufspreis (Transfers-Box der Spielerseite, Preis in EUR). Ist die Auktion vorbei, steht der Spieler nicht mehr auf dem Markt.
- Heiße Phase hat Vorrang (Marcus, 26.10.2026): Solange ein Gebot läuft, pausieren alle anderen Abrufe (Spieltag, Top 10, Wertscan, Markt, Liga). Technischer Grund zusätzlich: die Seite lässt nur eine ManagerZone-Sitzung gleichzeitig zu, ein laufender Scan würde das Gebot sonst blockieren. Umsetzung: keine neuen Abrufe starten, wenn eine Auktion mit aktivem Auftrag bald endet; lange Abrufe prüfen zwischen ihren Schritten und warten, bis der Bietomat fertig ist.
- Keine Zeitgrenze (Marcus, 26.10.2026): "bieten bis" abgeschafft. Geboten wird bis zum Endpreis, egal wie oft und wie lange sich die Auktion verlängert.

## 16. Ausdauer und Alter (Marcus, 30.10.2026)

- Ältere Spieler (Beispiel: 33 Jahre) verlieren Bälle, auch in Ausdauer.
- Ausdauer unter 8: Der Spieler hält nicht über 90 Minuten durch, ein Wechsel muss eingeplant werden. Die Zentrale warnt, wenn Ausdauer unter 8 fällt und wenn ein Startspieler Ausdauer unter 8 hat.
- Teamwert immer als ein Wert je Team: jeder Spieler anteilig nach seinen Spielminuten (keine Tabelle je Zeitfenster).
- Taktik-Check (Marcus, 30.10.2026): Nach jedem Kaderabruf prüfen, ob die Taktiken im Archiv noch optimal besetzt sind (Skills ändern sich). Vorschlag mit XML; übernommen wird nur auf Klick, nie automatisch.
- Höchstens 3 Wechsel je Spiel. Brauchen mehr Startspieler wegen Ausdauer unter 8 einen Wechsel, bekommen ihn die mit der niedrigsten Ausdauer zuerst; wer leer ausgeht, ist eine Schwachstelle mit Vorrang beim Transfermarkt (Marcus, 30.10.2026).

## 17. Vorgaben von Marcus zur Seite (26. bis 31.10.2026)

Spielfelder und Werte
- Heatmap mit festen Grenzen für alle Teams (nicht relativ zum Team): bis 0,3 Mio hellgrün, 0,7 Mio dunkelgrün, 1,0 Mio gelb, 1,25 Mio rot, ab 1,5 Mio dunkelrot (dazwischen fließend). Legende unter jedem Feld.
- Alle Spielfelder sind dieselbe Karte (eine Komponente). Spieler als kleine Punkte, damit die Aufstellung präzise zu sehen ist (verkleinert 31.10.2026).
- Letztes Ligaspiel: ein Feld mit beiden Teams (seine Spieler als Rauten, gespiegelt), je eigenem Spieler ✓/✗, ob er sein Duell mit dem wertvolleren Spieler bestritten hat („getroffen?“).
- Teamwert: ein Wert je Team, jeder Spieler anteilig nach seinen Spielminuten (überall, keine Tabellen je Zeitfenster).

Formation Liga (26.10.2026)
- Nach jeder Spieltag-Analyse (5 Stunden nach dem Ligaspiel) automatisch die Aufstellung gegen den nächsten Gegner in den Editor-Reiter „Liga“ schreiben und nach Neuladen prüfen. Welcher Reiter im Spiel gilt und was am Ende gespielt wird, entscheidet Marcus selbst.
- Grundlage ist die getestete Taktik aus dem Archiv (Spieler, Bank, Wechsel- und Taktikregeln bleiben). Angepasst wird nur: stärkste Verteidiger gegen seine stärksten Angreifer, Innenverteidiger mit dem meisten Kopfball, wenn er über außen spielt, Angriff auf seiner schwächeren Abwehrseite (sonst spiegeln).
- Kopfball innen schon bei der Auswahl (Marcus, 01.11.2026: „spielt er über außen, hat er in der Mitte einen sehr kopfballstarken Stürmer“): Die VT-Formel gewichtet Kopfball mit 0. Spielt er über außen (ein echter Angreifer außen, der flankt; die Einstellung Flügel allein reicht nicht), zählt auf den Innenverteidiger-Plätzen ein Zuschlag von 0,08 × Kopfball (eigene Setzung) schon bei der Wahl der Elf, nicht nur bei der Verteilung. So kommt ein gleich starker, aber kopfballstärkerer Verteidiger von der Bank in die Mitte. Liga zeigt danach „Innenverteidigung: Name (Kopfball x), …“. Spielt er eng, zählt kein Kopfball, nur die Stärke (VT-Formel: Zweikampf 0,30 und Sprint 0,25 am höchsten).
- Transfers: Ein gekaufter Spieler ist 25 Stunden nach Auktionsende im Kader und ab dann spielberechtigt (Marcus, 01.11.2026).
- Sperren gelten je Wettbewerb: Pokal- oder Freundschaftsspiel-Sperre sperrt nicht für die Liga.
- Für den Reiter „Liga“ ist die Seite allein zuständig (Marcus, 31.10.2026): beste Taktik für das nächste Ligaspiel nach der Gegneranalyse, selbst aufgestellt und in den Reiter „Liga“ übernommen; er darf nie leer sein. Umsetzung: nach jeder Spieltag-Analyse und nach jedem täglichen Kaderabruf neu (bis zum Anstoß), nach einem Fehler stündlich erneut. Vorher wird die Besetzung der Basis-Taktik mit dem Taktik-Check gegen Kader und Aufstellbarkeit am Spieltag geprüft (Verletzung, Sperre, Trainingslager, Skills, Ausdauer-Wechsel).

Zentrale
- Warnung bei Skillverlust (vor allem Ausdauer unter 8), Übersicht „Bälle der letzten 14 Tage“ (wer hat Bälle bekommen oder verloren). Taktik fürs nächste Spiel nur kompakt.
- Täglicher Taktik-Check und Taktik-Portfolio: Vorschläge mit Begründung und XML; in ManagerZone übernommen wird nur auf Klick von Marcus, nie automatisch (Ausnahme: Formation Liga, siehe oben).

Taktik-Portfolio (Hauptaufgabe, 30./31.10.2026)
- Die 8 Reiter sollen ein Portfolio sein: für das eigene Team optimal besetzt, abwechslungsreich, mit einer guten Antwort auf jeden Gegnertyp. Laufend prüfen und Umgestaltungen vorschlagen.
- Überschreiben vorschlagen, wenn ein Reiter identisch mit einem anderen ist oder ein anderer Stil klar besser ist. Eigene Setzung der Seite: „klar besser“ = bei den Top 10 gegen dieselbe Gegnerklasse mindestens 10 Prozentpunkte mehr Punktquote; bewährt = mindestens 3 Spiele und 60 % Punktquote.
- Seitenvarianten gehören ins Portfolio (Marcus, 31.10.2026): mal über rechts, mal über links angreifen, damit der Gegner nicht einfach seine Abwehr auf Hyuga rechts stellt. Gespiegelte Reiter (außenR/außenL) sind deshalb kein Duplikat; fehlt zu einem einseitigen Reiter die Fassung für die andere Seite, schlägt die Seite die gespiegelte Fassung vor. Liga, außenR, außenL und kupass werden nicht überschrieben (außenR und kupass nennt die Faustregel beim Namen).
- U18 ist keine Taktik, sondern die Aufstellung der U18-Mannschaft (Marcus, 31.10.2026): eine allgemeine Aufstellung, die gegen alles bestehen soll, ohne viel Aufwand. Nur Spieler bis 18 Jahre (18 ja, 19 nein; im Editor über den Alter-Regler, U18 steht auf 16 bis 18). Beste Elf, die das Team mit diesem Alter stellen kann; Spieler mit Rückennummer 100 bis 150 haben Vorrang auf dem Feld, damit sie Spielpraxis bekommen. Stil und Name bleiben, geprüft wird nur die Besetzung.
- Reiter mit Alter-Regler bleiben so eingestellt (nur Spieler dieses Alters). Alle Reiter ohne Altersgrenze (16 bis 38) darf die Seite frei gestalten. Später kommen U21 und U23 dazu, noch nicht (keine Jugendspieler in dem Alter).
- Alter-Regler im Editor: Tactic["@attributes"].age_from / age_to (Grenzen 16 und 38), nur für Clubmitglieder änderbar (tactics.js, gelesen 31.10.2026). Beim Überschreiben prüft die Seite nach dem Speichern, dass der Regler gleich geblieben ist.
- Die Seite liest beim täglichen Kaderabruf jeden Reiter direkt aus dem Editor (Reiter anklicken, Export, nur lesen) und hält das Archiv damit aktuell. Editor-Stand 30.10.2026: A außenR, B außenL, C kupass, D 3313of, E 532de, F U18 (Alter 16 bis 18), G Liga, H freund, I und J leer, K Alt1, L Alt2.
- Koordinaten im Editor-JSON: 1000 × 1000; Export rechnet x = floor(x × 214 / 1000) − 3, y = floor(y × 328 / 1000) − 1; Torwart immer 103/315 (tactics.js, coordToPos, gelesen 31.10.2026).
- Sinnhaftigkeit prüfen, nicht nur Duplikate: Name und Inhalt müssen zusammenpassen. Spielt ein Reiter etwas anderes, als der Name sagt (Beispiel Marcus: „532de“, aber keine 5-3-2), wird er umbenannt (Vorschlag mit Knopf, nur auf Klick).
- Namensschema der Seite: Formation + Taktik + Spielweise, höchstens 6 Zeichen, z. B. 532flo = 5-3-2 Flügel offensiv, 343kp = 3-4-3 Kurzpass normal (fl Flügel, kp Kurzpass, lb lange Bälle, o offensiv, d defensiv, nichts = normal).
- Umbenennen im Editor (tactics.js, gelesen 31.10.2026): Reiter wählen, „Umbenennen“ (#rename_tactics_button), Name ins Feld #tactic_name (maxlength 6), Speichern (POST ajax.php?p=tactics&sub=rename mit tactic_name und key). Ohne Clubmitgliedschaft nur Reiter A.
- Stand Archiv 31.10.2026 (vor dem automatischen Einlesen aus dem Editor): 7 Reiter enthalten dieselbe Elf, dieselbe Bank und dieselben 8 Regeln; außenL, Kupass, 3313of, 532de, U18 und freund sind identisch, außenR hat teils andere Plätze (zum Teil gespiegelt, aber keine vollständige Spiegelung von außenL). Alle eingefügt am 26.10.2026 zwischen 12:26 und 12:31 UTC. Wahrscheinlich beim Einfügen jedes Mal dieselbe XML erwischt: jeden Reiter einzeln exportieren und neu einfügen, bevor Portfolio-Vorschläge übernommen werden.
- freund (Marcus, 31.10.2026): Reiter für Freundschaftsspiele. Die wichtigsten Spieler sitzen auf der Bank, damit sie Erfahrung und Form bekommen, sich aber nicht verletzen können (laut Marcus). freund soll eine komplett andere Taktik sein als die offiziell gespielten Reiter. Umsetzung der Seite: wichtigste = Startelf des letzten Ligaspiels nach MZ-Wert, so viele wie Bankplätze; keine Wechselregel wechselt sie ein.
- Taktikvorschläge (Marcus, 31.10.2026): inspiriert vom Wissen der Top 10 und davon, wie sie gegen bestimmte Gegner gespielt haben; dürfen den Gegner auch in die Falle locken (z. B. Seitenwechsel); immer auf die eigenen Spieler abgestimmt. Die aktuellen Reiter sind laut Marcus schon gut und bleiben die Basis; Änderungen nur, wenn etwas fehlt oder klar besser geht.
- Taktikseite (Marcus, 31.10.2026): dort alle Reiter automatisch aus dem Editor, je Reiter Vorschläge (Spieler tauschen, Wechsel anders, kann weg, überschreiben), Abdeckung je Gegnertyp, U18 und freund, XML und Umbenennen mit Namensvorschlag (max. 6 Zeichen). Die Startseite zeigt dazu nur noch einen kurzen Hinweis.
- freund wird immer getrennt betrachtet (Marcus, 31.10.2026): Es geht dort um nichts, nur darum, dass sich die Spieler nicht verletzen und trotzdem Form bekommen. Laut Marcus braucht jeder Spieler 2 Ligaspiele und 4 Freundschaftsspiele, um die beste Form zu halten. In freund soll eine Taktik gespielt werden, die es in keinem anderen Reiter gibt. freund zählt nicht beim Doppelt-Vergleich und nicht bei der Abdeckung.
- außenR und außenL sind verschieden, weil sie über verschiedene Seiten angreifen (Marcus, 31.10.2026): gleicher Stil mit Eckstürmern auf der anderen Seite gilt als Seitenvariante, nicht als Duplikat.
- Reiter löschen (Marcus, 31.10.2026): im Editor Reiter wählen, „Alles zurücksetzen“ (#clearb, clearAll(): Feld und Regeln leeren), „Speicher aktuellen Tab“, Namen entfernen (leerer Name: der Editor zeigt den Buchstaben). Reiter A darf nicht leer sein (allowEmpty false). Die Seite macht das nur auf Klick und hebt die XML vorher als Sicherung auf (Rohseite „taktik-geloescht“).
- Scoutspiele (Marcus, 31.10.2026): mit einem Klick auf der Gegnerseite alle Scoutspiele gegen den Gegner holen und auswerten; danach Liga anpassen, wenn nötig. Umsetzung: Liste per POST ajax.php?p=matches&sub=list mit selectType=scout_match (eingeloggt), Stats-XML über check-match und getMatchFiles.php?type=stats (eingeloggt, sonst „blocked“), eigene Taktik je Spiel über die Startaufstellung (Toleranz wie bei eigenen Spielen). Die automatische Auswertung hat Vorrang vor den von Marcus gelieferten Berichten. Entscheidung zwischen Taktiken wie bisher: mindestens 8 Spiele je Taktik, Punkte pro Spiel ab 0,2 Abstand, sonst Tordifferenz.
- Kader (31.10.2026): sortierbar nach höchstem MZ-Wert, Alter, Scout; Ansicht Top 5 je Position; Filter Profis/Jugend, Alter, Status, Ausdauer unter 8. Jugend: gleiche Tabelle, aufgeteilt in Behalten/Abgabekandidaten, eigene Entscheidung per Klick (überschreibt den Regel-Vorschlag).
- Transfervorschläge (31.10.2026): Karten mit Skills und Potenzial, Annehmen (Watchlist) oder Ablehnen; auf der Watchlist mit Endpreis in den Bietomat oder entfernen. Aktive Bietomat-Aufträge stehen auf der Transferseite.
- Taktiken (31.10.2026): Liga und alle anderen Reiter werden im täglichen Kaderabruf geprüft; Liga wird nur bei Änderung neu geschrieben, die anderen bekommen Vorschläge auf der Taktikseite.

Transfermarkt (31.10.2026)
- Schwachstellen = Startelf des letzten Ligaspiels. Einwechselspieler (z. B. Kaupa) stehen nicht drin; für sie spielt Ausdauer kaum eine Rolle (Marcus).
- Ab 31.10.2026 gelockert: Marcus hat selbst auf Spieler mit Sprint 8/Ausdauer 9 und Sprint 9/Ausdauer 8 geboten (Jonsson, Arnold, Di Pietro, Astafiei), die die strenge 99-Regel aussortiert hatte. Die Seite verlangt jetzt Sprint und Ausdauer je 8+ und zusammen 17+ (höchstens einer der beiden 8) und schreibt einen Vorbehalt dazu. Unlesbare Nationalität schließt ohne Rahmen nicht mehr aus.
- Ohne eingetragenen Rahmen (Kapital, Ausländer, Arbeitsbewilligungen) zeigte die Seite keinen Spieler. Seit 31.10.2026 zeigt sie Kandidaten trotzdem, mit dem Vorbehalt, dass diese Grenzen nicht geprüft sind.
- Rahmen (31.10.2026): Marcus hatte noch Platz für Ausländer, und zwar über Arbeitsbewilligungen (Gebotsfenster vom 26.10.2026: Ausländische Spieler 5 von 5, Arbeitsbewilligungen 2 von 5, verfügbarer Saldo 3.482.080 EUR). Die Seite liest diese Zahlen jetzt bei jeder Marktsuche selbst aus dem Gebotsfenster eines gefundenen Spielers (nur lesen) und prüft damit Budget und Ausländerplätze.
- Anzeige (31.10.2026): alles auf Deutsch; die Formel-Rolle „Anchorman“ heißt in der Anzeige „Sechser“. Filter sind Schalter (noch einmal klicken hebt sie auf). Jugend hat dieselben Filter wie der Kader. Behalten/Abgabe auch auf der Spielerseite einstellbar. XML überall herunterladen oder kopieren. Transfervorschläge zum Durchblättern (4 je Seite) mit sichtbaren Skills. Saison zeigt die Ligatabelle.
- Marktsuche (31.10.2026): Nationalität steht in der Suche nur als Flaggenbild vor dem Namen (img/flags/15/<Code>.png), nicht als Zeile; die Seite liest den Ländercode daraus.
- Transfermarkt-Reiter (Marcus, 31.10.2026): Vorschläge, Watchlist, Gebote (Bietomat). Spieler verschwinden von der Watchlist, sobald ihre Auktion vorbei ist (zuletzt bekanntes Ende plus 30 Minuten; verlängerte Enden aus der neuesten Suche oder dem Bietomat zählen).
- Ligatabelle (Marcus, 31.10.2026): ändert sich nur nach Ligaspielen, deshalb nur im Spieltag-Abruf 5 Stunden nach jedem Ligaspiel holen. Sie steht nicht im Seiten-HTML der Ligaseite, sondern im Reiter „Tabelle“ (a#league_tab_table, ajax.php …&sub=table); Spalten: Platz, Mannschaft, Sp, G, U, V, +, -, =, Pkt, Letzte 6 Spiele.
- Transfermarkt (Marcus, 31.10.2026): überall alle Infos zum Spieler, auch auf Watchlist und Gebote (Skills, MZ-Werte, Eckdaten, wen er ersetzt und um wie viel).
- Transfermarkt (Marcus, 31.10.2026): Klick auf den Spielernamen öffnet ihn in einem neuen Tab auf dem Transfermarkt von ManagerZone: https://www.managerzone.com/?p=transfer&sub=players&u=<Spielernummer> (Adresse von Marcus; per Test bestätigt, die Suche zeigt genau diesen Spieler). Wer ein aktives Gebot hat, steht unter Gebote, nicht auf der Watchlist. Gebot entfernen: „Verwerfen“ (weg, auch von der Watchlist) oder „Zurück auf Watchlist“.
- Transfermarkt (Marcus, 31.10.2026): Spieler auf der Watchlist oder mit aktivem Gebot stehen nicht mehr bei den Vorschlägen. Watchlist und Gebote zeigen dieselbe Spielerkarte wie die Vorschläge, bei Gebote zusätzlich dein Endpreis und letztes Gebot. Überall ein Countdown (Tage, Stunden, Minuten) bis zum Auktionsende.

Arbeitsweise
- Alles, was besprochen wird, in dieser Datei festhalten und vor neuen Aufgaben hier nachsehen, damit nichts doppelt besprochen werden muss.
- Antworten kurz, in Stichpunkten, nur belegte Inhalte.
- Scoutspiele (Marcus, 31.10.2026): Bei neuen Scoutspielen nur die neuen laden, schon gespeicherte nie erneut. Die Auswertung umfasst immer alle Scoutspiele gegen den Gegner seit dem eigenen letzten Ligaspiel; ältere (z. B. aus einer früheren Begegnung) werden weder geladen noch gezählt. Danach die Taktiken kontrollieren.
- Nach neuen Infos Taktiken kontrollieren (Marcus, 31.10.2026): Nach Kaderabruf, Spieltag-Analyse, Scoutspielen und Ligatabelle die empfohlene Taktik neu berechnen, die Formation Liga prüfen (geschrieben nur bei Änderung, nur vor dem Anstoß) und alle übrigen Reiter prüfen (nur Vorschläge).
- Weltrang eines Teams = „Rang“ auf der Teamseite ?p=team&tid= (Marcus, 31.10.2026). Ligatabelle zeigt dazu den Startelf-Wert (Marktwerte der Elf aus dem letzten Ligaspiel des Teams) und ist nach Punkten, Startelf-Wert und Weltrang sortierbar.
- Namensänderungen zählen bei Taktiken nicht als Änderung (Marcus, 31.10.2026): nicht in der Zahl der Zentrale, nicht im Filter „Nur mit Vorschlägen“, nicht in der täglichen Taktikprüfung; der Namensvorschlag bleibt auf der Karte sichtbar.
- Portfolio-Lücke (Marcus, 31.10.2026): Gibt es gegen den Typ des nächsten Ligagegners einen bei den Top 10 bewährten Stil, den kein Reiter hat, und ist er besser als dein bester Stil gegen diesen Typ, dann Hinweis auf Spieltag und Zentrale mit fertiger Aufstellung (echte Startelf eines Topteams aus einem Sieg, mit deinem Kader besetzt). Übernommen wird nur auf Klick in einen gewählten Reiter (leere zuerst, Liga, freund und Jugend nie). Die Empfehlung (Scoutspiele, sonst Faustregel) bleibt unberührt.
- Auktionsbericht (Marcus, 31.10.2026): Am Ende jeder Bietomat-Auktion ein Bericht (Spieler bekommen / nicht bekommen / Bietomat beendet mit Grund; Anzahl Gebote, höchstes eigenes Gebot, Maximum) als Push aufs Handy und als Pop-up beim nächsten Besuch. Kein Bericht, wenn Marcus den Auftrag selbst löscht. „Bekommen“ heißt: zuletzt Höchstbietender laut Bietomat; den Kauf selbst prüft er nicht.
- Beendete Auktionen (Marcus, 31.10.2026): Spieler mit beendeter Auktion landen nicht wieder auf der Watchlist (und nicht in den Vorschlägen), sondern im Reiter Gebote unter „Beendete Auktionen“ mit Ergebnis (bekommen für Preis / nicht bekommen / beendet), Auktionsende, Anzahl Gebote, höchstem Gebot und Maximum.
- Endstand einer Auktion (Marcus, 31.10.2026): aus der Gebotsübersicht von ManagerZone (?p=transfer&sub=yourplayers, Inhalt per ajax.php?p=transfer&sub=your-bids): letztes Gebot = Endpreis, Mannschaft mit dem letzten Gebot, Kosten der Arbeitsbewilligung. Der Bietomat liest sie direkt nach Auktionsende; sie hat Vorrang vor dem, was der Bietomat selbst gesehen hat.
- Zugänge (Marcus, 01.11.2026): Ein gewonnener Transfer kommt etwa 24 Stunden nach Auktionsende in den Kader. Bis er im Kader steht (höchstens 7 Tage), zählt er für Schwachstellen, Transfervorschläge, gezielte Marktsuche und die Zentrale schon mit: er übernimmt den Startplatz, den er am stärksten verbessert; gesucht wird dann für die nächste Schwachstelle.
- Trainingszeiten (Marcus, 01.11.2026): Neue Trainingsberichte und Skill-Änderungen kommen gegen 4 Uhr (Berlin), nicht um Mitternacht. Der tägliche Kaderabruf (Skills, Bälle, Status) läuft deshalb erst ab 5 Uhr, die Top 10 ab 4 Uhr, der Transfermarkt ab 6 Uhr. Fehler bis 01.11.2026: die Uhrzeitprüfung las „00 Uhr“ als keine Zahl, dadurch liefen alle drei schon ab 0 Uhr.
- Sonntags kein Training: keine neuen Bälle, keine Verbesserungen der Spieler.
- Mittwochs trainieren nur Spieler im Trainingslager; alle anderen Spieler trainieren an diesem Tag nicht.
- Bälle und Taktik (Marcus, 01.11.2026): „Durch die Bälle in der Startelf“ nur, wenn er mit seinen Skills von vor 14 Tagen nicht in der Startelf des Reiters wäre (tägliche Prüfung zweimal gerechnet). Spieler im Trainingslager, verletzt oder gesperrt werden dafür als einsetzbar gerechnet und mit „nach dem Trainingslager …“ gemeldet. freund wird dabei nicht bewertet: dort sitzen die wichtigsten Spieler bewusst auf der Bank (Spielpraxis für Form und Erfahrung ohne Verletzungsgefahr); Liga schreibt die Seite selbst.
- Fehlende Spielertypen (Marcus, 01.11.2026): Geprüft werden deine Reiter (ohne Liga, freund und U18/Jugend: freund und U18 spielen einfach mit dem, was da ist) und bei den Top 10 bewährte Stile, die gegen einen Gegnertyp besser abschneiden als dein bester bewährter Stil dagegen und die du nicht als Reiter hast, werden mit deinem Kader (inkl. Zugängen) besetzt. Ist ein Platz dort schwächer besetzt als dein heute schwächster Startelf-Platz, fehlt dir dieser Spielertyp: zusätzliches Ziel für Marktbewertung (Vorschläge mit „für <Taktik>“) und gezielte Suche (höchstens ein Ziel), höchstens 3 Top-10-Stile. Alle Spieler werden dafür als einsetzbar gerechnet (Trainingslager und Verletzung sind vorübergehend). Beispiel: zu viele Abwehrspieler verkauft, dann fehlen sie für eine Fünferkette. Kommt selten vor.
- Taktiken immer vollständig (Marcus, 01.11.2026: „die Taktiken müssen immer komplett durchdacht sein und zum Erfolg führen“; beim Import von 343kp fehlten die Wechselregeln): Jede neu erzeugte Taktik (Portfolio, Lücke gegen den Gegner, Taktik-Code) bekommt beim Erzeugen die Rot-Regel, die Spielstand-Regeln wie deine Reiter (60. 1 Tor Rückstand offensiv + aggressiv, 65. 2 Tore Rückstand Kurzpass + aggressiv, 70. Führung normal, 80. Gleichstand offensiv + aggressiv; wirkungslose entfallen, Alternative 2 nicht, weil gleich der Startaufstellung) und die Ausdauer-Wechselregeln (70. Minute, bester passender Bankspieler, höchstens 3 Wechsel) wie bei der täglichen Prüfung. Vor dem Schreiben nach ManagerZone wird sie gegen die volle Prüfliste und die tägliche Prüfung geprüft; besteht sie nicht, wird nichts geschrieben.
- Bei jeder Taktik immer mitdenken (Marcus, 01.11.2026: „Denke immer an sowas, wenn es um Taktiken geht“), auch bei Liga: Rot-Regel (ohne Spielerwechsel, Umstellung auf Alternative 1), Spielstand-Regeln (Rückstand, Führung, Gleichstand), Ausdauer-Wechsel für alle Startspieler unter Ausdauer 8 (höchstens 3 Wechsel, kein Spieler in zwei Wechselregeln), Bank je Position, Alternativen 1 und 2. Liga wird aus deinem Archiv-Reiter gebaut (Regeln und Alternativen bleiben, Besetzung und Wechsel per täglicher Prüfung); ohne Archiv-Reiter neu erzeugt mit denselben Regeln. Stand Liga gegen Biene Maja (31.10.2026, kupass): 55. Wiesenberg für Hyuga, 60. Kaupa für Nazarov, 60. Rodekamp für Cytrynski (alle Ausdauer 7), 60./65./80. Spielstand-Regeln, Rot → Kurzpass + Alternative 1; 70. Führung → normal nicht nötig, spielt schon normal.
- Mindestabstand bei übernommenen Top-10-Aufstellungen (01.11.2026): Koordinaten aus der Stats-XML liegen nach dem Umrechnen manchmal knapp unter 47 (343kp: 46,1 und 46,7). Erzeugte Taktiken und das Nachziehen von Regeln schieben zu enge Feldspieler um das Nötige auseinander (Ziel 48, der vorderste an y 63 bleibt), in allen drei Aufstellungen.
- U18 (Marcus, 01.11.2026): bekommt die Spielstand-Regeln wie alle Reiter (damit sie erfolgreicher ist), mit Altersgrenze und ohne Ausdauer-Wechsel. freund bekommt keine (dort ist das Ergebnis egal).
- Führungsregel „ab 70. bei Führung auf normal“ nur bei offensiver Grundeinstellung (Marcus, 01.11.2026): bei defensiv (z. B. U18) würde sie die Taktik offensiver machen statt ruhiger, deshalb dort weder ergänzen noch behalten.
- Alternativen immer mitbauen (Marcus, 01.11.2026: „in Zukunft, wenn du Taktiken erstellst, muss das alles zusammen passieren“): Neue Taktiken bekommen Alternative 1 (Rot, 10 Mann) und Alternative 2 (2 Tore Rückstand) nach dem Vorbild deines ähnlichsten Reiters mit echten Alternativen (gleich viele Verteidiger, nächstliegende Startplätze; jeder Spieler bekommt die Verschiebung des passenden Vorbild-Spielers). Rot-Regel nach der Prüfliste auf Alternative 1 ausgerichtet, 65. bei 2 Toren Rückstand auf Alternative 2. Danach Abstände, Prüfliste und tägliche Prüfung; erst dann schreiben.
- Wechselzeit bei Ausdauer 7 (Marcus, 01.11.2026, mit Begründung): 70. Minute. Eigene Daten: Hyuga (Ausdauer 7) schafft es bis etwa zur 75. bis 80. und ist deutlich wirksamer als der Ersatz (außenR: 8 Vorlagen bis zur 50.; Ishizaki ab der 50.: 0 Vorlagen, 0 Schüsse aufs Tor, Zweikämpfe 2:11). Die Top-10-Zahl (häufigste Wechselminute 55.) gilt für alle Wechsel und setzt einen gleich guten Ersatz voraus, deshalb nicht übertragen. Früher wechseln nur mit Beleg, dass der Ersatz gleich gut ist.
- Arbeitsweise (Marcus, 01.11.2026): Nicht blind zustimmen, sondern nach Daten entscheiden und die Begründung nennen, auch wenn es Marcus widerspricht. Ziel ist die bestmögliche Vorbereitung (Gegner analysieren: welche Taktik gegen welchen Gegnertyp, Konter darauf; Portfolio aus Top-10-Wissen für jeden Typ), keine Sieggarantie.
- Leistung je Spieler und Rolle (Marcus, 01.11.2026): aus eigenen Ligaspielen und Scoutspielen mit Stats-XML je 90 Minuten (Tore, Vorlagen, Schüsse aufs Tor, Zweikämpfe, Pässe), Rolle = Startplatz, Eingewechselte auf der Rolle des Ersetzten. Grundlage für Wechselzeit und Aufstellung statt Einzelspiel. Bewertet und verglichen wird ein Spieler in einer Rolle erst ab 180 Minuten (etwa zwei volle Spiele, Festlegung). Alle Spieler mit Einsatzzeit, auch Bank. „Im Visier“: Bankspieler, die in ihrer Rolle bei Toren, Vorlagen oder Schüssen aufs Tor je 90 jeden bewertbaren Startspieler übertreffen. Steht auf Kader- und Spielerseite.
- Gleich starker Ersatz → früh wechseln wie die Topteams (Marcus, 01.11.2026). Hyuga/Ishizaki auf dem Flügel laut Leistung je Rolle gleichwertig: Ishizaki (Ausdauer 9) startet, Hyuga (Ausdauer 7) kommt frisch; außenR wie außenL in der 50. (gespiegelte Reiter unterscheiden sich nur in der Seite).
- Spieltag-Automatik (Marcus, 01.11.2026): Spielbericht, Analyse des nächsten Gegners und Ligatabelle 3 Stunden nach Anstoß des Ligaspiels (vorher 5 Stunden nach Spielende).
- Fehleranalyse Biene Maja (01.11.2026, 1:1): Die Liga-Abwehr gab jedem Abwehrplatz den Aufschlag seines nächsten Angreifers; zwei Plätze (x 127 und x 175) zählten so beide für Galvan, Nazarov landete außen, wo niemand angriff (Galvan spielte gegen Zahl, Salqvist gegen Chille). Korrigiert: jeder Angreifer gehört genau zu einem Abwehrplatz (nächster, eins zu eins). Außerdem galt als erwartete Elf die häufigste der Saison, bei Gleichstand die älteste; jetzt: hat er zuletzt mindestens zweimal hintereinander gleich aufgestellt, gilt diese neueste Elf (Trend), sonst die häufigste, bei Gleichstand die neueste.
- Vorhersage „wie spielt er gegen mich?“ (Marcus, 01.11.2026: Schere, Stein, Papier; Kern des Programms): 1. Trend: zuletzt mindestens zweimal hintereinander gleich aufgestellt → so erwartet. 2. Wechselt er: seine Aufstellung zuletzt gegen Gegner wie dich (dein Gegnertyp aus deinen letzten 3 Ligaspielen: Fünferkette, enge Mitte, mit Außenspielern). 3. Sonst seine häufigste. Die erwartete Aufstellung ist Grundlage für Gegnertyp, Faustregel (Fünferkette/enge Mitte → kupass, sonst außenR), Top-10-Belege, Duelle und Formation Liga.
- Seitenvarianten: Greift die Liga über seine schwächere Abwehrseite an und wäre außenR dafür gespiegelt worden, gilt gleich außenL (und umgekehrt), überall gleich benannt (01.11.2026: „du sagst außenR, zeigst aber außenL“).
