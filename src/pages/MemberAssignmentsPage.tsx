import MemberAssignments from "../components/MemberAssignments";

function MemberAssignmentsPage() {
  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Assignments
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Open an assignment to read the instructions and submit your answer.
        </p>
        <MemberAssignments />
      </div>
    </div>
  );
}

export default MemberAssignmentsPage;
