import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { EBouton, ETexte, creerStyles } from '@empreinte-studio/react-native';
import { objectiveInvitation, permissionPrompt, stageInvitation } from '@/domain/akari/assistant';
import {
  ACCEPT_ACTION,
  PERMISSION_REPLY_ID,
  buildReplies,
  statusLine,
  type Reply,
} from '@/domain/akari/conversation';
import { stageName, type ObjectiveDetail } from '@/domain/objectives/objective-detail';
import { STAGE_STATE_TITLES } from '@/domain/objectives/progress';
import { CRUMB_TITLE_MAX, firstName, shortTitle } from '@/domain/shared/titles';
import { useAkari } from '@/state/akari';
import { useAnnouncements, useReport } from '@/state/announcements';
import { useObjectiveDetail } from '@/state/objectives';
import { useCurrentUser } from '@/state/session';
import { useToday } from '@/state/today';
import { Composeur } from '@/ui/composeur';
import { Ecran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { Fil, type RepliqueFil } from '@/ui/fil';
import { FilAriane } from '@/ui/fil-ariane';
import { pas, traits } from '@/ui/fondations';
import { Prose } from '@/ui/prose';
import { Repli } from '@/ui/repli';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { LoadingLine, NotFound, NotLoaded } from '../shell/screen-states';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { AKARI_SCREEN_TEXTS as T } from './akari.texts';

const useStyles = creerStyles(({ couleurs }) => ({
  etapes: {
    gap: pas['pas-3'],
  },
  etape: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: pas['pas-3'],
    paddingTop: pas['pas-3'],
    borderTopWidth: traits['trait-fin'],
    borderTopColor: couleurs.trame,
  },
  numero: {
    width: pas['pas-6'] + pas['pas-1'],
  },
  nom: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
}));

/**
 * Akari pour un objectif (`/objectifs/:id/akari`) : la conversation avec Akari, sa zone de réponse au pied de
 * l'écran, et l'arête de l'objectif en résumé, qui se remplit quand la personne accepte une étape ou un pas.
 * `stageId` (`?etape=`) prépare une demande de pas pour cette étape.
 */
export function AkariScreen({
  objectiveId,
  stageId,
}: {
  readonly objectiveId: string;
  readonly stageId: string | null;
}) {
  const router = useRouter();
  const today = useToday();
  const { detail, notFound, failure, refresh } = useObjectiveDetail(objectiveId, today);
  const { report } = useReport();

  if (detail) return <AkariConversationScreen detail={detail} stageId={stageId} />;

  return (
    <Ecran note={<ReportNote />} testID="ecran-akari">
      <FilAriane
        miettes={[{ libelle: SHELL_TEXTS.crumbs.objectives, onPress: () => router.dismissTo(routes.home) }]}
      />
      {notFound ? (
        <NotFound />
      ) : failure ? (
        <NotLoaded hasReport={!!report} onReload={refresh} />
      ) : (
        <LoadingLine text={T.searching} />
      )}
    </Ecran>
  );
}

