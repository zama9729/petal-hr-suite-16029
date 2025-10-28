import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, Calendar, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const stats = [
  {
    title: "Total Employees",
    value: "248",
    change: "+12% from last month",
    icon: Users,
    trend: "up",
  },
  {
    title: "Pending Approvals",
    value: "23",
    change: "8 timesheets, 15 leaves",
    icon: Clock,
    trend: "neutral",
  },
  {
    title: "Active Leave Requests",
    value: "15",
    change: "5 need approval",
    icon: Calendar,
    trend: "neutral",
  },
  {
    title: "Avg. Attendance",
    value: "94.2%",
    change: "+2.1% from last month",
    icon: TrendingUp,
    trend: "up",
  },
];

const recentActivities = [
  { id: 1, type: "leave", user: "Sarah Johnson", action: "submitted leave request", time: "2 hours ago" },
  { id: 2, type: "timesheet", user: "Mike Chen", action: "submitted timesheet", time: "3 hours ago" },
  { id: 3, type: "approval", user: "Lisa Anderson", action: "approved expense report", time: "4 hours ago" },
  { id: 4, type: "employee", user: "New Employee", action: "joined the organization", time: "1 day ago" },
];

const pendingTasks = [
  { id: 1, title: "Review 8 pending timesheets", priority: "high", link: "/timesheets" },
  { id: 2, title: "Approve 5 leave requests", priority: "high", link: "/leaves" },
  { id: 3, title: "Complete policy configuration", priority: "medium", link: "/policies" },
  { id: 4, title: "Review workflow automations", priority: "low", link: "/workflows" },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your organization</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="transition-all hover:shadow-medium">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Pending Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      task.priority === 'high' ? 'bg-destructive' : 
                      task.priority === 'medium' ? 'bg-warning' : 
                      'bg-muted-foreground'
                    }`} />
                    <span className="text-sm">{task.title}</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={task.link}>View</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/employees/new">
                  <Users className="mr-2 h-4 w-4" />
                  Add Employee
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/employees/import">
                  <Users className="mr-2 h-4 w-4" />
                  Import CSV
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/workflows/new">
                  <Users className="mr-2 h-4 w-4" />
                  Create Workflow
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/policies">
                  <Users className="mr-2 h-4 w-4" />
                  Configure Policies
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
