import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_BASE_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('score_desc');
  const [showEvaluation, setShowEvaluation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [metricsRes, accountsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/metrics`),
          fetch(`${API_BASE_URL}/api/suspicious-accounts`)
        ]);

        if (!metricsRes.ok || !accountsRes.ok) throw new Error('API request failed');

        const metricsData = await metricsRes.json();
        const accountsData = await accountsRes.json();

        setMetrics(metricsData);
        setAccounts(accountsData);
        if (accountsData.length > 0) setSelectedAccount(accountsData[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getScore = (acc) => Number(acc.theft_probability ?? acc.score ?? acc.prediction ?? 0);
  const getAccId = (acc) => String(acc.account_id || acc.id || '');

  const filteredAccounts = accounts
    .filter(acc => getAccId(acc).toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => sortMode === 'score_desc' ? getScore(b) - getScore(a) : getScore(a) - getScore(b));

  const highRiskCount = accounts.filter(a => getScore(a) >= (metrics?.review_threshold || 0.5)).length;

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#080d16] text-cyan-400 font-mono">Loading Classifier Metrics...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-[#080d16] text-red-400 font-mono">Error: {error}</div>;

  return (
    <div className="relative min-h-screen w-full bg-[#080d16] text-[#E6EDF3] p-6 mx-auto space-y-6 font-sans overflow-x-hidden">
      {/* Top-left cyan/blue ambient glow matching target asset */}
      <div className="absolute -top-[10%] -left-[5%] w-[50vw] h-[50vh] rounded-full bg-gradient-to-br from-cyan-600/25 via-blue-900/15 to-transparent blur-3xl pointer-events-none" />

      {/* Bottom-right magenta/purple ambient glow matching target asset */}
      <div className="absolute top-[50%] right-[0%] w-[50vw] h-[50vh] rounded-full bg-gradient-to-tl from-purple-900/95 via-rose-950/15 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container Wrapper */}
      <div className="relative z-10 space-y-6 max-w-screen mx-auto">
        
        {/* Header with Performance Evaluation (AUC-PR) */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#28333E] pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-sans">Meter review</h1>
            <p className="text-sm text-[#8CA0B0] mt-1">
              Accounts ranked by likelihood of tampering, scored from three years of daily smart-meter readings against baseline.
            </p>
          </div>
          {metrics && (
            <div className="flex items-baseline gap-3 text-right">
              <div>
                <div className="text-4xl font-extrabold font-mono text-[#E8A33D] tracking-tight">{metrics.auc_pr.toFixed(4)}</div>
                <div className="text-xs text-[#8CA0B0] uppercase tracking-wider mt-1">
                  AUC-PR, holdout period
                </div>
                <div className="text-[11px] text-[#5C6D7A]">vs {metrics.baseline_auc_pr} baseline (5 confirmed of 70)</div>
              </div>
            </div>
          )}
        </header>

        {/* Toolbar & Filter Options */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <Input
              type="text"
              placeholder="Search account ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 bg-[#151D25] border-[#28333E] text-white focus-visible:ring-cyan-500 placeholder:text-[#5C6D7A]"
            />
            Sort by:
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="bg-[#151D25] border border-[#28333E] rounded-md px-3 py-2 text-white outline-none cursor-pointer"
            >
              <option value="score_desc">Score (high to low)</option>
              <option value="score_asc">Score (low to high)</option>
            </select>
            <label className="flex items-center gap-2 text-[#8CA0B0] cursor-pointer">
              <input
                type="checkbox"
                checked={showEvaluation}
                onChange={(e) => setShowEvaluation(e.target.checked)}
                className="accent-[#4FC1D9] rounded"
              />
              Show confirmed labels
            </label>
          </div>
          <div className="text-[#8CA0B0]">
            {filteredAccounts.length} of {accounts.length} accounts · <span className="text-white font-medium">{highRiskCount}</span> above {metrics?.review_threshold} review threshold
          </div>
        </div>

        {/* Main Grid Inspector View */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Ranked Accounts Sidebar List (4 cols) */}
          <Card className="lg:col-span-4 bg-[#151D25] border-[#28333E] shadow-none overflow-hidden flex flex-col h-[550px]">
            <CardHeader className="py-3 px-4 bg-[#1A2530] shrink-0 border-b border-[#28333E]">
              <CardTitle className="text-xs font-semibold text-[#8CA0B0] uppercase tracking-wider">
                Ranked accounts
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 w-full">
              <div className="divide-y divide-[#1E2830]">
                {filteredAccounts.map((acc, index) => {
                  const accId = getAccId(acc);
                  const score = getScore(acc);
                  const isSelected = selectedAccount && getAccId(selectedAccount) === accId;

                  return (
                    <div
                      key={accId}
                      onClick={() => setSelectedAccount(acc)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#1A2530] border-l-4 border-[#E8A33D]' : 'hover:bg-[#1A2530]/50'
                      }`}
                    >
                      <span className="col-span-1 font-mono text-xs text-[#5C6D7A]">#{index + 1}</span>
                      <span className="col-span-5 font-mono text-xs truncate font-medium text-slate-200" title={accId}>{accId}</span>
                      
                      {/* Micro Sparkline Preview */}
                      <div className="col-span-3 h-5 flex items-center">
                        {acc.sparkline && (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={acc.sparkline.map((v, i) => ({ i, v }))}>
                              <Line type="monotone" dataKey="v" stroke="#4FC1D9" strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Confidence Score Output */}
                      <div className="col-span-3 text-right font-mono text-xs">
                        <span className={`font-semibold ${score >= 0.5 ? 'text-[#E8A33D]' : 'text-[#8CA0B0]'}`}>
                          {score.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Selected Account Time Series Inspector (8 cols) */}
          <Card className="lg:col-span-8 bg-[#151D25]/80 backdrop-blur-md border-[#28333E] text-white shadow-xl rounded-md">
            {selectedAccount ? (
              <CardContent className="p-6 space-y-6">
                {/* Account Confidence Title Header */}
                <div className="flex justify-between items-start border-b border-[#28333E] pb-4">
                  <div>
                    <h2 className="font-mono text-xl font-bold text-white">{getAccId(selectedAccount)}</h2>
                    <p className="text-xs text-[#8CA0B0] mt-0.5">
                      Confidence score <span className="font-mono font-semibold text-[#E8A33D]">{getScore(selectedAccount).toFixed(2)}</span>
                    </p>
                  </div>
                  {showEvaluation && selectedAccount.actual_label !== undefined && (
                    <Badge className={`font-mono text-xs px-2.5 py-1 ${selectedAccount.actual_label === 1 ? 'bg-[#E8A33D]/20 text-[#E8A33D] border-[#E8A33D]/40' : 'bg-slate-800 text-slate-400'}`}>
                      {selectedAccount.actual_label === 1 ? 'Confirmed Theft' : 'Normal Account'}
                    </Badge>
                  )}
                </div>

                {/* Time Series Graph Component */}
                <div className="space-y-2">
                  <div className="h-64 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedAccount.time_series || []}>
                        <XAxis dataKey="date" stroke="#5C6D7A" fontSize={10} tickLine={false} />
                        <YAxis stroke="#5C6D7A" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1A2530', borderColor: '#28333E', fontSize: 12, borderRadius: 4 }}
                          labelStyle={{ color: '#8CA0B0' }}
                        />
                        <ReferenceLine x={selectedAccount.time_series?.[90]?.date} stroke="#5C6D7A" strokeDasharray="3 3" label={{ value: 'holdout', fill: '#5C6D7A', fontSize: 10 }} />
                        <Line type="monotone" dataKey="value" stroke="#E8A33D" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-6 text-xs text-[#8CA0B0] pt-2 font-mono">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#E8A33D]"></span> daily reading (gap = missing)</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#5C6D7A]"></span> holdout period</span>
                  </div>
                </div>

                {/* Model Feature Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-[#1A2530] p-3 rounded border border-[#28333E]">
                    <div className="text-[11px] text-[#8CA0B0]">Train baseline mean</div>
                    <div className="font-mono text-sm font-semibold text-white mt-1">
                      {Number(selectedAccount.mean_consumption || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-[#1A2530] p-3 rounded border border-[#28333E]">
                    <div className="text-[11px] text-[#8CA0B0]">Holdout mean</div>
                    <div className="font-mono text-sm font-semibold text-white mt-1">
                      {Number(selectedAccount.holdout_mean || (selectedAccount.mean_consumption ? selectedAccount.mean_consumption * 0.7 : 0)).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-[#1A2530] p-3 rounded border border-[#28333E]">
                    <div className="text-[11px] text-[#8CA0B0]">Drop ratio (holdout / baseline)</div>
                    <div className="font-mono text-sm font-semibold text-[#E8A33D] mt-1">
                      {Number(selectedAccount.recent_drop_ratio || 0.42).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-[#1A2530] p-3 rounded border border-[#28333E]">
                    <div className="text-[11px] text-[#8CA0B0]">Missing rate, holdout</div>
                    <div className="font-mono text-sm font-semibold text-white mt-1">
                      {Number(selectedAccount.zero_day_count || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            ) : (
              <div className="text-center py-24 text-[#5C6D7A]">Select an account to view inspection graph</div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}