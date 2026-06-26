// @ts-nocheck
import { useState, useEffect } from "react";
import { FlaskConical, Loader2, AlertTriangle, RefreshCw, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/features/smart/components/ui/card";
import { Badge } from "@/features/smart/components/ui/badge";
import { Button } from "@/features/smart/components/ui/button";
import { Input } from "@/features/smart/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/features/smart/components/ui/table";
import { registrarApi } from "@/features/smart/lib/api";
import { Breadcrumb } from "@/features/smart/components/ui/breadcrumb";
import { useTheme } from "@/features/smart/contexts/ThemeContext";

export default function RemedialTracker() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await registrarApi.getRemedialPending({ page: p, limit: 20 });
      const payload = res.data as any;
      setItems(payload.items ?? payload.data ?? payload.learners ?? []);
      setMeta(payload.meta ?? { total: payload.total ?? 0, totalPages: Math.ceil((payload.total ?? 0) / 20) });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load remedial data from EnrollPro.");
      setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void load(page); }, [page]);

  const filtered = search
    ? items.filter((item) => {
        const name = `${item.lastName ?? ""} ${item.firstName ?? ""}`.toLowerCase();
        const lrn = String(item.lrn ?? "");
        return name.includes(search.toLowerCase()) || lrn.includes(search);
      })
    : items;

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[{ label: "Dashboard", href: "/registrar" }, { label: "Remedial Tracker" }]} />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Remedial Tracker</h1>
          <p className="text-gray-600 mt-1">
            Learners enrolled in remedial classes — read-only view from EnrollPro. Actions must be done in EnrollPro.
          </p>
        </div>
        <Button onClick={() => void load(page)} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 rounded-xl text-white" style={{ backgroundColor: colors.primary }}>
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Remedial Pending List</CardTitle>
                <CardDescription>{meta?.total ?? filtered.length} learner(s)</CardDescription>
              </div>
            </div>
            <Input
              placeholder="Search by name or LRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-xl border-gray-200"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.primary }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-gray-700 font-medium">Unable to load remedial data</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button onClick={() => void load(page)} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="font-bold text-gray-700">LRN</TableHead>
                    <TableHead className="font-bold text-gray-700">Learner Name</TableHead>
                    <TableHead className="font-bold text-gray-700">Sex</TableHead>
                    <TableHead className="font-bold text-gray-700">Grade / Section</TableHead>
                    <TableHead className="font-bold text-gray-700">Subject(s)</TableHead>
                    <TableHead className="font-bold text-gray-700">Failing Grade</TableHead>
                    <TableHead className="font-bold text-gray-700">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No remedial learners found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, i) => (
                      <TableRow key={item.enrollmentRecordId ?? item.learnerId ?? i}>
                        <TableCell className="font-mono text-sm text-gray-600">{item.lrn ?? "—"}</TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {item.lastName}, {item.firstName} {item.middleName ?? ""}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.sex === "MALE" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>
                            {item.sex ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.gradeLevel?.name ?? "—"} / {item.section?.name ?? "—"}</TableCell>
                        <TableCell>
                          {Array.isArray(item.subjects)
                            ? item.subjects.map((s: any) => s.name ?? s).join(", ")
                            : item.subjectName ?? "—"}
                        </TableCell>
                        <TableCell>
                          {item.failingGrade ?? item.grade ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-700">
                            {item.status ?? "PENDING"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && !error && meta && meta.totalPages > 1 && (
            <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Page {page} of {meta.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl">Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
