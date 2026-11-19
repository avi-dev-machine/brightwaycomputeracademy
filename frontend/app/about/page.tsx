import Link from "next/link";
import {
  PublicHeader,
  GOOGLE_MAPS_URL,
  RGYCSM_COURSES_URL,
} from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Shield,
  Target,
  Users,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <PublicHeader />

      <main className="flex-1">
        <section className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase">
              <Award className="h-3.5 w-3.5" />
              Affiliated to RGYCSM (rgycsm.org)
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-black">
              About BRIGHTWAY COMPUTER EDUCATION
            </h1>
            <p className="text-sm text-blue-100 max-w-2xl mx-auto leading-relaxed">
              An authorized training centre of Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM), dedicated to delivering practical, career-focused computer education.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10">
            {/* Affiliation Spotlight */}
            <div className="rounded-2xl border-2 border-[#1E3A8A]/20 bg-white p-8 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                    Official National Affiliation
                  </span>
                  <h2 className="text-2xl font-black text-[#1E3A8A] mt-0.5">
                    Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)
                  </h2>
                </div>
                <a
                  href={RGYCSM_COURSES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-4 py-2.5 text-xs font-extrabold transition-colors"
                >
                  <span>Verify Courses on rgycsm.org</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#FBBF24]" />
                </a>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                <strong>BRIGHTWAY COMPUTER EDUCATION</strong> conducts certified diploma and certificate programs under the curriculum of{" "}
                <strong>Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)</strong>. Our flagship programs — including{" "}
                <strong>ADOAP</strong> (Advance Diploma in Office Accounting &amp; Publishing),{" "}
                <strong>DCAE</strong> (Diploma in Computer Accounting Expert),{" "}
                <strong>DDTP</strong> (Diploma in Desktop Publishing), and{" "}
                <strong>RCIT</strong> — equip learners with verifiable credentials for government and private sector careers.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {[
                  "Nationally Recognized RGYCSM Certificates",
                  "1:1 Practical Laboratory Workstations",
                  "Digital ID Cards & Online Razorpay Fee Desk",
                ].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-2 rounded-xl bg-blue-50/70 px-3.5 py-2.5 text-xs font-bold text-[#1E3A8A]"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mission & Vision */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1E3A8A] mb-4">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Our Mission
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  To empower youth and school learners with practical computer proficiency, financial accounting mastery (Tally Prime with GST), graphic publishing, and modern programming skills.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B] mb-4">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Our Vision
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  To remain the most trusted computer education centre in the region through 100% practical training, transparent digital fee records, and authoritative RGYCSM certifications.
                </p>
              </div>
            </div>

            {/* Core Values & Location CTA */}
            <div className="rounded-2xl bg-white p-8 border border-slate-200 space-y-6">
              <h2 className="text-xl font-black text-[#1E3A8A]">
                Why Students Choose BRIGHTWAY COMPUTER EDUCATION
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 mb-2">
                    <BookOpen className="h-4 w-4 text-[#2563EB]" />
                    Hands-On Laboratory First
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every theoretical concept is paired with immediate practical execution on individual computer systems.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 mb-2">
                    <Users className="h-4 w-4 text-[#2563EB]" />
                    Experienced Faculty
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Structured batch timings with personal mentorship for both RGYCSM diploma students and Class IV–XII board students.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 mb-2">
                    <Shield className="h-4 w-4 text-[#2563EB]" />
                    Digital Student Portal
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every student gets an online account for instant Digital ID Card download and Razorpay tuition fee payment.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-5 py-2.5 text-xs font-extrabold transition-colors"
                >
                  <MapPin className="h-4 w-4 text-[#FBBF24]" />
                  <span>Locate Campus on Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#FBBF24]" />
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-5 py-2.5 text-xs font-extrabold transition-colors"
                >
                  <span>Go to Student Login</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
