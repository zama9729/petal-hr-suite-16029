import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export default function MyProfile() {
  const [employeeId, setEmployeeId] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getEmployeeId();
        if (me?.id) {
          setEmployeeId(me.id);
          // Redirect to the employee detail page for the current user
          navigate(`/employees/${me.id}`, { replace: true });
        }
      } catch (error) {
        console.error('Error fetching employee ID:', error);
      }
    })();
  }, [navigate]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    </div>
  );
}


