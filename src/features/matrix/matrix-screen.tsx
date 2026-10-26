import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EBouton, EListe, ETache, ETexte, creerStyles } from '@empreinte-studio/react-native';
import {
  QUADRANTS,
  QUADRANT_DESCRIPTIONS,
  TITRES_QUADRANTS,
  otherQuadrants,
  type Quadrant,
} from '@/domain/objectives/eisenhower';
import {
  countLabel,
  filterMatrixByObjective,
  matrixObjectiveOptions,
  matrixSize,
  matrixTaskDetail,
} from '@/domain/objectives/matrix';
import { formatToday } from '@/domain/shared/dates';
import { FILTER_TITLE_MAX, distinctShortTitles } from '@/domain/shared/titles';
import { useAnnouncements, useReport } from '@/state/announcements';
import { useMatrix, useObjectiveCommands } from '@/state/objectives';
import { useToday } from '@/state/today';
import { Ecran } from '@/ui/ecran';
import { EnTete } from '@/ui/en-tete';
import { Filtres } from '@/ui/filtres';
import { pas } from '@/ui/fondations';
import { Menu } from '@/ui/menu';
import { MARGE_PANNEAU } from '@/ui/panneau';
import { Quadrants, type TuileQuadrant } from '@/ui/quadrants';
import { AppBand } from '../shell/app-band';
import { ReportNote } from '../shell/report-note';
import { routes } from '../shell/routes';
import { LoadingLine } from '../shell/screen-states';
import { SHELL_TEXTS } from '../shell/shell.texts';
import { MATRIX_TEXTS as T } from './matrix.texts';

const useStyles = creerStyles(() => ({
  bloc: {
    gap: pas['pas-3'],
  },
  quadrant: {
    gap: pas['pas-4'],
  },
  titreQuadrant: {
    gap: 2,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: pas['pas-2'],
    paddingVertical: pas['pas-3'],
    paddingLeft: MARGE_PANNEAU.laterale,
    paddingRight: pas['pas-2'],
  },
  tache: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  vide: {
    paddingVertical: pas['pas-4'],
    paddingHorizontal: MARGE_PANNEAU.laterale,
  },
}));

/**
 * La matrice d'Eisenhower (`/matrice`) : tous les pas, faits compris, rangés dans les quatre quadrants
 * d'Empreinte. Sur un téléphone, les quatre panneaux donnent la vue d'ensemble ; celui qu'on ouvre montre ses
 * pas, qu'on coche sur place ou qu'on déplace avec « Déplacer vers… ». Le filtre par objectif ne vit que dans
 * l'écran.
 */
export function MatrixScreen() {
  const styles = useStyles();
  const router = useRouter();
  const today = useToday();
  const { matrix, snapshot, loaded: objectivesLoaded, failure, refreshing, refresh } = useMatrix();
  const commands = useObjectiveCommands();
  const announcements = useAnnouncements();
  const { report } = useReport();
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<Quadrant>('maintenant');

  // Un filtre par objectif racine, au titre court ; deux objectifs au début identique gardent des noms différents.
  const objectives = matrixObjectiveOptions(snapshot.objectives);
  const labels = distinctShortTitles(
    objectives.map((objective) => objective.title),
    FILTER_TITLE_MAX,
  );
  const filterOptions = objectives.map((objective, index) => ({
    valeur: objective.id,
    libelle: labels[index] ?? '',
  }));
  const activeFilter =
    filter !== null && objectives.some((objective) => objective.id === filter) ? filter : null;
  const shown = filterMatrixByObjective(matrix, activeFilter);

  const hasTasks = matrixSize(matrix) > 0;
  // Avant que les pas soient connus, l'écran ne prétend pas qu'il y a « 0 pas ».
  const loaded = objectivesLoaded || hasTasks;
  const count = countLabel(matrixSize(shown));

  const chooseFilter = (id: string | null) => {
    if (id === activeFilter) return;
    setFilter(id);
    const name =
      id === null
        ? T.allObjectives
        : (objectives.find((objective) => objective.id === id)?.title ?? T.allObjectives);
    announcements.announce(T.filterChosen(name, countLabel(matrixSize(filterMatrixByObjective(matrix, id)))));
  };

  const tiles = QUADRANTS.map((quadrant): TuileQuadrant<Quadrant> => ({
    cle: quadrant,
    titre: TITRES_QUADRANTS[quadrant],
    compte: countLabel(shown[quadrant].length),
    description: QUADRANT_DESCRIPTIONS[quadrant],
  })) as [TuileQuadrant<Quadrant>, TuileQuadrant<Quadrant>, TuileQuadrant<Quadrant>, TuileQuadrant<Quadrant>];
  const tasks = shown[open];

  return (
    <Ecran
      sousOnglets
      bandeau={<AppBand />}
      note={<ReportNote />}
      rafraichir={{ enCours: refreshing, onRafraichir: refresh }}
      testID="ecran-matrice"
    >
      <EnTete repere={loaded ? `${formatToday(today)} · ${count}` : formatToday(today)} titre={T.title} />

      {filterOptions.length > 1 ? (
        <Filtres
          libelle={T.filters}
          libelleTous={T.allObjectives}
          options={filterOptions}
          selection={activeFilter}
          onSelection={chooseFilter}
          bordPerdu
          testID="filtre"
        />
      ) : null}

      {objectivesLoaded && !hasTasks ? (
        <View style={styles.bloc}>
          <ETexte couleur="encre-douce">{T.empty}</ETexte>
          <EBouton petit onPress={() => router.navigate(routes.home)}>
            {SHELL_TEXTS.seeObjectives}
          </EBouton>
        </View>
      ) : null}

      {!loaded && !failure ? <LoadingLine text={T.loading} /> : null}
      {!loaded && failure && !report ? (
        <View style={styles.bloc}>
          <ETexte>{T.loadFailed}</ETexte>
          <EBouton petit onPress={refresh}>
            {SHELL_TEXTS.reload}
          </EBouton>
        </View>
      ) : null}

      {loaded && hasTasks ? (
        <>
          <Quadrants tuiles={tiles} choisi={open} onChoisir={setOpen} testID="quadrant" />
          <View style={styles.quadrant} role="tabpanel">
            <View style={styles.titreQuadrant}>
              <ETexte variante="section" role="heading">
                {TITRES_QUADRANTS[open]}
              </ETexte>
              <ETexte variante="detail" couleur="encre-douce">
                {`${QUADRANT_DESCRIPTIONS[open]} · ${countLabel(tasks.length)}`}
              </ETexte>
            </View>
            <EListe>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <View key={task.id} style={styles.ligne}>
                    <ETache
                      titre={task.title}
                      {...(matrixTaskDetail(task) ? { meta: matrixTaskDetail(task) } : {})}
                      fait={task.done}
                      onFaitChange={(done) => void commands.setTaskDone(task.id, done)}
                      style={styles.tache}
                      testID={`pas-${task.id}`}
                    />
                    <Menu
                      libelle={T.moveLabel(task.title)}
                      icone="deplacer"
                      petit
                      entrees={otherQuadrants(open).map((target) => ({
                        valeur: target,
                        libelle: TITRES_QUADRANTS[target],
                      }))}
                      onChoix={(target) => void commands.moveTaskToQuadrant(task.id, target)}
                      testID={`deplacer-${task.id}`}
                    />
                  </View>
                ))
              ) : (
                <View style={styles.vide}>
                  <ETexte variante="detail" couleur="encre-douce">
                    {T.emptyQuadrant}
                  </ETexte>
                </View>
              )}
            </EListe>
          </View>
        </>
      ) : null}
    </Ecran>
  );
}
