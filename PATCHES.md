# Scripts pour la Pokéball

À partir de **Dernière Vague 1.2.0**, l’atelier Windows applique des modifications persistantes aux fichiers du jeu. Le joueur copie le script fourni dans la Pokéball et clique sur **Valider et redémarrer le jeu**. Les fichiers modifiés sont enregistrés sur disque, puis la page de jeu est rechargée avec ces fichiers. La partie reste sauvegardée sur le même profil.

Le format est un document JSON, pas une commande PowerShell, un programme Node.js ou du JavaScript à exécuter directement. Fournir un script complet prêt à copier, comme ci-dessous, lorsque le joueur demande une modification.

```json
{
  "format": "derniere-vague-patch-v1",
  "title": "Un cap couleur cuivre",
  "changes": [
    {
      "file": "style.css",
      "append": "\nh1 { color: #f1ae65; }\n"
    }
  ]
}
```

L’exemple est aussi disponible dans `patches/exemple-couleur.json` et via **Essayer un exemple** dans l’atelier. Le titre principal devient cuivré après validation et redémarrage.

## Trois opérations disponibles

Chaque objet de `changes` cible exactement `index.html`, `style.css` ou `game.js`. Une opération est l’une des formes suivantes :

- `{"file":"index.html","find":"Gardez le cap.","replace":"Tous à bord !"}` remplace un passage exact qui doit apparaître une seule fois. Les expressions régulières et les remplacements approximatifs ne sont pas utilisés.
- `{"file":"style.css","append":"\n/* nouveau style */\n"}` ajoute du texte à la fin du fichier.
- `{"file":"game.js","content":"... contenu complet du fichier ..."}` remplace tout le fichier. Préserver les fonctionnalités et points d’entrée existants lorsque l’objectif est une modification partielle.

Les chaînes JSON contiennent les retours à la ligne sous forme `\n`. Les blocs Markdown entourés de trois accents graves et du langage `json` sont également acceptés au collage. Un script déjà appliqué dans la version courante ne peut pas être appliqué une deuxième fois.

Toutes les opérations sont préparées ensemble. Si un passage est absent ou ambigu, si le JavaScript final contient une erreur de syntaxe, ou si l’écriture échoue, aucune nouvelle version n’est activée. Le contrôle syntaxique n’exécute pas le code et ne garantit pas l’absence de défauts pendant le jeu.

Limites : 80 opérations par script, 2 Mo de JSON, 1 Mo par fichier modifié, brouillon de 500 000 caractères. Pour les remplacements, examiner les sources et les modifications déjà appliquées afin de fournir un passage `find` unique et présent dans la version du joueur.

## Conservation et récupération

Les originaux restent intégrés dans l’application. Les versions modifiées sont de vrais fichiers dans le dossier `modifications` du profil utilisateur Electron : `versions/<identifiant>/index.html`, `style.css`, `game.js` et `metadata.json`. `state.json` sélectionne la version active, remplacée atomiquement après écriture complète. `draft.txt` conserve le brouillon indépendamment des fichiers actifs.

- **Version précédente** revient à la version précédant la dernière validation ; on peut rétablir l’autre version avec le même bouton.
- **Revenir à la version d’origine** recharge les fichiers intégrés à l’application sans effacer la partie sauvegardée ni le brouillon.
- **F8** ou **Jeu → Atelier Pokéball…** ouvre un atelier indépendant des fichiers modifiables, même si un script a supprimé le bouton Pokéball du jeu.

Les modifications sont locales au profil utilisateur : elles ne modifient pas le dépôt GitHub, l’exécutable partagé, les originaux intégrés, ni les autres PC. Elles restent actives après fermeture de l’application. Après une mise à jour du jeu, revenir à l’origine pour utiliser les nouveaux fichiers intégrés si des modifications locales les remplacent encore.

L’atelier et son accès aux fichiers sont dans `desktop/` et ne font pas partie des fichiers modifiables. Les contenus du jeu restent dans un rendu sans Node.js, avec isolation des contextes, sandbox et politique CSP. Seule la fenêtre d’atelier protégée peut appliquer les scripts ; la fenêtre du jeu peut demander son ouverture.

Dans la version navigateur, la Pokéball conserve uniquement un brouillon. Pour appliquer les scripts aux fichiers persistants, utiliser l’application Windows.

## Vérifications

```sh
node --test tests/patch-store.test.cjs
node tests/notebook.cjs
node tests/desktop.cjs
```

Les tests couvrent les écritures réelles, les échecs sans application partielle, la persistance entre lancements, le redémarrage, la conservation de la partie, l’accès IPC, la restauration et l’ouverture avec F8 depuis une page sans bouton Pokéball. Les tests Electron demandent Playwright disponible dans l’environnement.

## Parties multijoueurs (Windows 1.3.0)

L’hôte applique les scripts à tous les écrans de sa partie. Les invités ne peuvent pas valider de patch dans le salon. Pour rester compatible avec ce mode, conserver l’intégration `vague-network-v1` dans game.js et le bouton `id="network"` dans index.html ; le moteur refuse un bundle sans ces points d’entrée. Préserver aussi les appels de synchronisation et de signalement du chargement lors d’un remplacement complet de game.js. Une modification qui empêche les écrans de signaler leur chargement est annulée automatiquement.

Le moteur de connexion et l’atelier protégés ne font pas partie des fichiers modifiables. Voir [MULTIJOUEUR.md](MULTIJOUEUR.md) pour les limites, la conservation des connexions et le script texte de mise à jour.
