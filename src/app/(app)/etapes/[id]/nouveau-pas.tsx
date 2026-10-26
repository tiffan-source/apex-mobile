import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { AddTaskSheet } from '@/features/sheets/add-task-sheet';

export default function AddTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddTaskSheet stageId={routeParam(id) ?? ''} />;
}
