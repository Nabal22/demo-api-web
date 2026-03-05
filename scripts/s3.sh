#!/bin/bash
# Scénario 3 — Problème N+1 : compter les SQL dans le terminal du serveur
# Sans DataLoader : 1 SQL livres + 1 SQL par auteur = N+1
# Avec DataLoader : 1 SQL livres + 1 SQL batch auteurs = 2

echo "=== GraphQL — sans DataLoader (N+1 SQL) ==="
echo "Regarder le terminal du serveur : 1 + N requêtes SQL"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "X-Use-Dataloader: false" \
  -d '{"query":"{ books(limit: 5) { id title author { name } } }"}'

echo -e "\n\n=== GraphQL — avec DataLoader (2 SQL) ==="
echo "Regarder le terminal du serveur : 2 requêtes SQL seulement"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "X-Use-Dataloader: true" \
  -d '{"query":"{ books(limit: 5) { id title author { name } } }"}'

echo ""
