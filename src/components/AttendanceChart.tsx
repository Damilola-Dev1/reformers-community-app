import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";

type ChartService = {
  id: string;
  title: string;
  date: string;
  finalized: boolean;
};

type Mark = {
  serviceId: string;
  memberId: string;
  status: string;
};

type AttendanceChartProps = {
  services: ChartService[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function shortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return Number(match[3]) + " " + MONTHS[Number(match[2]) - 1];
}

function AttendanceChart({ services }: AttendanceChartProps) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const membersQuery = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
          where("status", "==", "approved"),
        );
        const attendanceQuery = query(
          collection(db, "attendance"),
          where("communityId", "==", settings.communityId),
        );
        const [memberSnap, attendanceSnap] = await Promise.all([
          getDocs(membersQuery),
          getDocs(attendanceQuery),
        ]);

        const approvedIds = new Set(memberSnap.docs.map((d) => d.id));
        const found: Mark[] = [];
        attendanceSnap.docs.forEach((d) => {
          const data = d.data();
          const memberId = String(data.memberId ?? "");
          if (approvedIds.has(memberId)) {
            found.push({
              serviceId: String(data.serviceId ?? ""),
              memberId: memberId,
              status: String(data.status ?? ""),
            });
          }
        });
        setMarks(found);
      } catch (err) {
        console.error(err);
        setError("Could not load the attendance chart.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const rows = useMemo(() => {
    const finalized = services
      .filter((s) => s.finalized)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12);

    const result: {
      label: string;
      percent: number;
      present: number;
      total: number;
      title: string;
    }[] = [];
    finalized.forEach((s) => {
      let present = 0;
      let total = 0;
      marks.forEach((m) => {
        if (m.serviceId === s.id) {
          total += 1;
          if (m.status === "present") present += 1;
        }
      });
      if (total > 0) {
        result.push({
          label: shortDate(s.date),
          percent: Math.round((present / total) * 100),
          present: present,
          total: total,
          title: s.title,
        });
      }
    });
    return result;
  }, [services, marks]);

  return (
    <section className="mb-6 rounded-panel border border-line bg-white p-4">
      <h2 className="font-display text-xl font-semibold text-ink">
        Attendance by service
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        Share of approved members present, for the last finalised services
      </p>

      {loading ? (
        <p className="text-[15px] text-muted">Loading...</p>
      ) : error ? (
        <p role="alert" className="text-[15px] font-semibold text-danger">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[15px] text-muted">
          Finalise a service to see the chart.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D6" />
              <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#5F5757" }} />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 13, fill: "#5F5757" }}
              />
              <Tooltip
                formatter={(value) => [String(value) + "%", "Attendance"]}
              />
              <Bar
                dataKey="percent"
                name="Attendance"
                fill="#7A1E2E"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default AttendanceChart;
