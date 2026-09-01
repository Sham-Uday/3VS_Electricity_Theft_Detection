import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const API_BASE_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsRes, accountsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/metrics`),
        fetch(`${API_BASE_URL}/api/suspicious-accounts`)
      ]);

      if (!metricsRes.ok || !accountsRes.ok) {
        throw new Error('Failed to connect to backend server');
      }

      const metricsData = await metricsRes.json();
      const accountsData = await accountsRes.json();

      if (accountsData.error) {
        setError(accountsData.error);
      } else {
        setMetrics(metricsData);
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          setSelectedAccount(accountsData[0]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAccounts = accounts.filter(acc => {
    const idStr = String(acc.account_id || acc.id || '');
    return idStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getScore = (acc) => {
    const val = acc.theft_probability ?? acc.anomaly_score ?? acc.score ?? acc.prediction ?? 0;
    return Number(val) || 0;
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 font-mono gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        <p className="text-sm text-slate-400">Loading Dashboard Metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 p-4 font-mono gap-4">
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6 max-w-md text-center">
          <h2 className="text-lg font-bold text-red-400 mb-2">API Connection Failed</h2>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchData} className="border-red-500/50 text-red-400 hover:bg-red-500/10">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">Electricity Theft Detection</h1>
          <p className="text-sm text-slate-400 mt-1">Consumption Anomaly Ranking & Target Inspector</p>
        </div>
        {metrics && (
          <div className="flex gap-8 text-right">
            <div>
              <div className="text-3xl font-bold font-mono text-cyan-400">{metrics.auc_pr}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">AUC-PR Score</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-cyan-400">{metrics.scanned_meters?.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Scanned Meters</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-amber-400">{metrics.flagged_accounts}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Flagged Accounts</div>
            </div>
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="flex justify-between items-center gap-4">
        <Input
          type="text"
          placeholder="Search Account ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-cyan-500 placeholder:text-slate-500"
        />
        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-200">{filteredAccounts.length}</span> of <span className="font-semibold text-slate-200">{accounts.length}</span> accounts
        </div>
      </div>

      {/* Main Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Accounts List (5 cols) */}
        <Card className="lg:col-span-5 bg-slate-900 border-slate-800 text-slate-100 shadow-none">
          <CardHeader className="border-b border-slate-800 py-3.5 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Suspicious Accounts (Top 100)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[620px] overflow-y-auto divide-y divide-slate-800/60">
            {filteredAccounts.map((acc, index) => {
              const accId = String(acc.account_id || acc.id || `Acc-${index + 1}`);
              const score = getScore(acc);
              const isSelected = selectedAccount && String(selectedAccount.account_id || selectedAccount.id) === accId;

              return (
                <div
                  key={accId}
                  onClick={() => setSelectedAccount(acc)}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-800/90 border-l-4 border-amber-400' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <span className="col-span-1 font-mono text-xs text-slate-500">#{index + 1}</span>
                  <span className="col-span-7 font-mono text-xs truncate text-slate-200" title={accId}>
                    {accId}
                  </span>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <Progress value={score * 100} className="h-1.5 bg-slate-800 [&>div]:bg-amber-400 flex-1" />
                    <span className="font-mono text-xs text-amber-400 font-semibold w-10 text-right">
                      {score.toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Detail Panel (7 cols) */}
        <Card className="lg:col-span-7 bg-slate-900 border-slate-800 text-slate-100 shadow-none">
          <CardHeader className="border-b border-slate-800 py-3.5 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Account Details Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {selectedAccount ? (
              <div className="space-y-6">
                <div className="border-b border-slate-800/80 pb-4">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Selected Account</span>
                  <h3 className="font-mono text-lg font-semibold text-cyan-400 break-all mt-0.5">
                    {selectedAccount.account_id || selectedAccount.id}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(selectedAccount).map(([key, val]) => {
                    const isHighRisk = key === 'theft_probability' && Number(val) > 0.5;
                    const isConfirmed = key === 'actual_label' && Number(val) === 1;

                    return (
                      <div
                        key={key}
                        className={`p-4 rounded-lg border transition-all ${
                          isHighRisk
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className={`font-mono text-lg font-medium mt-1 ${isHighRisk ? 'text-amber-400' : 'text-slate-100'}`}>
                          {typeof val === 'number' ? val.toFixed(4) : String(val)}
                        </div>
                        {isConfirmed && (
                          <Badge className="mt-2 text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30">
                            Confirmed Theft
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">Select an account to view detailed metrics</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}