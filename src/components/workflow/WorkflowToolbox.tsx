import { Play, GitBranch, User, Mail, Clock, Code, Webhook } from "lucide-react";

const nodeTypes = [
  { id: "trigger", name: "Trigger", icon: Play, color: "text-primary" },
  { id: "condition", name: "Condition", icon: GitBranch, color: "text-warning" },
  { id: "approver", name: "Approver", icon: User, color: "text-accent" },
  { id: "email", name: "Email", icon: Mail, color: "text-blue-500" },
  { id: "delay", name: "Delay", icon: Clock, color: "text-purple-500" },
  { id: "script", name: "Script", icon: Code, color: "text-orange-500" },
  { id: "webhook", name: "Webhook", icon: Webhook, color: "text-pink-500" },
];

export function WorkflowToolbox() {
  return (
    <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-20rem)]">
      {nodeTypes.map((node) => (
        <div
          key={node.id}
          className="p-3 border rounded-lg cursor-move hover:bg-muted/50 transition-colors flex items-center gap-3"
          draggable
        >
          <node.icon className={`h-5 w-5 ${node.color}`} />
          <span className="text-sm font-medium">{node.name}</span>
        </div>
      ))}
    </div>
  );
}
