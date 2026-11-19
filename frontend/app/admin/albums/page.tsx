"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Images,
  Plus,
  Upload,
  Trash2,
  Calendar,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";

interface AlbumPhoto {
  id: string;
  caption: string;
  image_url: string;
  year: number;
  uploaded_at: string;
}

interface PhotoAlbum {
  id: string;
  title: string;
  year: number;
  description: string;
  visible_to_students: boolean;
  photos: AlbumPhoto[];
  created_at: string;
}

export default function AdminPhotoAlbumsPage() {
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("2027");
  const [newDesc, setNewDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetAlbumId, setTargetAlbumId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: albums, isLoading } = useQuery<PhotoAlbum[]>({
    queryKey: ["admin", "albums", selectedYear],
    queryFn: () =>
      api.get<PhotoAlbum[]>("/v1/admin/albums", {
        ...(selectedYear !== "ALL" ? { year: Number(selectedYear) } : {}),
      }),
  });

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await api.post("/v1/admin/albums", {
        title: newTitle.trim(),
        year: Number(newYear) || 2027,
        description: newDesc.trim(),
        visible_to_students: true,
      });
      toast({
        type: "success",
        title: "Photo Album Created",
        description: `Created "${newTitle}" (${newYear}).`,
      });
      setNewTitle("");
      setNewDesc("");
      queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Could Not Create Album",
        description:
          err instanceof Error ? err.message : "Failed to create album.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleMultiPhotoSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !targetAlbumId) return;

    setUploadingAlbumId(targetAlbumId);
    try {
      const photosPayload: Array<{ caption: string; image_url: string }> = [];
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          photosPayload.push({
            caption: file.name.replace(/\.[^.]+$/, ""),
            image_url: dataUrl,
          });
        }
      }

      await api.post(`/v1/admin/albums/${targetAlbumId}/photos`, {
        photos: photosPayload,
      });
      toast({
        type: "success",
        title: "Photographs Uploaded",
        description: `Added ${photosPayload.length} photographs to album.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Upload Failed",
        description:
          err instanceof Error ? err.message : "Could not upload photographs.",
      });
    } finally {
      setUploadingAlbumId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (albumId: string, photoId: string) => {
    try {
      await api.delete(`/v1/admin/albums/${albumId}/photos/${photoId}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
    } catch {
      toast({
        type: "error",
        title: "Delete Failed",
        description: "Could not remove photo.",
      });
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    try {
      await api.delete(`/v1/admin/albums/${albumId}`);
      toast({
        type: "success",
        title: "Album Deleted",
        description: "Removed photo album.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
    } catch {
      toast({
        type: "error",
        title: "Delete Failed",
        description: "Could not delete album.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase">
            <Images className="h-3.5 w-3.5" />
            Section 9 • Year-Wise Student Photo Albums
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold">
            Institute &amp; Student Photo Albums
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Organize photographs year-wise, create separate event albums, and upload multiple photographs at once.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
          <Calendar className="h-4 w-4 text-[#FBBF24]" />
          <span className="text-xs font-bold text-[#FBBF24]">Filter Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
          >
            <option value="ALL" className="text-slate-900">
              All Years
            </option>
            <option value="2027" className="text-slate-900">
              2027
            </option>
            <option value="2026" className="text-slate-900">
              2026
            </option>
            <option value="2025" className="text-slate-900">
              2025
            </option>
          </select>
        </div>
      </div>

      {/* Create New Album Form */}
      <form
        onSubmit={handleCreateAlbum}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Album Title *
          </label>
          <input
            type="text"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. RGYCSM Convocation 2027"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Year *
          </label>
          <select
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
          >
            <option value="2028">2028</option>
            <option value="2027">2027</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Album description"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white py-2.5 px-4 text-xs font-extrabold cursor-pointer"
        >
          <Plus className="h-4 w-4 text-[#FBBF24]" />
          <span>Create Album</span>
        </button>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg"
        onChange={handleMultiPhotoSelect}
        className="hidden"
      />

      {isLoading ? (
        <CardSkeleton />
      ) : (
        <div className="space-y-6">
          {(albums || []).map((album) => (
            <div
              key={album.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#1E3A8A] text-[#FBBF24] px-2.5 py-0.5 text-xs font-black">
                      YEAR {album.year}
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {album.title}
                    </h2>
                  </div>
                  {album.description && (
                    <p className="text-xs text-slate-500 mt-1">
                      {album.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingAlbumId === album.id}
                    onClick={() => {
                      setTargetAlbumId(album.id);
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-4 py-2 text-xs font-extrabold cursor-pointer"
                  >
                    {uploadingAlbumId === album.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 text-[#FBBF24]" />
                    )}
                    <span>Upload Multiple Photos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlbum(album.id)}
                    className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 p-2 cursor-pointer"
                    title="Delete Album"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {album.photos.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No photographs uploaded to this album yet. Click &ldquo;Upload Multiple Photos&rdquo; to add pictures.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {album.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.caption}
                        className="h-40 w-full object-cover"
                      />
                      <div className="p-2 flex items-center justify-between gap-1 bg-white">
                        <span className="text-[11px] font-bold text-slate-700 truncate">
                          {photo.caption}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(album.id, photo.id)}
                          className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
