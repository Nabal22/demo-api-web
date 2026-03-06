#!/bin/bash
# Scénario 3 — Problème N+1

echo "# GraphQL — sans DataLoader (N+1 SQL)"
echo "Regarder le terminal du serveur : 1 + N requêtes SQL"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "X-Use-Dataloader: false" \
  -d '{"query":"{ books(limit: 5) { id title author { name } } }"}'

echo -e "\n\n# GraphQL — avec DataLoader (2 SQL)"
echo "Regarder le terminal du serveur : 2 requêtes SQL seulement"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "X-Use-Dataloader: true" \
  -d '{"query":"{ books(limit: 5) { id title author { name } } }"}'

echo ""
