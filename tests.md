A.1 IDs dans l'URL
#	Test	Commande	Attendu
A1	Profil, ID texte	get /users/abc	400 ou 404, pas 500 (R1)
A2	Autres IDs invalides	get /rooms/abc, get /users/abc/stats, get /users/abc/matches, get /game/abc/results, get /users/1.5, get /users/-1, get /users/99999999999999999999999	400 ou 404
A3	Actions avec ID invalide	post /rooms/abc/join, post /users/me/friends/abc, patch /game/abc/leave, post /rooms/abc/invite/abc	400 ou 404
A4	ID inexistant	get /users/999999999, get /rooms/999999999	404
