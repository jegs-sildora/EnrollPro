import { useState, useEffect, useCallback } from 'react';
import { sileo } from 'sileo';
import { Plus, Trash2, Grid3X3, X, Check, Edit2 } from 'lucide-react';
import api from '@/api/axiosInstance';
import { useSettingsStore } from '@/stores/settingsStore';
import { toastApiError } from '@/hooks/useApiToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Skeleton } from '@/components/ui/skeleton';

interface Teacher {
  id: number;
  name: string;
  email: string;
}

interface SectionItem {
  id: number;
  name: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface GradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: SectionItem[];
}

function fillColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-orange-400';
  if (pct >= 50) return 'bg-yellow-400';
  return 'bg-green-500';
}

function fillEmoji(pct: number): string {
  if (pct >= 90) return '🔴';
  if (pct >= 75) return '🟠';
  if (pct >= 50) return '🟡';
  return '🟢';
}

export default function SectionsTab() {
  const { activeAcademicYearId, viewingAcademicYearId } = useSettingsStore();
  const ayId = viewingAcademicYearId ?? activeAcademicYearId;

  const [activeLevel, setActiveLevel] = useState('JHS');
  const [groups, setGroups] = useState<GradeLevelGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline add section state
  const [addGlId, setAddGlId] = useState<number | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionCap, setSectionCap] = useState('40');
  const [advisingTeacherId, setAdvisingTeacherId] = useState<string>('none');
  const [adding, setAdding] = useState(false);

  // Edit section state
  const [editSection, setEditSection] = useState<SectionItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCap, setEditCap] = useState('40');
  const [editAdvisingTeacherId, setEditAdvisingTeacherId] = useState<string>('none');
  const [editing, setEditing] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [res, teachersRes] = await Promise.all([
        api.get(`/sections/${ayId}`, { params: { level: activeLevel } }),
        api.get('/sections/teachers')
      ]);
      setGroups(res.data.gradeLevels);
      setTeachers(teachersRes.data.teachers);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, activeLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleAddMode = (glId: number) => {
    if (addGlId === glId) {
      setAddGlId(null);
    } else {
      setAddGlId(glId);
      setSectionName('');
      setSectionCap('40');
      setAdvisingTeacherId('none');
    }
  };

  const handleAdd = async () => {
    if (!addGlId || !sectionName.trim()) return;
    setAdding(true);
    try {
      await api.post('/sections', {
        name: sectionName.trim(),
        maxCapacity: parseInt(sectionCap) || 40,
        gradeLevelId: addGlId,
        advisingTeacherId: advisingTeacherId === 'none' ? null : parseInt(advisingTeacherId)
      });
      sileo.success({ title: 'Section Added', description: sectionName.trim() });
      setAddGlId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (section: SectionItem) => {
    setEditSection(section);
    setEditName(section.name);
    setEditCap(section.maxCapacity.toString());
    setEditAdvisingTeacherId(section.advisingTeacher ? section.advisingTeacher.id.toString() : 'none');
  };

  const handleEdit = async () => {
    if (!editSection || !editName.trim()) return;
    setEditing(true);
    try {
      await api.put(`/sections/${editSection.id}`, {
        name: editName.trim(),
        maxCapacity: parseInt(editCap) || 40,
        advisingTeacherId: editAdvisingTeacherId === 'none' ? null : parseInt(editAdvisingTeacherId)
      });
      sileo.success({ title: 'Section Updated', description: editName.trim() });
      setEditSection(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/sections/${deleteId}`);
      sileo.success({ title: 'Deleted', description: deleteName });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setDeleting(false);
    }
  };

  if (!ayId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No school year selected. Set an active year or choose one from the header switcher.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs 
        value={activeLevel} 
        onValueChange={setActiveLevel}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="JHS" className="flex-1 min-w-25">Junior High School</TabsTrigger>
          <TabsTrigger value="SHS" className="flex-1 min-w-25">Senior High School</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Capacity Heatmap overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Grid3X3 className="h-5 w-5" />
                Capacity Heatmap
              </CardTitle>
              <CardDescription>
                Visual overview of section fill rates. 🟢 &lt;50% · 🟡 50-74% · 🟠 75-89% · 🔴 90%+
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No grade levels with sections found.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.flatMap((g) =>
                    g.sections.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
                      >
                        <span className="text-lg">{fillEmoji(s.fillPercent)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.gradeLevelName} — {s.name}</p>
                          <div className="mt-1 h-2 w-full rounded-full bg-[hsl(var(--muted))]">
                            <div
                              className={`h-2 rounded-full transition-all ${fillColor(s.fillPercent)}`}
                              style={{ width: `${Math.min(s.fillPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {s.enrolledCount}/{s.maxCapacity}
                        </span>
                      </div>
                    ))
                  )}
                  {groups.every((g) => g.sections.length === 0) && (
                    <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No sections created yet. Add sections to grade levels below.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sections grouped by grade level */}
          <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.gradeLevelId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{g.gradeLevelName}</CardTitle>
                  <Button 
                    size="sm" 
                    variant={addGlId === g.gradeLevelId ? "ghost" : "outline"} 
                    onClick={() => toggleAddMode(g.gradeLevelId)}
                  >
                    {addGlId === g.gradeLevelId ? (
                      <><X className="mr-1 h-3 w-3" /> Cancel</>
                    ) : (
                      <><Plus className="mr-1 h-3 w-3" /> Add Section</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {addGlId === g.gradeLevelId && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Section Name</Label>
                        <Input 
                          placeholder="e.g. Section A" 
                          value={sectionName} 
                          onChange={(e) => setSectionName(e.target.value)} 
                          className="h-9 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Capacity</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={sectionCap} 
                          onChange={(e) => setSectionCap(e.target.value)} 
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs">Advising Teacher (Optional)</Label>
                        <Select value={advisingTeacherId} onValueChange={setAdvisingTeacherId}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Advising Teacher</SelectItem>
                            {teachers.map(t => (
                              <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full" 
                      onClick={handleAdd} 
                      disabled={adding || !sectionName.trim()}
                    >
                      {adding ? 'Adding...' : <><Check className="mr-1 h-3 w-3" /> Save Section</>}
                    </Button>
                    <Separator />
                  </div>
                )}

                {g.sections.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-2">No sections</p>
                ) : (
                  <div className="space-y-2">
                    {g.sections.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2"
                      >
                        <span className="text-sm">{fillEmoji(s.fillPercent)}</span>
                        <span className="flex-1 text-sm font-medium">{s.name}</span>
                        {s.advisingTeacher && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-25" title={s.advisingTeacher.name}>
                            {s.advisingTeacher.name}
                          </span>
                        )}
                        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                          {s.enrolledCount}/{s.maxCapacity} ({s.fillPercent}%)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(s)}
                          title="Edit section"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-[hsl(var(--destructive))]"
                          onClick={() => { setDeleteId(s.id); setDeleteName(s.name); }}
                          disabled={s.enrolledCount > 0}
                          title={s.enrolledCount > 0 ? 'Cannot delete — has enrolled students' : 'Delete section'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
        </>
      )}

      {/* Edit Section Dialog */}
      <Dialog open={!!editSection} onOpenChange={(open) => !open && setEditSection(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input placeholder="e.g. Section A" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max Capacity</Label>
              <Input type="number" min="1" value={editCap} onChange={(e) => setEditCap(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advising Teacher</Label>
              <Select value={editAdvisingTeacherId} onValueChange={setEditAdvisingTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Advising Teacher</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editing || !editName.trim()}>
              {editing ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Section"
        description={`Are you sure you want to delete the section "${deleteName}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
