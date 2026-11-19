"use client";

import { useState } from "react";
import {
  MessageSquare,
  Smartphone,
  Mail,
  Send,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

interface DispatchRecord {
  id: string;
  student_id: string;
  student_name: string;
  contact_number: string;
  batch: string;
  month_year: string;
  amount: number;
  payment_link: string;
  whatsapp_url?: string | null;
  message: string;
}

export default function AdminNotificationsPage() {
  const [monthYear, setMonthYear] = useState("2026-10");
  const [batch, setBatch] = useState("ALL");
  const [channels, setChannels] = useState<string[]>([
    "WHATSAPP",
    "SMS",
    "EMAIL",
  ]);
  const [isSending, setIsSending] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const { toast } = useToast();

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleDispatch = async () => {
    if (channels.length === 0) {
      toast({
        type: "error",
        title: "Select at least one channel",
        description: "Choose WhatsApp, SMS, or Email.",
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await api.post<{
        total_unpaid_targeted: number;
        sent_count: number;
        dispatches: DispatchRecord[];
      }>("/v1/notifications/bulk-reminders", {
        month_year: monthYear,
        batch: batch !== "ALL" ? batch : undefined,
        channels,
        limit: 100,
      });

      setDispatches(res.dispatches || []);
      toast({
        type: "success",
        title: "Reminders Dispatched",
        description: `Generated & dispatched personalized payment links for ${res.sent_count} unpaid students.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Dispatch Failed",
        description:
          err instanceof Error ? err.message : "Could not dispatch reminders.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div>
          <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-extrabold uppercase">
            Multi-Channel Reminder Engine
          </span>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold text-[#1E3A8A]">
            Automated Fee Payment Notification Dispatcher
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Dispatch personalized payment reminder links to students with unpaid dues across WhatsApp Cloud API, SMS (Fast2SMS/Twilio), and Email.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
              Target Billing Month
            </label>
            <input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
              Filter by Course Batch
            </label>
            <input
              type="text"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="ALL or e.g. ADOAP, DCAE"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
              Active Messaging Channels
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
                { id: "SMS", label: "SMS", icon: Smartphone },
                { id: "EMAIL", label: "Email", icon: Mail },
              ].map((ch) => {
                const active = channels.includes(ch.id);
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                      active
                        ? "bg-[#1E3A8A] text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 text-[#FBBF24]" />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isSending}
            onClick={handleDispatch}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white px-6 py-3 text-sm font-extrabold shadow-md transition-colors cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
            ) : (
              <Send className="h-4 w-4 text-[#FBBF24]" />
            )}
            <span>
              {isSending
                ? "Dispatching Multi-Channel Reminders..."
                : `Dispatch Reminders for Unpaid Students (${monthYear})`}
            </span>
          </button>
        </div>
      </div>

      {dispatches.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="font-display text-lg font-extrabold text-[#1E3A8A]">
              Dispatched Payment Reminder Links ({dispatches.length})
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Student</th>
                  <th className="py-3 px-4 font-bold">Batch &amp; Due</th>
                  <th className="py-3 px-4 font-bold">Personalized Payment Link</th>
                  <th className="py-3 px-4 font-bold text-right">Direct Launch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{d.student_name}</p>
                      <p className="font-mono text-[11px] text-[#1E3A8A]">
                        {d.student_id} • {d.contact_number}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800">{d.batch}</span>
                      <p className="text-amber-700 font-extrabold">
                        ₹{d.amount} ({d.month_year})
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {d.payment_link}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {d.whatsapp_url && (
                        <a
                          href={d.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-extrabold"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Open WhatsApp</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
