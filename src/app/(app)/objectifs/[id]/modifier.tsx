import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { EditObjectiveSheet } from '@/features/sheets/edit-objective-sheet';

export default function EditObjectiveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditObjectiveSheet objectiveId={routeParam(id) ?? ''} />;
}
