'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Play, Database, Loader2, Download, Trash2, Copy, Check } from 'lucide-react';

interface QueryResult {
  success?: boolean;
  rows?: any[];
  rowCount?: number;
  command?: string;
  error?: string;
  hint?: string;
  sql?: string;
}

export default function SqlRunnerPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [sql, setSql] = useState<string>('SELECT * FROM products LIMIT 10;');
  const [connectionString, setConnectionString] = useState<string>('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runQuery = async () => {
    if (!sql.trim()) {
      toast({ title: 'Error', description: 'Please enter a SQL query', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/sql-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, connectionString: connectionString || undefined }),
      });

      const data: QueryResult = await response.json();

      if (!response.ok) {
        setResult(data);
        toast({ title: 'Query failed', description: data.error || 'Unknown error', variant: 'destructive' });
      } else {
        setResult(data);
        toast({
          title: 'Query executed',
          description: `${data.rowCount ?? 0} row(s) affected/returned`,
        });
        setHistory((prev) => [sql, ...prev.filter((q) => q !== sql)].slice(0, 10));
      }
    } catch (err: any) {
      setResult({ error: err.message || 'Network error' });
      toast({ title: 'Error', description: err.message || 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!result?.rows || result.rows.length === 0) return;
    const headers = Object.keys(result.rows[0]);
    const csvLines = [
      headers.join(','),
      ...result.rows.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      ),
    ];
    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyResult = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setSql('');
    setResult(null);
  };

  const formatValue = (val: any): string => {
    if (val === null) return 'NULL';
    if (val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  };

  const quickQueries = [
    { label: 'List tables', sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" },
    { label: 'Count products', sql: 'SELECT COUNT(*) as total_products FROM products;' },
    { label: 'Recent orders', sql: 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;' },
    { label: 'List categories', sql: 'SELECT * FROM categories ORDER BY sort_order;' },
    { label: 'Table columns', sql: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Database className="h-6 w-6 text-blue-900" />
                Supabase SQL Runner
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Connect to your Supabase database and run SQL queries directly.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - quick queries & history */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Queries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickQueries.map((q) => (
                  <Button
                    key={q.label}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => setSql(q.sql)}
                  >
                    {q.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Queries</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {history.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setSql(q)}
                      className="w-full text-left text-xs text-gray-600 hover:text-blue-700 truncate p-2 rounded-lg hover:bg-gray-50"
                    >
                      {q.substring(0, 60)}{q.length > 60 ? '...' : ''}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main content - query editor & results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Connection string (optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Connection (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="connection" className="text-xs text-gray-500">
                  Leave empty to use the server's default Supabase connection. Or enter a custom connection: URL|KEY format.
                </Label>
                <Input
                  id="connection"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="https://your-project.supabase.co|eyJhbGci..."
                  className="mt-2 font-mono text-xs"
                />
              </CardContent>
            </Card>

            {/* SQL Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">SQL Query</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearAll}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                    <Button onClick={runQuery} disabled={loading} className="bg-blue-900 hover:bg-blue-800">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Query
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  ref={textareaRef}
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="Enter your SQL query here..."
                  className="font-mono text-sm min-h-[200px] resize-y"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      runQuery();
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Tip: Press Ctrl/Cmd + Enter to run the query
                </p>
              </CardContent>
            </Card>

            {/* Results */}
            {result && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {result.error ? 'Error' : `Results${result.rowCount !== undefined ? ` (${result.rowCount} rows)` : ''}`}
                    </CardTitle>
                    {result.rows && result.rows.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyResult}>
                          {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                          {copied ? 'Copied' : 'Copy JSON'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportCsv}>
                          <Download className="w-4 h-4 mr-1" />
                          Export CSV
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {result.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm text-red-700 font-medium">{result.error}</p>
                      {result.hint && (
                        <div className="mt-3 rounded-md bg-white border border-red-100 p-3">
                          <p className="text-xs text-gray-600 mb-1">💡 Setup hint:</p>
                          <code className="text-xs text-blue-700 font-mono whitespace-pre-wrap">{result.hint}</code>
                        </div>
                      )}
                    </div>
                  ) : result.rows && result.rows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {Object.keys(result.rows[0]).map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-xs truncate" title={formatValue(val)}>
                                  {formatValue(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Query executed successfully. No rows returned.</p>
                      {result.rowCount !== undefined && (
                        <p className="text-xs text-gray-400 mt-1">{result.rowCount} row(s) affected</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
