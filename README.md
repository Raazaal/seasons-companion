# Seasons Companion

Compagnon de score en temps réel pour le jeu de société *Seasons* (2-4 joueurs).

## Installation (hôte, sous Termux)

1. Installer [Termux](https://f-droid.org/packages/com.termux/) depuis F-Droid (pas le Play Store, obsolète).
2. Dans Termux :
   ```bash
   pkg install nodejs git termux-api
   git clone <url-du-repo> seasons-companion
   cd seasons-companion
   npm install
   npm run build
   ```
3. Empêcher Android de tuer le serveur en arrière-plan :
   ```bash
   termux-wake-lock
   ```
4. Démarrer le serveur :
   ```bash
   npm start
   ```
   La console affiche le port (3000 par défaut) et le code de partie à 4 caractères.
5. Connecter tout le monde au même réseau local (WiFi partagé de préférence, sinon activer le partage de connexion du téléphone hôte), puis ouvrir `http://<ip-locale-de-l-hote>:3000` dans le navigateur de chaque téléphone.

## Développement

```bash
npm install                          # à la racine, installe les deux workspaces
npm test                             # lance les tests serveur puis client
npm run build --workspace client     # build de production du client
npm run dev --workspace client       # serveur de dev Vite avec hot-reload (pour itérer sur l'UI)
node server/src/index.js             # lance le serveur (nécessite un build client existant)
```

## Checklist de test manuel avant une soirée jeu

- [ ] Démarrer le serveur, noter le code de partie affiché.
- [ ] Ouvrir l'app dans 2 à 4 onglets de navigateur (ou téléphones), rejoindre avec des noms et couleurs différents.
- [ ] Vérifier qu'une couleur déjà prise est bien désactivée pour les joueurs suivants.
- [ ] Démarrer la partie, vérifier que le joueur actif est correctement mis en avant.
- [ ] Ajuster manuellement le score d'un joueur (+1/-1), vérifier que tous les onglets se mettent à jour.
- [ ] Ajouter une carte à effet "self" à la main d'un joueur, l'activer, vérifier que seul son score change.
- [ ] Ajouter une carte à effet "each_opponent", l'activer, vérifier que tous les autres joueurs perdent/gagnent les points, pas l'activateur.
- [ ] Vérifier que l'écran historique liste bien toutes ces actions, consultable depuis n'importe quel onglet joueur.
- [ ] Fermer un onglet, le rouvrir sur la même URL : vérifier que le joueur retrouve son score et sa main sans avoir à rejoindre.
- [ ] Lancer le décompte final, ajouter plusieurs cartes de fin de partie (y compris plusieurs fois la même) à son propre score depuis la section "Cartes invoquées", puis en retirer une par erreur et vérifier que le score se recalcule correctement.
- [ ] Vérifier que "Terminer la partie" reste désactivé tant que chaque joueur n'a pas cliqué sur "J'ai terminé mon décompte", et qu'ajouter/retirer une carte après coup annule ce statut.
- [ ] Une fois tout le monde prêt, terminer la partie : vérifier le classement final (1er, 2ème, etc., avec gestion des égalités) et qu'aucune action de score n'est plus possible ensuite.
- [ ] Arrêter le serveur (Ctrl+C) et le relancer : vérifier que la partie reprend exactement où elle en était (scores, historique, phase).
