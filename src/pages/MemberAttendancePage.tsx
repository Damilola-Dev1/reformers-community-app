import MyAttendance from "../components/MyAttendance";

function MemberAttendancePage() {
  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Attendance
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Your record for every finalised service.
        </p>
        <MyAttendance full />
      </div>
    </div>
  );
}

export default MemberAttendancePage;
