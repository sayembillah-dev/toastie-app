import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/admin/club_admin_screen.dart';
import '../features/admin/club_profile_screen.dart';
import '../features/admin/members_admin_screen.dart';
import '../features/admin/permissions_screen.dart';
import '../features/auth/change_password_screen.dart';
import '../features/auth/invite_screen.dart';
import '../features/auth/join_club_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/sign_in_screen.dart';
import '../features/home/home_screen.dart';
import '../features/learn/learn_screen.dart';
import '../features/learn/member_pathway_screen.dart';
import '../features/learn/pathway_detail_screen.dart';
import '../features/live/ah_counter_screen.dart';
import '../features/live/grammarian_screen.dart';
import '../features/live/timer_screen.dart';
import '../features/meetings/agenda_screen.dart';
import '../features/meetings/attendance_screen.dart';
import '../features/meetings/planner_screen.dart';
import '../features/meetings/voting_screen.dart';
import '../features/meetings/meeting_hub_screen.dart';
import '../features/meetings/meetings_screen.dart';
import '../features/meetings/overview_screen.dart';
import '../features/meetings/roles_screen.dart';
import '../features/meetings/speaker_edit_screen.dart';
import '../features/meetings/speakers_screen.dart';
import '../features/meetings/table_topics_screen.dart';
import '../features/meetings/theme_screen.dart';
import '../features/me/delete_account_screen.dart';
import '../features/me/edit_profile_screen.dart';
import '../features/me/me_screen.dart';
import '../features/me/my_speeches_screen.dart';
import '../features/people/guest_logs_screens.dart';
import '../features/people/guest_profile_screen.dart';
import '../features/people/people_screen.dart';
import '../features/org/org_tree_screen.dart';
import '../features/org/users_screen.dart';
import '../features/org/whatsapp_screen.dart';
import '../data/models_admin.dart' show OrgLevel;
import 'session.dart';
import 'shell.dart';

/// Bridges Riverpod auth changes into go_router's refreshListenable.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, _) => notifyListeners());
  }
}

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

