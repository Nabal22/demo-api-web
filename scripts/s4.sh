#!/bin/bash
# Scénario 4 — Comparaison finale : REST (1+N HTTP) vs GraphQL+DL vs SOAP

echo "=== REST — plusieurs requêtes HTTP (1 liste + 1 par auteur unique) ==="
echo "--- GET /rest/books?limit=5 ---"
curl -s "http://localhost:3000/rest/books?limit=5"

echo -e "\n--- GET /rest/authors/1 (Frank Herbert) ---"
curl -s http://localhost:3000/rest/authors/1

echo -e "\n--- GET /rest/authors/2 (Isaac Asimov) ---"
curl -s http://localhost:3000/rest/authors/2

echo -e "\n\n=== GraphQL + DataLoader — 1 requête HTTP, 2 SQL ==="
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "X-Use-Dataloader: true" \
  -d '{"query":"{ books(limit: 5) { id title genre year author { name nationality } } }"}'

echo -e "\n\n=== SOAP — GetBooks (1 requête HTTP, payload XML très verbeux) ==="
curl -s -X POST http://localhost:3000/soap \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H 'SOAPAction: "GetBooks"' \
  -d '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://demo.api.web/BookCatalog"><soap:Body><tns:GetBooksRequest><Limit>5</Limit><Offset>0</Offset></tns:GetBooksRequest></soap:Body></soap:Envelope>'

echo ""
