import { useIsFocused, useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { View, type ScrollViewInstance, type ViewInstance } from 'react-native';
import {
  EArete,
  EBouton,
  EFilAriane,
  EGlissable,
  EIcone,
  ELegendeArete,
  EListe,
  ENote,
  EPas,
  ETache,
  ETexte,
  ETrace,
  type EtapeAreteIdentifiee,
  creerStyles,
  libelleEffacer,
} from '@empreinte-studio/react-native';
import { TITRES_QUADRANTS } from '@/domain/objectives/eisenhower';
import {
  foldedDoneStageId,
  openStageId,
  stageName,
  stageWithout,
  type ObjectiveDetail,
  type StageTaskView,
  type StageView,
} from '@/domain/objectives/objective-detail';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { CRUMB_TITLE_MAX, shortTitle } from '@/domain/shared/titles';
import { useAnnouncements, useReport } from '@/state/announcements';
import { useObjectiveCommands, useObjectiveDetail, useTaskTrace } from '@/state/objectives';
import { useToday } from '@/state/today';
import { Ecran, amenerALEcran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { pas, traits } from '@/ui/fondations';
import { EnRetrait, MARGE_PANNEAU, Panneau, Trame } from '@/ui/panneau';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { LoadingLine, NotFound, NotLoaded } from '../shell/screen-states';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { OBJECTIVE_TEXTS as T } from './objective.texts';

const useStyles = creerStyles(({ couleurs }) => ({
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
  // La liste laisse voir le filet du panneau de chaque côté : ses lignes sont opaques (la bande d'une ligne glissée
  // passe dessous, la trace a son fond creux), comme dans la maquette.
  liste: {
    paddingHorizontal: traits['trait-fin'],
  },
  // Les pas gardent la marge du panneau.
  tache: {
    paddingHorizontal: MARGE_PANNEAU.laterale - traits['trait-fin'],
  },
  trace: {
    paddingLeft: MARGE_PANNEAU.laterale - traits['trait-fin'],
  },
  // La sortie de l'étape, sous un filet, d'un bord à l'autre du panneau (maquette « Effacer », mobile).
  sortie: {
    paddingTop: pas['pas-2'],
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  // Le mot s'aligne sur la marge du panneau.
  effacer: {
    paddingHorizontal: 0,
  },
}));

/**
 * Effacer un pas (maquette « Effacer », mobile) : la ligne glisse vers la gauche, ou « Effacer » dans les actions de
 * VoiceOver et TalkBack ; sa trace prend sa place le temps de le remettre. Un pas qui n'est pas encore enregistré ne
 * s'efface pas.
 */
type TaskErasing = {
  /** Le pas dont la trace est à l'écran. */
  readonly erasing: string | null;
  /** Le pas qui vient d'être remis à sa place : le lecteur d'écran s'y repose. */
  readonly restored: string | null;
  readonly onErase: (task: StageTaskView) => void;
  readonly onPutBack: (task: StageTaskView) => void;
  /** La trace est finie : le pas part pour de bon. */
  readonly onGone: (task: StageTaskView) => void;
};

/** Les pas d'une étape (ou sans étape), à cocher sur place, chacun avec « Modifier », à glisser pour l'effacer. */
function TaskRows({
  tasks,
  onToggle,
  onEdit,
  erase,
}: {
  readonly tasks: readonly StageTaskView[];
  readonly onToggle: (taskId: string, done: boolean) => void;
  readonly onEdit: (task: StageTaskView) => void;
  readonly erase: TaskErasing;
}) {
  const styles = useStyles();
  return (
    <EListe nue style={styles.liste}>
      {tasks.map((task) =>
        task.id === erase.erasing ? (
          <ETrace
            key={`trace-${task.id}`}
            titre={task.title}
            onRemettre={() => erase.onPutBack(task)}
            onExpiree={() => erase.onGone(task)}
            style={styles.trace}
            testID={`trace-${task.id}`}
          />
        ) : (
          <EGlissable
            key={task.id}
            libelleAccessible={libelleEffacer(task.title)}
            desactive={isTemporaryId(task.id)}
            onAction={() => erase.onErase(task)}
          >
            <ETache
              titre={task.title}
              {...(task.done ? {} : { meta: TITRES_QUADRANTS[task.quadrant] })}
              fait={task.done}
              onFaitChange={(done) => onToggle(task.id, done)}
              {...(isTemporaryId(task.id) ? {} : { onEffacer: () => erase.onErase(task) })}
              focaliser={task.id === erase.restored}
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
          </EGlissable>
        ),
      )}
    </EListe>
  );
}

/** L'étape ouverte à côté de l'arête : son état, son nom, ses pas, et ce qu'on peut y faire. */
function StagePanel({
  objectiveId,
  stage: shownStage,
  onToggle,
  erase,
  panel,
}: {
  readonly objectiveId: string;
  readonly stage: StageView;
  readonly onToggle: (taskId: string, done: boolean) => void;
  readonly erase: TaskErasing;
  readonly panel: RefObject<ViewInstance | null>;
}) {
  const styles = useStyles();
  const router = useRouter();
  // Le pas dont la trace est à l'écran ne compte plus.
  const stage = stageWithout(shownStage, erase.erasing);
  const counted = stage.progress.done + stage.progress.toDo;
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
          {counted > 0 ? (
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
            erase={erase}
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
        <EnRetrait style={styles.sortie}>
          <EBouton
            variante="nu"
            petit
            doux
            disabled={isTemporaryId(stage.id)}
            onPress={() => router.push(routes.eraseStage(stage.id))}
            style={styles.effacer}
          >
            {T.eraseStage}
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
  const focused = useIsFocused();
  const { detail: current, notFound, failure, refreshing, refresh } = useObjectiveDetail(objectiveId, today);
  const { report } = useReport();
  const scroller = useRef<ScrollViewInstance | null>(null);

  // Tant qu'une feuille la couvre, ou qu'on la quitte, l'arête garde ce qu'elle montrait : l'objectif effacé depuis
  // sa feuille part pendant que l'écran se referme, sans y dire « introuvable ».
  const [shown, setShown] = useState(current);
  if (current && current !== shown) setShown(current);
  const detail = current ?? (focused ? undefined : shown);

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
  const { erasing, trace } = useTaskTrace();
  const panel = useRef<ViewInstance | null>(null);
  const { objective, stages } = detail;

  // La personne choisit l'étape à ouvrir : aucune ne passe avant les autres. Elle reste ouverte tant qu'elle
  // existe, même une fois faite, et quand son id temporaire devient définitif.
  const [shownStageId, setShownStageId] = useState<string | null>(null);
  const openId = openStageId(shownStageId && commands.currentId(shownStageId), detail);
  if (openId !== shownStageId) setShownStageId(openId);
  const stage = stages.find((item) => item.id === openId);

  // Le pas remis à sa place par sa trace : le lecteur d'écran s'y repose quand il revient.
  const [restored, setRestored] = useState<string | null>(null);
  const erase: TaskErasing = {
    erasing,
    restored,
    onErase: (task) => {
      setRestored(null);
      trace.start(task.id);
    },
    onPutBack: (task) => {
      setRestored(task.id);
      trace.putBack(task.id);
    },
    onGone: (task) => trace.expire(task.id),
  };

  const toggle = (taskId: string, done: boolean) => void commands.setTaskDone(taskId, done);

  const chooseStage = (etape: EtapeAreteIdentifiee) => {
    const id = etape.id ?? foldedDoneStageId(stages, openId);
    const chosen = stages.find((item) => item.id === id);
    if (!chosen) return;
    setShownStageId(chosen.id);
    setRestored(null);
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
            <StagePanel
              objectiveId={objective.id}
              stage={stage}
              onToggle={toggle}
              erase={erase}
              panel={panel}
            />
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
            erase={erase}
          />
        </Panneau>
      ) : null}
    </>
  );
}
