import 'dotenv/config';
import { getKnex } from '../src/storage/knex-client.js';

const TEST_WORKSPACES = ['ws_test_estimate', 'ws_test_check', 'ws_handoff_test', 'ws_test_pdf'];

async function main(): Promise<void> {
  const knex = getKnex();
  for (const tbl of ['user_business_info', 'ai_tools_usage'] as const) {
    const has = await knex.schema.hasTable(tbl);
    if (!has) {
      console.log(`[skip] ${tbl} not exist`);
      continue;
    }
    const beforeRows = await knex(tbl).whereIn('workspace_id', TEST_WORKSPACES).select('id', 'workspace_id');
    const n = await knex(tbl).whereIn('workspace_id', TEST_WORKSPACES).del();
    console.log(`[delete] ${tbl}: found ${beforeRows.length} rows, deleted ${n}`);
    for (const r of beforeRows) console.log(`  - ${r.workspace_id} / ${r.id}`);
  }
  await knex.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
