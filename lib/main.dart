import 'package:flutter/material.dart';

import 'app.dart';
import 'services/local_db.dart';
import 'services/seed_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Local-first storage (Hive). Firebase gets initialized here later —
  // see README for the staged Firebase integration plan.
  await LocalStore.init();
  // Seed realistic demo data on first launch.
  await SeedService().seedIfEmpty();
  runApp(const EventHubApp());
}
