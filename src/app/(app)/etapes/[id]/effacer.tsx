import { useLocalSearchParams } from 'expo-router';
import { routeParam } from '@/features/shell/routes';
import { EraseStageSheet } from '@/features/sheets/erase-stage-sheet';

export default function EraseStageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EraseStageSheet stageId={routeParam(id) ?? ''} />;
}