function AkariConversationScreen({
  detail,
  stageId,
}: {
  readonly detail: ObjectiveDetail;
  readonly stageId: string | null;
}) {
  const styles = useStyles();
  const router = useRouter();
  const user = useCurrentUser();
  const announcements = useAnnouncements();
  const { objective, stages } = detail;
  const akari = useAkari(objective.id, true);

  // La personne a parlé depuis son arrivée : l'invitation s'efface (l'écran est recréé pour un autre objectif ou
  // une autre étape).
  const [spoke, setSpoke] = useState(false);

  const stage = stageId ? stages.find((item) => item.id === stageId) : undefined;
  const invitation =
    akari.ready && !spoke
      ? stage
        ? stageInvitation(stageName(stage.title))
        : akari.messages.length === 0
          ? objectiveInvitation(objective.title)
          : null
      : null;

  const stageTitleOf = (id: string) => {
    const found = stages.find((candidate) => candidate.id === id);
    return found ? stageName(found.title) : undefined;
  };
  const replies = buildReplies({
    messages: akari.messages,
    invitation,
    permission: akari.permission,
    stageTitleOf,
  });

  // La demande d'accord arrive dans le fil, qui ne se lit pas à voix haute : sa phrase est dite une fois, pour que
  // ses deux boutons aient un sens (la ligne d'état dit seulement « Akari attend ton accord. »).
  const permissionPhrase = akari.permission ? permissionPrompt(akari.permission, stageTitleOf) : '';
  const announced = useRef('');
  useEffect(() => {
    if (permissionPhrase && permissionPhrase !== announced.current) announcements.announce(permissionPhrase);
    announced.current = permissionPhrase;
  }, [announcements, permissionPhrase]);

  const status = statusLine({
    loadingHistory: !akari.historyLoaded,
    awaitingPermission: akari.permission !== null,
    processing: akari.processing,
    value: akari.value,
    interrupted: akari.interrupted,
  });

  const say = async (text: string): Promise<boolean> => {
    const message = text.trim();
    if (!message || !akari.ready) return false;
    setSpoke(true);
    return akari.send(message);
  };

  const act = (reply: Reply | undefined, actionId: string) => {
    if (!reply) return;
    if (reply.invitation) void say(reply.invitation.message);
    else if (reply.id === PERMISSION_REPLY_ID) void akari.respond(actionId === ACCEPT_ACTION);
  };

  const thread: RepliqueFil[] = replies.map((reply) => {
    const assistant = reply.speaker === 'akari';
    return {
      id: reply.id,
      auteur: assistant ? 'assistant' : 'personne',
      contenu: reply.markdown ? (
        <Prose texte={reply.text} voix={assistant ? 'voix' : 'corps'} douce={reply.pending} />
      ) : (
        reply.text
      ),
      enAttente: reply.pending,
      actions: reply.actions.map((action) => ({ id: action.id, libelle: action.label })),
    };
  });

  const taskTotal = detail.taskCount.total;
  const loose = detail.tasksWithoutStage.length;

  return (
    <Ecran
      note={<ReportNote />}
      suivreLaFin
      libelleRetourFin={T.latest}
      pied={
        <Composeur
          libelle={T.composer.label}
          indication={T.composer.hint}
          libelleEnvoyer={T.composer.send}
          pret={akari.ready}
          onEnvoyer={say}
          testID="composeur"
        />
      }
      testID="ecran-akari"
    >
      <EnTete
        filAriane={
          <FilAriane
            miettes={[
              { libelle: SHELL_TEXTS.crumbs.objectives, onPress: () => router.dismissTo(routes.home) },
              {
                libelle: shortTitle(objective.title, CRUMB_TITLE_MAX),
                onPress: () => router.dismissTo(routes.objective(objective.id)),
              },
              { libelle: SHELL_TEXTS.crumbs.akari },
            ]}
          />
        }
        repere={T.marker}
        iconeRepere="akari"
        titre={objective.title}
        variante="objectif"
        detail={T.intro}
      />

      <Repli
        titre={T.arete}
        detail={T.summary(objective.horizon, stages.length, taskTotal)}
        testID="resume-arete"
      >
        <View style={styles.etapes}>
          {stages.length > 0 ? (
            stages.map((item) => (
              <View key={item.id} style={styles.etape}>
                <ETexte variante="objectif" style={styles.numero}>
                  {String(item.index)}
                </ETexte>
                <View style={styles.nom}>
                  <ETexte>{stageName(item.title)}</ETexte>
                  <ETexte variante="detail" couleur="encre-douce">
                    {[STAGE_STATE_TITLES[item.state], item.horizon].filter(Boolean).join(' · ')}
                  </ETexte>
                </View>
                <ETexte variante="detail" couleur="encre-douce">
                  {T.stageTasks(item.tasks.length)}
                </ETexte>
              </View>
            ))
          ) : (
            <ETexte couleur="encre-douce">{T.noStage}</ETexte>
          )}
          {loose > 0 ? (
            <ETexte variante="detail" couleur="encre-douce">
              {T.looseTasks(loose)}
            </ETexte>
          ) : null}
          <EBouton petit onPress={() => router.dismissTo(routes.objective(objective.id))}>
            {T.seeArete}
          </EBouton>
        </View>
      </Repli>

      <Fil
        repliques={thread}
        statut={status}
        personne={firstName(user?.name, T.personFallback)}
        onAction={(replique, action) =>
          act(
            replies.find((reply) => reply.id === replique.id),
            action.id,
          )
        }
        testID="fil-akari"
      />
    </Ecran>
  );
}
