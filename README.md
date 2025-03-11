# verona-modules-ib

Machbarkeitsstudie eines Item-Builder-Players für Verona.

## Konzept

Die DIPF-Itemplayer-Runtime und die Aufgaben-_inhalte_ müssen aus der selben Quelle 
nachgeladen werden. Dazu wird alles, was benötigt wird, in ein itcr-Paket gepackt.
Der Player und die Unit-Definition (aus Testcentersicht) sind dann nur ganz
dünne Layer - das Wesentliche befindet sich in dem Paket.

Für jedes Booklet mit IB-Inhalten wird ein solches Paket benötigt.


## Vorgehensweise

1. clone this repo (including submodules!)
2. copy items (as zip) to units
3. `npm run build`
4. in dist you find
 * the player
 * a package containing your units and the IB-runtimes
 * sample unit-xml, testtaker-xml and booklet-xml file for iqb-testccenter
5. edit xmls as desired
6. upload everything to testcenter

## Features

| Feature                                   | IB    | V/ITC  | Status                                               |
|-------------------------------------------|-------|--------|------------------------------------------------------|
| Aufgabe Anzeigen                          | Ja    | Ja     | Done                                                 |
| Neue Aufgabe im selben Player Laden       | Ja    | Ja     | TODO                                                 |
| Unit-Navigation aus der Aufgabe heraus    | Ja    | Ja     | Done
| Unit-Navigation von außen                 | Ja    | Ja     | TODO
| Seiten-Navigation von außen               | Nein? | Ja     | TODO
| presentationProggress / responseProgress  | Nein? | Ja     | Prüfen
| VariablenState NOT_REACHED / DISPLAYED    | Nein? | Ja     | Prüfen
| Eingaben wegspeichern                     | Ja    | Ja     | TODO                                                 |
| Logs wegspeichern                         | Ja    | Ja     | TODO                                                 |
| Eingaben/Aufgabenzustand wiederherstellen | Ja?   | Ja     | TODO (warscheinl. möglich über Replay?)              |
| Replay                                    | Ja    | Nein   |                                                      |
| Fokus tracken                             | Nein  | Ja     | Wahrscheinlich unmöglich ohne Anpassung der IB-Runtime |
| Print-Modus                               | Nein  | Ja     |                                                      |
| Vorladen von Biblbiotheken und Inhalten   | Nein  | Ja     | Nur möglich durch größere Umbauten im Testcenter *)  |
| Trennung von Runtime und Aufgabeninhalten | Ja    | Ja     | Wahrscheinlich unmöglich ohne Anpassung der IB-Runtime
| Paginations-Modi                          | Nein  | Ja     | Unmöglich
| Mit spezifischem Task starten             | Ja    | (Nein) | TODO
| Scores wegspeichern                       | Ja    | (Nein) | Scoreformat nicht ohne weiteres als IQB-Variablen verständlich  
| mathJax Bibliothek nutzen                 | Ja    | Ja     | TODO 


*) entweder Vorladen durch Nutzung vom Browsercache oder Einsatz von Webservice

## Weitere Fragen mit auswirkungen auf Verona

## ServiceWorker
- Runtime meldet: "SW installation SW not present or not prod env. Install SW:. app can NOT be used in offline mode!"
Wofür braucht man den? Braucht man den wirklich?
Ggf. Anpassung der TC-Architektur

## 
