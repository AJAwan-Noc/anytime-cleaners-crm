import KanbanBoard from '@/components/dashboard/KanbanBoard';

export default function Pipeline() {
  return (
    <div className="h-full flex flex-col min-h-0">
      <h1 className="text-2xl font-bold mb-4">Lead Pipeline</h1>
      <div className="flex-1 min-h-0">
        <KanbanBoard fullHeight />
      </div>
    </div>
  );
}
