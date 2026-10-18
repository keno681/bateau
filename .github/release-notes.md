**Dernière Vague 1.3.0 — Multijoueur local, jusqu’à cinq personnes**

- **Héberger** une partie et partager un code d’invitation à copier.
- **Rejoindre** avec ce code, sur le même Wi-Fi privé ou réseau Ethernet.
- Partager le bateau, les marins, les objets et la journée avec l’hôte et quatre invités.
- Appliquer les scripts Pokéball de l’hôte chez tous les joueurs : les écrans redémarrent avec les mêmes connexions, identifiants et travaux en cours.
- Revenir à la version précédente si une modification ne démarre pas.

Téléchargez le **ZIP Windows 1.3.0**, extrayez-le puis lancez le `.exe`. Cette mise à jour du moteur est nécessaire : le script Pokéball seul ne peut pas ajouter le service réseau à l’ancien exécutable.

Le fichier **MULTIJOUEUR-5-JOUEURS-POKEBALL.txt** est aussi fourni séparément et dans le ZIP, prêt à copier. Il met les trois fichiers du jeu à jour et nécessite le moteur 1.3.0. Le nouveau ZIP contient déjà le mode multijoueur.

Si Windows le demande, autorisez le jeu dans le pare-feu pour le réseau privé. Le mode vise le réseau local, sans relais Internet. Seul l’hôte valide les modifications partagées. L’hôte doit laisser son application ouverte.

Les tests couvrent cinq applications Electron et de vrais sockets locaux sous Linux ; un essai sur vos PC Windows reste nécessaire pour leurs autorisations réseau. La compilation se fait sur Windows. Programme non signé, pour Windows 10/11 64 bits.
