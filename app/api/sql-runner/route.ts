import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sql, connectionString } = body;

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    const trimmedSql = sql.trim().replace(/;+$/, '');
    const lowerSql = trimmedSql.toLowerCase();

    // Block dangerous commands
    const forbidden = ['drop database', 'truncate table', 'drop schema'];
    for (const cmd of forbidden) {
      if (lowerSql.includes(cmd)) {
        return NextResponse.json(
          { error: `Blocked: "${cmd}" is not allowed for safety. Use Supabase dashboard for this.` },
          { status: 403 }
        );
      }
    }

    // Determine connection
    let supabaseUrl: string;
    let supabaseKey: string;

    if (connectionString && typeof connectionString === 'string') {
      if (connectionString.includes('|')) {
        const parts = connectionString.split('|');
        supabaseUrl = parts[0].trim();
        supabaseKey = parts[1].trim();
      } else if (connectionString.startsWith('https://')) {
        supabaseUrl = connectionString;
        supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      } else {
        return NextResponse.json(
          { error: 'Invalid connection string format. Use "URL|KEY" or just the Supabase URL.' },
          { status: 400 }
        );
      }
    } else {
      supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.' },
        { status: 500 }
      );
    }

    // Try using pg module with DATABASE_URL first (most reliable for raw SQL)
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl) {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ 
          connectionString: dbUrl,
          max: 1,
          idleTimeoutMillis: 5000,
          connectionTimeoutMillis: 10000,
        });
        const result = await pool.query(trimmedSql);
        await pool.end();
        return NextResponse.json({
          success: true,
          rows: result.rows,
          rowCount: result.rowCount,
          command: result.command,
        });
      } catch (pgErr: any) {
        return NextResponse.json({ error: pgErr.message, sql: trimmedSql }, { status: 500 });
      }
    }

    // Fallback: Use Supabase REST API to execute SQL via the /pg/query endpoint
    // This endpoint is available on Supabase projects when the pgBouncer is enabled
    try {
      const queryResponse = await fetch(`${supabaseUrl}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query: trimmedSql }),
      });

      if (queryResponse.ok) {
        const data = await queryResponse.json();
        return NextResponse.json({
          success: true,
          rows: data.rows || data,
          rowCount: data.rows?.length || 0,
        });
      }
    } catch {
      // Fall through to next method
    }

    // Fallback: Try using the Supabase client's rpc method with an exec_sql function
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
      const { data: rpcData, error: rpcError } = await client.rpc('exec_sql', { query: trimmedSql });
      if (!rpcError && rpcData) {
        return NextResponse.json({
          success: true,
          rows: Array.isArray(rpcData) ? rpcData : [rpcData],
          rowCount: Array.isArray(rpcData) ? rpcData.length : 1,
        });
      }
    } catch {
      // Fall through
    }

    // If all methods fail, return a helpful error with setup instructions
    return NextResponse.json({
      error: 'Could not execute raw SQL. No execution method available.',
      hint: 'To enable the SQL Runner, do ONE of the following:\n\n1. Set DATABASE_URL in your environment variables (recommended):\n   DATABASE_URL=postgresql://postgres:PASSWORD@db.kybgrsqqvejbvjediowo.supabase.co:5432/postgres\n\n2. Or create an exec_sql function in Supabase SQL Editor:\n   CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS json AS $$\n   DECLARE result json;\n   BEGIN\n     EXECUTE \'SELECT json_agg(row_to_json(t)) FROM (\' || query || \') t\' INTO result;\n     RETURN result;\n   END;\n   $$ LANGUAGE plpgsql SECURITY DEFINER;',
      sql: trimmedSql,
    }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
