"use client";
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function Reports() {
  const [data, setData] = useState({ revenue: [], popularItems: [], statusCounts: {}, rawOrders: [] });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, all

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      let startDate = new Date();
      if (dateRange === '7d') startDate.setDate(startDate.getDate() - 7);
      if (dateRange === '30d') startDate.setDate(startDate.getDate() - 30);
      if (dateRange === 'all') startDate = new Date('2020-01-01');

      const res = await fetch(`/api/admin/analytics?startDate=${startDate.toISOString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
      setLoading(false);
    }
    loadData();
  }, [dateRange]);

  const exportCSV = () => {
    if (!data.rawOrders || data.rawOrders.length === 0) return alert('No data to export');
    
    const headers = ['Date', 'Amount (LKR)', 'Status'];
    const rows = data.rawOrders.map(o => [
      new Date(o.date).toLocaleString('en-US'),
      o.amount,
      o.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tableflow_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors = {
    'served': '#4CAF50',
    'ready': '#2196F3',
    'preparing': '#FF9800',
    'pending': '#9E9E9E'
  };

  const pieData = Object.keys(data.statusCounts || {}).map(k => ({
    name: k, value: data.statusCounts[k]
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Reporting & Analytics</h2>
          <p style={{ color: 'var(--text-muted)' }}>Visualize business performance and export data</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="input" 
            style={{ padding: '8px 16px', width: 'auto' }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button className="btn btn-primary" onClick={exportCSV}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading reports...</p>
      ) : (
        <>
          <div className="data-grid">
            <div className="data-card" style={{ gridColumn: 'span 2' }}>
              <div className="data-card-header">
                <h3>Revenue Trends</h3>
              </div>
              <div style={{ height: '300px', width: '100%', padding: '16px 0' }}>
                {data.revenue && data.revenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenue}>
                      <defs>
                        <linearGradient id="colorRevRep" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#B87F5C" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#B87F5C" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `LKR ${val}`} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        itemStyle={{ color: 'var(--primary)' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#B87F5C" strokeWidth={3} fillOpacity={1} fill="url(#colorRevRep)" activeDot={{ r: 6, fill: '#B87F5C' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No revenue data for this period</div>
                )}
              </div>
            </div>

            <div className="data-card">
              <div className="data-card-header">
                <h3>Order Status Volume</h3>
              </div>
              <div style={{ height: '300px', width: '100%', padding: '16px 0', display: 'flex', justifyContent: 'center' }}>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={statusColors[entry.name] || '#999'} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No orders in this period</div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {pieData.map(entry => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColors[entry.name] || '#999' }}></div>
                    {entry.name.toUpperCase()} ({entry.value})
                  </div>
                ))}
              </div>
            </div>

            <div className="data-card">
              <div className="data-card-header">
                <h3>Top Selling Items</h3>
              </div>
              <div style={{ height: '300px', width: '100%', padding: '16px 0' }}>
                {data.popularItems && data.popularItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.popularItems} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                      <Bar dataKey="count" fill="#B87F5C" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No items sold in this period</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
