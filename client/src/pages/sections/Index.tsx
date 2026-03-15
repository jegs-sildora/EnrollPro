import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, User, LayoutGrid, AlertCircle } from 'lucide-react';
import { sileo } from 'sileo';
import api from '@/api/axiosInstance';
import { useSettingsStore } from '@/stores/settingsStore';
import { toastApiError } from '@/hooks/useApiToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Teacher {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: Teacher | null;
}

interface GradeLevelSections {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: Section[];
}

export default function Sections() {
  const { activeAcademicYearId, viewingAcademicYearId } = useSettingsStore();
  const ayId = viewingAcademicYearId ?? activeAcademicYearId;

  const [data, setData] = useState<GradeLevelSections[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [selectedGlId, setSelectedGlId] = useState<number | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [teacherId, setTeacherId] = useState<string>('NONE');

  const fetchData = useCallback(async () => {
    if (!ayId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [secRes, teaRes] = await Promise.all([
        api.get(`/sections/${ayId}`),
        api.get('/admin/users?role=TEACHER&isActive=true&limit=100'),
      ]);
      setData(secRes.data.gradeLevels);
      setTeachers(teaRes.data.users);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!name || (!selectedGlId && !editingSection)) return;
    try {
      const payload = {
        name,
        maxCapacity: parseInt(capacity),
        advisingTeacherId: teacherId === 'NONE' ? null : parseInt(teacherId),
        gradeLevelId: selectedGlId,
      };

      if (editingSection) {
        await api.put(`/sections/${editingSection.id}`, payload);
        sileo.success({ title: 'Updated', description: 'Section details updated.' });
      } else {
        await api.post('/sections', payload);
        sileo.success({ title: 'Created', description: 'New section added.' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    try {
      await api.delete(`/sections/${id}`);
      sileo.success({ title: 'Deleted', description: 'Section removed.' });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage grade level sections and advising teachers</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
            Total Sections: {data.reduce((acc, gl) => acc + gl.sections.length, 0)}
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading sections...</div>
      ) : data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <LayoutGrid className="h-12 w-12 mx-auto text-[hsl(var(--muted-foreground))] opacity-20 mb-4" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No grade levels found for this academic year.</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Configure grade levels in the Curriculum tab first.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {data.map((gl) => (
            <div key={gl.gradeLevelId} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-bold">
                    {gl.gradeLevelName.match(/\d+/)?.[0] || '•'}
                  </Badge>
                  {gl.gradeLevelName}
                </h3>
                <Button size="xs" variant="outline" onClick={() => { 
                  setSelectedGlId(gl.gradeLevelId); 
                  setEditingSection(null); 
                  setName(''); 
                  setCapacity('40'); 
                  setTeacherId('NONE'); 
                  setDialogOpen(true); 
                }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Section
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gl.sections.length === 0 ? (
                  <div className="col-span-full py-6 text-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))/30]">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">No sections defined for {gl.gradeLevelName}.</p>
                  </div>
                ) : (
                  gl.sections.map((sec) => (
                    <Card key={sec.id} className="group overflow-hidden border shadow-sm hover:shadow-md transition-all">
                      <div className={`h-1.5 w-full ${sec.fillPercent >= 100 ? 'bg-red-500' : sec.fillPercent >= 85 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-bold">{sec.name}</CardTitle>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { 
                              setEditingSection(sec); 
                              setSelectedGlId(gl.gradeLevelId); 
                              setName(sec.name); 
                              setCapacity(String(sec.maxCapacity)); 
                              setTeacherId(sec.advisingTeacher?.id ? String(sec.advisingTeacher.id) : 'NONE'); 
                              setDialogOpen(true); 
                            }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sec.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-xs flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {sec.advisingTeacher ? sec.advisingTeacher.name : 'No Advisor Assigned'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Capacity</span>
                            <span className={`font-bold ${sec.fillPercent >= 100 ? 'text-red-600' : 'text-[hsl(var(--foreground))]'}`}>
                              {sec.enrolledCount} / {sec.maxCapacity}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${sec.fillPercent >= 100 ? 'bg-red-500' : sec.fillPercent >= 85 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(100, sec.fillPercent)}%` }} 
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] font-bold h-5">
                              {sec.fillPercent}% Full
                            </Badge>
                            {sec.fillPercent >= 100 && (
                              <Badge variant="destructive" className="text-[10px] font-bold h-5 animate-pulse">OVER CAPACITY</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Create New Section'}</DialogTitle>
            <DialogDescription>
              {editingSection ? `Update details for section ${editingSection.name}` : `Add a new section to ${data.find(gl => gl.gradeLevelId === selectedGlId)?.gradeLevelName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input placeholder="e.g. Diamond, Archimedes" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Maximum Capacity</Label>
              <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advising Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None / Assign Later</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingSection && editingSection.enrolledCount > parseInt(capacity) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 text-orange-800 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Warning: New capacity is lower than current enrollment ({editingSection.enrolledCount}). This section will be marked as over-capacity.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
