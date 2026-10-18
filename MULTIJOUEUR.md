# Multijoueur local — jusqu’à cinq personnes

Utiliser **Dernière Vague 1.4.0 sur tous les PC**. L’hôte et quatre invités partagent le même bateau, les trois marins, les objets, les réserves et la progression de la journée. Chaque joueur peut choisir un marin et lui donner un ordre ; le moteur de l’hôte empêche deux ordres simultanés sur un marin déjà occupé. La pause, la journée suivante et les modifications Pokéball sont pilotées par l’hôte.

## Héberger et rejoindre

1. Tous les PC sont connectés au même réseau Wi-Fi privé ou au même routeur Ethernet.
2. L’hôte lance le jeu, puis **Multijoueur → Héberger → Créer la partie**.
3. Il clique sur **Copier le code d’invitation** et l’envoie aux autres joueurs.
4. Chaque invité ouvre **Multijoueur → Rejoindre**, choisit son pseudo et colle le code complet `VAGUE1-…`.
5. Les invités chargent automatiquement les fichiers du jeu de l’hôte. La liste indique les joueurs connectés et la limite de cinq, hôte compris.

Le menu **Jeu → Multijoueur…** et **F9** ouvrent aussi le salon. L’hôte doit laisser l’application ouverte. Le code contient les adresses IPv4 locales et le port du salon ; l’application essaie ces adresses automatiquement. Le port par défaut est UDP 16383 ; il est modifiable avant la création de la partie. Les échanges sont authentifiés et chiffrés par AES-256-GCM avec le secret aléatoire contenu dans l’invitation : partagez ce code uniquement avec les participants.

Cette version vise le réseau local. Elle ne fournit ni serveur de rendez-vous Internet, ni relais, ni ouverture automatique de ports de routeur.

## Si la connexion échoue

- Vérifier que tous utilisent la même version du jeu et le code complet de la partie en cours.
- Vérifier le même réseau privé : les Wi-Fi invités peuvent isoler les appareils entre eux.
- Si le pare-feu Windows demande une autorisation, autoriser l’application sur le réseau privé. Ne pas désactiver globalement le pare-feu.
- L’hôte ne doit pas fermer l’application. Après un changement de réseau, quitter le salon puis en créer un nouveau pour obtenir les nouvelles adresses.
- Si le port est occupé, en choisir un autre dans l’écran Héberger et partager le nouveau code.
- Une sixième personne reçoit une erreur « partie complète ». Une version différente reçoit un message de mise à jour.

Une coupure UDP déclenche une reconnexion automatique avec le même identifiant. Cette reprise dépend du réseau et de la disponibilité de l’hôte ; après plusieurs échecs, quitter puis rejoindre le salon avec son code. La fermeture complète du processus hôte termine la partie réseau.

## Pokéball synchronisée

Seul l’hôte valide les scripts, annule une modification ou revient à l’origine. Les invités peuvent ouvrir l’atelier, mais ne peuvent pas appliquer une version différente à la partie.

Les fichiers complets `index.html`, `style.css` et `game.js` sont préparés et vérifiés chez tous les participants avant activation. Les écrans sont ensuite rechargés ensemble. Les sockets UDP, le code d’invitation et les identifiants restent dans les processus principaux Electron, qui ne redémarrent pas.

La partie est figée pendant l’opération. L’état partagé, les réserves, les tâches en cours et leur progression sont conservés. Le jeu attend le signal de chargement de chaque écran avant de reprendre la synchronisation ; l’hôte peut ensuite reprendre la partie si elle est en pause.

Si une vérification échoue, la nouvelle version n’est pas partagée. Si un écran ne redémarre pas dans le délai prévu, le moteur rétablit la version précédente chez tous les participants. L’atelier protégé et F8 restent accessibles.

Les fichiers reçus par les invités servent à la partie en cours et ne remplacent pas leurs modifications solo sur disque. Quitter le salon recharge leur version locale. L’hôte conserve ses modifications dans son profil habituel. La partie solo des invités utilise une sauvegarde distincte de leur copie de l’état coopératif.

## Le fichier texte prêt à copier

`patches/MULTIJOUEUR-5-JOUEURS-POKEBALL.txt` est un script JSON complet à copier dans la Pokéball. Il remplace les trois fichiers de l’interface et du jeu par ceux de la version multijoueur. Cela remplace aussi leurs éventuelles modifications précédentes ; l’atelier conserve le retour à la version précédente.

