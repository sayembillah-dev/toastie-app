import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/domain/my_roles.dart';

void main() {
  test('a role with a live tool wins over a speech', () {
    final step = myNextStep(const [
      MyRole('Speaker 1', toolRoute: 'speakers/s1', kind: MyRoleKind.speaker),
      MyRole('Timer', toolRoute: 'timer'),
    ]);
    expect(step.label, 'Open my Timer');
    expect(step.route, 'timer');
  });

  test('a speech wins over a role without a tool', () {
    final step = myNextStep(const [
      MyRole('Toastmaster of the Day'),
      MyRole('Speaker 2', toolRoute: 'speakers/s2', kind: MyRoleKind.speaker),
    ]);
    expect(step.label, 'My speech details');
    expect(step.route, 'speakers/s2');
  });

  test('an evaluator goes to the speaker they evaluate', () {
    final step = myNextStep(const [
      MyRole('Evaluator 1', toolRoute: 'speakers/s1', kind: MyRoleKind.evaluator),
    ]);
    expect(step.label, 'My evaluation');
    expect(step.route, 'speakers/s1');
  });

  test('a role without a tool opens the roles screen', () {
    final step = myNextStep(const [MyRole('General Evaluator')]);
    expect(step.label, 'See my role');
    expect(step.route, 'roles');
  });

  test('no role invites the member to take one', () {
    final step = myNextStep(const []);
    expect(step.label, 'Take a role');
    expect(step.route, 'roles');
  });
}
