import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:eventhub/theme/app_colors.dart';
import 'package:eventhub/theme/app_theme.dart';

void main() {
  test('brand palette defines the primary color', () {
    expect(AppColors.primary, const Color(0xFF1A1A2E));
  });

  test('theme is Material 3 with a light scaffold', () {
    final theme = AppTheme.light();
    expect(theme.useMaterial3, isTrue);
    expect(theme.scaffoldBackgroundColor, AppColors.bg);
  });
}
