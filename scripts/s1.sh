#!/bin/bash
# Scénario 1 — Un livre par ID : SOAP vs REST vs GraphQL
# Observer dans le terminal du serveur les requêtes SQL déclenchées

echo "# SOAP — GetBook(id=1) — retourne tout (auteur + reviews) même si pas demandé"
curl -s -X POST http://localhost:3000/soap \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H 'SOAPAction: "GetBook"' \
  -d '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://demo.api.web/BookCatalog"><soap:Body><tns:GetBookRequest><BookId>1</BookId></tns:GetBookRequest></soap:Body></soap:Envelope>'

echo -e "\n\n# REST — GET /rest/books/1 — champs fixes + liens HATEOAS"
curl -s http://localhost:3000/rest/books/1

echo -e "\n\n# GraphQL — on demande seulement id, title, year, genre"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ book(id: \"1\") { id title year genre } }"}'

echo -e "\n\n# GraphQL — on demande tout : auteur + reviews"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ book(id: \"1\") { id title year genre author { name nationality } reviews { reviewer rating } } }"}'

echo ""
