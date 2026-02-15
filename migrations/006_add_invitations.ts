import type { Knex } from 'knex';

/**
 * Migration: Add invitations table for team member invitations
 * Also adds invited_by column to workspace_users for tracking who invited each member
 */
export async function up(knex: Knex): Promise<void> {
  // Create invitations table
  const hasInvitationsTable = await knex.schema.hasTable('invitations');
  if (!hasInvitationsTable) {
    await knex.schema.createTable('invitations', (table) => {
      table.string('token').primary();
      table.string('workspace_id').notNullable().references('id').inTable('workspaces');
      table.string('invited_by_email').notNullable(); // email of the user who created the invitation
      table.string('email').nullable(); // specific email restriction (null = anyone can use)
      table.timestamp('expires_at').notNullable();
      table.timestamp('used_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('workspace_id');
      table.index('email');
    });
  }

  // Add invited_by column to workspace_users if not exists
  const hasInvitedBy = await knex.schema.hasColumn('workspace_users', 'invited_by');
  if (!hasInvitedBy) {
    await knex.schema.alterTable('workspace_users', (table) => {
      table.string('invited_by').nullable(); // email of the inviter
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop invitations table
  await knex.schema.dropTableIfExists('invitations');

  // Remove invited_by column from workspace_users
  const hasInvitedBy = await knex.schema.hasColumn('workspace_users', 'invited_by');
  if (hasInvitedBy) {
    await knex.schema.alterTable('workspace_users', (table) => {
      table.dropColumn('invited_by');
    });
  }
}
