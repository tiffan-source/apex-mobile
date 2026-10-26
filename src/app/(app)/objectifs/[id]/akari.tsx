import { useLocalSearchParams } from 'expo-router';
import { AkariScreen } from '@/features/akari/akari-screen';
import { routeParam } from '@/features/shell/routes';

export default function AkariRoute() {
  const { id, etape } = useLocalSearchParams<{ id: string; etape?: string }>();
  const objectiveId = routeParam(id) ?? '';
  const stageId = routeParam(etape);
  // Un autre objectif, une autre étape : une nouvelle conversation (l'invitation revient).
  return <AkariScreen key={`${objectiveId}|${stageId ?? ''}`} objectiveId={objectiveId} stageId={stageId} />;
}
