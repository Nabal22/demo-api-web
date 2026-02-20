import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { scenarios, resetSqlCounter, getSqlCount } from './scenarios';
import type { BenchmarkResult } from '../../shared/types';

// === Configuration ===
const ITERATIONS = 100;
const WARMUP = 5; // Itérations de chauffe ignorées

async function main() {
  console.log('='.repeat(60));
  console.log('  BENCHMARK — REST vs GraphQL vs SOAP');
  console.log(`  ${ITERATIONS} itérations par test (+ ${WARMUP} de chauffe)`);
  console.log('='.repeat(60));

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n📊 Scénario : ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log('-'.repeat(50));

    for (const api of scenario.apis) {
      process.stdout.write(`   ${api.name.padEnd(22)}`);

      // Phase de chauffe (résultats ignorés)
      for (let i = 0; i < WARMUP; i++) {
        await resetSqlCounter(api.adminUrl);
        await api.run();
      }

      // Phase de mesure
      const latencies: number[] = [];
      let totalHttpRequests = 0;
      let totalSqlQueries = 0;
      let totalBytes = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        // Reset du compteur SQL avant chaque itération
        await resetSqlCounter(api.adminUrl);

        const start = performance.now();
        const { httpRequests, totalBytes: bytes } = await api.run();
        const elapsed = performance.now() - start;

        latencies.push(elapsed);
        totalHttpRequests += httpRequests;
        totalBytes += bytes;

        // Lire le nombre de requêtes SQL effectuées
        const sqlCount = await getSqlCount(api.adminUrl);
        totalSqlQueries += sqlCount;
      }

      // Calcul des moyennes
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const avgHttpReqs = totalHttpRequests / ITERATIONS;
      const avgSqlQueries = totalSqlQueries / ITERATIONS;
      const avgBytes = totalBytes / ITERATIONS;

      const result: BenchmarkResult = {
        scenario: scenario.name,
        api: api.name,
        avgLatencyMs: Math.round(avgLatency * 100) / 100,
        httpRequests: Math.round(avgHttpReqs * 10) / 10,
        sqlQueries: Math.round(avgSqlQueries * 10) / 10,
        responsePayloadBytes: Math.round(avgBytes),
      };

      results.push(result);
      console.log(
        `latence=${result.avgLatencyMs.toFixed(1)}ms  ` +
        `HTTP=${result.httpRequests}  ` +
        `SQL=${result.sqlQueries}  ` +
        `payload=${result.responsePayloadBytes}o`
      );
    }
  }

  // Sauvegarder les résultats
  const outputDir = path.join(__dirname, '..', 'results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Résultats sauvegardés dans ${outputPath}`);
  console.log('='.repeat(60));

  // Quitter proprement
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur pendant le benchmark :', err);
  process.exit(1);
});
