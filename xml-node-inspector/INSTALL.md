# XML Node Inspector - Installation

1. ZIP entpacken (Ordner xml-node-inspector behalten).
2. In Chrome chrome://extensions öffnen.
3. Oben rechts Entwicklermodus einschalten.
4. Entpackte Erweiterung laden klicken und den entpackten Ordner auswählen.
5. Für lokale Dateien: bei der Erweiterung auf Details und
   Zugriff auf Datei-URLs zulassen aktivieren.

## Benutzung

**XML-Seite öffnen**
Bei Seiten mit XML-Content-Type öffnet sich der Viewer automatisch in einem neuen Tab.
Wenn die URL nach XML aussieht, aber der Server einen anderen Content-Type liefert,
kannst du auf das Erweiterungs-Icon oder den Button auf der Seite klicken und
Als XML öffnen wählen.

Der Viewer lädt die Quelle aus dem XML-Tab. Wenn der Browser das Content-Script
auf einer Seite nicht ausführt, versucht der Viewer, die URL direkt zu laden,
und zeigt bei einem Fehler eine verständliche Meldung an.

**Datei laden oder XML einfügen**
Auf das Erweiterungs-Icon klicken und Viewer öffnen wählen. Dann Datei
hineinziehen, auswählen, oder XML in das Feld einfügen.

## Viewer-Funktionen

Klick auf einen Tag-Namen im Baum zeigt rechts alle Vorkommen dieses Knotens
im gesamten Dokument - mit Wert, Attributen, XPath und Zeilennummer.

- Umschalter überall im Dokument / nur unter gleichem Pfad
- Zahl hinter jedem Tag = Anzahl Vorkommen
- Filter über die Trefferliste, Option "nur mit Wert"
- Werte kopieren, XPath kopieren, CSV
- Klick auf eine Trefferzeile springt zurück in den Baum und markiert den Knoten
- Trennlinie zwischen Baum und Panel ist verschiebbar

Alles läuft lokal im Browser; es werden keine Dokumente an einen Server gesendet.
