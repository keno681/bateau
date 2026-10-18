# Salon, saboteur et rêves — version Windows 1.5.0

Installez le moteur **1.5.0 sur tous les PC**. Le bateau 3D, les huit salles et les cinq marins sont inclus. Le réseau reste **UDP 16383**.

Si vos anciens scripts Pokéball sont encore actifs, collez tout `SALON-SABOTEUR-POKEBALL.txt` dans la Pokéball de l’hôte, puis validez. F8 → Version d’origine rétablit également les nouveaux fichiers intégrés. Gardez une copie de vos adaptations : le texte remplace les trois fichiers du jeu. Ce texte seul ne peut pas ajouter les rôles privés au moteur 1.4.0.

## Avant le départ

1. L’hôte ouvre Multijoueur, laisse **Mode saboteur secret** coché et choisit 1, 3 ou 5 jours (3 par défaut).
2. Il crée le salon et partage le code. Les invités rejoignent avec leur pseudo. Il faut entre **2 et 5 joueurs**, hôte compris.
3. Chaque joueur clique sur **Prêt**. Le temps reste arrêté avant le lancement.
4. Quand tous sont prêts, l’hôte clique sur **Commencer la traversée**. Une nouvelle partie multijoueur commence ; la sauvegarde solo personnelle reste séparée.

Un joueur est choisi au hasard comme saboteur. Chaque écran affiche uniquement le rôle de son utilisateur. Tous les joueurs continuent de contrôler les cinq marins du bateau ; le rôle secret appartient à un joueur, et le sommeil touche un marin du jeu.

## La mission secrète

Le saboteur dispose de deux actions par journée :

- **Provoquer une avarie** : retire 15 points de coque, une seule fois par jour.
- **Endormir un marin** : choisit un des cinq personnages, une seule fois par jour. Le marin reste endormi jusqu’au lendemain et son travail en cours est interrompu. Une collecte interrompue libère son objet. Les matériaux d’une action déjà commencée restent consommés.

Ces actions sont disponibles pendant une traversée active, hors pause et hors synchronisation. Les boutons et les utilisations restantes n’apparaissent que chez le saboteur. Les journaux partagés montrent les conséquences, sans nommer l’auteur. Les actions sont une mission quotidienne : elles ne sont pas déclenchées automatiquement si le saboteur ne les utilise pas.

Les marins endormis ne peuvent ni travailler, ni ramasser des objets, ni recevoir un nouvel ordre de déplacement. Ils retrouvent leurs actions au début de la journée suivante. En 3D, ils apparaissent couchés avec une indication Zzz.

## Les rêves prémonitoires

Sélectionnez la carte du marin endormi pour lire son rêve. Il décrit un événement réellement programmé pour le lendemain :

- **Accalmie** : dégâts des vagues réduits de 30 %.
- **Bourrasque** : dégâts des vagues augmentés de 25 %.
- **Banc de poissons** : chaque pêche rapporte un poisson supplémentaire.

La prédiction est partagée à travers le rêve du marin et ne révèle pas le saboteur. L’événement est fixé dans le moteur et reste identique après un rechargement Pokéball ou une reconnexion. Au réveil, le rêve laisse place au bulletin du nouveau jour.

## Fin et reprise

L’équipage gagne en atteignant la fin du nombre de jours choisi. Le saboteur gagne si la coque ou la santé tombe à zéro avant cette échéance. Son identité est révélée uniquement à la fin. Depuis le salon, l’hôte peut lancer une nouvelle partie avec les mêmes connexions ; tous doivent de nouveau cliquer sur Prêt et les rôles sont tirés à nouveau.

Une traversée commencée refuse les nouveaux joueurs. Un participant déjà inscrit peut se reconnecter avec la même installation et le même profil ; la partie attend son retour. L’identifiant de joueur est conservé localement. Une fermeture complète de l’application hôte termine la session : les rôles secrets ne sont pas restaurés dans une nouvelle session.

Les rôles, les actions déjà utilisées, le sommeil et les prédictions restent dans le moteur pendant les rechargements Pokéball. Le mode coopératif classique reste disponible en décochant **Mode saboteur secret** avant la création du salon.

## Validation et limites

Tests : salons et rôles privés, refus des actions d’un équipier, une action de chaque type par jour, annulation d’un travail endormi, anciens états refusés après sabotage, prédiction du lendemain vérifiée, réveil et réinitialisation quotidienne, conservation après Pokéball et reconnexion, refus des arrivées tardives, victoire et nouveau salon.

L’intégration utilise trois vraies applications Electron sous Linux. Le rendu WebGL, l’affichage du sommeil et du rêve sont également testés. La compilation est effectuée sur Windows ; les performances et autorisations réseau sur vos PC restent à vérifier.

L’hôte est autoritaire. La confidentialité concerne les écrans et données normalement partagés ; cette version entre proches ne protège pas contre la modification du moteur ou l’inspection de sa mémoire. Les actions du saboteur restent vérifiées par le moteur hôte.
