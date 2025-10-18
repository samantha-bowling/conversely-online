import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface HealthMetrics {
  active_sessions: number;
  searching_users: number;
  active_chats: number;
  recent_messages: number;
  users_online_now: number;
  last_cron_run: string;
}

interface MaintenanceLog {
  job_name: string;
  created_at: string;
  would_close_count: number;
  closed_count: number;
  safety_clamp_triggered: boolean;
}

const HEALTH_CHECK_KEY = 'conversely_last_health_check';
const PASSWORD_KEY = 'conversely_health_password';
const CORRECT_PASSWORD = 'CONVERSELY_HEALTH_2025';
const PASSWORD_EXPIRY_DAYS = 7;

export default function AdminHealth() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Check password on mount
  useEffect(() => {
    const stored = localStorage.getItem(PASSWORD_KEY);
    if (stored) {
      try {
        const { password, expiry } = JSON.parse(stored);
        if (password === CORRECT_PASSWORD && new Date(expiry) > new Date()) {
          setAuthenticated(true);
          return;
        }
      } catch (e) {
        console.error('Invalid stored password');
      }
    }
  }, []);

  // Daily reminder check (9 AM Pacific)
  useEffect(() => {
    if (!authenticated) return;

    const checkReminder = () => {
      const lastCheck = localStorage.getItem(HEALTH_CHECK_KEY);
      const now = new Date();
      
      // Convert to Pacific Time
      const pacificTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hour12: false
      }).format(now);
      
      const currentHourPT = parseInt(pacificTime);
      
      // If it's past 9 AM PT and last check was >36 hours ago
      if (currentHourPT >= 9 && lastCheck) {
        const hoursSinceCheck = (now.getTime() - parseInt(lastCheck)) / (1000 * 60 * 60);
        if (hoursSinceCheck > 36) {
          toast.warning("⏰ Haven't checked system health in over a day!", {
            duration: 10000,
          });
        }
      }
    };

    checkReminder();
  }, [authenticated]);

  const fetchHealth = async () => {
    try {
      // Query 1: Health snapshot
      const { data: healthData, error: healthError } = await supabase.rpc('get_health_snapshot');
      
      if (healthError) {
        console.error('Health check failed:', healthError);
        toast.error('Failed to load health metrics');
        return;
      }

      setMetrics(healthData?.[0] || null);

      // Query 2: Maintenance logs
      const { data: logsData } = await supabase
        .from('maintenance_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setLogs(logsData || []);
      setLastRefresh(new Date());
      
      // Update last check timestamp
      localStorage.setItem(HEALTH_CHECK_KEY, Date.now().toString());
      
      setLoading(false);
    } catch (error) {
      console.error('Health fetch error:', error);
      toast.error('Failed to load health data');
    }
  };

  useEffect(() => {
    if (!authenticated) return;

    fetchHealth();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [authenticated]);

  // Keyboard shortcut: 'r' to refresh
  useEffect(() => {
    if (!authenticated) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetchHealth();
        toast.success('Refreshing health data...');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [authenticated]);

  // Auto-trigger Discord alerts for critical issues
  useEffect(() => {
    if (!logs || logs.length === 0 || !metrics) return;

    const latestLog = logs[0];
    
    // Only trigger if safety clamp happened in last 10 minutes
    const logAge = Date.now() - new Date(latestLog.created_at).getTime();
    if (latestLog.safety_clamp_triggered && logAge < 10 * 60 * 1000) {
      const isProd = !window.location.hostname.includes('localhost');
      
      if (isProd) {
        supabase.functions.invoke('send-discord-alert', {
          body: {
            title: 'Safety Clamp Triggered',
            message: `${latestLog.would_close_count} rooms were eligible for closure. Cleanup aborted to prevent mass disconnections.`,
            severity: 'P0',
            metadata: {
              job: latestLog.job_name,
              would_close: latestLog.would_close_count,
              timestamp: latestLog.created_at
            }
          }
        });
      }
    }

    // Check for stuck matching queue
    if (metrics.searching_users > 20) {
      const isProd = !window.location.hostname.includes('localhost');
      
      if (isProd) {
        supabase.functions.invoke('send-discord-alert', {
          body: {
            title: 'Matching Queue Critical',
            message: `${metrics.searching_users} users stuck in matching queue (threshold: 20)`,
            severity: 'P0',
            metadata: {
              searching_users: metrics.searching_users,
              active_chats: metrics.active_chats,
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    }
  }, [logs, metrics]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordInput === CORRECT_PASSWORD) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + PASSWORD_EXPIRY_DAYS);
      
      localStorage.setItem(PASSWORD_KEY, JSON.stringify({
        password: CORRECT_PASSWORD,
        expiry: expiry.toISOString()
      }));
      
      setAuthenticated(true);
      toast.success('Access granted');
    } else {
      toast.error('Incorrect password');
      setPasswordInput('');
    }
  };

  const getHealthStatus = () => {
    if (!metrics) return '🟡';
    
    // Critical checks
    if (logs[0]?.safety_clamp_triggered) return '🔴';
    if (metrics.searching_users > 20) return '🔴';
    
    // Warning checks
    if (metrics.searching_users > 10) return '🟡';
    
    // Check last cron run (should be <10 min ago)
    if (metrics.last_cron_run) {
      const lastCron = new Date(metrics.last_cron_run);
      const minsSinceLastCron = (Date.now() - lastCron.getTime()) / (1000 * 60);
      if (minsSinceLastCron > 10) return '🟡';
    }
    
    return '🟢';
  };

  const getCronStatus = () => {
    if (!metrics?.last_cron_run) return { text: 'Unknown', color: 'text-muted-foreground' };
    
    const lastCron = new Date(metrics.last_cron_run);
    const minsSince = Math.floor((Date.now() - lastCron.getTime()) / (1000 * 60));
    
    if (minsSince < 6) return { text: `${minsSince}m ago`, color: 'text-green-600' };
    if (minsSince < 10) return { text: `${minsSince}m ago`, color: 'text-yellow-600' };
    return { text: `${minsSince}m ago ⚠`, color: 'text-red-600' };
  };

  // Password gate UI
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Admin Health Dashboard</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Enter password to access system health metrics
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Access Dashboard
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-4">
            Password valid for {PASSWORD_EXPIRY_DAYS} days
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading health metrics...</div>
      </div>
    );
  }

  const cronStatus = getCronStatus();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {getHealthStatus()} System Health
        </h1>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">
            Last DB sync: {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
          <div className={`text-xs ${cronStatus.color}`}>
            Last cron: {cronStatus.text}
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-3xl font-bold">{metrics?.active_sessions || 0}</div>
            <div className="text-sm text-muted-foreground">Active Sessions</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{metrics?.searching_users || 0}</div>
            <div className="text-sm text-muted-foreground">Searching</div>
            {(metrics?.searching_users || 0) > 10 && (
              <div className="text-xs text-orange-500 mt-1">⚠ High queue</div>
            )}
            {(metrics?.searching_users || 0) > 20 && (
              <div className="text-xs text-red-500 mt-1">🚨 Critical queue</div>
            )}
          </div>
          <div>
            <div className="text-3xl font-bold">{metrics?.active_chats || 0}</div>
            <div className="text-sm text-muted-foreground">Active Chats</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{metrics?.recent_messages || 0}</div>
            <div className="text-sm text-muted-foreground">Messages (2m)</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{metrics?.users_online_now || 0}</div>
            <div className="text-sm text-muted-foreground">Online Now</div>
          </div>
        </div>
      </Card>

      {/* Maintenance Logs */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Maintenance Jobs (Last 10)</h2>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance logs yet</p>
          ) : (
            logs.map((log, idx) => (
              <div 
                key={idx}
                className={`flex justify-between items-center p-3 rounded ${
                  log.safety_clamp_triggered 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-muted/50'
                }`}
              >
                <div>
                  <span className="font-medium">{log.job_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(log.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
                <div className="text-sm">
                  {log.safety_clamp_triggered ? (
                    <span className="text-red-600 font-bold">
                      🚨 CLAMP TRIGGERED ({log.would_close_count} rooms)
                    </span>
                  ) : (
                    <span>
                      Closed: {log.closed_count} / Eligible: {log.would_close_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4 flex-wrap">
          <button 
            onClick={fetchHealth}
            className="px-4 py-2 bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            Refresh Now <span className="text-xs text-muted-foreground ml-2">(or press 'r')</span>
          </button>
          <a
            href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/logs`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            View Logs →
          </a>
        </div>
      </Card>

      {/* Help Text */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>🟢 Healthy:</strong> All systems normal • 
          <strong className="ml-2">🟡 Warning:</strong> Minor issues detected • 
          <strong className="ml-2">🔴 Critical:</strong> Immediate action required
        </p>
      </Card>
    </div>
  );
}
