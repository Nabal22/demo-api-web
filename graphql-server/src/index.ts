import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import getDb, { resetSqlCounter, getSqlCount } from '../../shared/db';
import { typeDefs } from './schema';
import { resolvers, createContext, type GraphQLContext } from './resolvers';

const PORT = 3002;
const db = getDb();

async function main() {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => {
      // Le header X-Use-Dataloader contrôle le mode de résolution
      const useDataLoader = req.headers['x-use-dataloader'] === 'true';

      // Le header X-Reset-Sql-Counter permet au benchmark de reset le compteur
      if (req.headers['x-reset-sql-counter'] === 'true') {
        resetSqlCounter();
      }

      const ctx = createContext(db, useDataLoader);
      return ctx;
    },
  });

  console.log(`🟣 GraphQL server démarré sur ${url}`);
  console.log(`   Header X-Use-Dataloader: true/false pour basculer le mode`);

  // Endpoint dédié pour lire le compteur SQL (via query GraphQL introspection)
  // Le benchmark lira le compteur via un appel HTTP séparé sur le même port
}

// Exposer le compteur SQL via un mini serveur HTTP séparé n'est pas idéal.
// À la place, on exporte une fonction et le benchmark lira les logs.
// Mais pour simplifier, on ajoute un champ dans les extensions de la réponse.

// Alternative plus simple : le benchmark POST un reset puis GET le count
// On va patcher avec un petit express en parallèle sur le port 3012
import express from 'express';
const adminApp = express();
adminApp.post('/admin/reset-sql-counter', (_req, res) => {
  resetSqlCounter();
  res.json({ ok: true });
});
adminApp.get('/admin/sql-count', (_req, res) => {
  res.json({ count: getSqlCount() });
});
adminApp.listen(3012, () => {
  console.log('   Admin endpoint GraphQL sur http://localhost:3012');
});

main().catch(console.error);
