import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Timesheet {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_hours: number;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  employee: {
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
  reviewer?: {
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
}

export default function Timesheets() {
  const [myTimesheets, setMyTimesheets] = useState<Timesheet[]>([]);
  const [teamTimesheets, setTeamTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get current employee ID first
      const { data: currentEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!currentEmployee) {
        setLoading(false);
        return;
      }

      // Fetch my timesheets with proper joins
      const { data: myData, error: myError } = await supabase
        .from("timesheets")
        .select(`
          *,
          employee:employees!timesheets_employee_id_fkey(
            id,
            employee_id,
            profiles:profiles!employees_user_id_fkey(first_name, last_name)
          ),
          reviewer:employees!timesheets_reviewed_by_fkey(
            id,
            profiles:profiles!employees_user_id_fkey(first_name, last_name)
          )
        `)
        .eq("employee_id", currentEmployee.id)
        .order("submitted_at", { ascending: false });

      if (myError) {
        console.error("Error fetching my timesheets:", myError);
      } else if (myData) {
        setMyTimesheets(myData as any);
      }

      // Fetch team timesheets if manager or above
      if (userRole && ["manager", "hr", "director", "ceo"].includes(userRole)) {
        const { data: teamData, error: teamError } = await supabase
          .from("timesheets")
          .select(`
            *,
            employee:employees!timesheets_employee_id_fkey(
              id,
              employee_id,
              reporting_manager_id,
              profiles:profiles!employees_user_id_fkey(first_name, last_name)
            ),
            reviewer:employees!timesheets_reviewed_by_fkey(
              id,
              profiles:profiles!employees_user_id_fkey(first_name, last_name)
            )
          `)
          .eq("status", "pending")
          .order("submitted_at", { ascending: false });

        if (teamError) {
          console.error("Error fetching team timesheets:", teamError);
        } else if (teamData) {
          // Filter to only show timesheets from direct reports
          const filteredTeam = teamData.filter(
            (ts: any) => ts.employee?.reporting_manager_id === currentEmployee.id
          );
          setTeamTimesheets(filteredTeam as any);
        }
      }
    } catch (error) {
      console.error("Error fetching timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (timesheetId: string) => {
    const { data: employeeData } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    const { error } = await supabase
      .from("timesheets")
      .update({
        status: "approved",
        reviewed_by: employeeData?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", timesheetId);

    if (error) {
      toast({ title: "Error", description: "Failed to approve timesheet", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Timesheet approved" });
      fetchData();
    }
  };

  const handleReject = async (timesheetId: string, reason: string) => {
    const { data: employeeData } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    const { error } = await supabase
      .from("timesheets")
      .update({
        status: "rejected",
        reviewed_by: employeeData?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", timesheetId);

    if (error) {
      toast({ title: "Error", description: "Failed to reject timesheet", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Timesheet rejected" });
      fetchData();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { data: employeeData } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    if (!employeeData) return;

    const { error } = await supabase.from("timesheets").insert({
      employee_id: employeeData.id,
      week_start_date: formData.get("week_start_date") as string,
      week_end_date: formData.get("week_end_date") as string,
      total_hours: parseFloat(formData.get("total_hours") as string),
    });

    if (error) {
      toast({ title: "Error", description: "Failed to submit timesheet", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Timesheet submitted for approval" });
      setDialogOpen(false);
      fetchData();
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-12">Loading timesheets...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">Manage time tracking and approvals</p>
        </div>

        <Tabs defaultValue={userRole && ["manager", "hr", "director", "ceo"].includes(userRole) ? "approvals" : "my-timesheets"}>
          <TabsList>
            {userRole && ["manager", "hr", "director", "ceo"].includes(userRole) && (
              <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
            )}
            <TabsTrigger value="my-timesheets">My Timesheets</TabsTrigger>
          </TabsList>

          {userRole && ["manager", "hr", "director", "ceo"].includes(userRole) && (
            <TabsContent value="approvals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                  <CardDescription>Review and approve team timesheets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {teamTimesheets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No pending timesheet approvals</p>
                    </div>
                  ) : (
                    teamTimesheets.map((timesheet) => (
                      <div
                        key={timesheet.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {timesheet.employee?.profiles?.first_name || "Unknown"} {timesheet.employee?.profiles?.last_name || "Employee"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Week: {new Date(timesheet.week_start_date).toLocaleDateString()} - {new Date(timesheet.week_end_date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">{timesheet.total_hours} hours total</p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {new Date(timesheet.submitted_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = prompt("Enter rejection reason:");
                              if (reason) handleReject(timesheet.id, reason);
                            }}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(timesheet.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="my-timesheets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Timesheets</CardTitle>
                    <CardDescription>Your timesheet submission history</CardDescription>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Submit New Timesheet
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Submit Timesheet</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="week_start_date">Week Start Date</Label>
                          <Input type="date" name="week_start_date" required />
                        </div>
                        <div>
                          <Label htmlFor="week_end_date">Week End Date</Label>
                          <Input type="date" name="week_end_date" required />
                        </div>
                        <div>
                          <Label htmlFor="total_hours">Total Hours</Label>
                          <Input type="number" step="0.5" name="total_hours" required />
                        </div>
                        <Button type="submit" className="w-full">Submit Timesheet</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {myTimesheets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No timesheets submitted yet</p>
                    <p className="text-sm mt-2">Submit your first timesheet to get started</p>
                  </div>
                ) : (
                  myTimesheets.map((timesheet) => (
                    <div
                      key={timesheet.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Week: {new Date(timesheet.week_start_date).toLocaleDateString()} - {new Date(timesheet.week_end_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">{timesheet.total_hours} hours</p>
                          {timesheet.status === "approved" && timesheet.reviewer?.profiles && (
                            <p className="text-xs text-muted-foreground">
                              Approved by {timesheet.reviewer.profiles.first_name} {timesheet.reviewer.profiles.last_name}
                            </p>
                          )}
                          {timesheet.status === "rejected" && (
                            <p className="text-xs text-destructive">{timesheet.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          timesheet.status === "approved"
                            ? "default"
                            : timesheet.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {timesheet.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
