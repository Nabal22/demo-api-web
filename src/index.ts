import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

import { sqlCounter } from './db.js';
import restRouter from './rest/router.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers, createContext } from './graphql/resolvers.js';
import { soapHandler, wsdlHandler } from './soap/service.js';

const app = express();
app.use(cors());
app.use((req, res, next) => {
  const t0 = performance.now();
  sqlCounter.reset();

  const dl = req.headers['x-use-dataloader'];
  const hint = dl !== undefined ? ` (DataLoader: ${dl !== 'false' ? 'oui' : 'non'})` : '';
  console.log(`\n→ ${req.method} ${req.path}${hint}`);

  const originalSend = res.send.bind(res);
  res.send = function (body: unknown) {
    const ms    = (performance.now() - t0).toFixed(0);
    const bytes = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
    console.log(`  ← ${res.statusCode} | ${sqlCounter.get()} SQL | ${bytes} octets | ${ms}ms`);
    return originalSend(body);
  };

  next();
});

app.use('/rest', express.json(), restRouter);

app.get('/soap', wsdlHandler);
app.post('/soap',
  express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml', '*/*'] }),
  soapHandler
);

async function main() {
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();

  app.use('/graphql',
    express.json(),
    expressMiddleware(apollo, {
      context: async ({ req }) => createContext(req.headers['x-use-dataloader'] !== 'false'),
    })
  );

  app.listen(3000, () => {
    console.log('REST    -> http://localhost:3000/rest/books');
    console.log('GraphQL -> http://localhost:3000/graphql');
    console.log('SOAP    -> http://localhost:3000/soap?wsdl');
  });
}

main().catch(err => { console.error(err); process.exit(1); });
