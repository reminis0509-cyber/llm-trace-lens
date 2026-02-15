import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getAdapter, WorkspaceTraceRecord } from '../storage/adapter.js';
import { getWorkspaceSettings, getWorkspaceCostStats } from '../kv/client.js';

export interface ReportStats {
  totalRequests: number;
  totalCost: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  requestsByProvider: Record<string, number>;
  requestsByModel: Record<string, number>;
  averageLatency: number;
  validationSummary: {
    pass: number;
    warn: number;
    block: number;
  };
}

/**
 * Calculate statistics from traces
 */
export async function calculateStats(traces: WorkspaceTraceRecord[]): Promise<ReportStats> {
  const stats: ReportStats = {
    totalRequests: traces.length,
    totalCost: 0,
    costByProvider: {},
    costByModel: {},
    requestsByProvider: {},
    requestsByModel: {},
    averageLatency: 0,
    validationSummary: { pass: 0, warn: 0, block: 0 }
  };

  let totalLatency = 0;

  for (const trace of traces) {
    // Cost tracking
    const cost = trace.estimated_cost || 0;
    stats.totalCost += cost;
    stats.costByProvider[trace.provider] = (stats.costByProvider[trace.provider] || 0) + cost;
    stats.costByModel[trace.model] = (stats.costByModel[trace.model] || 0) + cost;

    // Request counts
    stats.requestsByProvider[trace.provider] = (stats.requestsByProvider[trace.provider] || 0) + 1;
    stats.requestsByModel[trace.model] = (stats.requestsByModel[trace.model] || 0) + 1;

    // Latency
    totalLatency += trace.latency_ms || 0;

    // Validation summary
    const overall = (trace.validation_results as { overall?: string })?.overall;
    if (overall === 'PASS') stats.validationSummary.pass++;
    else if (overall === 'WARN') stats.validationSummary.warn++;
    else if (overall === 'BLOCK') stats.validationSummary.block++;
  }

  stats.averageLatency = traces.length > 0 ? totalLatency / traces.length : 0;

  return stats;
}

/**
 * Generate monthly report PDF
 */
export async function generateMonthlyReport(
  workspaceId: string,
  month: string // YYYY-MM format
): Promise<Uint8Array> {
  // Get traces for the month
  const adapter = await getAdapter();
  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const traces = await adapter.getTraces(workspaceId, {
    startTime: startDate,
    endTime: endDate,
    limit: 10000 // Get all traces for the month
  });

  // Calculate statistics
  const stats = await calculateStats(traces);

  // Get workspace settings for budget comparison
  const settings = await getWorkspaceSettings(workspaceId);
  const budget = settings?.monthly_budget || 0;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();

  let y = height - 50;
  const leftMargin = 50;
  const rightMargin = width - 50;

  // Header
  page.drawText('LLM Trace Lens', {
    x: leftMargin,
    y,
    size: 24,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6)
  });
  y -= 30;

  page.drawText(`Monthly Report - ${month}`, {
    x: leftMargin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 15;

  page.drawText(`Workspace: ${workspaceId}`, {
    x: leftMargin,
    y,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });
  y -= 40;

  // Summary Section
  page.drawText('Summary', {
    x: leftMargin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 25;

  const summaryData = [
    ['Total Requests', stats.totalRequests.toString()],
    ['Total Cost', `$${stats.totalCost.toFixed(4)}`],
    ['Budget Used', budget > 0 ? `${((stats.totalCost / budget) * 100).toFixed(1)}%` : 'N/A'],
    ['Average Latency', `${stats.averageLatency.toFixed(0)} ms`]
  ];

  for (const [label, value] of summaryData) {
    page.drawText(`${label}:`, { x: leftMargin, y, size: 11, font });
    page.drawText(value, { x: 200, y, size: 11, font: boldFont });
    y -= 18;
  }
  y -= 20;

  // Cost by Provider
  page.drawText('Cost by Provider', {
    x: leftMargin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 25;

  for (const [provider, cost] of Object.entries(stats.costByProvider)) {
    const requests = stats.requestsByProvider[provider] || 0;
    page.drawText(`${provider}:`, { x: leftMargin, y, size: 11, font });
    page.drawText(`$${cost.toFixed(4)} (${requests} requests)`, { x: 150, y, size: 11, font });
    y -= 18;
  }
  y -= 20;

  // Cost by Model
  page.drawText('Cost by Model', {
    x: leftMargin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 25;

  const modelEntries = Object.entries(stats.costByModel).slice(0, 10); // Top 10 models
  for (const [model, cost] of modelEntries) {
    const requests = stats.requestsByModel[model] || 0;
    const displayModel = model.length > 30 ? model.substring(0, 27) + '...' : model;
    page.drawText(`${displayModel}:`, { x: leftMargin, y, size: 10, font });
    page.drawText(`$${cost.toFixed(4)} (${requests})`, { x: 250, y, size: 10, font });
    y -= 16;
  }
  y -= 20;

  // Validation Summary
  page.drawText('Validation Summary', {
    x: leftMargin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 25;

  page.drawText('PASS:', { x: leftMargin, y, size: 11, font });
  page.drawText(stats.validationSummary.pass.toString(), {
    x: 100, y, size: 11, font: boldFont, color: rgb(0.2, 0.6, 0.2)
  });

  page.drawText('WARN:', { x: 150, y, size: 11, font });
  page.drawText(stats.validationSummary.warn.toString(), {
    x: 200, y, size: 11, font: boldFont, color: rgb(0.8, 0.6, 0.1)
  });

  page.drawText('BLOCK:', { x: 250, y, size: 11, font });
  page.drawText(stats.validationSummary.block.toString(), {
    x: 310, y, size: 11, font: boldFont, color: rgb(0.8, 0.2, 0.2)
  });
  y -= 40;

  // Footer
  page.drawText(`Generated: ${new Date().toISOString()}`, {
    x: leftMargin,
    y: 30,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });

  page.drawText('LLM Trace Lens - https://github.com/your-repo/llm-trace-lens', {
    x: rightMargin - 250,
    y: 30,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generate report for current month
 */
export async function generateCurrentMonthReport(workspaceId: string): Promise<Uint8Array> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return generateMonthlyReport(workspaceId, month);
}

/**
 * Generate report for previous month
 */
export async function generatePreviousMonthReport(workspaceId: string): Promise<Uint8Array> {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return generateMonthlyReport(workspaceId, month);
}
