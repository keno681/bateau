# bateau — Dernière Vague

Un jeu de survie en mer, en français, avec un mode multijoueur à saboteur secret. Cinq personnages originaux, animés, travaillent sur un bateau vu en coupe : un mécano, une cuisinière, un pêcheur, un capitaine et un inspecteur.

## Jouer en local

Depuis `/workspace/bateau` :

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Ouvrir le jeu via un navigateur connecté à ce serveur. Aucun paquet à installer, aucun secret et aucun service externe. Les fichiers peuvent aussi s’ouvrir directement avec `index.html` ; la disponibilité de la sauvegarde locale dépend alors du navigateur.

## Règles

- Sélectionner un marin dans sa carte ou sur le bateau, puis cliquer sur les objets de son métier. La récupération prend quelques secondes.
- **Gaston, mécano** : 2 pièces → +26 points de coque.
- **Suzanne, cuisinière** : 2 provisions ou 1 poisson → +30 points de repas et +8 points de santé. Un poisson disponible est utilisé en priorité.
- **Marin, pêcheur** : 1 appât → 2 poissons pour la cuisine.
- **Émile, capitaine** : 1 carte marine → dégâts de tempête réduits de moitié pendant 18 secondes.
- **Victor, inspecteur** : 1 outil de contrôle → +8 points de coque et +12 points de santé.
- Les commandes de travail sont sur les cartes des marins. Chaque marin peut accomplir une seule tâche à la fois ; les cinq peuvent travailler simultanément.
- Une journée dure 140 secondes et va de 06:00 à 18:00. Le bateau subit des dégâts continus et les repas diminuent. Sous 15 points de repas, la santé commence à baisser.
- Survivre jusqu’au soir permet de passer à la journée suivante. Les cinq objectifs sont des repères, pas une obligation de victoire. La tempête s’intensifie progressivement.
- Chaque marin reçoit une humeur aléatoire chaque jour : motivé (+30 % de vitesse), serein (normale), fatigué (−25 %) ou grincheux (−15 %).
- Pause via le bouton supérieur ou Espace. Touches 1/2/3/4/5 : sélectionner un marin (hors bouton ou dialogue actif). Passer à un autre onglet met automatiquement en pause.
- Sauvegarde locale automatique toutes les deux secondes et après les actions importantes. Une partie chargée est en pause. Les tâches en cours et leur progression sont conservées et reprennent après la pause. Une nouvelle traversée demande confirmation.

## Technique

HTML/CSS/JavaScript natifs ; personnages SVG et décor CSS originaux, sans ressources empruntées à Fallout Shelter. Compatible avec les navigateurs modernes et les petits écrans. Les animations décoratives respectent la préférence de réduction des mouvements. Il s’agit d’un prototype 2D, sans son, multijoueur ou graphismes 3D.

Vérification syntaxique : `node --check game.js`. Servir les fichiers puis tester la collecte, la cuisine, la pêche, la réparation, la pause et le chargement de sauvegarde dans un navigateur.

## Tests navigateur

Dans cet environnement, Chromium et Playwright sont déjà disponibles. Avec le serveur démarré :

```sh
node tests/smoke.cjs
```

Le test utilise une horloge accélérée et la préférence de réduction des mouvements pour cliquer sur les éléments sans attendre leur stabilité visuelle. Il exerce les métiers, les ressources, les objectifs, une journée complète, la reprise des tâches sauvegardées, les deux conditions de défaite et l’affichage mobile. Les captures sont écrites dans `/tmp`. `GAME_URL` permet de choisir un autre serveur. En dehors de cet environnement, ces outils de test doivent être disponibles séparément ; le jeu lui-même n’en dépend pas.

## Exécutable Windows

