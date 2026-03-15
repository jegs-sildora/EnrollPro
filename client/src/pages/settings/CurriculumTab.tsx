import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Layers, Plus, Trash2, Edit2, ShieldCheck, Calendar, Info } from 'lucide-react';
import { sileo } from 'sileo';
import api from '@/api/axiosInstance';
import { useSettingsStore } from '@/stores/settingsStore';
import { toastApiError } from '@/hooks/useApiToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';

interface GradeLevel {
  id: number;
  name: string;
  displayOrder: number;
  sections: { id: number; _count: { enrollments: number } }[];
  _count?: { applicants: number };
}

interface Strand {
  id: number;
  name: string;
  applicableGradeLevelIds: number[];
  curriculumType: 'OLD_STRAND' | 'ELECTIVE_CLUSTER';
  track: 'ACADEMIC' | 'TECHPRO' | null;
}

interface ScpConfig {
  id?: number;
  scpType: string;
  isOffered: boolean;
  cutoffScore: number | null;
  examDate: string | null;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  notes: string | null;
}

const SCP_TYPES = [
  { value: 'STE', label: 'Science, Technology, and Engineering (STE)' },
  { value: 'SPA', label: 'Special Program in the Arts (SPA)' },
  { value: 'SPS', label: 'Special Program in Sports (SPS)' },
  { value: 'SPJ', label: 'Special Program in Journalism (SPJ)' },
  { value: 'SPFL', label: 'Special Program in Foreign Language (SPFL)' },
  { value: 'SPTVE', label: 'Special Program in Tech-Voc Education (SPTVE)' },
  { value: 'STEM_GRADE11', label: 'Grade 11 STEM (Placement Exam)' },
];

