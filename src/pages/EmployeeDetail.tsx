import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import EmployeeSkillsEditor from '@/components/EmployeeSkillsEditor';
import EmployeeCertificationsEditor from '@/components/EmployeeCertificationsEditor';
import EmployeePastProjectsEditor from '@/components/EmployeePastProjectsEditor';
import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Pencil, Save, X } from 'lucide-react';

interface EmployeeData {
  id: string;
  employee_id: string;
  department: string;
  position: string;
  work_location: string;
  join_date: string;
  status: string;
  reporting_manager_id?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [myEmployeeId, setMyEmployeeId] = useState<string>('');
  const [defaultTab, setDefaultTab] = useState<string>('overview');
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: '',
    department: '',
    position: '',
    workLocation: '',
    joinDate: '',
    status: '',
    reportingManagerId: '',
  });
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getEmployeeId();
        setMyEmployeeId(me?.id || '');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (id) {
      fetchEmployee();
      fetchManagers();
    }
  }, [id]);

  const fetchEmployee = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getEmployee(id);
      setEmployee(data);
      setFormData({
        firstName: data.profiles?.first_name || '',
        lastName: data.profiles?.last_name || '',
        email: data.profiles?.email || '',
        phone: data.profiles?.phone || '',
        employeeId: data.employee_id || '',
        department: data.department || '',
        position: data.position || '',
        workLocation: data.work_location || '',
        joinDate: data.join_date || '',
        status: data.status || 'active',
        reportingManagerId: data.reporting_manager_id || '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load employee details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const employees = await api.getEmployees();
      // Get all employees and check their roles from user_roles
      // For now, include all employees as potential managers (will be filtered properly via backend)
      const managerList = employees
        .map((emp: any) => ({
          id: emp.id,
          name: `${emp.profiles?.first_name || ''} ${emp.profiles?.last_name || ''}`.trim(),
        }))
        .filter((mgr: any) => mgr.name); // Only include those with names
      setManagers(managerList);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  // Check for tab query parameter in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'skills' || tab === 'certs' || tab === 'projects' || tab === 'overview') {
      setDefaultTab(tab);
    }
  }, [searchParams]);

  // CEO/HR/Director can edit
  const canEdit = userRole && ['hr', 'ceo', 'director'].includes(userRole);
  const canView = canEdit || (userRole === 'employee' && myEmployeeId && id === myEmployeeId);

  const handleSave = async () => {
    if (!id) return;
    try {
      await api.updateEmployee(id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.employeeId,
        department: formData.department,
        position: formData.position,
        workLocation: formData.workLocation,
        joinDate: formData.joinDate,
        status: formData.status,
        reportingManagerId: formData.reportingManagerId || null,
      });
      
      toast({
        title: 'Success',
        description: 'Employee details updated successfully',
      });
      
      setIsEditing(false);
      fetchEmployee();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl">
          <div className="text-center py-12">Loading employee details...</div>
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl">
          <div className="text-center py-12 text-muted-foreground">Employee not found</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {employee.profiles?.first_name} {employee.profiles?.last_name}
          </h1>
          {canEdit && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); fetchEmployee(); }}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" /> Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          )}
        </div>
        <Tabs defaultValue={defaultTab} value={defaultTab} onValueChange={setDefaultTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certs">Certifications</TabsTrigger>
            <TabsTrigger value="projects">Past Projects</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Employee Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID *</Label>
                      <Input
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department *</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position *</Label>
                      <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workLocation">Work Location</Label>
                      <Input
                        id="workLocation"
                        value={formData.workLocation}
                        onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="joinDate">Join Date *</Label>
                      <Input
                        id="joinDate"
                        type="date"
                        value={formData.joinDate}
                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        required
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reportingManagerId">Reporting Manager</Label>
                      <select
                        id="reportingManagerId"
                        value={formData.reportingManagerId}
                        onChange={(e) => setFormData({ ...formData, reportingManagerId: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      >
                        <option value="">None</option>
                        {managers.map((mgr) => (
                          <option key={mgr.id} value={mgr.id}>
                            {mgr.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">First Name</Label>
                      <p className="font-medium">{employee.profiles?.first_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Name</Label>
                      <p className="font-medium">{employee.profiles?.last_name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{employee.profiles?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{employee.profiles?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Employee ID</Label>
                      <p className="font-medium">{employee.employee_id || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="font-medium">{employee.department || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Position</Label>
                      <p className="font-medium">{employee.position || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Work Location</Label>
                      <p className="font-medium">{employee.work_location || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Join Date</Label>
                      <p className="font-medium">{employee.join_date ? new Date(employee.join_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="font-medium capitalize">{employee.status || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="skills">{id && canView && <EmployeeSkillsEditor employeeId={id} canEdit={canEdit} />}</TabsContent>
          <TabsContent value="certs">{id && canView && <EmployeeCertificationsEditor employeeId={id} canEdit={canEdit} />}</TabsContent>
          <TabsContent value="projects">{id && canView && <EmployeePastProjectsEditor employeeId={id} canEdit={canEdit} />}</TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}


