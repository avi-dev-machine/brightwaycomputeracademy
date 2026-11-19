import Link from "next/link";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  IdCard,
  Laptop,
  ShieldCheck,
  Users,
  ArrowRight,
  Lock,
  MapPin,
  ExternalLink,
  Building2,
  FileCheck2,
} from "lucide-react";
import {
  PublicHeader,
  GOOGLE_MAPS_URL,
  RGYCSM_COURSES_URL,
} from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export const rgycsmCourses = [
  {
    code: "ADOAP",
    category: "RGYCSM Advance Diploma",
    title: "Advance Diploma in Office Accounting & Publishing",
    duration: "12 Months (2 Semesters)",
    eligibility: "10th Standard & Above",
    monthlyFee: "₹800 – ₹900 / Month",
    description:
      "Comprehensive 2-semester RGYCSM flagship program combining office automation, computerized financial accounting with GST, and professional graphic desktop publishing.",
    highlights: [
      "Sem 1: Computer Fundamentals, Windows OS, MS Office (Word, Excel, PowerPoint, Access), HTML & Internet",
      "Sem 2: Financial Accounting, Tally Prime with GST, Adobe Photoshop, CorelDRAW, PageMaker & Project Work",
      "RGYCSM Nationally Verified Advance Diploma Certificate",
      "1:1 Practical Lab Terminal Training",
    ],
  },
  {
    code: "DCAE",
    category: "RGYCSM Accounting Diploma",
    title: "Diploma in Computer Accounting Expert",
    duration: "9 – 12 Months",
    eligibility: "10th / 12th & Commerce Learners",
    monthlyFee: "₹800 – ₹900 / Month",
    description:
      "Job-oriented computerized accounting and taxation diploma accredited under RGYCSM for corporate bookkeeping, GST return filing, and business analytics.",
    highlights: [
      "Computer Fundamentals, Windows OS & Complete MS Office Productivity Suite",
      "Advanced Excel Spreadsheets, MIS Reporting & Business Formulas",
      "Financial Accounting, Inventory Management & Tally Prime with Live GST Filing",
      "Banking, Payroll, E-Way Bill & Practical Accounting Project",
    ],
  },
  {
    code: "DDTP",
    category: "RGYCSM Publishing Diploma",
    title: "Diploma in Desktop Publishing & Graphic Design",
    duration: "6 Months",
    eligibility: "10th Standard & Creative Learners",
    monthlyFee: "₹600 – ₹800 / Month",
    description:
      "Specialized practical diploma in print media, digital photo retouching, vector illustration, and commercial publishing tools.",
    highlights: [
      "Computer Fundamentals, OS & MS Word Document Formatting",
      "Adobe Photoshop — Photo Retouching, Color Grading & Banner Design",
      "CorelDRAW — Vector Logo Design, Brochures, Packaging & Print Layouts",
      "Adobe PageMaker — Book, Newspaper & Multi-Page Publication Design",
    ],
  },
  {
    code: "RCIT / DCA",
    category: "RGYCSM Foundation Certificate",
    title: "Certificate in Information Technology & Computer Applications",
    duration: "3 – 6 Months",
    eligibility: "All Students & Beginners",
    monthlyFee: "₹500 – ₹700 / Month",
    description:
      "Foundational computer literacy and office application certification designed for school/college students and first-time computer learners.",
    highlights: [
      "Computer Architecture, Operating Systems & File Management",
      "Microsoft Word, Excel & PowerPoint Presentation Mastery",
      "Internet Navigation, Email Etiquette, Digital Payments & Cyber Safety",
      "RGYCSM Official Certificate upon Examination Completion",
    ],
  },
  {
    code: "PYTHON & CS (CLASS IV–XII)",
    category: "Academic & Programming Track",
    title: "Python Programming, C/C++, Java & School Computer Science",
    duration: "Academic Session",
    eligibility: "Class IV to Class XII (ICSE / CBSE / WB Board)",
    monthlyFee: "₹450 – ₹800 / Month",
    description:
      "Dedicated board-aligned practical coaching in Python, Java, C++, SQL, and Computer Applications for school and higher-secondary students.",
    highlights: [
      "Python Programming, Data Structures, Object-Oriented Programming & SQL",
      "ICSE (Java / BlueJ), CBSE (Python / Informatics Practices) & WB Board Curriculum",
      "Hands-On Coding Lab Sessions & Board Project Guidance",
      "Regular Assessments & Individual Doubt-Clearing Mentorship",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-20 lg:py-28">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FBBF24_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/10 border border-[#FBBF24]/40 px-4 py-1.5 text-xs font-extrabold tracking-wider uppercase text-[#FBBF24]">
                  <Award className="h-4 w-4" />
                  <span>
                    Affiliated to RGYCSM (Rajiv Gandhi Youth Computer Saksharta Mission)
                  </span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
                  BRIGHTWAY{" "}
                  <span className="text-[#FBBF24]">COMPUTER EDUCATION</span>
                </h1>

                <p className="text-base sm:text-lg text-blue-100 max-w-2xl leading-relaxed">
                  Authorized computer training centre affiliated with{" "}
                  <a
                    href={RGYCSM_COURSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FBBF24] font-bold underline underline-offset-4 hover:text-white"
                  >
                    RGYCSM (rgycsm.org)
                  </a>
                  . Offering nationally recognized diploma &amp; certificate courses in Office Automation (ADOAP), Accounting (DCAE), Desktop Publishing (DDTP), Python, and Academic Computer Science.
                </p>

                {/* Primary CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-extrabold px-6 py-4 text-sm sm:text-base shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <GraduationCap className="h-5 w-5" />
                    <span>Student Portal Login</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/admissions"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#1E3A8A] font-extrabold px-6 py-4 text-sm sm:text-base shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    <FileCheck2 className="h-5 w-5 text-[#F59E0B]" />
                    <span>Online Admission Form</span>
                    <ArrowRight className="h-4 w-4 text-[#2563EB]" />
                  </Link>

                  <a
                    href={RGYCSM_COURSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-4 text-sm sm:text-base transition-colors"
                  >
                    <BookOpen className="h-4 w-4 text-[#FBBF24]" />
                    <span>RGYCSM Official Courses</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#FBBF24]" />
                  </a>

                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#FBBF24]/50 bg-[#0F172A]/60 hover:bg-[#0F172A] text-[#FBBF24] font-bold px-5 py-4 text-sm sm:text-base transition-colors"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>Campus Location</span>
                  </a>
                </div>

                {/* Quick Trust Bar */}
                <div className="pt-3 flex flex-wrap items-center gap-5 text-xs text-blue-200">
                  <Link
                    href="/login?mode=admin"
                    className="inline-flex items-center gap-1.5 text-[#FBBF24] hover:text-white font-bold underline underline-offset-4 transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Admin Portal (/admin)</span>
                  </Link>
                  <span>•</span>
                  <span>743+ Enrolled Students</span>
                  <span>•</span>
                  <span>RGYCSM Certified Diplomas</span>
                  <span>•</span>
                  <span>Online Razorpay Fee Desk</span>
                </div>
              </div>

              {/* Right Column: Student Digital Portal Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl bg-white text-slate-900 p-6 sm:p-8 shadow-2xl border-4 border-[#FBBF24]">
                  <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-[#1E3A8A] text-[#FBBF24] flex items-center justify-center font-bold shadow-sm">
                        <IdCard className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#1E3A8A]">
                          Brightway Student Portal
                        </h2>
                        <p className="text-xs text-slate-500">
                          Digital ID Card &amp; Online Monthly Fee Desk
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-extrabold">
                      Dec 2027 Cycle
                    </span>
                  </div>

                  <div className="mt-5 space-y-3.5">
                    <div className="flex items-start gap-3.5 rounded-xl bg-blue-50/80 p-4 border border-blue-100">
                      <CreditCard className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-extrabold text-[#1E3A8A]">
                          Instant Online Fee Payment (Razorpay)
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Check your current month fee status (PAID / UNPAID) and pay securely via UPI, Cards, or NetBanking with instant PDF receipt download.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3.5 rounded-xl bg-amber-50/80 p-4 border border-amber-200/80">
                      <IdCard className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          Official Digital Student ID Card
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Upload your passport photograph and download your official Brightway Computer Education ID card in PNG or PDF format.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0F172A] text-white p-4 text-xs space-y-1.5">
                      <p className="font-extrabold text-[#FBBF24] uppercase tracking-wider">
                        Student Sign-In Credentials
                      </p>
                      <p className="text-slate-300 leading-relaxed">
                        Sign in using your <strong className="text-white">STUDENT ID</strong> (e.g.{" "}
                        <code className="text-[#FBBF24] font-bold">RG240017</code>) and your{" "}
                        <strong className="text-white">PASSWORD</strong> (e.g.{" "}
                        <code className="text-[#FBBF24] font-bold">AGN0017</code> or your registered 10-digit contact number).
                      </p>
                    </div>

                    <Link
                      href="/login"
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-extrabold py-3.5 text-sm shadow-md transition-colors"
                    >
                      <span>Sign In to Student Portal</span>
                      <ArrowRight className="h-4 w-4 text-[#FBBF24]" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Institutional Highlights Strip */}
        <section className="border-b border-slate-200 bg-slate-50 py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: Award,
                  value: "RGYCSM",
                  label: "Affiliated National Youth Computer Mission",
                },
                {
                  icon: Users,
                  value: "743+ Students",
                  label: "Active Certificate & Academic Learners",
                },
                {
                  icon: Laptop,
                  value: "1:1 Practical",
                  label: "Individual Dedicated Computer Terminals",
                },
                {
                  icon: ShieldCheck,
                  value: "ISO 9001:2015",
                  label: "Verified Certification & Digital Ledger",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-xs border border-slate-200/90"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1E3A8A] text-[#FBBF24]">
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#1E3A8A]">
                      {stat.value}
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RGYCSM Affiliated Courses Section */}
        <section id="batches" className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider mb-3">
                  <FileCheck2 className="h-3.5 w-3.5 text-[#F59E0B]" />
                  <span>Affiliated with RGYCSM (rgycsm.org/courses)</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-black text-[#1E3A8A]">
                  Certified Computer Courses &amp; Academic Programs
                </h2>
                <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                  Every diploma and certificate program at{" "}
                  <strong>BRIGHTWAY COMPUTER EDUCATION</strong> follows the industry-recognized{" "}
                  <strong>Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)</strong> curriculum.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={RGYCSM_COURSES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-5 py-3 text-xs font-extrabold shadow-xs transition-colors"
                >
                  <Award className="h-4 w-4 text-[#FBBF24]" />
                  <span>Official RGYCSM Course Portal</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#FBBF24]" />
                </a>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#1E3A8A] px-4 py-3 text-xs font-extrabold transition-colors"
                >
                  <span>View Detailed Syllabus</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {rgycsmCourses.map((item) => (
                <div
                  key={item.code}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-[#2563EB]/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-[#1E3A8A] text-[#FBBF24] px-3 py-1 text-xs font-black tracking-wide">
                          {item.code}
                        </span>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-[#1E3A8A] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                        {item.monthlyFee}
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-semibold mb-4 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#F59E0B]" />
                        Duration: <strong>{item.duration}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Eligibility: <strong>{item.eligibility}</strong>
                      </span>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      {item.highlights.map((h) => (
                        <div
                          key={h}
                          className="flex items-start gap-2 text-xs text-slate-700 font-medium"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/admissions?course=${encodeURIComponent(item.code)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-3 py-1.5 text-xs font-extrabold transition-colors"
                    >
                      <span>Online Admission Form</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#2563EB] hover:text-[#1E3A8A]"
                    >
                      <span>Enrolled Student Login</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Affiliation & Campus Location Banner */}
        <section className="py-16 bg-slate-50 border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Card 1: Official RGYCSM Affiliation */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] text-white p-8 shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase">
                    <Award className="h-4 w-4" />
                    <span>National Computer Literacy Affiliation</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-black">
                    Affiliated with Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)
                  </h3>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    BRIGHTWAY COMPUTER EDUCATION is an authorized RGYCSM study and training centre. Students completing ADOAP, DCAE, DDTP, and RCIT receive nationally valid RGYCSM mark sheets and diploma certificates verifiable online.
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/15 flex flex-wrap items-center gap-3">
                  <a
                    href={RGYCSM_COURSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-extrabold px-5 py-3 text-xs shadow-md transition-colors"
                  >
                    <span>Explore Official RGYCSM Courses</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 text-xs transition-colors"
                  >
                    <span>About Our Centre</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Official Google Maps Location */}
              <div className="rounded-2xl bg-white border-2 border-slate-200 p-8 shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-[#1E3A8A] px-3.5 py-1 text-xs font-extrabold uppercase">
                    <MapPin className="h-4 w-4 text-[#F59E0B]" />
                    <span>Verified Campus Location</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                    Visit BRIGHTWAY COMPUTER EDUCATION
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Visit our computer laboratory and admission desk for course counseling, practical demonstrations, certificate collection, and offline support. Find exact directions on Google Maps.
                  </p>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 space-y-1.5">
                    <p className="font-extrabold text-[#1E3A8A] flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#2563EB]" />
                      <span>BRIGHTWAY COMPUTER EDUCATION</span>
                    </p>
                    <p className="text-slate-600">
                      Practical Computer Lab • Morning &amp; Evening Batches (Monday – Saturday)
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-extrabold px-5 py-3 text-xs shadow-md transition-colors"
                  >
                    <MapPin className="h-4 w-4 text-[#FBBF24]" />
                    <span>Open Location in Google Maps</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#FBBF24]" />
                  </a>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold px-4 py-3 text-xs transition-colors"
                  >
                    <span>Contact &amp; Timings</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
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
