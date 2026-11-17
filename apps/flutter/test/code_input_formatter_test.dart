import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/features/auth/auth_widgets.dart';

TextEditingValue _v(String t) => TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));

String _apply(String prev, String next) => CodeInputFormatter().formatEditUpdate(_v(prev), _v(next)).text;

void main() {
  test('keeps typed digits', () {
    expect(_apply('12', '123'), '123');
  });

  test('strips spaces and words from a paste', () {
    expect(_apply('', '123 456'), '123456');
    expect(_apply('', 'Your code is 123-456.'), '123456');
  });

  test('a pasted code replaces a part-typed one', () {
    expect(_apply('12', '12987654'), '987654');
    expect(_apply('123456', '123456987654'), '987654');
  });

  test('never goes past six digits', () {
    expect(_apply('123456', '1234567'), '123456');
  });

  test('ignores letters', () {
    expect(_apply('12', '12a'), '12');
  });
}
