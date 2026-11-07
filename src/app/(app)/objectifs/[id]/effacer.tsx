import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { EraseObjectiveSheet } from '@/features/sheets/erase-objective-sheet';

export default function EraseObjectiveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EraseObjectiveSheet objectiveId={routeParam(id) ?? ''} />;
}
