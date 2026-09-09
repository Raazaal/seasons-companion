# Seasons Companion — Design

## Contexte et objectif

Le jeu de société [Seasons](https://www.libellud.com/nos-jeux/seasons/) (Libellud) demande de compter manuellement les cristaux (points de victoire) tout au long de la partie, ce qui devient fastidieux — d'autant plus que certaines cartes modifient les points de tous les joueurs à la fois. Cette app est un compagnon de jeu multi-joueurs (2 à 4) permettant à chaque joueur de suivre et modifier son score depuis son téléphone, synchronisé en temps réel avec les autres joueurs.

**Hors périmètre** : cette app ne remplace aucune règle du jeu (pioche, plateau, dés, etc.) — c'est un outil de comptage et de suivi, qui fait confiance aux joueurs pour l'utiliser correctement.

## Contraintes d'usage

- Utilisé en présentiel, autour d'une table. L'app ne dépend d'aucun accès internet — la communication se fait en réseau local entre les téléphones, pas via internet (chaque téléphone peut avoir sa propre data mobile, ça ne les met pas sur le même réseau local pour autant).
- L'hôte (un des 2-4 joueurs) fait tourner le serveur sur son téléphone Android via **Termux** (pas de PC nécessaire).
- Les autres joueurs utilisent leur navigateur mobile, sans rien installer.
- Tous les appareils doivent être sur le même réseau local pour que les clients atteignent le serveur de l'hôte (WiFi partagé de préférence, hotspot du téléphone hôte en secours si le réseau isole les clients entre eux).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Téléphone hôte (Termux)                             │
│  ┌─────────────────────────────────────────────┐    │
│  │  Serveur Node.js                              │    │
│  │  - Express : sert le build Svelte (statique)  │    │
│  │  - ws : connexions WebSocket temps réel       │    │
│  │  - État de partie en mémoire (source de       │    │
│  │    vérité) + persistance JSON sur disque      │    │
│  │  - Base de cartes Seasons (fichier statique)  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │ WebSocket      │ WebSocket      │ WebSocket
        │ (+ HTTP statique au chargement)
   ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
   │ Joueur 1│     │ Joueur 2│     │ Joueur 3/4
   │ (navig.)│     │ (navig.)│     │ (navig.) │
   └─────────┘     └─────────┘     └─────────┘
```

**Stack retenue** :
- Serveur : Node.js + Express (fichiers statiques) + `ws` (WebSocket brut, sans dépendance native — important pour une installation fiable sous Termux).
- Client : Svelte + Vite, build statique unique servi par le serveur, écosystème adapté au state partagé temps réel via des stores alimentés par le WebSocket.
- Persistance : fichier JSON unique sur disque (écriture atomique), pas de base de données — le volume de données est trivial (4 joueurs, quelques centaines d'entrées d'historique).

**Composants** :
- `server/gameState` — module contenant la logique pure d'application des actions sur l'état (`applyAction(state, action) → newState`), testable indépendamment du réseau.
- `server/persistence` — sauvegarde/rechargement du fichier `data/game-state.json`.
- `server/ws` — glue WebSocket : reçoit les actions, appelle `gameState`, rediffuse l'état complet à tous les clients connectés après chaque mutation.
- `server/cards.json` — base statique des cartes du jeu de base Seasons (nom, effets, valeur cristaux fin de partie).
- `client/` — écrans : rejoindre/créer une partie, tableau de bord (score, joueur actif, ma main), sélection/activation de carte, historique (écran séparé), décompte final.

Une seule partie active par instance de serveur — pas de gestion multi-sessions.

## Modèle de données

**Carte** (`cards.json`, base du jeu de base uniquement — ~72 cartes) :
```ts
{
  id: string,
  name: string,
  effects: Array<{ target: "self" | "each_opponent" | "all_players", amount: number }>,
  endGameCrystals: number | null
}
```
Toutes les cartes à effet immédiat connues à ce jour affectent soit le joueur qui active ("self"), soit l'ensemble des adversaires ("each_opponent"), jamais un adversaire choisi individuellement. Si une future carte nécessite un ciblage précis, ce type de cible (`choose_opponent`) sera ajouté à ce moment-là.

**Joueur** :
```ts
{
  id: string,
  token: string,       // secret, connu du client seul, sert à la reconnexion
  name: string,
  color: string,        // unique parmi les joueurs de la partie
  score: number,         // toujours >= 0 (plancher à 0, jamais négatif)
  hand: Array<{ cardId: string, instanceId: string }>,  // doublons autorisés
  connected: boolean
}
```

**Partie** :
```ts
{
  joinCode: string,
  players: Player[],
  turnOrder: string[],       // ids joueurs
  activePlayerId: string | null,
  phase: "lobby" | "playing" | "final_count" | "ended"
}
```

**Entrée d'historique** (log append-only, jamais modifié rétroactivement) :
```ts
{
  timestamp: number,
  playerId: string,          // dont le score change
  delta: number,
  resultingScore: number,
  source: "manual" | "card_effect" | "final_count",
  actorPlayerId: string,     // qui a déclenché (utile quand une carte d'un joueur touche un adversaire)
  cardId?: string,
  cardName?: string          // dénormalisé, reste lisible même si la base de cartes change plus tard
}
```
Pas de champ note libre — les ajustements manuels ne portent qu'un delta.

L'historique de chaque joueur est visible par **tous les joueurs** de la partie (vérification croisée anti-oubli/triche), pas seulement par son propriétaire. Il est affiché sur un écran séparé de l'écran de comptage principal.

## Flux temps réel (protocole WebSocket)

Le client envoie des actions typées, le serveur fait autorité sur l'état et rediffuse l'état complet de la partie à tous les clients connectés après chaque mutation (pas de diffs partiels — plus simple et robuste aux reconnexions).

- **Créer une partie** : le premier joueur crée la partie, reçoit un `joinCode` court affiché à l'écran (+ QR code optionnel).
- **Rejoindre une partie** : le joueur saisit son nom et choisit une couleur parmi celles encore libres → le serveur crée son `Player`, génère son `token`, le client le stocke en `localStorage`.
- **Reconnexion** : au chargement, le client renvoie son `token` s'il en a un ; le serveur le rattache au `Player` existant (aucune recréation, aucune perte de score/historique). Le serveur marque `connected: false` à la déconnexion, `true` à la reconnexion.
- **`ADJUST_SCORE { playerId, delta }`** : ajustement manuel, plancher 0, entrée d'historique `source: manual`.
- **`ADD_CARD_TO_HAND` / `REMOVE_CARD_FROM_HAND`** : gère la liste de cartes affichées sur l'interface d'un joueur (n'affecte pas le score).
- **`ACTIVATE_CARD { actorPlayerId, cardId }`** : résout chaque effet de la carte selon sa cible, applique les deltas (plancher 0 chacun), crée une entrée d'historique par joueur impacté (`source: card_effect`). Peut être déclenchée plusieurs fois sans limite (effets répétables autorisés, aucune restriction imposée par l'app).
- **`NEXT_TURN`** : avance `activePlayerId` selon `turnOrder`.
- **Décompte final** : `START_FINAL_COUNT` passe la partie en `phase: final_count`. Sur un écran dédié (étape séparée, indépendante des cartes jouées pendant la partie), chaque joueur ajoute les cartes à cristaux qu'il possède encore via `ADD_FINAL_CRYSTALS { playerId, cardId }` (entrée d'historique `source: final_count`). `END_GAME` fige la partie (`phase: ended`) — plus aucune action de score possible, le classement reste consultable.
- **`NEW_GAME`** : réinitialise l'état pour démarrer une nouvelle partie (action destructive, confirmation requise côté UI).

## Persistance

Fichier unique `server/data/game-state.json`, ré-écrit en entier après chaque action mutante avec écriture atomique (fichier temporaire + rename) pour éviter toute corruption si le process Termux est tué en plein milieu. Pas de debounce nécessaire vu la fréquence et le volume des écritures. Au démarrage, le serveur recharge ce fichier s'il existe et reprend la partie en cours ; sinon il démarre sur un lobby vide.

## Gestion des erreurs

- **Déconnexion réseau** : état du joueur conservé côté serveur ; le client retente la connexion WebSocket automatiquement (backoff) et se réauthentifie avec son token stocké localement.
- **Actions invalides** (code de partie inconnu, couleur/nom déjà pris, action envoyée après `ended`) : erreur ciblée renvoyée au seul client fautif (toast), sans perturber les autres.
- **Concurrence** : Node étant single-threaded, les actions sont traitées séquentiellement dans l'ordre de réception — pas de conditions de course sur l'état partagé.
- **Échec d'écriture disque** : loggé côté serveur sans faire planter le process ; l'état en mémoire reste correct et une nouvelle écriture est tentée à la prochaine action.

## Tests

- Logique de jeu (`applyAction`) écrite comme fonctions pures, séparées de la couche WebSocket — testée exhaustivement avec **Vitest** (plancher à 0, effets multi-cibles, changement de tour, décompte final, reconnexion) sans serveur réel.
- Tests de composants Svelte ciblés sur les éléments critiques (score, sélecteur de couleur) avec Vitest + Testing Library.
- Pas de suite e2e automatisée — test manuel multi-onglets en local avant une vraie soirée jeu.

## Résumé des décisions

| Sujet | Décision |
|---|---|
| Réseau | Téléphone hôte sous Termux + Node.js, autres joueurs en navigateur, WiFi partagé (hotspot en secours) |
| Cartes | Base de données prédéfinie, jeu de base uniquement (~72 cartes) |
| Activation carte | Répétable sans limite |
| Décompte final | Étape séparée et manuelle, réutilise la base de cartes |
| Reconnexion | Token privé en `localStorage`, état conservé côté serveur |
| Joueur actif | Bouton "joueur suivant" manuel |
| Historique | Visible par tous les joueurs, sans note libre |
| Score | Plancher à 0, jamais négatif |
| Persistance | Fichier JSON, écriture atomique, une seule partie active |
| Stack | Node.js + Express + `ws` (serveur), Svelte + Vite (client) |
