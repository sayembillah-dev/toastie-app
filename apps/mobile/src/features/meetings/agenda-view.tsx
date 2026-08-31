/**
 * The agenda, rendered identically for a signed-in member and for a guest who
 * opened the share link. One component on purpose: the public agenda is the
 * same document (docs/PRD.md section 6.1), and letting the two drift is how a guest
 * ends up looking at a different meeting than the members are.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Meeting, MeetingActor } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { compareRoleKeys, meetingRoleLabel } from '@/domain/meeting-roles';
import { useTheme } from '@/hooks/use-theme';
import { formatMeetingDate } from '@/lib/format';

type AgendaViewProps = {
  meeting: Meeting;
  /**
   * The club's agenda banner colour. It lives on `Club`, not `Meeting`
   * (docs/ERD.md section 4.3), so it is passed in — the public agenda screen has a
   * club to read it from, and a member viewing their own club's agenda does too.
   */
  bannerColor?: string | null;
};

export function AgendaView({ meeting, bannerColor }: AgendaViewProps) {
  const theme = useTheme();

  const roles = useMemo(
    () => [...meeting.roleAssignments].sort((a, b) => compareRoleKeys(a.roleKey, b.roleKey)),
    [meeting.roleAssignments],
  );
  const speakers = useMemo(
    () => [...meeting.speakers].sort((a, b) => a.order - b.order),
    [meeting.speakers],
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.banner, { backgroundColor: bannerColor ?? theme.accent }]}>
        <ThemedText type="small" style={{ color: theme.onAccent }}>
          Meeting #{meeting.meetingNumber} · {formatMeetingDate(meeting.dateTime)}
        </ThemedText>
        <ThemedText type="subtitle" style={{ color: theme.onAccent }}>
          {meeting.theme ?? 'Toastmasters meeting'}
        </ThemedText>
      </View>

      {meeting.word ? (
        <Card>
          <ThemedText type="smallBold" themeColor="textSecondary">
            WORD OF THE DAY
          </ThemedText>
          <ThemedText type="default">
            {meeting.word}
            {meeting.wordPartOfSpeech ? (
              <ThemedText type="small" themeColor="textSecondary">
                {'  '}
                {meeting.wordPartOfSpeech}
              </ThemedText>
            ) : null}
          </ThemedText>
          {meeting.wordMeaning ? (
            <ThemedText type="small" themeColor="textSecondary">
              {meeting.wordMeaning}
            </ThemedText>
          ) : null}
          {meeting.wordExample ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.example}>
              “{meeting.wordExample}”
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          ROLES
        </ThemedText>
        {roles.length ? (
          roles.map((role) => (
            <View key={role.id} style={styles.row}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
                {meetingRoleLabel(role.roleKey)}
              </ThemedText>
              <ThemedText type="default" style={styles.rowValue}>
                {actorName(role.actor)}
              </ThemedText>
            </View>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No roles assigned yet.
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          PREPARED SPEECHES
        </ThemedText>
        {speakers.length ? (
          speakers.map((slot) => (
            <View key={slot.id} style={styles.speech}>
              <ThemedText type="default">
                {slot.order}. {slot.title ?? 'Title to be confirmed'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {actorName(slot.speaker)}
                {slot.duration ? ` · ${slot.duration} min` : ''}
              </ThemedText>
              {slot.pathway || slot.project ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {[slot.pathway, slot.project].filter(Boolean).join(' · ')}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                Evaluator: {actorName(slot.evaluator)}
              </ThemedText>
            </View>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No speakers scheduled yet.
          </ThemedText>
        )}
      </Card>

      {meeting.tableTopicQuestions.length ? (
        <Card>
          <ThemedText type="smallBold" themeColor="textSecondary">
            TABLE TOPICS
          </ThemedText>
          {meeting.tableTopicQuestions.map((question) => (
            <ThemedText
              key={question.id}
              type="small"
              themeColor={question.asked ? 'textSecondary' : 'text'}
            >
              {question.text}
            </ThemedText>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

/**
 * A slot can be filled by a member or a guest, and can be empty — a half-built
 * agenda is the normal state of a meeting a week out (docs/ERD.md section 4.5).
 */
function actorName(actor: MeetingActor | null): string {
  return actor?.name ?? 'Unassigned';
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.three,
  },
  banner: {
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  speech: {
    gap: Spacing.half,
    paddingTop: Spacing.one,
  },
  example: {
    fontStyle: 'italic',
  },
});
