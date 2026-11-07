import { useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { View, type ScrollViewInstance, type ViewInstance } from 'react-native';
import {
  EArete,
  EBouton,
  EFilAriane,
  EIcone,
  ELegendeArete,
  EListe,
  ENote,
  EPas,
  ETache,
  ETexte,
  type EtapeAreteIdentifiee,
  creerStyles,
} from '@empreinte-studio/react-native';
import { TITRES_QUADRANTS } from '@/domain/objectives/eisenhower';
import {
  foldedDoneStageId,
  openStageId,
  stageName,
  type ObjectiveDetail,
  type StageTaskView,
  type StageView,
} from '@/domain/objectives/objective-detail';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { CRUMB_TITLE_MAX, shortTitle } from '@/domain/shared/titles';
import { useAnnouncements, useReport } from '@/state/announcements';
import { useObjectiveCommands, useObjectiveDetail } from '@/state/objectives';
import { useToday } from '@/state/today';
import { Ecran, amenerALEcran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { pas } from '@/ui/fondations';
import { EnRetrait, MARGE_PANNEAU, Panneau, Trame } from '@/ui/panneau';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { LoadingLine, NotFound, NotLoaded } from '../shell/screen-states';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { OBJECTIVE_TEXTS as T } from './objective.texts';

const useStyles = creerStyles(() => ({
  titreArete: {
    gap: pas['pas-2'],
  },
  enteteEtape: {
    gap: pas['pas-2'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: pas['pas-2'],
  },
  invitation: {
    gap: pas['pas-3'],
  },
  tache: {
    paddingHorizontal: MARGE_PANNEAU.laterale,
  },
}));

/** Les pas d'une étape (ou sans étape), à cocher sur place, chacun avec « Modifier ». */
function TaskRows({
  tasks,
  onToggle,
  onEdit,
}: {
  readonly tasks: readonly StageTaskView[];
  readonly onToggle: (taskId: string, done: boolean) => void;
  readonly onEdit: (task: StageTaskView) => void;
}) {
  const styles = useStyles();
  return (
    <EListe nue>
      {tasks.map((task) => (
        <ETache
          key={task.id}
          titre={task.title}
          {...(task.done ? {} : { meta: TITRES_QUADRANTS[task.quadrant] })}
          fait={task.done}
          onFaitChange={(done) => onToggle(task.id, done)}
          style={styles.tache}
          testID={`pas-${task.id}`}
          actions={
            <EBouton
              variante="nu"
              petit
              aria-label={T.editTaskLabel(task.title)}
              onPress={() => onEdit(task)}
            >
              {T.edit}
            </EBouton>
          }
        />
      ))}
    </EListe>
  );
}

/** L'étape ouverte à côté de l'arête : son état, son nom, ses pas, et ce qu'on peut y faire. */
function StagePanel({
  objectiveId,
  stage,
  onToggle,
  panel,
}: {
  readonly objectiveId: string;
  readonly stage: StageView;
  readonly onToggle: (taskId: string, done: boolean) => void;
  readonly panel: RefObject<ViewInstance | null>;
}) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View ref={panel} collapsable={false}>
      <Panneau bordPerdu testID="etape-ouverte">
        <EnRetrait style={styles.enteteEtape}>
          <ETexte variante="repere" couleur="encre-douce">
            {T.stageMarker(stage.done)}
          </ETexte>
          <ETexte variante="objectif" role="heading">
            {stageName(stage.title)}
          </ETexte>
          {stage.horizon ? (
            <ETexte variante="detail" couleur="encre-douce">
              {stage.horizon}
            </ETexte>
          ) : null}
          {stage.description ? (
            <ETexte variante="detail" couleur="encre-douce">
              {stage.description}
            </ETexte>
          ) : null}
          {stage.tasks.length > 0 ? (
            <EPas
              faits={stage.progress.done}
              aFaire={stage.progress.toDo}
              {...(stage.done ? { accompli: T.stageAccomplished } : {})}
            />
          ) : (
            <ETexte variante="detail" couleur="encre-douce">
              {stage.detail}
            </ETexte>
          )}
        </EnRetrait>
        {stage.tasks.length > 0 ? (
          <TaskRows
            tasks={stage.tasks}
            onToggle={onToggle}
            onEdit={(task) =>
              router.push(routes.editTask(task.id, isTemporaryId(stage.id) ? null : stage.id))
            }
          />
        ) : null}
        <EnRetrait style={styles.actions}>
          <EBouton
            petit
            disabled={isTemporaryId(stage.id)}
            onPress={() => router.push(routes.addTask(stage.id))}
          >
            <EIcone nom="plus" taille={18} />
            {T.addTask}
          </EBouton>
          <EBouton
            variante="nu"
            petit
            onPress={() => router.push(routes.akari(objectiveId, isTemporaryId(stage.id) ? null : stage.id))}
          >
            <EIcone nom="akari" taille={18} />
            {T.proposeTasks}
          </EBouton>
          <EBouton
            variante="nu"
            petit
            disabled={isTemporaryId(stage.id)}
            onPress={() => router.push(routes.editStage(stage.id))}
          >
            <EIcone nom="modifier" taille={18} />
            {T.editStage}
          </EBouton>
        </EnRetrait>
      </Panneau>
    </View>
  );
}

/**
 * L'écran d'un objectif : l'arête (`/objectifs/:id`, maquette « Arete »). L'arête de ses étapes, dont la tête
 * est le sceau de l'écran ; dessous, l'étape choisie et ses pas. Les modifications passent par des feuilles ;
 * tous les gestes sont optimistes.
 */
export function ObjectiveScreen({ objectiveId }: { readonly objectiveId: string }) {
  const router = useRouter();
  const today = useToday();
  const { detail, notFound, failure, refreshing, refresh } = useObjectiveDetail(objectiveId, today);
  const { report } = useReport();
  const scroller = useRef<ScrollViewInstance | null>(null);

  return (
    <Ecran
      note={<ReportNote />}
      rafraichir={{ enCours: refreshing, onRafraichir: refresh }}
      defilement={scroller}
      testID="ecran-arete"
    >
      {detail ? (
        <ObjectiveContent detail={detail} hasReport={!!report} scroller={scroller} />
      ) : (
        <>
          <EFilAriane
            miettes={[
              { libelle: SHELL_TEXTS.crumbs.objectives, onPress: () => router.dismissTo(routes.home) },
            ]}
          />
          {notFound ? (
            <NotFound />
          ) : failure ? (
            <NotLoaded hasReport={!!report} onReload={refresh} />
          ) : (
            <LoadingLine text={T.loading} />
          )}
        </>
      )}
    </Ecran>
  );
}

function ObjectiveContent({
  detail,
  hasReport,
  scroller,
}: {
  readonly detail: ObjectiveDetail;
  readonly hasReport: boolean;
  readonly scroller: RefObject<ScrollViewInstance | null>;
}) {
  const styles = useStyles();
  const router = useRouter();
  const commands = useObjectiveCommands();
  const announcements = useAnnouncements();
  const panel = useRef<ViewInstance | null>(null);
  const { objective, stages } = detail;

  // La personne choisit l'étape à ouvrir : aucune ne passe avant les autres. Elle reste ouverte tant qu'elle
  // existe, même une fois faite, et quand son id temporaire devient définitif.
  const [shownStageId, setShownStageId] = useState<string | null>(null);
  const openId = openStageId(shownStageId && commands.currentId(shownStageId), detail);
  if (openId !== shownStageId) setShownStageId(openId);
  const stage = stages.find((item) => item.id === openId);

  const toggle = (taskId: string, done: boolean) => void commands.setTaskDone(taskId, done);

  const chooseStage = (etape: EtapeAreteIdentifiee) => {
    const id = etape.id ?? foldedDoneStageId(stages, openId);
    const chosen = stages.find((item) => item.id === id);
    if (!chosen) return;
    setShownStageId(chosen.id);
    announcements.announce(T.stageChosen(chosen.done, stageName(chosen.title)));
    requestAnimationFrame(() => amenerALEcran(scroller, panel));
  };

  const akariHref = routes.akari(objective.id);

  return (
    <>
      <EnTete
        filAriane={
          <EFilAriane
            miettes={[
              { libelle: SHELL_TEXTS.crumbs.objectives, onPress: () => router.dismissTo(routes.home) },
              { libelle: shortTitle(objective.title, CRUMB_TITLE_MAX) },
            ]}
          />
        }
        {...(objective.horizon ? { surTitre: objective.horizon } : {})}
        titre={objective.title}
        {...(objective.why ? { voix: objective.why } : {})}
        {...(objective.description ? { detail: objective.description } : {})}
        actions={
          <>
            {stages.length > 0 ? (
              <EBouton petit onPress={() => router.push(routes.addStage(objective.id))}>
                <EIcone nom="plus" taille={18} />
                {T.addStage}
              </EBouton>
            ) : null}
            <EBouton variante="nu" petit onPress={() => router.push(routes.editObjective(objective.id))}>
              <EIcone nom="modifier" taille={18} />
              {T.editObjective}
            </EBouton>
          </>
        }
      />

      {stages.length > 0 ? (
        <Trame>
          <Panneau>
            <View style={styles.titreArete}>
              <ETexte variante="section" role="heading">
                {T.arete(stages.length)}
              </ETexte>
              <ELegendeArete />
            </View>
            <EArete
              objectif={objective.title}
              etapes={detail.aretes}
              interactive
              choisie={openId}
              onChoisir={chooseStage}
              testID="arete"
            />
          </Panneau>
          {stage ? (
            <StagePanel objectiveId={objective.id} stage={stage} onToggle={toggle} panel={panel} />
          ) : (
            <Panneau>
              <ETexte variante="detail" couleur="encre-douce">
                {T.chooseStage}
              </ETexte>
            </Panneau>
          )}
        </Trame>
      ) : !hasReport ? (
        <ENote
          actions={
            <>
              <EBouton petit onPress={() => router.push(routes.addStage(objective.id))}>
                <EIcone nom="plus" taille={18} />
                {T.addStage}
              </EBouton>
              <EBouton variante="nu" petit onPress={() => router.push(akariHref)}>
                {T.proposeStages}
              </EBouton>
            </>
          }
        >
          {T.firstStage}
        </ENote>
      ) : (
        // La note d'Akari est déjà là (une par écran) : la même invitation, sans note.
        <View style={styles.invitation}>
          <ETexte couleur="encre-douce">{T.firstStagePlain}</ETexte>
          <View style={styles.actions}>
            <EBouton petit onPress={() => router.push(routes.addStage(objective.id))}>
              <EIcone nom="plus" taille={18} />
              {T.addStage}
            </EBouton>
            <EBouton variante="nu" petit onPress={() => router.push(akariHref)}>
              {T.proposeStages}
            </EBouton>
          </View>
        </View>
      )}

      {detail.tasksWithoutStage.length > 0 ? (
        <Panneau bordPerdu testID="pas-sans-etape">
          <EnRetrait style={styles.enteteEtape}>
            <ETexte variante="section" role="heading">
              {T.looseTitle}
            </ETexte>
            <ETexte variante="detail" couleur="encre-douce">
              {T.looseHint(stages.length > 0)}
            </ETexte>
          </EnRetrait>
          <TaskRows
            tasks={detail.tasksWithoutStage}
            onToggle={toggle}
            onEdit={(task) => router.push(routes.editTask(task.id, null))}
          />
        </Panneau>
      ) : null}
    </>
  );
}
