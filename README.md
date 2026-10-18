# bateau — Dernière Vague

Un prototype de jeu de survie en mer, en français. Trois personnages originaux, animés, travaillent sur un bateau vu en coupe : un mécano, une cuisinière et un pêcheur.

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
- Les commandes de travail sont sur les cartes des marins. Chaque marin peut accomplir une seule tâche à la fois ; les trois peuvent travailler simultanément.
- Une journée dure 140 secondes et va de 06:00 à 18:00. Le bateau subit des dégâts continus et les repas diminuent. Sous 15 points de repas, la santé commence à baisser.
- Survivre jusqu’au soir permet de passer à la journée suivante. Les trois objectifs sont des repères, pas une obligation de victoire. La tempête s’intensifie progressivement.
- Chaque marin reçoit une humeur aléatoire chaque jour : motivé (+30 % de vitesse), serein (normale), fatigué (−25 %) ou grincheux (−15 %).
- Pause via le bouton supérieur ou Espace. Touches 1/2/3 : sélectionner un marin (hors bouton ou dialogue actif). Passer à un autre onglet met automatiquement en pause.
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

La version portable est produite dans `dist/Derniere-Vague-1.4.0-Windows-x64.exe`. Elle contient le jeu et son moteur : aucun autre fichier, navigateur, Python ou connexion Internet n’est nécessaire pour jouer. Copier l’exécutable sur un PC Windows 10/11 en 64 bits puis le lancer par double-clic. F11 active/désactive le plein écran ; Échap quitte le plein écran.

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