**Le moteur Windows 1.4.0 doit d’abord être installé via le nouveau ZIP.** L’ancienne Pokéball 1.2.0 ne peut pas ajouter un service réseau au processus principal. Le script texte ne peut donc pas, à lui seul, transformer l’ancien `.exe` en moteur multijoueur. Le nouveau ZIP inclut déjà la fonctionnalité ; le script est fourni pour le flux de modification demandé.

`node scripts/generate-multiplayer-patch.cjs` régénère le texte depuis les sources. Copier uniquement son contenu JSON dans l’atelier, puis cliquer sur **Valider et redémarrer le jeu**.

## Vérifications effectuées

```sh
node --test tests/room.test.cjs tests/patch-store.test.cjs
node tests/multiplayer.cjs
node tests/notebook.cjs
node tests/desktop.cjs
```

Les tests de réseau utilisent de vrais sockets locaux : cinq places, refus d’un sixième, synchronisation de l’état, commandes clientes, mises à jour, annulation, retour automatique à la version précédente et reconnexion réelle. Le test d’intégration lance **cinq applications Electron** avec des profils indépendants, fait agir un invité, applique une modification HTML/JavaScript, vérifie les cinq écrans et les identifiants, puis termine un travail commencé avant le rechargement. Le compteur de connexions de l’hôte reste à quatre lors de cette mise à jour.

Ces essais sont réalisés sur la machine Linux de développement. La compilation du programme est réalisée sur Windows par GitHub Actions. Un essai entre vos PC Windows reste nécessaire pour vérifier les autorisations du pare-feu et l’isolation éventuelle de votre réseau Wi-Fi.

## Fichiers accessibles dans le ZIP 1.4.0

Extrayez tout le ZIP et lancez **Dernière Vague.exe**. Gardez les DLL et les dossiers fournis avec lui. Les sources sont dans **resources/app** : `index.html`, `style.css`, `game.js`, ainsi que `desktop/room.cjs` et `desktop/udp-stream.cjs` pour le réseau. Fermez l’application avant une modification manuelle puis relancez-la. Une modification du moteur réseau demande une relance complète et une nouvelle connexion des joueurs. Distribuez le même moteur à tous les PC.

Le fichier portable `Derniere-Vague-1.4.0-Windows-x64.exe`, disponible séparément sur la page de téléchargement, reste autonome ; le ZIP utilise **Dernière Vague.exe** pour charger les fichiers accessibles du dossier. Les modifications persistantes de la Pokéball restent prioritaires sur les trois sources du jeu : sauvegardez-les puis utilisez F8 pour restaurer les fichiers du dossier si nécessaire. Les scripts Pokéball ne modifient pas le moteur réseau. Le fichier texte multijoueur fourni réinstalle les trois fichiers du jeu et exige le nouveau moteur ; il ne convertit pas un ancien exécutable TCP.

Les invitations UDP ne sont pas compatibles avec les anciens salons TCP. Créez un nouveau salon, puis partagez son nouveau code. UDP utilise des accusés de réception, retransmissions, remise en ordre et suppression des doublons pour préserver les commandes et les modifications de fichiers. Les datagrammes restent inférieurs à 1 100 octets et sont authentifiés ; les messages restent chiffrés. `Test-NetConnection -Port` teste TCP et ne permet pas de tester ce salon UDP.

## Capitaine et inspecteur : script compatible avec le moteur 1.4.0

L’hôte peut coller `patches/CAPITAINE-INSPECTEUR-POKEBALL.txt` dans sa Pokéball puis valider. Les deux personnages et leurs objets sont ajoutés chez tous, sans changer la connexion UDP. Le capitaine consomme une carte pour réduire les dégâts de moitié pendant 18 secondes ; l’inspecteur consomme un outil pour ajouter 8 points de coque et 12 de santé. Chaque invité peut les sélectionner, ramasser leurs objets et lancer leurs actions. Le nombre maximal de joueurs reste cinq. Le script remplace les trois fichiers du jeu ; la version précédente reste accessible dans l’atelier. Les anciens ZIP 1.4.0 nécessitent ce script pour bénéficier de ces deux personnages.
