import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../routes/app_router.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/primary_button.dart';
import '../../widgets/role_card.dart';

class RoleSelectionScreen extends StatefulWidget {
  const RoleSelectionScreen({super.key, required this.uid});

  final String uid;

  @override
  State<RoleSelectionScreen> createState() => _RoleSelectionScreenState();
}

class _RoleSelectionScreenState extends State<RoleSelectionScreen> {
  final _nameController = TextEditingController();
  final Set<String> _selectedRoles = <String>{};
  bool _loading = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _toggleRole(String role) {
    setState(() {
      if (!_selectedRoles.remove(role)) {
        _selectedRoles.add(role);
      }
    });
  }

  Future<void> _continue() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your display name to continue.')),
      );
      return;
    }
    if (_selectedRoles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one role.')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<AuthService>().completeProfile(
            uid: widget.uid,
            name: name,
            roles: _selectedRoles.toList(),
          );
      if (!mounted) return;
      await AppRouter.routeAfterAuth(context, widget.uid);
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AuthService.friendlyMessage(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Choose your role')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'How will you use EventHub?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'You can choose both. You can add or change roles later.',
                style: TextStyle(fontSize: 14, color: AppColors.textMuted),
              ),
              const SizedBox(height: 28),
              TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  prefixIcon: Icon(Icons.person_outline, size: 20),
                ),
              ),
              const SizedBox(height: 28),
              RoleCard(
                role: 'Attendee',
                icon: Icons.people_outline,
                description: 'Discover events, RSVP and join the celebration.',
                selected: _selectedRoles.contains('attendee'),
                onTap: () => _toggleRole('attendee'),
              ),
              const SizedBox(height: 12),
              RoleCard(
                role: 'Organizer',
                icon: Icons.calendar_month_outlined,
                description: 'Create events, manage guest lists and send invites.',
                selected: _selectedRoles.contains('organizer'),
                onTap: () => _toggleRole('organizer'),
              ),
              const SizedBox(height: 36),
              PrimaryButton(
                label: 'Continue',
                icon: Icons.arrow_forward_outlined,
                loading: _loading,
                onPressed: _continue,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
