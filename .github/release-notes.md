**Dernière Vague 1.4.0 — UDP 16383 et fichiers modifiables**

- Multijoueur en **UDP sur le port 16383**, comme le numéro et le transport utilisés par Cosmo Wrap.
- Transfert fiable avec retransmissions, ordre, suppression des doublons, authentification et chiffrement.
- ZIP avec **Dernière Vague.exe** et les sources accessibles dans **resources/app**, y compris le moteur réseau. Gardez les fichiers extraits ensemble.
- Exécutable portable autonome également fourni.
- Jusqu’à cinq joueurs ; modifications Pokéball partagées avec rechargement des écrans et maintien des connexions.

Installez la version 1.4.0 sur tous les PC et créez un nouveau salon : les anciennes invitations TCP ne sont pas compatibles. Autorisez cet exécutable sur le réseau privé dans le pare-feu Windows si nécessaire. Le script Pokéball ne peut pas transformer l’ancien moteur TCP en UDP : il faut d’abord la mise à jour Windows.

Pour modifier manuellement le moteur, fermez l’application puis relancez-la ; les joueurs devront rejoindre à nouveau. Les modifications persistantes Pokéball sont prioritaires sur les fichiers du jeu ; F8 permet de restaurer les sources du dossier.

Des essais sur vos deux PC Windows restent nécessaires : UDP ne contourne pas une isolation Wi-Fi ou une adresse inaccessible. Programme Windows 10/11 64 bits non signé.
