import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface AppraisalCycle {
  id: string;
  cycle_name: string;
  cycle_year: number;
  status: string;
}
interface Employee {
  id: string;
  employee_id: string;
  position: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}
interface PerformanceReview {
  id: string;
  employee_id: string;
  rating: number | null;
  performance_score: number | null;
  strengths: string | null;
  areas_of_improvement: string | null;
  goals: string | null;
  comments: string | null;
  status: string;
  employee_id: string;
  employee_id_display?: string;
  position?: string;
  first_name?: string;
  last_name?: string;
}

export default function Appraisals() {
  const { user, token } = useAuth();
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState({
    rating: "",
    performance_score: "",
    strengths: "",
    areas_of_improvement: "",
    goals: "",
    comments: "",
  });
  useEffect(() => {
    fetchCycles();
    fetchTeamMembers();
  }, [user]);
  useEffect(() => {
    if (selectedCycle) fetchReviews();
  }, [selectedCycle]);

  const fetchCycles = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/appraisal-cycles`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) throw new Error("Failed to fetch cycles");
      const data = await res.json();
      setCycles(data || []);
    } catch (e: any) {
      toast.error("Failed to fetch appraisal cycles");
    }
  };
  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/employees?team=mine`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) throw new Error("Failed to fetch team members");
      const data = await res.json();
      setTeamMembers(data || []);
    } catch (e: any) {
      toast.error("Failed to fetch team members");
    }
  };
  const fetchReviews = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/performance-reviews?cycle=${selectedCycle}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      setReviews(data || []);
    } catch (e: any) {
      toast.error("Failed to fetch reviews");
    }
  };
  const handleSubmitReview = async () => {
    if (!selectedCycle || !selectedEmployee) {
      toast.error("Please select a cycle and employee");
      return;
    }
    if (!reviewData.rating || !reviewData.performance_score) {
      toast.error("Rating and performance score are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/performance-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          appraisal_cycle_id: selectedCycle,
          employee_id: selectedEmployee,
          rating: Number(reviewData.rating),
          performance_score: Number(reviewData.performance_score),
          strengths: reviewData.strengths,
          areas_of_improvement: reviewData.areas_of_improvement,
          goals: reviewData.goals,
          comments: reviewData.comments,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to submit");
      toast.success("Review submitted successfully");
      setReviewData({ rating: "", performance_score: "", strengths: "", areas_of_improvement: "", goals: "", comments: "" });
      setSelectedEmployee("");
      fetchReviews();
    } catch (error: any) {
      toast.error("Failed to submit review: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const renderStars = (rating: number) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
      ))}
    </div>
  );
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Performance Appraisals</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Submit Performance Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Appraisal Cycle</Label>
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.cycle_name} - {cycle.cycle_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team Member</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.profiles?.first_name} {member.profiles?.last_name} - {member.employee_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rating (1-5)</Label>
              <Input type="number" min="1" max="5" value={reviewData.rating} onChange={(e) => setReviewData({ ...reviewData, rating: e.target.value })} />
            </div>
            <div>
              <Label>Performance Score (0-5)</Label>
              <Input type="number" step="0.01" min="0" max="5" value={reviewData.performance_score} onChange={(e) => setReviewData({ ...reviewData, performance_score: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Strengths</Label>
            <Textarea value={reviewData.strengths} onChange={(e) => setReviewData({ ...reviewData, strengths: e.target.value })} rows={3} />
          </div>
          <div>
            <Label>Areas of Improvement</Label>
            <Textarea value={reviewData.areas_of_improvement} onChange={(e) => setReviewData({ ...reviewData, areas_of_improvement: e.target.value })} rows={3} />
          </div>
          <div>
            <Label>Goals for Next Cycle</Label>
            <Textarea value={reviewData.goals} onChange={(e) => setReviewData({ ...reviewData, goals: e.target.value })} rows={3} />
          </div>
          <div>
            <Label>Additional Comments</Label>
            <Textarea value={reviewData.comments} onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })} rows={3} />
          </div>
          <Button onClick={handleSubmitReview} disabled={loading}>Submit Review</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Submitted Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>{review.first_name} {review.last_name}</TableCell>
                  <TableCell>{review.position}</TableCell>
                  <TableCell>{review.rating && renderStars(Number(review.rating))}</TableCell>
                  <TableCell>{review.performance_score}</TableCell>
                  <TableCell className="capitalize">{review.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
