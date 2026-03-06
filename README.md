# demo-api-web

Démo REST vs GraphQL vs SOAP — catalogue de livres SF.

## Lancer

```bash
npm install
npm run dev
```

## Endpoints

- REST - `localhost:3000/rest/books`
- GraphQL - `localhost:3000/graphql`
- SOAP - `localhost:3000/soap?wsdl`

## Démo

Deux terminaux : un pour le serveur (les SQL s'affichent en temps réel), un pour les scripts.

```bash
bash scripts/s1.sh   # Un livre par ID
bash scripts/s2.sh   # HATEOAS — 3 requêtes REST vs 1 GraphQL
bash scripts/s3.sh   # N+1 — sans DataLoader vs avec
bash scripts/s4.sh   # Comparaison finale
```

Le header `X-Use-Dataloader: false/true` contrôle le mode DataLoader (scénarios 3 et 4).

## Extraits des scripts et logs serveur.

Les fichiers `extraits/s1.txt` … `extraits/s4.txt` contiennent les commandes, logs serveur et réponses.
