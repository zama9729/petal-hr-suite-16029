import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmployeeSkillsEditor from '@/components/EmployeeSkillsEditor';
import EmployeeCertificationsEditor from '@/components/EmployeeCertificationsEditor';
import EmployeePastProjectsEditor from '@/components/EmployeePastProjectsEditor';
import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function EmployeeDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const [myEmployeeId, setMyEmployeeId] = useState<string>('');
  const [defaultTab, setDefaultTab] = useState<string>('overview');

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getEmployeeId();
        setMyEmployeeId(me?.id || '');
      } catch {}
    })();
  }, []);

  // Check for tab query parameter in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'skills' || tab === 'certs' || tab === 'projects' || tab === 'overview') {
      setDefaultTab(tab);
    }
  }, [searchParams]);

  // CEO/HR can view (read-only), employees can edit their own
  const canEdit = userRole === 'employee' && myEmployeeId && id === myEmployeeId;
  const canView = canEdit || (userRole && ['hr', 'ceo', 'director'].includes(userRole));
  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold">Employee Profile</h1>
        <Tabs defaultValue={defaultTab} value={defaultTab} onValueChange={setDefaultTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certs">Certifications</TabsTrigger>
            <TabsTrigger value="projects">Past Projects</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Basic profile details coming soon.</CardContent>
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


