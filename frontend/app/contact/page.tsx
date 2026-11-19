import Link from "next/link";
import {
  PublicHeader,
  GOOGLE_MAPS_URL,
  RGYCSM_COURSES_URL,
} from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import {
  MapPin,
  Clock,
  Award,
  ExternalLink,
  Navigation,
  GraduationCap,
  BookOpen,
} from "lucide-react";

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <PublicHeader />

      <main className="flex-1">
        <section className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase">
              <MapPin className="h-3.5 w-3.5" />
              Verified Google Maps Location
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-black">
              BRIGHTWAY COMPUTER EDUCATION — Campus Location
            </h1>
            <p className="text-sm text-blue-100 max-w-2xl mx-auto">
              Visit our campus for RGYCSM course admissions, practical lab timings, certificate distribution, and student portal support.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Left Column: Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                      Official Study Centre
                    </span>
                    <h2 className="text-2xl font-black text-[#1E3A8A] mt-0.5">
                      BRIGHTWAY COMPUTER EDUCATION
                    </h2>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1E3A8A]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 uppercase">
                        Google Maps Pin
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Click below to open exact turn-by-turn directions to BRIGHTWAY COMPUTER EDUCATION on Google Maps.
                      </p>
                      <a
                        href={GOOGLE_MAPS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#2563EB] hover:text-[#1E3A8A] underline underline-offset-4"
                      >
                        <span>{GOOGLE_MAPS_URL}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 uppercase">
                        Course Affiliation
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Affiliated with{" "}
                        <strong>
                          Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)
                        </strong>
                      </p>
                      <a
                        href={RGYCSM_COURSES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1E3A8A] hover:text-[#2563EB] underline underline-offset-4"
                      >
                        <span>{RGYCSM_COURSES_URL}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 uppercase">
                        Laboratory &amp; Office Hours
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Monday – Saturday: Morning &amp; Evening Practical Batches
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-5 py-3 text-xs font-extrabold shadow-sm transition-colors"
                  >
                    <Navigation className="h-4 w-4 text-[#FBBF24]" />
                    <span>Open in Google Maps</span>
                  </a>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-5 py-3 text-xs font-extrabold shadow-sm transition-colors"
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Student Portal Login</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: Interactive Map Launch Card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white p-8 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-[#FBBF24]/40 px-3.5 py-1 text-xs font-extrabold text-[#FBBF24]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Direct Navigation</span>
                  </div>
                  <h3 className="font-display text-2xl font-black">
                    Find BRIGHTWAY COMPUTER EDUCATION on Google Maps
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                    Use our official Google Maps link to view the campus location, street view, landmarks, and real-time transit directions directly on your phone or browser.
                  </p>
                </div>

                <div className="my-6 rounded-2xl bg-white/10 border border-white/15 p-6 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F59E0B] text-slate-950 shadow-lg">
                    <MapPin className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-extrabold text-base text-white">
                      BRIGHTWAY COMPUTER EDUCATION
                    </p>
                    <p className="text-xs text-blue-200 mt-0.5">
                      RGYCSM Authorized Computer Training Centre
                    </p>
                  </div>
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-black py-3.5 px-6 text-xs sm:text-sm shadow-lg transition-transform hover:-translate-y-0.5"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Launch Google Maps Directions</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="flex items-center justify-between text-xs text-blue-200 pt-2 border-t border-white/10">
                  <a
                    href={RGYCSM_COURSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#FBBF24]"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-[#FBBF24]" />
                    <span>RGYCSM Courses (rgycsm.org)</span>
                  </a>
                  <span>ISO 9001:2015 Certified</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
