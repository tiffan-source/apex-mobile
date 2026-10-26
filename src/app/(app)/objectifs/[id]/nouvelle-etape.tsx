import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { AddStageSheet } from '@/features/sheets/add-stage-sheet';

export default function AddStageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddStageSheet objectiveId={routeParam(id) ?? ''} />;
}
