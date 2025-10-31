import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Removed Table import as we're using Card layout instead
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Users, Briefcase, Clock, TrendingUp } from "lucide-react";

interface EmployeeStat {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department: string;
  position: string;
  project_count: number;
  total_allocation: number;
  timesheet_count: number;
  total_hours_logged: number;
  timesheet_entry_count: number;
  billable_entries: number;
  non_billable_entries: number;
  internal_entries: number;
  projects: Array<{
    project_id: string;
    project_name: string;
    role: string;
    allocation_percent: number;
    start_date: string;
    end_date: string | null;
  }>;
}

export default function EmployeeStats() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<EmployeeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const data = await api.getEmployeeStats(params);
      setStats(data || []);
    } catch (error: any) {
      console.error('Error fetching employee stats:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch employee statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchStats();
  };

  if (userRole !== 'hr' && userRole !== 'director' && userRole !== 'ceo') {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Employee Statistics</h1>
            <p className="text-muted-foreground">View project allocations and timesheet statistics by employee</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilter} className="w-full">Apply Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading employee statistics...</p>
            </CardContent>
          </Card>
        ) : stats.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No employee statistics found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {stats.map((stat) => (
              <Card key={stat.employee_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{stat.employee_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{stat.employee_email}</p>
                      {stat.department && (
                        <Badge variant="outline" className="mt-2">{stat.department} • {stat.position}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Active Projects</p>
                        <p className="text-lg font-semibold">{stat.project_count}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Allocation</p>
                        <p className="text-lg font-semibold">{Number(stat.total_allocation) || 0}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Hours Logged</p>
                        <p className="text-lg font-semibold">{Number(stat.total_hours_logged) || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Timesheets</p>
                        <p className="text-lg font-semibold">{stat.timesheet_count}</p>
                      </div>
                    </div>
                  </div>

                  {stat.projects && stat.projects.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold mb-2">Active Project Assignments</h3>
                      <div className="space-y-2">
                        {stat.projects.map((proj) => (
                          <div key={proj.project_id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <p className="font-medium">{proj.project_name}</p>
                              {proj.role && <p className="text-sm text-muted-foreground">Role: {proj.role}</p>}
                              <p className="text-xs text-muted-foreground">
                                {proj.start_date} - {proj.end_date || 'Ongoing'}
                              </p>
                            </div>
                            <Badge>{proj.allocation_percent}%</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Billable Entries</p>
                      <p className="text-lg font-semibold">{stat.billable_entries}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Non-Billable</p>
                      <p className="text-lg font-semibold">{stat.non_billable_entries}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Internal</p>
                      <p className="text-lg font-semibold">{stat.internal_entries}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

