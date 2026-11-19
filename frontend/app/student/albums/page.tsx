"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Images, Calendar } from "lucide-react";
import { api } from "@/lib/api/client";
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
  photos: AlbumPhoto[];
}

export default function StudentPhotoAlbumsPage() {
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: albums, isLoading } = useQuery<PhotoAlbum[]>({
    queryKey: ["student", "albums", selectedYear],
    queryFn: () =>
      api.get<PhotoAlbum[]>("/v1/albums", {
        ...(selectedYear !== "ALL" ? { year: Number(selectedYear) } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase">
            <Images className="h-3.5 w-3.5" />
            Brightway Student Gallery
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold">
            Year-Wise Student Photo Albums
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Browse official Brightway Computer Education convocation, practical laboratory, and campus event albums by year.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
          <Calendar className="h-4 w-4 text-[#FBBF24]" />
          <span className="text-xs font-bold text-[#FBBF24]">Year:</span>
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

      {isLoading ? (
        <CardSkeleton />
      ) : !albums || albums.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
          No photo albums available for the selected year.
        </div>
      ) : (
        <div className="space-y-6">
          {albums.map((album) => (
            <div
              key={album.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
            >
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

              {album.photos.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Photographs for this album will be uploaded by the administration soon.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {album.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.caption}
                        className="h-44 w-full object-cover"
                      />
                      <div className="p-2.5 bg-white">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {photo.caption}
                        </p>
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
