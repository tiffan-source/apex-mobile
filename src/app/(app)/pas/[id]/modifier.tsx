import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { EditTaskSheet } from '@/features/sheets/edit-task-sheet';

export default function EditTaskRoute() {
  const { id, etape } = useLocalSearchParams<{ id: string; etape?: string }>();
  return <EditTaskSheet taskId={routeParam(id) ?? ''} shownStageId={routeParam(etape)} />;
}
