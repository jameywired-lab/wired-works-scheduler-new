/**
 * export-manus-data.mjs
 * Exports all data from the Manus (source) database as INSERT statements.
 * Run with: node scripts/export-manus-data.mjs > /tmp/manus-data-export.sql
 */
import { createPool } from '../node_modules/mysql2/promise.js';
import { writeFileSync } from 'fs';

// Tables to export in dependency order (parents before children)
const TABLE_ORDER = [
  'users',
  'clients',
  'clientAddresses',
  'clientNotes',
  'clientPhotos',
  'clientTags',
  'clientCommunications',
  'tags',
  'crewMembers',
  'crewNotes',
  'jobs',
  'jobAssignments',
  'jobDocuments',
  'jobPhotos',
  'projects',
  'projectMilestones',
  'projectNotes',
  'projectPhotos',
  'projectReminders',
  'projectCredentials',
  'followUps',
  'smsLog',
  'smsTemplates',
  'partsRequests',
  'vanInventoryItems',
  'activityLog',
  'emailCampaigns',
  'emailCampaignRecipients',
  'googleTokens',
];

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
  // Escape string
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '\\0');
  return `'${str}'`;
}

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const lines = [];

  lines.push('-- Manus data export');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS=0;');
  lines.push('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
  lines.push('');

  for (const table of TABLE_ORDER) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (!rows || rows.length === 0) {
        lines.push(`-- Table \`${table}\`: empty`);
        lines.push('');
        continue;
      }

      lines.push(`-- Table \`${table}\`: ${rows.length} rows`);
      lines.push(`TRUNCATE TABLE \`${table}\`;`);

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `\`${c}\``).join(', ');

      // Batch inserts in groups of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const valuesList = batch.map(row =>
          '(' + columns.map(col => escapeValue(row[col])).join(', ') + ')'
        ).join(',\n  ');
        lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES`);
        lines.push(`  ${valuesList};`);
      }
      lines.push('');
    } catch (err) {
      lines.push(`-- SKIPPED \`${table}\`: ${err.message}`);
      lines.push('');
    }
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  lines.push('');
  lines.push('-- Export complete');

  await pool.end();

  const output = lines.join('\n');
  writeFileSync('/tmp/manus-data-export.sql', output);
  console.error(`Export complete. File: /tmp/manus-data-export.sql (${(output.length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
