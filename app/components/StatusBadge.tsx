const colors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  claimed: "bg-yellow-100 text-yellow-800",
  delivered: "bg-blue-100 text-blue-800",
  completed: "bg-gray-200 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  submitted: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};


export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}
 