import 'dotenv/config';
import { getKnex } from '../src/storage/knex-client.js';

const WORKSPACE_ID = 'ws_handoff';
const EMAIL = 'founder@reminis.jp';
const USER_ID = 'founder-handoff';

async function main(): Promise<void> {
  const knex = getKnex();

  // Workspaces table — minimal insert
  const hasWs = await knex.schema.hasTable('workspaces');
  if (hasWs) {
    const exists = await knex('workspaces').where({ id: WORKSPACE_ID }).first();
    if (!exists) {
      await knex('workspaces').insert({
        id: WORKSPACE_ID,
        name: 'Founder Handoff Test',
        created_at: new Date(),
      });
      console.log(`[insert] workspaces: ${WORKSPACE_ID}`);
    } else {
      console.log(`[skip] workspaces: ${WORKSPACE_ID} exists`);
    }
  }

  // workspace_users mapping
  const hasWu = await knex.schema.hasTable('workspace_users');
  if (hasWu) {
    const exists = await knex('workspace_users').where({ workspace_id: WORKSPACE_ID, email: EMAIL }).first();
    if (!exists) {
      await knex('workspace_users').insert({
        id: `wu_${Date.now()}`,
        workspace_id: WORKSPACE_ID,
        email: EMAIL,
        role: 'owner',
        created_at: new Date(),
      });
      console.log(`[insert] workspace_users: ${EMAIL} -> ${WORKSPACE_ID}`);
    } else {
      console.log(`[skip] workspace_users: ${EMAIL} exists`);
    }
  }

  console.log('---');
  console.log('Use these in browser localStorage:');
  console.log(`  key: sb-fujitrace-auth-token`);
  console.log(`  value: ${JSON.stringify({ user: { email: EMAIL, id: USER_ID } })}`);
  console.log(`Workspace ID: ${WORKSPACE_ID}`);

  await knex.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
