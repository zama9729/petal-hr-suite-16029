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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MapPin, 
  Mail, 
  Phone, 
  MoreVertical, 
  Pencil, 
  Save, 
  X,
  ThumbsUp,
  DollarSign,
  Award,
  TrendingUp,
  Users,
  Plus,
  ExternalLink,
  Scale,
  Cog,
  Puzzle,
  Flame
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface EmployeeData {
  id: string;
  employee_id: string;
  department: string;
  position: string;
  work_location: string;
  join_date: string;
  status: string;
  onboarding_status?: string;
  reporting_manager_id?: string;
  reporting_manager?: {
    id: string;
    first_name?: string;
    last_name?: string;
    position?: string;
  };
  reporting_team?: Array<{
    id: string;
    employee_id: string;
    position: string;
    department: string;
    profiles?: {
      first_name?: string;
      last_name?: string;
      email?: string;
    };
  }>;
  organization?: {
    name?: string;
    domain?: string;
  };
  onboarding_data?: {
    pan_number?: string;
    aadhar_number?: string;
    bank_account_number?: string;
    bank_name?: string;
    bank_branch?: string;
    ifsc_code?: string;
    permanent_address?: string;
    permanent_city?: string;
    permanent_state?: string;
    permanent_postal_code?: string;
    current_address?: string;
    current_city?: string;
    current_state?: string;
    current_postal_code?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    completed_at?: string;
  };
  performance_reviews?: Array<{
    id: string;
    rating?: number;
    performance_score?: number;
    strengths?: string;
    areas_of_improvement?: string;
    goals?: string;
    comments?: string;
    status: string;
    created_at: string;
    appraisal_cycle?: {
      cycle_name?: string;
      cycle_year?: number;
      start_date?: string;
      end_date?: string;
    };
    reviewer?: {
      first_name?: string;
      last_name?: string;
      position?: string;
    };
  }>;
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
  const [defaultTab, setDefaultTab] = useState<string>('about');
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
      const managerList = employees
        .map((emp: any) => ({
          id: emp.id,
          name: `${emp.profiles?.first_name || ''} ${emp.profiles?.last_name || ''}`.trim(),
        }))
        .filter((mgr: any) => mgr.name);
      setManagers(managerList);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'skills' || tab === 'certs' || tab === 'projects' || tab === 'about' || tab === 'job' || tab === 'docs' || tab === 'goals' || tab === 'reviews' || tab === 'onboarding') {
      setDefaultTab(tab);
    }
  }, [searchParams]);

  const canEdit = userRole && ['hr', 'ceo', 'director'].includes(userRole);
  // Allow viewing: HR/CEO/Director can view anyone, Managers can view anyone (backend will enforce team restriction), Employees can view their own
  const canView = canEdit || userRole === 'manager' || (userRole === 'employee' && myEmployeeId && id === myEmployeeId);

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

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  };

  const getFullName = () => {
    return `${employee?.profiles?.first_name || ''} ${employee?.profiles?.last_name || ''}`.trim();
  };

  const getReportingManagerName = () => {
    if (!employee?.reporting_manager) return 'N/A';
    return `${employee.reporting_manager.first_name || ''} ${employee.reporting_manager.last_name || ''}`.trim();
  };

  const calculateWorkAnniversary = () => {
    if (!employee?.join_date) return null;
    const joinDate = new Date(employee.join_date);
    const today = new Date();
    const years = today.getFullYear() - joinDate.getFullYear();
    const monthDiff = today.getMonth() - joinDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < joinDate.getDate())) {
      return years - 1;
    }
    return years;
  };

  const anniversaryYears = calculateWorkAnniversary();

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="text-center py-12">Loading employee details...</div>
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="text-center py-12 text-muted-foreground">Employee not found</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Profile Picture */}
              <Avatar className="h-32 w-32">
                <AvatarImage src="" alt={getFullName()} />
                <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                  {getInitials(employee.profiles?.first_name, employee.profiles?.last_name)}
                </AvatarFallback>
              </Avatar>

              {/* Employee Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{getFullName()}</h1>
                
                {/* Contact Info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                  {employee.organization?.name && employee.work_location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{employee.organization.name} | {employee.work_location}</span>
                    </div>
                  )}
                  {employee.profiles?.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>{employee.profiles.email}</span>
                    </div>
                  )}
                  {employee.profiles?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span>{employee.profiles.phone}</span>
                    </div>
                  )}
                </div>

                {/* Employment Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">DESIGNATION</p>
                    <p className="text-sm font-semibold mt-1">{employee.position || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">DEPARTMENT</p>
                    <p className="text-sm font-semibold mt-1">{employee.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">REPORTING TO</p>
                    <p className="text-sm font-semibold mt-1">{getReportingManagerName()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium">EMPLOYEE NO</p>
                    <p className="text-sm font-semibold mt-1">{employee.employee_id || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Actions
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>Export Profile</DropdownMenuItem>
                <DropdownMenuItem>View Org Chart</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 border-t pt-4">
            <Tabs value={defaultTab} onValueChange={setDefaultTab}>
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  About
                </TabsTrigger>
                <TabsTrigger value="job" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  Job
                </TabsTrigger>
                <TabsTrigger value="docs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  Docs
                </TabsTrigger>
                <TabsTrigger value="goals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  Goals
                </TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  Reviews
                </TabsTrigger>
                <TabsTrigger value="onboarding" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                  Onboarding
                </TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* About Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle>About</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h3 className="font-semibold mb-2">Professional Summary</h3>
                          <p className="text-sm text-muted-foreground">
                            {employee.position || 'Professional'} in the {employee.department || 'company'} department. 
                            {employee.join_date ? ` Joined on ${new Date(employee.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.` : ''}
                          </p>
                        </div>
                        {employee.department && (
                          <div>
                            <h3 className="font-semibold mb-2">Department & Role</h3>
                            <p className="text-sm text-muted-foreground">
                              Currently working as {employee.position || 'team member'} in the {employee.department} department.
                              {employee.work_location && ` Based in ${employee.work_location}.`}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Timeline Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {anniversaryYears !== null && (
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <ThumbsUp className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Work Anniversary - {anniversaryYears}{anniversaryYears === 1 ? 'st' : anniversaryYears === 2 ? 'nd' : anniversaryYears === 3 ? 'rd' : 'th'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {employee.join_date ? new Date(employee.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <DollarSign className="h-5 w-5 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">Pay Increase</p>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {employee.join_date ? new Date(employee.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                              <Award className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Praise - Super Star worker</p>
                              <p className="text-xs text-muted-foreground mb-2">
                                {employee.join_date ? new Date(employee.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                    {employee.reporting_manager?.first_name?.charAt(0) || 'M'}
                                  </AvatarFallback>
                                </Avatar>
                                <p className="text-xs text-muted-foreground">
                                  {employee.reporting_manager?.first_name || 'Manager'} - "Dynamic and creative {employee.position || 'professional'} with experience"
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Reporting Team */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Reporting Team ({employee.reporting_team?.length || 0})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {employee.reporting_team && employee.reporting_team.length > 0 ? (
                            <>
                              {employee.reporting_team.slice(0, 3).map((member) => (
                                <div key={member.id} className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-gray-100 text-gray-700">
                                    {getInitials(member.profiles?.first_name, member.profiles?.last_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {member.profiles?.first_name} {member.profiles?.last_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{member.position}</p>
                                  </div>
                                </div>
                              ))}
                              {employee.reporting_team.length > 3 && (
                                <Button variant="ghost" className="w-full text-sm text-blue-600">
                                  View all
                                </Button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No direct reports</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Praise Section */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base">Praise</CardTitle>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Give Praise
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-purple-50 border border-purple-100">
                            <Scale className="h-6 w-6 text-purple-600 mb-1" />
                            <p className="text-xs font-medium text-purple-900">Money Maker</p>
                            <p className="text-xs text-purple-600">2</p>
                          </div>
                          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-50 border border-green-100">
                            <Cog className="h-6 w-6 text-green-600 mb-1" />
                            <p className="text-xs font-medium text-green-900">Relentless</p>
                            <p className="text-xs text-green-600">1</p>
                          </div>
                          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <Puzzle className="h-6 w-6 text-blue-600 mb-1" />
                            <p className="text-xs font-medium text-blue-900">Problem Solver</p>
                            <p className="text-xs text-blue-600">5</p>
                          </div>
                          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                            <Flame className="h-6 w-6 text-yellow-600 mb-1" />
                            <p className="text-xs font-medium text-yellow-900">Torch Bearer</p>
                            <p className="text-xs text-yellow-600">1</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Goals Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Goals</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium mb-2">Digital transformation of all onboarding processes</p>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              <span className="text-xs text-green-600">On track</span>
                            </div>
                            <Progress value={51} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">23/45</span>
                              <div className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="h-3 w-3" />
                                <span>12%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="job">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Job Information</CardTitle>
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                          {isEditing ? (
                            <>
                              <X className="mr-2 h-4 w-4" /> Cancel
                            </>
                          ) : (
                            <>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
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
                        <div className="col-span-2 flex justify-end gap-2">
                          <Button variant="outline" onClick={() => { setIsEditing(false); fetchEmployee(); }}>
                            Cancel
                          </Button>
                          <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" /> Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">First Name</Label>
                          <p className="font-medium mt-1">{employee.profiles?.first_name || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Last Name</Label>
                          <p className="font-medium mt-1">{employee.profiles?.last_name || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <p className="font-medium mt-1">{employee.profiles?.email || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Phone</Label>
                          <p className="font-medium mt-1">{employee.profiles?.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Employee ID</Label>
                          <p className="font-medium mt-1">{employee.employee_id || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Department</Label>
                          <p className="font-medium mt-1">{employee.department || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Position</Label>
                          <p className="font-medium mt-1">{employee.position || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Work Location</Label>
                          <p className="font-medium mt-1">{employee.work_location || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Join Date</Label>
                          <p className="font-medium mt-1">{employee.join_date ? new Date(employee.join_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <p className="font-medium mt-1 capitalize">{employee.status || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Reporting Manager</Label>
                          <p className="font-medium mt-1">{getReportingManagerName()}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="docs">
                <Card>
                  <CardHeader>
                    <CardTitle>Documents & Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {employee.onboarding_data ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-semibold mb-3">Identity Documents</h3>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">PAN Number</Label>
                              <p className="font-medium">{employee.onboarding_data.pan_number || 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Aadhar Number</Label>
                              <p className="font-medium">{employee.onboarding_data.aadhar_number || 'Not provided'}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold mb-3">Bank Details</h3>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Bank Name</Label>
                              <p className="font-medium">{employee.onboarding_data.bank_name || 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Account Number</Label>
                              <p className="font-medium">{employee.onboarding_data.bank_account_number ? `****${employee.onboarding_data.bank_account_number.slice(-4)}` : 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">IFSC Code</Label>
                              <p className="font-medium">{employee.onboarding_data.ifsc_code || 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Branch</Label>
                              <p className="font-medium">{employee.onboarding_data.bank_branch || 'Not provided'}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold mb-3">Permanent Address</h3>
                          <div className="space-y-1">
                            <p className="text-sm">{employee.onboarding_data.permanent_address || 'Not provided'}</p>
                            {employee.onboarding_data.permanent_city && employee.onboarding_data.permanent_state && (
                              <p className="text-sm text-muted-foreground">
                                {employee.onboarding_data.permanent_city}, {employee.onboarding_data.permanent_state} {employee.onboarding_data.permanent_postal_code || ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold mb-3">Current Address</h3>
                          <div className="space-y-1">
                            <p className="text-sm">{employee.onboarding_data.current_address || 'Not provided'}</p>
                            {employee.onboarding_data.current_city && employee.onboarding_data.current_state && (
                              <p className="text-sm text-muted-foreground">
                                {employee.onboarding_data.current_city}, {employee.onboarding_data.current_state} {employee.onboarding_data.current_postal_code || ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold mb-3">Emergency Contact</h3>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <p className="font-medium">{employee.onboarding_data.emergency_contact_name || 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Phone</Label>
                              <p className="font-medium">{employee.onboarding_data.emergency_contact_phone || 'Not provided'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Relation</Label>
                              <p className="font-medium">{employee.onboarding_data.emergency_contact_relation || 'Not provided'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No onboarding documents found. Onboarding may not be completed yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="goals">
                <Card>
                  <CardHeader>
                    <CardTitle>Goals & Objectives</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {employee.performance_reviews && employee.performance_reviews.length > 0 ? (
                      <div className="space-y-4">
                        {employee.performance_reviews
                          .filter(review => review.goals && review.status === 'submitted')
                          .map((review, index) => (
                            <div key={review.id} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h3 className="font-semibold">
                                    {review.appraisal_cycle?.cycle_name || 'Performance Review'} {review.appraisal_cycle?.cycle_year || ''}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                                  </p>
                                </div>
                                <Badge variant={review.status === 'acknowledged' ? 'default' : 'secondary'}>
                                  {review.status}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Goals for Next Cycle</Label>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{review.goals}</p>
                                </div>
                                {review.rating && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground">Rating:</span>
                                    <span className="font-medium">{review.rating}/5</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        {employee.performance_reviews.filter(review => review.goals && review.status === 'submitted').length === 0 && (
                          <p className="text-muted-foreground">No goals found in performance reviews.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No performance reviews found. Goals will appear here once reviews are submitted.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {employee.performance_reviews && employee.performance_reviews.length > 0 ? (
                      <div className="space-y-4">
                        {employee.performance_reviews.map((review) => (
                          <div key={review.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">
                                  {review.appraisal_cycle?.cycle_name || 'Performance Review'} {review.appraisal_cycle?.cycle_year || ''}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                  Reviewed by {review.reviewer?.first_name || ''} {review.reviewer?.last_name || ''} ({review.reviewer?.position || 'Manager'})
                                  {' • '}
                                  {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                </p>
                              </div>
                              <Badge variant={review.status === 'acknowledged' ? 'default' : review.status === 'submitted' ? 'secondary' : 'outline'}>
                                {review.status}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              {review.rating && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Rating</Label>
                                  <p className="font-medium text-lg">{review.rating}/5</p>
                                </div>
                              )}
                              {review.performance_score && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Performance Score</Label>
                                  <p className="font-medium text-lg">{review.performance_score}/5</p>
                                </div>
                              )}
                            </div>

                            {review.strengths && (
                              <div className="mt-4">
                                <Label className="text-xs text-muted-foreground">Strengths</Label>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{review.strengths}</p>
                              </div>
                            )}

                            {review.areas_of_improvement && (
                              <div className="mt-4">
                                <Label className="text-xs text-muted-foreground">Areas of Improvement</Label>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{review.areas_of_improvement}</p>
                              </div>
                            )}

                            {review.comments && (
                              <div className="mt-4">
                                <Label className="text-xs text-muted-foreground">Comments</Label>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{review.comments}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No performance reviews found yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="onboarding">
                <Card>
                  <CardHeader>
                    <CardTitle>Onboarding Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Status</Label>
                        <div className="mt-2">
                          <Badge variant={
                            employee.onboarding_status === 'completed' ? 'default' :
                            employee.onboarding_status === 'in_progress' ? 'secondary' :
                            employee.onboarding_status === 'pending' ? 'outline' : 'outline'
                          }>
                            {employee.onboarding_status || 'Not Started'}
                          </Badge>
                        </div>
                      </div>
                      
                      {employee.onboarding_data?.completed_at && (
                        <div>
                          <Label className="text-sm font-semibold">Completed At</Label>
                          <p className="text-sm mt-1">
                            {new Date(employee.onboarding_data.completed_at).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}

                      {employee.join_date && (
                        <div>
                          <Label className="text-sm font-semibold">Join Date</Label>
                          <p className="text-sm mt-1">
                            {new Date(employee.join_date).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      )}

                      <div className="mt-6 pt-4 border-t">
                        <h3 className="font-semibold mb-3">Onboarding Checklist</h3>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.permanent_address ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">Permanent Address</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.current_address ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">Current Address</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.pan_number ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">PAN Number</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.aadhar_number ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">Aadhar Number</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.bank_account_number ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">Bank Details</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded ${employee.onboarding_data?.emergency_contact_name ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                            <span className="text-sm">Emergency Contact</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Skills, Certs, Projects tabs for backward compatibility */}
        {defaultTab === 'skills' && id && canView && <EmployeeSkillsEditor employeeId={id} canEdit={canEdit} />}
        {defaultTab === 'certs' && id && canView && <EmployeeCertificationsEditor employeeId={id} canEdit={canEdit} />}
        {defaultTab === 'projects' && id && canView && <EmployeePastProjectsEditor employeeId={id} canEdit={canEdit} />}
      </div>
    </AppLayout>
  );
}