export default function CurriculumTab() {
  const { activeAcademicYearId, viewingAcademicYearId } = useSettingsStore();
  const ayId = viewingAcademicYearId ?? activeAcademicYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [scpConfigs, setScpConfigs] = useState<ScpConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [stDialogOpen, setStDialogOpen] = useState(false);
  const [stEditing, setStEditing] = useState<Strand | null>(null);
  const [stName, setStName] = useState('');
  const [stType, setStType] = useState<'OLD_STRAND' | 'ELECTIVE_CLUSTER'>('OLD_STRAND');
  const [stTrack, setStTrack] = useState<'ACADEMIC' | 'TECHPRO' | 'NONE'>('NONE');

  const [matrixDirty, setMatrixDirty] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingScp, setSavingScp] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [glRes, stRes, scpRes] = await Promise.all([
        api.get(`/curriculum/${ayId}/grade-levels`),
        api.get(`/curriculum/${ayId}/strands`),
        api.get(`/curriculum/${ayId}/scp-config`),
      ]);
      setGradeLevels(glRes.data.gradeLevels);
      setStrands(stRes.data.strands);
      
      // Merge official SCP types with fetched configs
      const fetched = scpRes.data.scpConfigs as ScpConfig[];
      const merged = SCP_TYPES.map(type => {
        const found = fetched.find(f => f.scpType === type.value);
        return found || {
          scpType: type.value,
          isOffered: false,
          cutoffScore: null,
          examDate: null,
          artFields: [],
          languages: [],
          sportsList: [],
          notes: null
        };
      });
      setScpConfigs(merged);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Strand Actions ───────────────────────────────────────


  const handleSaveStrand = async () => {
    if (!ayId || !stName) return;
    try {
      const data = {
        name: stName,
        curriculumType: stType,
        track: stTrack === 'NONE' ? null : stTrack,
      };
      if (stEditing) {
        await api.put(`/curriculum/strands/${stEditing.id}`, data);
        sileo.success({ title: 'Updated', description: 'Curriculum item updated.' });
      } else {
        await api.post(`/curriculum/${ayId}/strands`, data);
        sileo.success({ title: 'Created', description: 'Curriculum item created.' });
      }
      setStDialogOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleDeleteStrand = async (id: number) => {
    if (!confirm('Are you sure you want to delete this curriculum item?')) return;
    try {
      await api.delete(`/curriculum/strands/${id}`);
      sileo.success({ title: 'Deleted', description: 'Curriculum item removed.' });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  // ─── SCP Actions ──────────────────────────────────────────

  const handleUpdateScpField = (index: number, field: keyof ScpConfig, value: string | boolean | number | string[] | null) => {
    const next = [...scpConfigs];
    next[index] = { ...next[index], [field]: value };
    setScpConfigs(next);
  };

  const handleSaveScp = async () => {
    if (!ayId) return;
    setSavingScp(true);
    try {
      await api.put(`/curriculum/${ayId}/scp-config`, { scpConfigs });
      sileo.success({ title: 'SCP Configuration Saved', description: 'Special programs updated for this year.' });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingScp(false);
    }
  };

  // ─── Matrix Actions ───────────────────────────────────────

  const toggleMatrixCell = (strandId: number, glId: number) => {
    setStrands((prev) =>
      prev.map((s) => {
        if (s.id !== strandId) return s;
        const has = s.applicableGradeLevelIds.includes(glId);
        return {
          ...s,
          applicableGradeLevelIds: has
            ? s.applicableGradeLevelIds.filter((id) => id !== glId)
            : [...s.applicableGradeLevelIds, glId],
        };
      })
    );
    setMatrixDirty(true);
  };

  const handleSaveMatrix = async () => {
    if (!ayId) return;
    setSavingMatrix(true);
    try {
      const matrix = strands.map((s) => ({
        strandId: s.id,
        gradeLevelIds: s.applicableGradeLevelIds,
      }));
      const res = await api.put(`/curriculum/${ayId}/strand-matrix`, { matrix });
      setStrands(res.data.strands);
      setMatrixDirty(false);
      sileo.success({ title: 'Matrix Saved', description: 'Strand-to-grade assignments updated.' });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingMatrix(false);
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

  if (loading) {
    return <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">Loading curriculum…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Grade Levels */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5" />
              Grade Levels
            </CardTitle>
            <CardDescription>View grade levels offered by the school</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b pb-1">Junior High School</p>
              {[...gradeLevels]
                .filter((gl) => gl.displayOrder >= 7 && gl.displayOrder <= 10)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((gl) => (
                  <div key={gl.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{gl.name}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{gl.sections.length} sections</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b pb-1">Senior High School</p>
              {[...gradeLevels]
                .filter((gl) => gl.displayOrder >= 11)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((gl) => (
                  <div key={gl.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{gl.name}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{gl.sections.length} sections</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCP Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5" />
              Special Curricular Programs (SCP)
            </CardTitle>
            <CardDescription>Configure admission criteria for STE, SPA, SPS, etc.</CardDescription>
          </div>
          <Button size="sm" onClick={handleSaveScp} disabled={savingScp}>
            {savingScp ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {scpConfigs.map((scp, idx) => (
              <div key={scp.scpType} className="rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]">
                <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--muted))] border-b">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={scp.isOffered} 
                      onCheckedChange={(checked) => handleUpdateScpField(idx, 'isOffered', checked)} 
                    />
                    <span className="text-sm font-bold">
                      {SCP_TYPES.find(t => t.value === scp.scpType)?.label || scp.scpType}
                    </span>
                  </div>
                  {scp.isOffered && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">ACTIVE</Badge>
                  )}
                </div>
                
                {scp.isOffered && (
                  <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex flex-col gap-1 flex-1 min-w-35">
                        <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Admission Date</Label>
                        <DatePicker 
                          date={scp.examDate ? new Date(scp.examDate) : undefined}
                          setDate={(d) => handleUpdateScpField(idx, 'examDate', d ? d.toISOString() : null)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-30">
                        <Label className="text-xs flex items-center gap-1"><Info className="h-3 w-3" /> Cut-off Score</Label>
                        <Input type="number" placeholder="Min score to pass" className="h-8 text-xs" value={scp.cutoffScore ?? ''} onChange={e => handleUpdateScpField(idx, 'cutoffScore', e.target.value ? parseFloat(e.target.value) : null)} />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-40">
                        <Label className="text-xs">Program Notes</Label>
                        <Input placeholder="Additional requirements or details..." className="h-8 text-xs" value={scp.notes || ''} onChange={e => handleUpdateScpField(idx, 'notes', e.target.value)} />
                      </div>
                    </div>

                    {['SPA'].includes(scp.scpType) && (
                      <div className="space-y-2">
                        <Label className="text-xs">Art Fields (Comma separated)</Label>
                        <Input 
                          placeholder="Visual Arts, Music, Theatre..." 
                          className="h-8 text-xs" 
                          value={scp.artFields.join(', ')} 
                          onChange={e => handleUpdateScpField(idx, 'artFields', e.target.value.split(',').map(s => s.trim()))}
                        />
                      </div>
                    )}
                    {['SPS'].includes(scp.scpType) && (
                      <div className="space-y-2">
                        <Label className="text-xs">Sports List (Comma separated)</Label>
                        <Input 
                          placeholder="Basketball, Volleyball, Archery..." 
                          className="h-8 text-xs" 
                          value={scp.sportsList.join(', ')} 
                          onChange={e => handleUpdateScpField(idx, 'sportsList', e.target.value.split(',').map(s => s.trim()))}
                        />
                      </div>
                    )}
                    {['SPFL'].includes(scp.scpType) && (
                      <div className="space-y-2">
                        <Label className="text-xs">Languages Offered (Comma separated)</Label>
                        <Input 
                          placeholder="Spanish, Japanese, French..." 
                          className="h-8 text-xs" 
                          value={scp.languages.join(', ')} 
                          onChange={e => handleUpdateScpField(idx, 'languages', e.target.value.split(',').map(s => s.trim()))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strands / Clusters / Tracks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layers className="h-5 w-5" />
              SHS Curriculum & Tracks
            </CardTitle>
            <CardDescription>
              DepEd DM 012, s. 2026: Tracks & Clusters for G11 · Strands for G12
            </CardDescription>
          </div>
          <Dialog open={stDialogOpen} onOpenChange={setStDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setStEditing(null); setStName(''); setStType('OLD_STRAND'); setStTrack('NONE'); }}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{stEditing ? 'Edit Curriculum Item' : 'Add Curriculum Item'}</DialogTitle>
                <DialogDescription>Define a Track, Cluster, or Strand.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Academic, STEM, ICT Cluster" value={stName} onChange={e => setStName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={stType} onValueChange={(v: 'OLD_STRAND' | 'ELECTIVE_CLUSTER') => setStType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ELECTIVE_CLUSTER">Elective Cluster / Track (DM 012)</SelectItem>
                      <SelectItem value="OLD_STRAND">Old Strand (Transition)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Track (Optional)</Label>
                  <Select value={stTrack} onValueChange={(v: 'ACADEMIC' | 'TECHPRO' | 'NONE') => setStTrack(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No Specific Track</SelectItem>
                      <SelectItem value="ACADEMIC">Academic</SelectItem>
                      <SelectItem value="TECHPRO">Technical-Professional (TechPro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveStrand}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* DM 012 Curriculum */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-[hsl(var(--muted-foreground))]">DM 012, s. 2026 Curriculum (Grade 11)</h3>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Track-Based</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strands.filter(s => s.curriculumType === 'ELECTIVE_CLUSTER').map(s => (
                  <div key={s.id} className="flex items-center justify-between group rounded-xl border border-[hsl(var(--border))] px-4 py-3 bg-[hsl(var(--card))]">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{s.name}</span>
                      <div className="flex gap-2 mt-1">
                        {s.track && <Badge variant="secondary" className="text-[10px] h-4">{s.track}</Badge>}
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.applicableGradeLevelIds.length} levels</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStEditing(s); setStName(s.name); setStType(s.curriculumType); setStTrack(s.track || 'NONE'); setStDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteStrand(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Old Strand Curriculum */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-[hsl(var(--muted-foreground))]">Old Strand-Based Curriculum (Grade 12)</h3>
                <Badge variant="outline">Transition</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strands.filter(s => s.curriculumType === 'OLD_STRAND').map(s => (
                  <div key={s.id} className="flex items-center justify-between group rounded-xl border border-[hsl(var(--border))] px-4 py-3 bg-[hsl(var(--card))]">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{s.name}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{s.applicableGradeLevelIds.length} levels</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStEditing(s); setStName(s.name); setStType(s.curriculumType); setStTrack(s.track || 'NONE'); setStDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteStrand(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strand-to-Grade Matrix */}
      {strands.length > 0 && gradeLevels.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Curriculum-to-Grade Matrix</CardTitle>
              <CardDescription>Map Tracks, Clusters, and Strands to Grade Levels</CardDescription>
            </div>
            {matrixDirty && (
              <Button size="sm" onClick={handleSaveMatrix} disabled={savingMatrix}>
                {savingMatrix ? 'Saving...' : 'Save Matrix'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--muted))] border-b">
                    <th className="text-left px-4 py-3 font-bold text-[hsl(var(--muted-foreground))] w-64">Item</th>
                    {[...gradeLevels].sort((a,b) => a.displayOrder - b.displayOrder).map((gl) => (
                      <th key={gl.id} className="px-3 py-3 text-center font-bold text-[hsl(var(--muted-foreground))]">
                        {gl.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {strands.map((s) => (
                    <tr key={s.id} className="hover:bg-[hsl(var(--muted))] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold">{s.name}</span>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.curriculumType.replace('_', ' ')}</span>
                        </div>
                      </td>
                      {[...gradeLevels].sort((a,b) => a.displayOrder - b.displayOrder).map((gl) => {
                        const checked = s.applicableGradeLevelIds.includes(gl.id);
                        return (
                          <td key={gl.id} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMatrixCell(s.id, gl.id)}
                              className="h-5 w-5 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))] cursor-pointer transition-transform hover:scale-110"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
