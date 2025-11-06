import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Play, Pause, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type WorkflowRow = { id: string; name: string; description: string | null; status: string; created_at: string; updated_at: string };

export default function Workflows() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { workflows } = await api.getWorkflows();
        setWorkflows(workflows || []);
      } catch (e) {
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const { workflows } = await api.getWorkflows();
      setWorkflows(workflows || []);
    } finally {
      setLoading(false);
    }
  };

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
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Loading workflows...</CardContent>
            </Card>
          ) : workflows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No workflows created yet</p>
                <p className="text-sm mt-2">Create your first workflow to automate HR processes</p>
              </CardContent>
            </Card>
          ) : (
            workflows.map((workflow) => (
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
                      <CardDescription>{workflow.description || "No description"}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/workflows/${workflow.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon">
                        {workflow.status === "active" ? (
                          <Pause className="h-4 w-4" onClick={async () => { await api.updateWorkflow(workflow.id, { status: 'paused' }); refresh(); }} />
                        ) : (
                          <Play className="h-4 w-4" onClick={async () => { await api.updateWorkflow(workflow.id, { status: 'active' }); refresh(); }} />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={async () => { if (confirm('Delete this workflow?')) { await api.deleteWorkflow(workflow.id); refresh(); } }}>
                        <Trash2 className="h-4 w-4 text-destructive"  />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div>Updated: <span className="font-medium">{new Date(workflow.updated_at).toLocaleString()}</span></div>
                    <div>Created: <span className="font-medium">{new Date(workflow.created_at).toLocaleString()}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
