# demo-api-web — REST vs GraphQL vs SOAP

Projet de démonstration comparative pour un exposé universitaire. Un même service (catalogue de livres de science-fiction) est implémenté avec trois approches d'API web : **REST**, **GraphQL** et **SOAP**.

Un benchmark automatisé mesure les performances de chaque approche sur des scénarios concrets, et les résultats sont visualisés dans une page HTML interactive.

## Installation et lancement rapide

```bash
# 1. Installer les dépendances
npm run setup

# 2. Lancer les 3 serveurs + benchmark + visualisation
npm run demo
```

Ou étape par étape :

```bash
npm install
npm run seed              # Crée la base SQLite avec les données de test
npm run start:all         # Lance les 3 serveurs en parallèle
npm run benchmark         # Exécute le benchmark (serveurs doivent tourner)
open visualize/index.html # Ouvre les graphiques
```

## Les trois serveurs

### REST (port 3001)

Serveur Express.js implémentant une API REST de niveau 2-3 (Richardson Maturity Model). Chaque ressource (livre, auteur, review) a son endpoint dédié avec des liens HATEOAS permettant la navigation entre ressources. La pagination est gérée via `?limit=` et `?offset=`. Les réponses incluent `Cache-Control` et les codes HTTP appropriés (200, 201, 400, 404).

### GraphQL (port 3002)

Serveur Apollo Server 4 avec un schéma SDL typé. La particularité : deux modes de résolution contrôlés par le header `X-Use-Dataloader`. En mode naïf, chaque résolution de champ fait sa propre requête SQL (problème N+1 visible dans les logs). En mode DataLoader, les requêtes sont automatiquement batchées. Cela permet de montrer en live pourquoi DataLoader est essentiel en production.

### SOAP (port 3003)

Serveur Express avec la bibliothèque `soap`. Le WSDL est écrit à la main avec les types XSD correspondant au modèle de données. Le service `BookCatalogService` expose 4 opérations : `GetBook`, `GetBooks`, `GetAuthor` et `AddReview`. Chaque opération retourne les données liées en une seule réponse XML.

## Les 3 scénarios de benchmark

### Scénario 1 — Requête simple
Récupérer un seul livre par son ID. Toutes les approches font une seule requête HTTP. Ce scénario mesure la **latence de base** et la **taille du payload** (XML SOAP vs JSON REST vs JSON GraphQL).

### Scénario 2 — Données liées
Récupérer un livre avec son auteur et ses reviews. REST nécessite **3 requêtes HTTP** séquentielles (sous-fetching), tandis que GraphQL et SOAP retournent tout en **1 requête**. Ce scénario illustre le compromis REST entre granularité des ressources et nombre de round-trips.

### Scénario 3 — Liste avec relations (N+1)
Récupérer 10 livres avec leurs auteurs. C'est le scénario le plus révélateur :
- **REST** : 1 + N requêtes HTTP (1 pour la liste, 1 par auteur unique)
- **GraphQL sans DataLoader** : 1 requête HTTP mais **N+1 requêtes SQL** en interne
- **GraphQL avec DataLoader** : 1 requête HTTP et seulement **2 requêtes SQL** (batch)
- **SOAP** : 1 requête HTTP, 2 requêtes SQL (batch natif)

## Interpréter les résultats

Les graphiques affichent 4 métriques :

1. **Latence** : temps total côté client. REST est pénalisé sur les scénarios 2 et 3 par les requêtes multiples.
2. **Requêtes HTTP** : REST nécessite plus de round-trips pour les données liées.
3. **Requêtes SQL** : met en évidence le problème N+1 de GraphQL sans DataLoader. Le nombre de requêtes SQL explose avec la taille de la liste.
4. **Taille des payloads** : SOAP (XML) est plus verbeux que JSON. GraphQL permet de ne demander que les champs nécessaires.

## Structure du projet

```
demo-api-web/
├── shared/          # Base SQLite + types TypeScript partagés
├── rest-server/     # API REST (Express.js, port 3001)
├── graphql-server/  # API GraphQL (Apollo Server, port 3002)
├── soap-server/     # API SOAP (express + soap, port 3003)
├── benchmark/       # Scripts de benchmark + résultats JSON
└── visualize/       # Page HTML de visualisation (Chart.js)
```

## Prérequis

- Node.js 18+
- npm 9+
