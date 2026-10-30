import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type GrowthMember = {
  date: Date;
  gender: string;
};

type MemberGrowthChartProps = {
  members: GrowthMember[];
  loading: boolean;
};

function MemberGrowthChart({ members, loading }: MemberGrowthChartProps) {
  const data = useMemo(() => {
    const dated = members.filter(
      (m) => m.gender === "male" || m.gender === "female",
    );
    if (dated.length === 0) return [];

    const male = new Map<number, number>();
    const female = new Map<number, number>();
    let earliest = Infinity;
    let latest = -Infinity;

    dated.forEach((m) => {
      const key = m.date.getFullYear() * 4 + Math.floor(m.date.getMonth() / 3);
      const target = m.gender === "male" ? male : female;
      target.set(key, (target.get(key) ?? 0) + 1);
      if (key < earliest) earliest = key;
      if (key > latest) latest = key;
    });

    const now = new Date();
    const currentKey = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
    const last = Math.max(currentKey, latest);

    const rows: { label: string; Men: number; Women: number }[] = [];
    let runningMale = 0;
    let runningFemale = 0;
    for (let key = earliest; key <= last; key++) {
      runningMale += male.get(key) ?? 0;
      runningFemale += female.get(key) ?? 0;
      const year = Math.floor(key / 4);
      const quarter = (key % 4) + 1;
      rows.push({
        label: "Q" + quarter + " " + String(year).slice(2),
        Men: runningMale,
        Women: runningFemale,
      });
    }
    return rows;
  }, [members]);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">
        Member growth
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        Approved members, running total by quarter of registration
      </p>

      {loading ? (
        <p className="text-[15px] text-muted">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-[15px] text-muted">
          No registration dates yet. The chart appears once members are
          approved.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D6" />
              <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#5F5757" }} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 13, fill: "#5F5757" }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Men"
                stroke="#7A1E2E"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Women"
                stroke="#1F5A5E"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default MemberGrowthChart;
