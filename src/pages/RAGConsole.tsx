import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Document {
  doc_id: string;
  tenant_id?: string;
  allowed_roles?: string;
  source_reference?: string;
}

export default function RAGConsole() {
  // Query state
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [prov, setProv] = useState<Array<{id:string; doc_id:string}>>([]);
  const [confidence, setConfidence] = useState<string>("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [fullResponse, setFullResponse] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Ingestion state
  const [docId, setDocId] = useState("");
  const [text, setText] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["employee", "hr", "ceo"]);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [indexedDocuments, setIndexedDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const availableRoles = ["employee", "hr", "ceo", "manager", "admin"];

  // Load indexed documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await api.ragGetDocuments();
      setIndexedDocuments(response.docs || []);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      setIngestMessage({ type: 'error', text: 'Please upload a .txt file. Other formats coming soon!' });
      return;
    }

    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileText = e.target?.result as string;
      setText(fileText);
      // Auto-generate doc_id from filename if not set
      if (!docId.trim()) {
        const nameWithoutExt = file.name.replace(/\.txt$/i, '').replace(/[^a-z0-9]/gi, '_');
        setDocId(nameWithoutExt || 'policy_document');
      }
      setIngestMessage({ type: 'info', text: `File "${file.name}" loaded. Review and click "Upload Policy" to ingest.` });
    };
    reader.onerror = () => {
      setIngestMessage({ type: 'error', text: 'Failed to read file. Please try again.' });
    };
    reader.readAsText(file);
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleIngest = async () => {
    if (!docId.trim()) {
      setIngestMessage({ type: 'error', text: 'Please enter a document ID' });
      return;
    }
    if (!text.trim()) {
      setIngestMessage({ type: 'error', text: 'Please enter policy text or upload a file' });
      return;
    }
    if (selectedRoles.length === 0) {
      setIngestMessage({ type: 'error', text: 'Please select at least one allowed role' });
      return;
    }

    setIngestLoading(true);
    setIngestMessage(null);
    
    try {
      const response = await api.ragIngest({
        doc_id: docId.trim(),
        text: text.trim(),
        allowed_roles: selectedRoles
      });

      setIngestMessage({ 
        type: 'success', 
        text: `${response.message || 'Policy ingested successfully!'} ${response.chunks_added ? `(${response.chunks_added} chunks created)` : ''}` 
      });
      
      // Clear form
      setDocId("");
      setText("");
      setUploadedFile(null);
      setSelectedRoles(["employee", "hr", "ceo"]);
      
      // Reload documents list
      setTimeout(() => loadDocuments(), 1000);
    } catch (error: any) {
      setIngestMessage({ 
        type: 'error', 
        text: error.message || error.error || 'Failed to ingest policy. Please try again.' 
      });
      console.error('Ingestion error:', error);
    } finally {
      setIngestLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    
    setQueryLoading(true);
    setAnswer("");
    setProv([]);
    setConfidence("");
    setFullResponse(null);
    
    try {
      const r = await api.ragQuery(query.trim());
      setAnswer(r.text || "");
      setProv(r.provenance || []);
      setConfidence(r.confidence || "");
      setFullResponse(r);
      console.log('[RAG Response]', r);
    } catch (e: any) {
      setAnswer(e?.message || "Request failed");
      setFullResponse({ error: e?.message || "Request failed" });
      console.error('[RAG Error]', e);
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI Assistant (RAG)</h1>
          <p className="text-muted-foreground">Upload policies and query with AI-powered retrieval.</p>
        </div>

        <Tabs defaultValue="ingest" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ingest">Upload Policy</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
            <TabsTrigger value="documents">Indexed Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="ingest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Policy Document</CardTitle>
                <CardDescription>
                  Upload a policy document to make it searchable via the AI assistant. 
                  The document will be automatically chunked and indexed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Upload File (TXT format)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept=".txt,text/plain"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="cursor-pointer"
                      disabled={ingestLoading}
                    />
                    {uploadedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{uploadedFile.name}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .txt (PDF and DOCX coming soon)
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Or paste text directly:</p>
                </div>

                {/* Document ID */}
                <div className="space-y-2">
                  <Label htmlFor="doc-id">Document ID *</Label>
                  <Input
                    id="doc-id"
                    placeholder="e.g., work_hours_policy, maternity_leave_policy"
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    disabled={ingestLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    A unique identifier for this policy (letters, numbers, and underscores only)
                  </p>
                </div>

                {/* Policy Text */}
                <div className="space-y-2">
                  <Label htmlFor="policy-text">Policy Text *</Label>
                  <Textarea
                    id="policy-text"
                    placeholder="Paste or type the full policy text here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={12}
                    disabled={ingestLoading}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {text.length} characters
                  </p>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label>Allowed Roles *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-md">
                    {availableRoles.map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={selectedRoles.includes(role)}
                          onCheckedChange={() => handleRoleToggle(role)}
                          disabled={ingestLoading}
                        />
                        <Label
                          htmlFor={`role-${role}`}
                          className="text-sm font-normal cursor-pointer capitalize"
                        >
                          {role}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which user roles can access this policy when querying
                  </p>
                </div>

                {/* Messages */}
                {ingestMessage && (
                  <Alert
                    variant={ingestMessage.type === 'error' ? 'destructive' : 'default'}
                    className={ingestMessage.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' : ingestMessage.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
                  >
                    {ingestMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {ingestMessage.type === 'error' && <XCircle className="h-4 w-4" />}
                    {ingestMessage.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-600" />}
                    <AlertDescription className={ingestMessage.type === 'success' ? 'text-green-800 dark:text-green-200' : ingestMessage.type === 'info' ? 'text-blue-800 dark:text-blue-200' : ''}>
                      {ingestMessage.text}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleIngest}
                  disabled={ingestLoading || !docId.trim() || !text.trim() || selectedRoles.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {ingestLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading Policy...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Policy
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="query">
            <Card>
              <CardHeader>
                <CardTitle>Ask a Question</CardTitle>
                <CardDescription>
                  Query your indexed policies using natural language. The AI will retrieve relevant information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea 
                  placeholder="e.g., What is the maternity leave policy? What happens if an employee is late?" 
                  value={query} 
                  onChange={e => setQuery(e.target.value)}
                  rows={4}
                />
                <Button 
                  disabled={queryLoading || !query.trim()} 
                  onClick={handleQuery}
                  className="w-full"
                  size="lg"
                >
                  {queryLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Querying...
                    </>
                  ) : (
                    'Ask Question'
                  )}
                </Button>
                
                {answer && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">
                        Confidence: <span className="font-medium">{confidence || 'n/a'}</span>
                      </div>
                      {fullResponse?.source && (
                        <div className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">
                          Source: {fullResponse.source}
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">{answer}</pre>
                    </div>
                    {prov?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Sources: {prov.map(p => p.doc_id).join(', ')}
                      </div>
                    )}
                    {fullResponse && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRawJson(!showRawJson)}
                        >
                          {showRawJson ? 'Hide' : 'Show'} Raw JSON Response
                        </Button>
                        {showRawJson && (
                          <pre className="mt-2 p-3 bg-slate-900 text-green-400 text-xs overflow-auto rounded max-h-96">
                            {JSON.stringify(fullResponse, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Indexed Documents</CardTitle>
                <CardDescription>
                  List of all policies that have been uploaded and indexed for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : indexedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents indexed yet. Upload a policy to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {indexedDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{doc.doc_id}</div>
                            {doc.allowed_roles && (
                              <div className="text-xs text-muted-foreground">
                                Roles: {typeof doc.allowed_roles === 'string' ? doc.allowed_roles : doc.allowed_roles}
                              </div>
                            )}
                          </div>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={loadDocuments}
                  disabled={loadingDocs}
                  className="mt-4"
                >
                  {loadingDocs ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    'Refresh List'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
