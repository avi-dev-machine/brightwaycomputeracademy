"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { StudentIdCardGenerator } from "@/components/id-card/student-id-card-generator";
import { CardSkeleton } from "@/components/ui/skeleton";

interface StudentProfileData {
  id: string;
  student_id: string;
  name: string;
  contact_number: string;
  batch: string;
  course?: string;
  monthly_fee: number;
  admission_date?: string;
  photo_url?: string | null;
  initial_passcode: string;
}

export default function StudentProfilePage() {
  const { data: student, isLoading } = useQuery<StudentProfileData>({
    queryKey: ["student", "me"],
    queryFn: () => api.get<StudentProfileData>("/v1/students/me"),
  });

  if (isLoading || !student) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StudentIdCardGenerator
        studentId={student.student_id}
        name={student.name}
        batch={student.course || student.batch}
        contactNumber={student.contact_number}
        monthlyFee={student.monthly_fee}
        admissionDate={student.admission_date || "2026-01-10"}
        photoUrl={student.photo_url}
        allowPhotoUpload={false}
      />
    </div>
  );
}
