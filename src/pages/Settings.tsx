import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Settings() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCEO, setIsCEO] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    setIsCEO(userRole === 'ceo');
    if (user) {
      fetchOrganization();
    }
  }, [user, userRole]);

  const fetchOrganization = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (profile?.tenant_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.tenant_id)
          .single();

        if (org) {
          setOrganization(org);
          setOrgName(org.name);
          setLogoPreview(org.logo_url || "");
        }
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!isCEO) {
      toast({
        title: "Access denied",
        description: "Only CEO can update organization settings.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let logoUrl = organization?.logo_url;

      // Upload logo if changed
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${organization.id}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('org-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('org-logos')
          .getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      // Update organization
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: orgName,
          logo_url: logoUrl,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      toast({
        title: "Settings updated",
        description: "Organization settings have been saved successfully.",
      });

      fetchOrganization();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your organization settings and preferences</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Branding</CardTitle>
              <CardDescription>
                {isCEO 
                  ? "Customize your organization's name and logo" 
                  : "Only CEOs can modify organization branding"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isCEO || isLoading}
                  placeholder="Your Organization Name"
                />
              </div>

              <div className="space-y-4">
                <Label>Organization Logo</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 rounded-lg">
                    <AvatarImage src={logoPreview} alt={orgName} />
                    <AvatarFallback className="rounded-lg bg-primary/10">
                      <Building2 className="h-10 w-10 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={!isCEO || isLoading}
                      className="hidden"
                    />
                    <Label
                      htmlFor="logo"
                      className={`flex items-center gap-2 cursor-pointer ${!isCEO ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!isCEO || isLoading}
                        onClick={() => document.getElementById('logo')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </Button>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG or WEBP. Max 5MB.
                    </p>
                  </div>
                </div>
              </div>

              {isCEO && (
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your personal account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={userRole?.toUpperCase() || ''} disabled />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
