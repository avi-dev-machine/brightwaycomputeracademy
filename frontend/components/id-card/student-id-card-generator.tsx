"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface StudentIdCardGeneratorProps {
  studentId: string;
  name: string;
  batch: string;
  contactNumber: string;
  monthlyFee: number;
  admissionDate?: string;
  validitySession?: string;
  instituteAddress?: string;
  photoUrl?: string | null;
  allowPhotoUpload?: boolean;
  onPhotoUploaded?: (newPhotoUrl: string) => void;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB strict limit

export function StudentIdCardGenerator({
  studentId,
  name,
  batch,
  contactNumber,
  admissionDate = "2026-01-10",
  validitySession = "2027 – 2028",
  instituteAddress = "Alambazar, Baranagar, Kolkata - 700035",
  photoUrl,
  allowPhotoUpload = false,
  onPhotoUploaded,
}: StudentIdCardGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [activePhotoSrc, setActivePhotoSrc] = useState<string>(
    photoUrl
      ? `/api/backend${photoUrl.replace(/^\/api/, "")}`
      : `/api/backend/v1/students/${encodeURIComponent(studentId)}/photo`
  );
  const { toast } = useToast();

  useEffect(() => {
    if (photoUrl) {
      setActivePhotoSrc(`/api/backend${photoUrl.replace(/^\/api/, "")}`);
    } else if (studentId) {
      setActivePhotoSrc(
        `/api/backend/v1/students/${encodeURIComponent(studentId)}/photo`
      );
    }
  }, [photoUrl, studentId]);

  // Draw dynamic ID Card onto HTML5 Canvas whenever student data or photo changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1012;
    const height = 638;
    canvas.width = width;
    canvas.height = height;

    const drawCard = (loadedPhoto: HTMLImageElement | null) => {
      // 1. Crisp White Card Background (#FFFFFF)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      // Subtle watermark pattern
      ctx.fillStyle = "#F8FAFC";
      for (let x = 0; x < width; x += 48) {
        ctx.fillRect(x, 165, 20, height - 235);
      }

      // 2. Deep Trust Blue Header (#1E3A8A)
      const headerGrad = ctx.createLinearGradient(0, 0, width, 155);
      headerGrad.addColorStop(0, "#1E3A8A");
      headerGrad.addColorStop(1, "#2563EB");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, width, 150);

      // 3. Educational Gold Accent Strip (#F59E0B / #FBBF24)
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(0, 150, width, 14);

      // 4. Academy Emblem Circle in Header
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath();
      ctx.arc(78, 75, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1E3A8A";
      ctx.font = "900 32px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BW", 78, 86);

      // 5. Academy Title, Affiliation & Institute Address
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 34px Inter, system-ui, sans-serif";
      ctx.fillText("BRIGHTWAY COMPUTER EDUCATION", 142, 58);

      ctx.fillStyle = "#FBBF24";
      ctx.font = "700 16px Inter, system-ui, sans-serif";
      ctx.fillText(
        "AFFILIATED TO RGYCSM (rgycsm.org)  •  OFFICIAL STUDENT ID CARD",
        142,
        90
      );

      ctx.fillStyle = "#DBEAFE";
      ctx.font = "600 15px Inter, system-ui, sans-serif";
      ctx.fillText(`Institute Address: ${instituteAddress}`, 142, 120);

      // 6. Student Photograph Frame (Left)
      const px = 56;
      const py = 200;
      const pw = 250;
      const ph = 300;

      ctx.fillStyle = "#EFF6FF";
      ctx.fillRect(px, py, pw, ph);

      if (loadedPhoto) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, pw, ph);
        ctx.clip();
        const imgRatio = loadedPhoto.width / loadedPhoto.height;
        const boxRatio = pw / ph;
        let drawW = pw;
        let drawH = ph;
        let offsetX = px;
        let offsetY = py;
        if (imgRatio > boxRatio) {
          drawW = ph * imgRatio;
          offsetX = px - (drawW - pw) / 2;
        } else {
          drawH = pw / imgRatio;
          offsetY = py - (drawH - ph) / 2;
        }
        ctx.drawImage(loadedPhoto, offsetX, offsetY, drawW, drawH);
        ctx.restore();
      } else {
        ctx.fillStyle = "#1E3A8A";
        ctx.fillRect(px, py, pw, ph);
        const initials =
          name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join("") || "BW";
        ctx.fillStyle = "#FBBF24";
        ctx.font = "900 76px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(initials, px + pw / 2, py + ph / 2 + 24);
      }

      // Photo Border
      ctx.strokeStyle = "#2563EB";
      ctx.lineWidth = 5;
      ctx.strokeRect(px, py, pw, ph);

      // Gold Verified Corner Tag under Photo
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(px, py + ph + 12, pw, 34);
      ctx.fillStyle = "#0F172A";
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`ID: ${studentId}`, px + pw / 2, py + ph + 35);

      // 7. Student Particulars (Right Column)
      const infoX = 348;
      ctx.textAlign = "left";

      ctx.fillStyle = "#64748B";
      ctx.font = "700 15px Inter, system-ui, sans-serif";
      ctx.fillText("STUDENT FULL NAME", infoX, 220);

      ctx.fillStyle = "#0F172A";
      ctx.font = "900 32px Inter, system-ui, sans-serif";
      ctx.fillText((name || "STUDENT").toUpperCase().slice(0, 28), infoX, 258);

      // Divider
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(infoX, 276, 608, 2);

      // Grid of Metadata Fields (Student ID, Course Name, Admission Date, Contact Number)
      const fields = [
        { label: "STUDENT ID", value: studentId, x: infoX, y: 315, highlight: true },
        {
          label: "ADMISSION DATE",
          value: admissionDate || "2026-01-10",
          x: infoX + 310,
          y: 315,
          highlight: false,
        },
        {
          label: "COURSE NAME",
          value: (batch || "GENERAL").slice(0, 28),
          x: infoX,
          y: 405,
          highlight: false,
        },
        {
          label: "CONTACT NUMBER",
          value:
            contactNumber && contactNumber !== "0000000000"
              ? `+91 ${contactNumber}`
              : "Registered on Portal",
          x: infoX + 310,
          y: 405,
          highlight: false,
        },
      ];

      for (const f of fields) {
        ctx.fillStyle = "#64748B";
        ctx.font = "700 14px Inter, system-ui, sans-serif";
        ctx.fillText(f.label, f.x, f.y);

        ctx.fillStyle = f.highlight ? "#1E3A8A" : "#1E293B";
        ctx.font = "800 23px Inter, system-ui, sans-serif";
        ctx.fillText(f.value, f.x, f.y + 32);
      }

      // Academic Validity Pill
      ctx.fillStyle = "#EFF6FF";
      ctx.fillRect(infoX, 472, 390, 44);
      ctx.strokeStyle = "#BFDBFE";
      ctx.lineWidth = 2;
      ctx.strokeRect(infoX, 472, 390, 44);
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "700 16px Inter, system-ui, sans-serif";
      ctx.fillText(
        `VALIDITY / SESSION: ${validitySession}  •  VERIFIED`,
        infoX + 18,
        500
      );

      // Authorized Signatory Block
      ctx.fillStyle = "#0F172A";
      ctx.font = "italic 700 18px Georgia, serif";
      ctx.fillText("Brightway Registrar", infoX + 430, 492);
      ctx.fillStyle = "#64748B";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText("AUTHORIZED SIGNATORY", infoX + 430, 514);

      // 8. Bottom Footer Bar (#1E3A8A)
      ctx.fillStyle = "#1E3A8A";
      ctx.fillRect(0, 574, width, 64);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 15px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        `BRIGHTWAY COMPUTER EDUCATION  •  ${instituteAddress}`,
        48,
        612
      );

      ctx.fillStyle = "#FBBF24";
      ctx.textAlign = "right";
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.fillText(`STUDENT ID: ${studentId}`, width - 48, 612);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => drawCard(img);
    img.onerror = () => drawCard(null);
    img.src = activePhotoSrc;
  }, [
    name,
    studentId,
    batch,
    contactNumber,
    admissionDate,
    validitySession,
    instituteAddress,
    activePhotoSrc,
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type.toLowerCase())) {
      toast({
        type: "error",
        title: "Invalid Image Format",
        description: "Please select a PNG or JPEG photograph.",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        type: "error",
        title: "File Too Large",
        description: "Profile photograph must be 2 MB or smaller.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/backend/v1/students/${encodeURIComponent(studentId)}/photo`,
        {
          method: "POST",
          body: formData,
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "Failed to upload photograph.");
      }

      const newPhotoPath =
        json.data?.photo_url ||
        `/api/v1/students/${encodeURIComponent(studentId)}/photo?v=${Date.now()}`;
      const proxiedUrl = `/api/backend${newPhotoPath.replace(/^\/api/, "")}`;
      setActivePhotoSrc(proxiedUrl);
      onPhotoUploaded?.(newPhotoPath);

      toast({
        type: "success",
        title: "Photograph Updated",
        description: "Student photograph updated on official ID card.",
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Upload Failed",
        description:
          err instanceof Error ? err.message : "Could not upload photograph.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `Brightway-ID-${studentId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      type: "success",
      title: "ID Card Downloaded (PNG)",
      description: `Saved Brightway-ID-${studentId}.png`,
    });
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(
        `/api/backend/v1/students/${encodeURIComponent(studentId)}/id-card.pdf`
      );
      if (!res.ok) {
        throw new Error("Could not generate PDF ID card.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Brightway-ID-${studentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        type: "success",
        title: "ID Card Downloaded (PDF)",
        description: `Saved Brightway-ID-${studentId}.pdf`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "PDF Download Failed",
        description:
          err instanceof Error ? err.message : "Unable to download PDF ID card.",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#F59E0B]" />
            Official Digital Student ID Card
          </span>
          <h2 className="mt-1.5 font-display text-xl font-extrabold text-[#1E3A8A]">
            Brightway Computer Education — Student Identity Card
          </h2>
          <p className="text-xs text-slate-500">
            Includes Brightway Logo, Institute Address, Photograph, Student Name, Student ID, Course Name, Admission Date, and Session Validity.
          </p>
        </div>

        {allowPhotoUpload && (
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2563EB] bg-blue-50/70 hover:bg-blue-100/80 text-[#1E3A8A] px-4 py-2.5 text-xs font-extrabold transition-colors cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
              ) : (
                <Camera className="h-4 w-4 text-[#2563EB]" />
              )}
              <span>
                {isUploading ? "Uploading Photo..." : "Update Student Photo"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Live High-DPI HTML5 Canvas Preview */}
      <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900/95 p-4 sm:p-6 shadow-inner">
        <div className="w-full max-w-xl overflow-hidden rounded-xl shadow-2xl ring-2 ring-[#FBBF24]/50">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block bg-white"
            aria-label={`Digital ID Card for ${name}`}
          />
        </div>
        <p className="mt-3 text-[11px] text-slate-300 font-medium">
          Official CR80 Digital ID Card • Managed by Super Admin
        </p>
      </div>

      {/* One-Click Download Controls (PNG & PDF) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Verified Official ID Record • Available as PDF &amp; PNG</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-5 py-2.5 text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
          >
            <ImageIcon className="h-4 w-4 text-[#FBBF24]" />
            <span>Download ID Card as PNG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 disabled:opacity-60 text-white px-5 py-2.5 text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
          >
            {isDownloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
            ) : (
              <FileText className="h-4 w-4 text-[#FBBF24]" />
            )}
            <span>
              {isDownloadingPdf ? "Generating PDF..." : "Download ID Card as PDF"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