Les versions publiées sont disponibles dans [les Releases GitHub](https://github.com/keno681/bateau/releases). Le workflow `.github/workflows/windows-release.yml` compile et publie un exécutable portable lorsqu’un tag `v*` est envoyé. Il utilise uniquement le jeton automatique du dépôt avec la permission `contents: write`, sans secret supplémentaire.

La version portable est produite dans `dist/Derniere-Vague-1.5.0-Windows-x64.exe`. Elle contient le jeu et son moteur : aucun autre fichier, navigateur, Python ou connexion Internet n’est nécessaire pour jouer. Copier l’exécutable sur un PC Windows 10/11 en 64 bits puis le lancer par double-clic. F11 active/désactive le plein écran ; Échap quitte le plein écran.

Le fichier n’est pas signé avec un certificat d’éditeur. Les sauvegardes restent dans le profil local de l’utilisateur Windows et ne sont pas partagées avec la version navigateur ni entre différents PC. La compilation et l’archive ont été contrôlées sous Linux ; le lancement de l’exécutable sur Windows reste à vérifier.

### Refaire le fichier .exe

Node.js 22.12 ou plus récent est nécessaire uniquement pour développer ou compiler. Les versions des dépendances sont verrouillées dans `package-lock.json`.

Sur Windows, depuis le dossier du projet :

```sh
npm ci
npm run build:windows
```

Pour démarrer l’application de bureau en développement :

```sh
npm run install:electron
npm start
```

Dans cet environnement Linux, utiliser les caches autorisés et le proxy fourni :

```sh
npm --cache /workspace/.cache/npm ci --no-audit --no-fund
ELECTRON_GET_USE_PROXY=1 electron_config_cache=/workspace/.cache/electron-linux npm run install:electron
XDG_CACHE_HOME=/workspace/.cache ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder npm run build:windows
```

Les vérifications TLS et les sommes de contrôle des téléchargements restent activées. La cible portable peut être compilée sous Linux sans Wine, car l’édition du binaire interne et la signature sont désactivées. L’exécutable portable porte l’icône du jeu ; l’exécutable interne peut conserver l’icône Electron.

Avec Playwright disponible, `node tests/desktop.cjs` teste le chargement dans Electron, la pêche, la sauvegarde et l’isolation du rendu. Sous Linux, le test utilise le mode headless et un profil temporaire. Ces tests ne constituent pas un lancement du binaire Windows.

## Pokéball : modifier les fichiers du jeu

Dans l’application Windows, la Pokéball ouvre un atelier où coller les scripts de modification fournis. Le bouton **Valider et redémarrer le jeu** vérifie le script, enregistre de vrais fichiers HTML/CSS/JavaScript modifiés et recharge le jeu. Les changements restent présents au prochain lancement et la partie est conservée.

**Essayer un exemple** permet de tester un changement de couleur. Les boutons **Version précédente** et **Revenir à la version d’origine** restaurent les fichiers précédents ou intégrés. F8 et le menu **Jeu → Atelier Pokéball…** restent disponibles même si une modification a supprimé le bouton du jeu.

Les modifications sont enregistrées dans le profil local de l’utilisateur et ne changent pas les fichiers intégrés au `.exe` ni ceux de GitHub. Dans le navigateur, le carnet reste un brouillon. Voir [le format des scripts et les détails de récupération](PATCHES.md).

Tests du moteur : `node --test tests/patch-store.test.cjs`. Test de l’atelier Electron : `node tests/notebook.cjs`. Les Releases contiennent le `.exe`, le ZIP Windows, les instructions et un exemple de script.

## Multijoueur local — 5 personnes

La version Windows 1.4.0 propose **Multijoueur → Héberger / Rejoindre** avec un code d’invitation à copier. L’hôte et quatre invités partagent le bateau et les trois marins. Les modifications Pokéball de l’hôte sont chargées chez tous les joueurs, avec rechargement des écrans et conservation des sockets, des identifiants et de la progression.

Voir [les instructions de connexion et de dépannage](MULTIJOUEUR.md). Le [script texte prêt à copier](patches/MULTIJOUEUR-5-JOUEURS-POKEBALL.txt) est inclus dans le ZIP. Il exige le nouveau moteur Windows 1.4.0 et remplace les trois fichiers du jeu. Le ZIP possède déjà le mode multijoueur. Cette version cible le même réseau local, sans relais Internet.

### ZIP avec sources modifiables (1.4.0)

Le ZIP Windows contient **Dernière Vague.exe** et ses fichiers associés. Extrayez tout, gardez le dossier complet, puis lancez cet exécutable pour utiliser les sources modifiables dans **resources/app**. Le HTML, le CSS, le JavaScript du jeu et les fichiers `desktop` du moteur sont accessibles. Fermez le jeu avant une modification manuelle puis relancez-le. Les modifications du moteur réseau demandent une nouvelle connexion des joueurs ; les rechargements Pokéball conservent les connexions. Le portable autonome reste également disponible.

Le réseau utilise **UDP 16383** à partir de 1.4.0. Les codes d’invitation TCP précédents sont incompatibles. Installez le même moteur sur tous les PC et créez un nouveau salon. La Pokéball ne remplace pas le moteur de l’exécutable.

### Ajouter le capitaine et l’inspecteur à la version 1.4.0

Copiez tout [CAPITAINE-INSPECTEUR-POKEBALL.txt](patches/CAPITAINE-INSPECTEUR-POKEBALL.txt) dans la Pokéball de l’hôte puis cliquez sur **Valider et redémarrer le jeu**. Le script remplace `index.html`, `style.css` et `game.js` ; gardez une copie de vos adaptations précédentes. En partie multijoueur, il est partagé automatiquement avec les invités. Aucun nouveau moteur, port ou réglage réseau n’est requis. Les sauvegardes à trois marins sont converties à cinq sans perdre la journée, les stocks précédents ou les tâches en cours. Les cartes et outils reçoivent un stock initial de deux chacun. Les anciennes versions sans cette mise à jour restent à trois marins.

### Bateau en 3D et huit salles

Le [texte Pokéball BATEAU-3D-8-SALLES-POKEBALL.txt](patches/BATEAU-3D-8-SALLES-POKEBALL.txt) ajoute une vue WebGL avec personnages en volume, mer animée, rotation et zoom. Aux trois salles existantes s’ajoutent la passerelle, la salle radio, l’infirmerie, le dortoir et l’atelier : huit salles meublées au total. Sélectionnez un marin puis une salle pour l’y déplacer ; les ordres de travail le ramènent à son poste. Les destinations sont sauvegardées et synchronisées avec les invités. Les nouvelles salles offrent des lieux de déplacement ; les actions de métier restent celles des cinq personnages.

Dans la vue, glissez pour tourner la caméra ou utilisez les flèches. La molette et les boutons +/− règlent le zoom ; Recentrer retrouve la caméra de départ. Les boutons des salles restent utilisables au clavier et sur écran tactile. La caméra est locale à chaque joueur. Une vue de secours permet de continuer la partie si WebGL est indisponible.

L’hôte colle tout le texte dans sa Pokéball puis valide ; tous les écrans se rechargent sans changer le moteur 1.4.0 ni la connexion UDP. Le script remplace les trois fichiers du jeu, y compris les deux nouveaux personnages si nécessaire. Il remplace les adaptations précédentes de ces fichiers ; gardez-en une copie. Les sauvegardes à trois ou cinq marins sont conservées. La limite reste cinq joueurs.

Pour modifier le rendu : éditez `scripts/boat3d.js`, puis lancez `node scripts/generate-3d-patch.cjs`. Le rendu est incorporé dans `game.js` pour rester compatible avec les trois fichiers autorisés dans la Pokéball. Aucun téléchargement de moteur, CDN ou accès Internet n’est nécessaire pour jouer. Le script capitaine/inspecteur précédent conserve son contenu d’origine ; le réappliquer remplace aussi la vue 3D par l’ancienne vue.

Validation 3D : `node tests/boat3d.cjs` (serveur local port 8010), et `PATCH_FILE=patches/BATEAU-3D-8-SALLES-POKEBALL.txt node tests/crew-patch.cjs` pour l’installation sur la vraie version 1.4.0 et les déplacements envoyés par un invité. Les tests WebGL utilisent un rendu logiciel dans l’environnement Linux ; l’affichage et les performances sur vos PC Windows restent à vérifier.

### Salon et saboteur secret (moteur 1.5.0)

Le nouveau [guide SABOTEUR.md](SABOTEUR.md) décrit le salon d’attente, les boutons Prêt, les rôles privés, les deux actions quotidiennes et les rêves qui annoncent le lendemain. Le nouveau moteur Windows 1.5.0 est nécessaire sur tous les PC. Le [texte SALON-SABOTEUR-POKEBALL.txt](patches/SALON-SABOTEUR-POKEBALL.txt) met ensuite les trois fichiers du jeu à jour si d’anciennes modifications Pokéball restent actives. Il inclut le bateau 3D et les cinq personnages.

Tests : `node --test tests/patch-store.test.cjs tests/room.test.cjs tests/udp-stream.test.cjs tests/match.test.cjs`, `node tests/saboteur.cjs` pour trois applications et les rechargements, et `node tests/boat3d.cjs` pour le rendu et le sommeil. L’hôte fixe la durée à 1, 3 ou 5 jours. Le jeu solo et le mode coopératif classique restent disponibles.
