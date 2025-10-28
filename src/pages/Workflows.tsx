import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Play, Pause, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const mockWorkflows = [
  {
    id: 1,
    name: "Leave Approval Flow",
    description: "Automatically route leave requests based on department and duration",
    status: "active",
    lastRun: "2 hours ago",
    runs: 145,
  },
  {
    id: 2,
    name: "Expense Approval (>$1000)",
    description: "Escalate high-value expenses to finance manager",
    status: "active",
    lastRun: "5 hours ago",
    runs: 89,
  },
  {
    id: 3,
    name: "New Employee Onboarding",
    description: "Send welcome emails and assign onboarding tasks",
    status: "draft",
    lastRun: "Never",
    runs: 0,
  },
  {
    id: 4,
    name: "Timesheet Reminder",
    description: "Weekly reminder for pending timesheets",
    status: "paused",
    lastRun: "3 days ago",
    runs: 234,
  },
];

export default function Workflows() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">Automate your HR processes</p>
          </div>
          <Button asChild>
            <Link to="/workflows/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {mockWorkflows.map((workflow) => (
            <Card key={workflow.id} className="transition-all hover:shadow-medium">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{workflow.name}</CardTitle>
                      <Badge
                        variant={
                          workflow.status === "active"
                            ? "default"
                            : workflow.status === "paused"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {workflow.status}
                      </Badge>
                    </div>
                    <CardDescription>{workflow.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/workflows/${workflow.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon">
                      {workflow.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">{workflow.runs}</span> total runs
                  </div>
                  <div>
                    Last run: <span className="font-medium">{workflow.lastRun}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
