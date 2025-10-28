import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Upload, Download, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const mockEmployees = [
  { id: 1, name: "Sarah Johnson", email: "sarah.j@company.com", role: "Software Engineer", department: "Engineering", status: "active", joinDate: "2023-01-15" },
  { id: 2, name: "Mike Chen", email: "mike.c@company.com", role: "Product Manager", department: "Product", status: "active", joinDate: "2022-11-20" },
  { id: 3, name: "Lisa Anderson", email: "lisa.a@company.com", role: "HR Manager", department: "Human Resources", status: "active", joinDate: "2021-06-10" },
  { id: 4, name: "James Wilson", email: "james.w@company.com", role: "Designer", department: "Design", status: "active", joinDate: "2023-03-01" },
  { id: 5, name: "Emily Brown", email: "emily.b@company.com", role: "Sales Lead", department: "Sales", status: "on-leave", joinDate: "2022-08-15" },
];

export default function Employees() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Employees</h1>
            <p className="text-muted-foreground">Manage your organization's workforce</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/employees/import">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Link>
            </Button>
            <Button asChild>
              <Link to="/employees/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockEmployees.map((employee) => (
                    <TableRow key={employee.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to={`/employees/${employee.id}`} className="hover:underline">
                          {employee.name}
                        </Link>
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{new Date(employee.joinDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/employees/${employee.id}`}>View Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
