/**
 * Monthly Report Cron Job
 *
 * This script generates and sends monthly reports for all workspaces
 * that have email notifications enabled.
 *
 * For Vercel: Configure in vercel.json with cron schedule
 * For self-hosted: Run via cron/systemd/PM2 on the 1st of each month
 *
 * Usage:
 *   npx tsx src/cron/monthly-report.ts
 *   node dist/cron/monthly-report.js
 */

import 'dotenv/config';
import { listWorkspaces, getWorkspaceSettings } from '../kv/client.js';
import { generatePreviousMonthReport } from '../report/generator.js';
import { sendMonthlyReportEmail, isEmailConfigured } from '../report/email.js';

interface WorkspaceReportResult {
  workspaceId: string;
  email?: string;
  success: boolean;
  error?: string;
}

/**
 * Process monthly reports for all workspaces
 */
async function processMonthlyReports(): Promise<WorkspaceReportResult[]> {
  const results: WorkspaceReportResult[] = [];

  // Check email configuration
  if (!isEmailConfigured()) {
    console.warn('Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
    return results;
  }

  // Get previous month for report
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log(`Generating reports for ${reportMonth}...`);

  // Get all workspaces
  const workspaces = await listWorkspaces();
  console.log(`Found ${workspaces.length} workspace(s)`);

  for (const workspaceId of workspaces) {
    console.log(`Processing workspace: ${workspaceId}`);

    try {
      // Get workspace settings
      const settings = await getWorkspaceSettings(workspaceId);

      // Check if reports are enabled and email is configured
      if (!settings?.report_enabled) {
        console.log(`  - Reports disabled for workspace`);
        results.push({
          workspaceId,
          success: false,
          error: 'Reports disabled'
        });
        continue;
      }

      if (!settings?.notification_email) {
        console.log(`  - No notification email configured`);
        results.push({
          workspaceId,
          success: false,
          error: 'No email configured'
        });
        continue;
      }

      // Generate report
      console.log(`  - Generating PDF...`);
      const pdfBuffer = await generatePreviousMonthReport(workspaceId);

      // Send email
      console.log(`  - Sending to ${settings.notification_email}...`);
      const sent = await sendMonthlyReportEmail(
        settings.notification_email,
        reportMonth,
        pdfBuffer,
        workspaceId
      );

      if (sent) {
        console.log(`  - Report sent successfully`);
        results.push({
          workspaceId,
          email: settings.notification_email,
          success: true
        });
      } else {
        console.log(`  - Failed to send report`);
        results.push({
          workspaceId,
          email: settings.notification_email,
          success: false,
          error: 'Email send failed'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  - Error: ${errorMessage}`);
      results.push({
        workspaceId,
        success: false,
        error: errorMessage
      });
    }
  }

  return results;
}

/**
 * Generate and send report for a single workspace
 */
export async function sendWorkspaceReport(
  workspaceId: string,
  email: string,
  month?: string
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.error('Email not configured');
    return false;
  }

  try {
    // Default to previous month if not specified
    let reportMonth = month;
    if (!reportMonth) {
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    console.log(`Generating report for ${workspaceId} (${reportMonth})...`);

    // Import dynamically to avoid circular dependency
    const { generateMonthlyReport } = await import('../report/generator.js');
    const pdfBuffer = await generateMonthlyReport(workspaceId, reportMonth);

    console.log(`Sending report to ${email}...`);
    return await sendMonthlyReportEmail(email, reportMonth, pdfBuffer, workspaceId);
  } catch (error) {
    console.error('Failed to send workspace report:', error);
    return false;
  }
}

/**
 * Main entry point for cron job
 */
async function main() {
  console.log('='.repeat(50));
  console.log('LLM Trace Lens - Monthly Report Generator');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  try {
    const results = await processMonthlyReports();

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`  Total workspaces: ${results.length}`);
    console.log(`  Reports sent: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\nFailed workspaces:');
      for (const result of failed) {
        console.log(`  - ${result.workspaceId}: ${result.error}`);
      }
    }

    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    console.log('='.repeat(50));

    // Exit with error code if any failures
    process.exit(failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processMonthlyReports };