const _publicPrefixes = ['/sign-in', '/register', '/agenda/', '/invite/'];

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthListenable(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      final isPublic = _publicPrefixes.any(loc.startsWith);

      if (auth is SignedOut) {
        return isPublic ? null : '/sign-in';
      }
      final s = auth as SignedIn;
      if (loc == '/sign-in' || loc == '/register') {
        final from = state.uri.queryParameters['from'];
        return from != null && from.startsWith('/') ? from : '/';
      }
      if (s.session.user.mustChangePassword && !s.skippedPasswordChange && loc != '/change-password') {
        return '/change-password';
      }
      if (s.context == null && !loc.startsWith('/join') && !loc.startsWith('/invite/') &&
          !loc.startsWith('/agenda/') && !loc.startsWith('/me') && loc != '/change-password') {
        return '/join';
      }
      if (s.context != null && loc == '/join') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/join', builder: (_, _) => const JoinClubScreen()),
      GoRoute(path: '/change-password', builder: (_, _) => const ChangePasswordScreen(forced: true)),
      GoRoute(path: '/invite/:token', builder: (_, s) => InviteScreen(token: s.pathParameters['token']!)),
      // Public agenda — the deep-link target for shared agenda links.
      GoRoute(
        path: '/agenda/:meetingId',
        builder: (_, s) => AgendaScreen(meetingId: s.pathParameters['meetingId']!, standalone: true),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/meetings',
              builder: (_, _) => const MeetingsScreen(),
              routes: [
                GoRoute(path: 'planner', builder: (_, _) => const PlannerScreen()),
                GoRoute(
                  path: ':id',
                  builder: (_, s) => MeetingHubScreen(meetingId: s.pathParameters['id']!),
                  routes: [
                    GoRoute(path: 'overview', builder: (_, s) => OverviewScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(path: 'roles', builder: (_, s) => RolesScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(
                      path: 'speakers',
                      builder: (_, s) => SpeakersScreen(meetingId: s.pathParameters['id']!),
                      routes: [
                        GoRoute(
                          path: ':sid',
                          builder: (_, s) => SpeakerEditScreen(
                              meetingId: s.pathParameters['id']!, speakerId: s.pathParameters['sid']!),
                        ),
                      ],
                    ),
                    GoRoute(path: 'theme', builder: (_, s) => ThemeScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(
                        path: 'table-topics', builder: (_, s) => TableTopicsScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(path: 'agenda', builder: (_, s) => AgendaScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(path: 'attendance', builder: (_, s) => AttendanceScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(path: 'voting', builder: (_, s) => VotingScreen(meetingId: s.pathParameters['id']!)),
                    GoRoute(
                      path: 'timer',
                      parentNavigatorKey: _rootKey,
                      builder: (_, s) => TimerScreen(meetingId: s.pathParameters['id']!),
                    ),
                    GoRoute(
                      path: 'ah-counter',
                      parentNavigatorKey: _rootKey,
                      builder: (_, s) => AhCounterScreen(meetingId: s.pathParameters['id']!),
                    ),
                    GoRoute(
                      path: 'grammarian',
                      parentNavigatorKey: _rootKey,
                      builder: (_, s) => GrammarianScreen(meetingId: s.pathParameters['id']!),
                    ),
                  ],
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/people',
              builder: (_, _) => const PeopleScreen(),
              routes: [
                GoRoute(
                  path: 'members/:mid',
                  builder: (_, s) => MemberPathwayScreen(memberId: s.pathParameters['mid']!),
                ),
                GoRoute(
                  path: 'guests/:gid',
                  builder: (_, s) => GuestProfileScreen(guestId: s.pathParameters['gid']!),
                  routes: [
                    GoRoute(path: 'visits', builder: (_, s) => VisitLogsScreen(guestId: s.pathParameters['gid']!)),
                    GoRoute(path: 'contacts', builder: (_, s) => ContactLogsScreen(guestId: s.pathParameters['gid']!)),
                  ],
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/learn',
              builder: (_, _) => const LearnScreen(),
              routes: [
                GoRoute(
                  path: 'members/:mid',
                  builder: (_, s) => MemberPathwayScreen(memberId: s.pathParameters['mid']!),
                ),
                GoRoute(
                  path: 'pathways/:pid',
                  builder: (_, s) => PathwayDetailScreen(pathwayId: s.pathParameters['pid']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/me',
              builder: (_, _) => const MeScreen(),
              routes: [
                GoRoute(path: 'profile', builder: (_, _) => const EditProfileScreen()),
                GoRoute(path: 'password', builder: (_, _) => const ChangePasswordScreen()),
                GoRoute(path: 'speeches', builder: (_, _) => const MySpeechesScreen()),
                GoRoute(path: 'delete-account', builder: (_, _) => const DeleteAccountScreen()),
                GoRoute(
                  path: 'club-admin',
                  builder: (_, _) => const ClubAdminScreen(),
                  routes: [
                    GoRoute(path: 'members', builder: (_, _) => const MembersAdminScreen()),
                    GoRoute(path: 'permissions', builder: (_, _) => const PermissionsScreen()),
                    GoRoute(path: 'profile', builder: (_, _) => const ClubProfileScreen()),
                  ],
                ),
                GoRoute(
                  path: 'pathway/:mid',
                  builder: (_, s) => MemberPathwayScreen(memberId: s.pathParameters['mid']!),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/org',
              builder: (_, _) => const OrgTreeScreen(),
              routes: [
                GoRoute(
                  path: ':level/:parentId',
                  builder: (_, s) => OrgTreeScreen(
                    level: OrgLevel.values.byName(s.pathParameters['level']!),
                    parentId: s.pathParameters['parentId'],
                    title: s.uri.queryParameters['title'],
                  ),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/users',
              builder: (_, _) => const UsersScreen(),
              routes: [
                GoRoute(path: 'whatsapp', builder: (_, _) => const WhatsappScreen()),
              ],
            ),
          ]),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(),
      body: const Center(child: Text('That page does not exist.')),
    ),
  );
});
