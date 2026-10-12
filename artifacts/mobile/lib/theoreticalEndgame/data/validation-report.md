# Validation des finales théoriques

Généré le 2026-10-12T12:30:53.694Z. 57 variantes actives, 0 en échec.

Méthode : table Syzygy Lichess pour 7 pièces ou moins (exacte, point de vue du trait). Chaque ligne conserve la catégorie, le DTZ, le DTM ou null, la source et la méthode. Une catégorie exacte n’est pas une distance de mat : les nulles ont été consultées avec `dtm = 0`, sentinelle conservée dans `dtmReported`, et `dtm` est null. Stockfish 18 Lite profondeur 16 pour les percées à 8 pièces : recherche, centipions, pas une table et pas une DTM. Le jeu n’appelle ni l’un ni l’autre. Les décisions intermédiaires, hors de ce rapport, sont mesurées dans la partie par le mat annoncé du moteur de l’appareil ; voir `SCORING.md`.

| id | camp | objectif | statut | méthode | détail |
| --- | --- | --- | --- | --- | --- |
| TE-CANON-QUEEN-MATE | white | WIN | verified | syzygy-7 exact | category=win dtz=13 dtm=13 dtmReported=13 source=lichess-syzygy |
| TE-CANON-QUEEN-MATE-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=11 dtm=11 dtmReported=11 source=lichess-syzygy |
| TE-CANON-QUEEN-MATE-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=13 dtm=13 dtmReported=13 source=lichess-syzygy |
| TE-CANON-ROOK-MATE | white | WIN | verified | syzygy-7 exact | category=win dtz=27 dtm=27 dtmReported=27 source=lichess-syzygy |
| TE-CANON-ROOK-MATE-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=11 dtm=11 dtmReported=11 source=lichess-syzygy |
| TE-CANON-ROOK-MATE-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=15 dtm=15 dtmReported=15 source=lichess-syzygy |
| TE-CANON-TWO-BISHOPS-MATE | white | WIN | verified | syzygy-7 exact | category=win dtz=33 dtm=33 dtmReported=33 source=lichess-syzygy |
| TE-CANON-TWO-BISHOPS-MATE-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=29 dtm=29 dtmReported=29 source=lichess-syzygy |
| TE-CANON-TWO-BISHOPS-MATE-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=27 dtm=27 dtmReported=27 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=25 dtmReported=25 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE-W2 | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=27 dtmReported=27 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE-W3 | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=25 dtmReported=25 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE-D1 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE-D2 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PAWN-SQUARE-D3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-OPPOSITION | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=37 dtmReported=37 source=lichess-syzygy |
| TE-CANON-OPPOSITION-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=7 dtm=39 dtmReported=39 source=lichess-syzygy |
| TE-CANON-OPPOSITION-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=29 dtmReported=29 source=lichess-syzygy |
| TE-CANON-KPK | white | WIN | verified | syzygy-7 exact | category=win dtz=9 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-KPK-2 | black | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=39 dtmReported=39 source=lichess-syzygy |
| TE-CANON-KPK-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=7 dtm=31 dtmReported=31 source=lichess-syzygy |
| TE-CANON-KEY-SQUARES-1 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=33 dtmReported=33 source=lichess-syzygy |
| TE-CANON-KEY-SQUARES-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-KEY-SQUARES-3 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=31 dtmReported=31 source=lichess-syzygy |
| TE-CANON-ROOK-PAWN-WIN | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=17 dtmReported=17 source=lichess-syzygy |
| TE-CANON-ROOK-PAWN-DEF-H | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-ROOK-PAWN-DEF-A | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PAWN-RACE | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=31 dtmReported=31 source=lichess-syzygy |
| TE-CANON-PAWN-RACE-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=7 dtm=51 dtmReported=51 source=lichess-syzygy |
| TE-CANON-PAWN-RACE-3 | black | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=25 dtmReported=25 source=lichess-syzygy |
| TE-CANON-OUTSIDE-1 | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-OUTSIDE-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-OUTSIDE-3 | white | WIN | verified | syzygy-7 exact | category=win dtz=1 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-TRIANGULATION-1 | white | WIN | verified | syzygy-7 exact | category=win dtz=11 dtm=33 dtmReported=33 source=lichess-syzygy |
| TE-CANON-TRIANGULATION-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=37 dtmReported=37 source=lichess-syzygy |
| TE-CANON-TRIANGULATION-3 | white | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-BAD-BISHOP-1 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-BAD-BISHOP-2 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-BAD-BISHOP-3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-QUEEN-PAWN-1 | black | WIN | verified | syzygy-7 exact | category=win dtz=15 dtm=23 dtmReported=23 source=lichess-syzygy |
| TE-CANON-QUEEN-PAWN-2 | black | WIN | verified | syzygy-7 exact | category=win dtz=44 dtm=47 dtmReported=47 source=lichess-syzygy |
| TE-CANON-QUEEN-PAWN-3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-LUCENA | white | WIN | verified | syzygy-7 exact | category=win dtz=15 dtm=41 dtmReported=41 source=lichess-syzygy |
| TE-CANON-LUCENA-2 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=15 dtmReported=15 source=lichess-syzygy |
| TE-CANON-LUCENA-3 | white | WIN | verified | syzygy-7 exact | category=win dtz=5 dtm=17 dtmReported=17 source=lichess-syzygy |
| TE-CANON-PHILIDOR | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PHILIDOR-2 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PHILIDOR-3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-LATERAL-1 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-LATERAL-2 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-LATERAL-3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-VANCURA-1 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-VANCURA-2 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-VANCURA-3 | black | DRAW | verified | syzygy-7 exact | category=draw dtz=0 dtm=null dtmReported=0 source=lichess-syzygy |
| TE-CANON-PAWN-BREAKTHROUGH | white | WIN | verified | stockfish-18-lite depth 16 (not exact) | category=win dtz=null dtm=null dtmReported=null source=stockfish-18-lite best=b5b6 cp=640 depth=16 |
| TE-CANON-PAWN-BREAKTHROUGH-2 | white | WIN | verified | stockfish-18-lite depth 16 (not exact) | category=win dtz=null dtm=null dtmReported=null source=stockfish-18-lite best=b4a5 cp=587 depth=16 |
| TE-CANON-PAWN-BREAKTHROUGH-3 | white | WIN | verified | stockfish-18-lite depth 16 (not exact) | category=win dtz=null dtm=null dtmReported=null source=stockfish-18-lite best=d4e5 cp=735 depth=16 |

