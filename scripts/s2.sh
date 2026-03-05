#!/bin/bash
# Scénario 2 — Liens HATEOAS : 3 requêtes REST séquentielles vs 1 GraphQL

echo "=== REST — 3 requêtes séquentielles obligatoires ==="

echo "--- 1/3 : GET /rest/books/1 ---"
curl -s http://localhost:3000/rest/books/1

echo -e "\n--- 2/3 : GET /rest/books/1/author ---"
curl -s http://localhost:3000/rest/books/1/author

echo -e "\n--- 3/3 : GET /rest/books/1/reviews ---"
curl -s http://localhost:3000/rest/books/1/reviews

echo -e "\n\n=== GraphQL — tout en 1 seule requête ==="
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ book(id: \"1\") { id title year genre author { name bio nationality } reviews { reviewer rating comment } } }"}'

echo ""
