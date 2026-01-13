import pg from 'pg';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const TABLES_IN_ORDER = [
  'application_settings',
  'invoice_counters',
  'users',
  'password_reset_tokens',
  'services',
  'workflows',
  'workflow_steps',
  'service_workflows',
  'engagements',
  'quotes',
  'quote_items',
  'quote_media',
  'invoices',
  'invoice_items',
  'invoice_media',
  'reservations',
  'reservation_services',
  'workshop_tasks',
  'notifications',
  'chat_conversations',
  'chat_participants',
  'chat_messages',
  'chat_attachments',
  'audit_logs',
  'audit_log_changes',
];

function escapeValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function exportTable(tableName: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    const checkResult = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
      [tableName]
    );
    
    if (!checkResult.rows[0].exists) {
      return [];
    }

    const result = await client.query(`SELECT * FROM "${tableName}"`);
    const rows = result.rows;

    if (rows.length === 0) {
      return [];
    }

    const statements: string[] = [];
    statements.push(`-- Table: ${tableName} (${rows.length} rows)`);
    statements.push(`DELETE FROM "${tableName}";`);

    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map(col => escapeValue(row[col]));
      statements.push(
        `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`
      );
    }

    return statements;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Exporting development database to SQL...');
  
  const allStatements: string[] = [];
  allStatements.push('-- MyJantes Database Export');
  allStatements.push(`-- Generated: ${new Date().toISOString()}`);
  allStatements.push('-- Run this script on your production database');
  allStatements.push('');
  allStatements.push('BEGIN;');
  allStatements.push('');

  for (const table of TABLES_IN_ORDER) {
    const statements = await exportTable(table);
    if (statements.length > 0) {
      allStatements.push(...statements);
      allStatements.push('');
      console.log(`Exported: ${table}`);
    }
  }

  allStatements.push('COMMIT;');

  const outputPath = 'scripts/production-data.sql';
  fs.writeFileSync(outputPath, allStatements.join('\n'));
  
  console.log('');
  console.log(`Export complete! File saved to: ${outputPath}`);
  console.log('');
  console.log('To import to production:');
  console.log('1. Go to the Database pane in Replit');
  console.log('2. Select your production database');
  console.log('3. Use the SQL editor to run this script');

  await pool.end();
}

main().catch(console.error);