## Justification pédagogique

- **TE-CANON-QUEEN-MATE** — Roi noir au centre, dame en h1 : le réseau se construit sans échec initial.
- **TE-CANON-QUEEN-MATE-2** — Roi déjà au bord, dame loin : il faut rapprocher sans pater.
- **TE-CANON-QUEEN-MATE-3** — Les Noirs ont la dame, roi blanc en f1 : autre géométrie, pas un simple retournement.
- **TE-CANON-ROOK-MATE** — Tour en h1, rois au centre : la méthode du couloir entier.
- **TE-CANON-ROOK-MATE-2** — Roi noir déjà en h8, tour en a1 : il reste à coordonner le roi.
- **TE-CANON-ROOK-MATE-3** — Les Noirs ont la tour en a2, roi blanc en d1.
- **TE-CANON-TWO-BISHOPS-MATE** — Fous en c1 et f1, couleurs opposées, roi noir au centre.
- **TE-CANON-TWO-BISHOPS-MATE-2** — Fous en b1 et d2, rois sur la colonne b : autre cage.
- **TE-CANON-TWO-BISHOPS-MATE-3** — Les Noirs ont les fous en a7 et b1, roi blanc en d2.
- **TE-CANON-PAWN-SQUARE** — Pion b4, roi noir en g6, roi blanc en h1 trop loin pour escorter. Seul b5 gagne : les coups de roi laissent entrer le roi.
- **TE-CANON-PAWN-SQUARE-W2** — Pion a2 : seul le double pas a4 gagne. a3 laisse le roi de g5 entrer dans le carré.
- **TE-CANON-PAWN-SQUARE-W3** — Pion c4, roi en h6 juste hors du carré. Seul c5 gagne.
- **TE-CANON-PAWN-SQUARE-D1** — Même aile mais le trait est aux Noirs : le roi de h8 peut entrer. Un mauvais pas laisse le pion filer. Pas une capture immédiate.
- **TE-CANON-PAWN-SQUARE-D2** — Pion d2 et son double pas : le roi de b6 doit choisir le chemin du carré. Le roi blanc en h1 n’escorte pas.
- **TE-CANON-PAWN-SQUARE-D3** — Pion g4, roi en b7, roi blanc en a1. Autre aile, trajet réel, pas une symétrie des précédents.
- **TE-CANON-OPPOSITION** — Rois en e4 et e6, pion e2, trait aux Blancs : il faut reprendre l’opposition. L’ancienne position laissait le trait aux Noirs.
- **TE-CANON-OPPOSITION-2** — Rois en décalage e3/f5 : l’opposition se prend par le côté, pas par un face-à-face déjà fait.
- **TE-CANON-OPPOSITION-3** — Les Noirs ont le pion c6, rois en c4 et c2. Le pion est déjà avancé : autre décision que le pion en 2e.
- **TE-CANON-KPK** — Roi en d3 devant le pion e2, roi noir en e5 : un seul coup garde le gain.
- **TE-CANON-KPK-2** — Les Noirs ont le pion e7, roi d6 contre roi d3. L’épaule se joue par Ke5 ou Kd5.
- **TE-CANON-KPK-3** — Pion c5, rois c6 et f3 : le roi noir doit écarter le roi blanc, pas seulement pousser.
- **TE-CANON-KEY-SQUARES-1** — Pion e3 : la case clé d5. Seul Kd5 gagne. Ce n’est pas un face-à-face déjà installé.
- **TE-CANON-KEY-SQUARES-2** — Pion e2 : les cases clés sont en 4e. Seul Kd4 les occupe utilement.
- **TE-CANON-KEY-SQUARES-3** — Roi noir en d7, pion e3 : plusieurs accès aux cases clés, les coups de pion nuls.
- **TE-CANON-ROOK-PAWN-WIN** — Pion a6, roi en b6 qui ferme le coin. Seul a7 gagne : les coups de roi nullent.
- **TE-CANON-ROOK-PAWN-DEF-H** — Pion h7. Seul Kh8 nulle. Kf8 perd. Le coin h est la particularité du pion de tour.
- **TE-CANON-ROOK-PAWN-DEF-A** — Pion a5, roi en a8. Seul Kb8 reste dans la zone du coin. Ce n’est pas un gain à forcer.
- **TE-CANON-PAWN-RACE** — Pions b5 et g2, rois a7 et e1. Un seul coup gagne la course.
- **TE-CANON-PAWN-RACE-2** — Pions a5 et b2, rois g5 et c1. La course est longue : le calcul va jusqu’à la dame.
- **TE-CANON-PAWN-RACE-3** — Les Noirs au trait, pions f5 et a2. Un seul coup gagne, d’autres perdent la course.
- **TE-CANON-OUTSIDE-1** — Pion a5 éloigné contre b2 et g3. b4 perd le gain : il faut traiter le passé sans le pousser dans le roi.
- **TE-CANON-OUTSIDE-2** — Même structure, roi noir en c6 : b4 nulle. Le roi est plus près du pion éloigné, le détour change.
- **TE-CANON-OUTSIDE-3** — Pion a2 passé et f3, pion noir b5. a4 perd, f4 nulle : l’aile utile n’est pas le coup le plus bruyant.
- **TE-CANON-TRIANGULATION-1** — Pions e5-g5 contre e6-g6, roi loin en g7. Kd4, Kd3 ou Ke3 gagnent ; Kf3 et Kf4 nullent. Le détour de roi rend le trait.
- **TE-CANON-TRIANGULATION-2** — Rois d2 et d5, pions b3-d4 contre b4. Seuls Kd3 et Ke3 gagnent : le pas direct ailleurs cède le zugzwang.
- **TE-CANON-TRIANGULATION-3** — Même idée de pions doublés, mais le roi noir est en e7 : aux Blancs de tenir la nulle. Kd3 et Kd4 perdent.
- **TE-CANON-BAD-BISHOP-1** — Fou c2 cases claires, pion h5, coin h8 noir. Seul Kg8 mène au coin. Ke7 et Ke8 perdent.
- **TE-CANON-BAD-BISHOP-2** — Fou c1 cases noires, pion a6, coin a8 clair. Seuls Ka7 et Ka8 nullent.
- **TE-CANON-BAD-BISHOP-3** — Fou f1 cases claires, pion h5, roi déjà en g8. Kh8 est le coin ; toutes les cases voisines nullent encore.
- **TE-CANON-QUEEN-PAWN-1** — Pion c7, dame a1. Seul Da8 se place devant. Les autres essais nullent ou perdent.
- **TE-CANON-QUEEN-PAWN-2** — Pion central d7, dame e1, roi en h1. Gain long : plusieurs méthodes, beaucoup de nulles si la dame se trompe de colonne.
- **TE-CANON-QUEEN-PAWN-3** — Pion f7 et roi f6 : exception. La dame au trait ne force pas le gain. Un coup perd.
- **TE-CANON-LUCENA** — Pion b7, roi b8, tour c1 contre tour a2 et roi d8. Pont classique.
- **TE-CANON-LUCENA-2** — Pion e7, roi e8, roi noir en h8, tour noire en a2. Autre colonne, roi adverse dans le coin.
- **TE-CANON-LUCENA-3** — Pion d7, rois d8 et f8, tour noire en g2. Le pont se construit sur une autre aile.
- **TE-CANON-PHILIDOR** — Tour b6, pion e5, rois e8 et f5. Le trait est aux Noirs, qui tiennent la 6e. Huit coups perdent.
- **TE-CANON-PHILIDOR-2** — Pion c5, tour a6, roi c8 devant le pion. La barrière est sur la 6e, colonne c.
- **TE-CANON-PHILIDOR-3** — Le roi n’est pas encore devant : seul Re7 nulle. La tour en d6 ne suffit pas si le roi reste en f6.
- **TE-CANON-LATERAL-1** — Pion e4, roi e3, tour a2. Ra3+ et Ra4 tiennent ; Re2+ est trop proche et perd.
- **TE-CANON-LATERAL-2** — Pion c6 déjà avancé, tour h4. Les échecs longs sur la 4e tiennent ; Rb4+ est trop court.
- **TE-CANON-LATERAL-3** — Pion g6, roi f5, tour a4. Ra4+ tient à distance ; Re4 perd.
- **TE-CANON-VANCURA-1** — Pion a5, tour c6. Seuls Rc5 (attaque latérale), Rf4 et Rg4 nullent. La prise du pion n’est pas immédiate.
- **TE-CANON-VANCURA-2** — Pion a4, tour déjà en c5 sur la rangée du pion. Rester sur la 5e nulle ; Rg5 et Rc1+ perdent.
- **TE-CANON-VANCURA-3** — Pion a5, tour d5. La rangée du pion tient ; descendre en d4, d3, d6 ou d7 perd.
- **TE-CANON-PAWN-BREAKTHROUGH** — Percée classique a5-b5-c5 contre a7-b7-c7. Stockfish 18 Lite profondeur 16 : b6, +6,40, dame dans la variante. Ke2 est 0,00. Ce n’est pas une table de finales à 7 pièces.
- **TE-CANON-PAWN-BREAKTHROUGH-2** — Pions déjà au contact, roi noir en e8. Seule la prise bxa5 perce. À la profondeur 16 le score est d’environ +5,87, pas une table.
- **TE-CANON-PAWN-BREAKTHROUGH-3** — Percée centrale d4-e4-f4 contre d5-e5-f5, roi noir en h1. Profondeur 16 : environ +7,35. Autre secteur que l’aile dame.
