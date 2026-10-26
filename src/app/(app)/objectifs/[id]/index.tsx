import { useLocalSearchParams } from 'expo-router';
import { ObjectiveScreen } from '@/features/objective/objective-screen';
import { routeParam } from '@/features/shell/routes';

export default function ObjectiveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const objectiveId = routeParam(id) ?? '';
  return <ObjectiveScreen key={objectiveId} objectiveId={objectiveId} />;
}
