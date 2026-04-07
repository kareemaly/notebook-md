import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project } from '@/types';

interface Props {
  projects: Project[];
  activeId: string | null;
  onChange: (id: string) => void;
}

export function ProjectSwitcher({ projects, activeId, onChange }: Props) {
  return (
    <Select value={activeId ?? ''} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select project…" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
