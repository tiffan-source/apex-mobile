import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { EditStageSheet } from '@/features/sheets/edit-stage-sheet';

export default function EditStageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditStageSheet stageId={routeParam(id) ?? ''} />;
}
