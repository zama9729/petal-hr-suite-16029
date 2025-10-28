import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";

const pendingTimesheets = [
  { id: 1, employee: "Sarah Johnson", week: "Dec 18-24", hours: 40, submitted: "1 day ago" },
  { id: 2, employee: "Mike Chen", week: "Dec 18-24", hours: 38, submitted: "2 days ago" },
  { id: 3, employee: "Lisa Anderson", week: "Dec 18-24", hours: 42, submitted: "3 days ago" },
];

const myTimesheets = [
  { id: 1, week: "Dec 18-24", hours: 40, status: "approved", approvedBy: "John Manager" },
  { id: 2, week: "Dec 11-17", hours: 42, status: "approved", approvedBy: "John Manager" },
  { id: 3, week: "Dec 4-10", hours: 38, status: "rejected", reason: "Missing project codes" },
];

export default function Timesheets() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">Manage time tracking and approvals</p>
        </div>

        <Tabs defaultValue="approvals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
            <TabsTrigger value="my-timesheets">My Timesheets</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Review and approve team timesheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingTimesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{timesheet.employee}</p>
                        <p className="text-sm text-muted-foreground">
                          Week: {timesheet.week} • {timesheet.hours} hours
                        </p>
                        <p className="text-xs text-muted-foreground">Submitted {timesheet.submitted}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">View Details</Button>
                      <Button size="sm" variant="outline">
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button size="sm">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-timesheets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Timesheets</CardTitle>
                    <CardDescription>Your timesheet submission history</CardDescription>
                  </div>
                  <Button>Submit New Timesheet</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {myTimesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Week: {timesheet.week}</p>
                        <p className="text-sm text-muted-foreground">{timesheet.hours} hours</p>
                        {timesheet.status === "approved" && (
                          <p className="text-xs text-muted-foreground">
                            Approved by {timesheet.approvedBy}
                          </p>
                        )}
                        {timesheet.status === "rejected" && (
                          <p className="text-xs text-destructive">{timesheet.reason}</p>
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
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
