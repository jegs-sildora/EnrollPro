import { Search } from "lucide-react";

export function TableSearchIndicator({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Search className="w-10 h-10 text-slate-400 animate-pulse" />
          <div className="flex flex-col items-center space-y-1">
            <p className="text-lg font-bold text-slate-600">Searching...</p>
            <p className="text-sm text-slate-400">Scanning DepEd records...</p>
          </div>
        </div>
      </td>
    </tr>
  );
}
